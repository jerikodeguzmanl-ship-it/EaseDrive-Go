-- Run AFTER schema.sql. Adds admin workflows, hardening, messaging, vehicle review, date blocking.
alter table profiles add column if not exists suspended boolean not null default false;
insert into platform_settings values('require_vehicle_review','true') on conflict do nothing;

-- Hardening: users can only edit their own name/phone (not role/suspended)
revoke update on profiles from authenticated; grant update(full_name,phone) on profiles to authenticated;
drop policy pa_all on partner_applications;
create policy pa_sel on partner_applications for select using(applicant_id=auth.uid() or is_admin());
create policy pa_ins on partner_applications for insert with check(applicant_id=auth.uid() and status='Submitted');
create policy pa_adm on partner_applications for all using(is_admin()) with check(is_admin());
drop policy bd_all on business_documents;
create policy bd_sel on business_documents for select using(is_admin() or exists(select 1 from partner_applications a where a.id=application_id and a.applicant_id=auth.uid()));
create policy bd_ins on business_documents for insert with check(verified=false and exists(select 1 from partner_applications a where a.id=application_id and a.applicant_id=auth.uid()));
create policy bd_adm on business_documents for all using(is_admin()) with check(is_admin());
drop policy m_ins on messages; -- messages only through send_message()

