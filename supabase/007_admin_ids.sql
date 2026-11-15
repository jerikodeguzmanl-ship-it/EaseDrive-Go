-- Run after 006_profile_backfill.sql. Admin full control + customer valid ID. Safe to re-run.
insert into storage.buckets(id,name,public) values('hero','hero',true),('vehicles','vehicles',true),('documents','documents',false),('ids','ids',false) on conflict (id) do update set public=excluded.public;
alter table profiles add column if not exists email text;
update profiles p set email=u.email from auth.users u where u.id=p.id and p.email is null;
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$begin insert into profiles(id,full_name,email) values(new.id,new.raw_user_meta_data->>'full_name',new.email) on conflict (id) do nothing; return new; end$$;

create table if not exists customer_ids(id uuid primary key default gen_random_uuid(), customer_id uuid not null references profiles on delete cascade, id_type text not null, storage_path text not null, status text not null default 'Pending' check(status in('Pending','Verified','Rejected')), reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz default now());
alter table customer_ids enable row level security;
drop policy if exists ci_ins on customer_ids; drop policy if exists ci_sel on customer_ids; drop policy if exists ci_del on customer_ids;
create policy ci_ins on customer_ids for insert with check(customer_id=auth.uid() and status='Pending');
create policy ci_sel on customer_ids for select using(customer_id=auth.uid() or is_admin() or exists(select 1 from bookings b where b.customer_id=customer_ids.customer_id and b.owner_id=my_owner()));
create policy ci_del on customer_ids for delete using(is_admin());
drop policy if exists ids_ins on storage.objects; drop policy if exists ids_sel on storage.objects; drop policy if exists veh_up on storage.objects;
create policy ids_ins on storage.objects for insert to authenticated with check(bucket_id='ids' and (storage.foldername(name))[1]=auth.uid()::text);
create policy ids_sel on storage.objects for select to authenticated using(bucket_id='ids' and ((storage.foldername(name))[1]=auth.uid()::text or is_admin() or exists(select 1 from bookings b where b.customer_id::text=(storage.foldername(name))[1] and b.owner_id=my_owner())));
create policy veh_up on storage.objects for insert to authenticated with check(bucket_id='vehicles' and (storage.foldername(name))[1]=auth.uid()::text and (my_owner() is not null or is_admin()));

create or replace function review_id(p_id uuid,p_ok boolean) returns void language plpgsql security definer set search_path=public as $$
declare c uuid;
begin select customer_id into c from customer_ids where id=p_id; if c is null then raise exception 'Not found'; end if;
 if not (is_admin() or exists(select 1 from bookings b where b.customer_id=c and b.owner_id=my_owner())) then raise exception 'Forbidden'; end if;
 update customer_ids set status=case when p_ok then 'Verified' else 'Rejected' end, reviewed_by=auth.uid(), reviewed_at=now() where id=p_id;
 insert into notifications(user_id,title,body) values(c,case when p_ok then 'Your ID was verified' else 'Your ID was rejected. Please upload a new valid ID.' end,'');
 perform log_act('id_review','customer_id',p_id::text,jsonb_build_object('ok',p_ok));
end$$;

create or replace function admin_delete_user(p_user uuid) returns void language plpgsql security definer set search_path=public as $$
begin if not is_admin() then raise exception 'Admin only'; end if;
 if p_user=auth.uid() then raise exception 'You cannot delete your own account'; end if;
 if exists(select 1 from bookings where customer_id=p_user) then raise exception 'This customer has bookings. Suspend the account instead.'; end if;
 if exists(select 1 from business_owners where profile_id=p_user) then raise exception 'This user is a partner. Delete the partner first.'; end if;
 delete from messages where sender_id=p_user or recipient_id=p_user; delete from notifications where user_id=p_user; delete from reviews where customer_id=p_user; delete from partner_applications where applicant_id=p_user;
 delete from auth.users where id=p_user; perform log_act('user_deleted','profile',p_user::text);
end$$;

create or replace function admin_delete_partner(p_owner uuid) returns void language plpgsql security definer set search_path=public as $$
declare pid uuid;
begin if not is_admin() then raise exception 'Admin only'; end if;
 if exists(select 1 from bookings where owner_id=p_owner) then raise exception 'This partner has bookings. Suspend instead of deleting.'; end if;
 select profile_id into pid from business_owners where id=p_owner; delete from vehicles where owner_id=p_owner; delete from business_owners where id=p_owner;
 update profiles set role='customer' where id=pid and role='owner'; perform log_act('partner_deleted','business_owner',p_owner::text);
end$$;

create or replace function admin_delete_vehicle(p_vehicle uuid) returns void language plpgsql security definer set search_path=public as $$
begin if not is_admin() then raise exception 'Admin only'; end if;
 if exists(select 1 from bookings where vehicle_id=p_vehicle) then raise exception 'This vehicle has bookings. Archive it instead.'; end if;
 delete from vehicles where id=p_vehicle; perform log_act('vehicle_deleted','vehicle',p_vehicle::text);
end$$;