create or replace function check_publish() returns trigger language plpgsql security definer set search_path=public as $$
declare rv boolean;
begin
 if new.status='Rejected' and not is_admin() then raise exception 'Admin only'; end if;
 if new.status='Published' then
  if not exists(select 1 from business_owners where id=new.owner_id and status='Approved') then raise exception 'Owner not approved'; end if;
  select (value#>>'{}')::boolean into rv from platform_settings where key='require_vehicle_review';
  if coalesce(rv,true) and not is_admin() and (tg_op='INSERT' or old.status is distinct from 'Published') then new.status:='Pending Review'; end if;
 end if; return new;
end$$;

create function block_suspended() returns trigger language plpgsql security definer set search_path=public as $$
begin if exists(select 1 from profiles where id=new.customer_id and suspended) then raise exception 'Account suspended'; end if; return new; end$$;
create trigger bk_susp before insert on bookings for each row execute function block_suspended();

create function create_vehicle(p jsonb) returns vehicles language plpgsql security definer set search_path=public as $$
declare o uuid:=my_owner(); v vehicles;
begin if o is null then raise exception 'Approved partners only'; end if;
 insert into vehicles(owner_id,name,brand,model_year,category,transmission,fuel,seats,luggage,aircon,description,location,features,status)
 values(o,p->>'name',p->>'brand',(p->>'model_year')::int,p->>'category',p->>'transmission',p->>'fuel',(p->>'seats')::int,(p->>'luggage')::int,coalesce((p->>'aircon')::boolean,true),p->>'description',p->>'location',coalesce(array(select jsonb_array_elements_text(p->'features')),'{}'),(case when p->>'status'='Published' then 'Published' else 'Draft' end)::listing_status) returning * into v;
 insert into vehicle_rates(vehicle_id,self_drive_rate,with_driver_rate,delivery_fee,additional_fee,tax_rate,tax_inclusive,deposit,long_stay_days,long_stay_discount_pct)
 values(v.id,(p->>'self_drive_rate')::numeric,(p->>'with_driver_rate')::numeric,coalesce((p->>'delivery_fee')::numeric,0),coalesce((p->>'additional_fee')::numeric,0),coalesce((p->>'tax_rate')::numeric,0.12),coalesce((p->>'tax_inclusive')::boolean,false),coalesce((p->>'deposit')::numeric,0),coalesce((p->>'long_stay_days')::int,5),coalesce((p->>'long_stay_discount_pct')::numeric,0));
 perform log_act('vehicle_created','vehicle',v.id::text); return v;
end$$;

create function set_application_status(p_app uuid,p_status partner_status,p_notes text default null) returns void language plpgsql security definer set search_path=public as $$
begin if not is_admin() then raise exception 'Admin only'; end if;
 if p_status='Approved' then
  if not exists(select 1 from partnership_contracts where application_id=p_app and signed_at is not null) then raise exception 'Signed contract required'; end if;
  perform approve_partner(p_app);
 else update partner_applications set status=p_status,admin_notes=coalesce(p_notes,admin_notes) where id=p_app; end if;
 perform log_act('application_status','application',p_app::text,jsonb_build_object('status',p_status,'notes',p_notes));
end$$;

create function set_partner_status(p_owner uuid,p_status partner_status) returns void language plpgsql security definer set search_path=public as $$
begin if not is_admin() then raise exception 'Admin only'; end if;
 if p_status not in('Approved','Suspended') then raise exception 'Use Approved or Suspended'; end if;
 update business_owners set status=p_status where id=p_owner;
 if p_status='Suspended' then update vehicles set status='Unavailable' where owner_id=p_owner and status in('Published','Pending Review'); end if;
 perform log_act('partner_'||lower(p_status::text),'business_owner',p_owner::text);
end$$;

create function review_vehicle(p_vehicle uuid,p_approve boolean) returns void language plpgsql security definer set search_path=public as $$
begin if not is_admin() then raise exception 'Admin only'; end if;
 update vehicles set status=(case when p_approve then 'Published' else 'Rejected' end)::listing_status where id=p_vehicle;
 perform log_act('vehicle_review','vehicle',p_vehicle::text,jsonb_build_object('approved',p_approve));
end$$;

create function admin_suspend_user(p_user uuid,p_flag boolean) returns void language plpgsql security definer set search_path=public as $$
begin if not is_admin() then raise exception 'Admin only'; end if;
 update profiles set suspended=p_flag where id=p_user;
 update business_owners set status=(case when p_flag then 'Suspended' else 'Approved' end)::partner_status where profile_id=p_user;
 perform log_act('user_suspend','profile',p_user::text,jsonb_build_object('suspended',p_flag));
end$$;

create function block_dates(p_vehicle uuid,p_start date,p_end date,p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare per daterange:=daterange(p_start,p_end,'[]');
begin if not exists(select 1 from vehicles where id=p_vehicle and (owner_id=my_owner() or is_admin())) then raise exception 'Forbidden'; end if;
 if exists(select 1 from bookings where vehicle_id=p_vehicle and period&&per and status in('Approved','Confirmed')) then raise exception 'Overlaps a confirmed booking'; end if;
 insert into vehicle_availability(vehicle_id,period,reason) values(p_vehicle,per,p_reason);
end$$;

create function complete_booking(p_id uuid) returns bookings language plpgsql security definer set search_path=public as $$
declare b bookings;
begin select * into b from bookings where id=p_id; if not found then raise exception 'Not found'; end if;
 if not (is_admin() or b.owner_id=my_owner()) then raise exception 'Forbidden'; end if;
 if b.status<>'Confirmed' or lower(b.period)>current_date then raise exception 'Cannot complete yet'; end if;
 update bookings set status='Completed' where id=p_id returning * into b;
 insert into notifications(user_id,title,body) values(b.customer_id,'Rental completed',b.ref);
 perform log_act('booking_completed','booking',p_id::text); return b;
end$$;

create function send_message(p_booking uuid,p_body text) returns messages language plpgsql security definer set search_path=public as $$
declare b bookings; r uuid; m messages;
begin select * into b from bookings where id=p_booking; if not found then raise exception 'Not found'; end if;
 if auth.uid()=b.customer_id then select profile_id into r from business_owners where id=b.owner_id;
 elsif b.owner_id=my_owner() then r:=b.customer_id; else raise exception 'Forbidden'; end if;
 if length(trim(coalesce(p_body,'')))=0 or length(p_body)>2000 then raise exception 'Invalid message'; end if;
 insert into messages(booking_id,vehicle_id,sender_id,recipient_id,body) values(b.id,b.vehicle_id,auth.uid(),r,trim(p_body)) returning * into m;
 insert into notifications(user_id,title,body) values(r,'New message',b.ref); return m;
end$$;

revoke execute on function create_vehicle,set_application_status,set_partner_status,review_vehicle,admin_suspend_user,block_dates,complete_booking,send_message from public,anon;
grant execute on function create_vehicle,set_application_status,set_partner_status,review_vehicle,admin_suspend_user,block_dates,complete_booking,send_message to authenticated;