create or replace function admin_delete_booking(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin if not is_admin() then raise exception 'Admin only'; end if;
 if not exists(select 1 from bookings where id=p_id and status in('Cancelled','Rejected','Expired','Completed')) then raise exception 'Only cancelled, rejected, expired or completed bookings can be deleted. Cancel it first.'; end if;
 delete from messages where booking_id=p_id; delete from reviews where booking_id=p_id; delete from transactions where booking_id=p_id; delete from bookings where id=p_id;
 perform log_act('booking_deleted','booking',p_id::text);
end$$;

revoke execute on function review_id,admin_delete_user,admin_delete_partner,admin_delete_vehicle,admin_delete_booking from public,anon;
grant execute on function review_id,admin_delete_user,admin_delete_partner,admin_delete_vehicle,admin_delete_booking to authenticated;

-- Replaced functions (same signatures as before)
create or replace function create_booking(p_vehicle uuid,p_service service_type,p_start date,p_end date,p_delivery boolean,p_time time,p_pass int,p_addr text,p_notes text) returns bookings language plpgsql security definer set search_path=public as $$
declare v vehicles; q jsonb; b bookings; per daterange:=daterange(p_start,p_end,'[]'); hrs int;
begin if auth.uid() is null then raise exception 'Login required'; end if;
 if not exists(select 1 from customer_ids where customer_id=auth.uid() and status<>'Rejected') then raise exception 'Upload a valid ID before booking'; end if;
 select * into v from vehicles where id=p_vehicle and status='Published'; if not found then raise exception 'Vehicle unavailable'; end if;
 if not exists(select 1 from business_owners where id=v.owner_id and status='Approved') then raise exception 'Partner not active'; end if;
 if p_start<current_date then raise exception 'Past date'; end if;
 if p_pass>v.seats then raise exception 'Too many passengers'; end if;
 if exists(select 1 from vehicle_availability where vehicle_id=p_vehicle and period&&per) or exists(select 1 from bookings where vehicle_id=p_vehicle and period&&per and status in('Approved','Confirmed')) then raise exception 'Dates not available'; end if;
 q:=quote_booking(p_vehicle,p_service,p_start,p_end,p_delivery);
 select (value#>>'{}')::int into hrs from platform_settings where key='pending_expiry_hours';
 insert into bookings(customer_id,vehicle_id,owner_id,service,period,pickup_time,delivery,passengers,address,notes,expires_at,base,delivery_fee,extra_fee,discount,tax,total,deposit,tax_inclusive)
 values(auth.uid(),p_vehicle,v.owner_id,p_service,per,p_time,p_delivery,p_pass,p_addr,p_notes,now()+make_interval(hours=>coalesce(hrs,24)),(q->>'base')::numeric,(q->>'delivery_fee')::numeric,(q->>'extra_fee')::numeric,(q->>'discount')::numeric,(q->>'tax')::numeric,(q->>'total')::numeric,(q->>'deposit')::numeric,(q->>'tax_inclusive')::boolean) returning * into b;
 insert into notifications(user_id,title,body) select profile_id,'New booking request',b.ref from business_owners where id=v.owner_id;
 perform log_act('booking_created','booking',b.id::text); return b;
end$$;

create or replace function decide_booking(p_id uuid,p_approve boolean,p_reason text default null) returns bookings language plpgsql security definer set search_path=public as $$
declare b bookings;
begin select * into b from bookings where id=p_id; if not found then raise exception 'Not found'; end if;
 if not (is_admin() or b.owner_id=my_owner()) then raise exception 'Forbidden'; end if;
 if p_approve and not exists(select 1 from customer_ids where customer_id=b.customer_id and status<>'Rejected') then raise exception 'Customer valid ID is required before approval'; end if;
 if b.status not in('Pending','Under Review') or b.expires_at<now() then raise exception 'Not pending'; end if;
 -- exclusion constraint rejects overlapping confirmed bookings even under race conditions
 update bookings set status=case when p_approve then 'Confirmed' else 'Rejected' end::booking_status, reject_reason=p_reason where id=p_id returning * into b;
 insert into notifications(user_id,title,body) values(b.customer_id,'Booking '||b.status,b.ref);
 perform log_act('booking_'||lower(b.status::text),'booking',b.id::text); return b;
end$$;

create or replace function create_vehicle(p jsonb) returns vehicles language plpgsql security definer set search_path=public as $$
declare o uuid:=case when is_admin() and p->>'owner_id' is not null then (p->>'owner_id')::uuid else my_owner() end; v vehicles;
begin if o is null then raise exception 'Approved partners only'; end if;
 insert into vehicles(owner_id,name,brand,model_year,category,transmission,fuel,seats,luggage,aircon,description,location,features,status)
 values(o,p->>'name',p->>'brand',(p->>'model_year')::int,p->>'category',p->>'transmission',p->>'fuel',(p->>'seats')::int,(p->>'luggage')::int,coalesce((p->>'aircon')::boolean,true),p->>'description',p->>'location',coalesce(array(select jsonb_array_elements_text(p->'features')),'{}'),(case when p->>'status'='Published' then 'Published' else 'Draft' end)::listing_status) returning * into v;
 insert into vehicle_rates(vehicle_id,self_drive_rate,with_driver_rate,delivery_fee,additional_fee,tax_rate,tax_inclusive,deposit,long_stay_days,long_stay_discount_pct)
 values(v.id,(p->>'self_drive_rate')::numeric,(p->>'with_driver_rate')::numeric,coalesce((p->>'delivery_fee')::numeric,0),coalesce((p->>'additional_fee')::numeric,0),coalesce((p->>'tax_rate')::numeric,0.12),coalesce((p->>'tax_inclusive')::boolean,false),coalesce((p->>'deposit')::numeric,0),coalesce((p->>'long_stay_days')::int,5),coalesce((p->>'long_stay_discount_pct')::numeric,0));
 perform log_act('vehicle_created','vehicle',v.id::text); return v;
end$$;
