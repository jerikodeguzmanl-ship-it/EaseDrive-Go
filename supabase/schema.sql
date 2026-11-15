-- EaseDrive Go: schema + RLS + server-side pricing/booking. Run in Supabase SQL editor.
create extension if not exists btree_gist;
create type app_role as enum ('customer','owner','admin');
create type partner_status as enum ('Submitted','Under Review','Documents Required','Awaiting Agreement','Approved','Rejected','Suspended');
create type booking_status as enum ('Pending','Under Review','Approved','Confirmed','Rejected','Cancelled','Completed','Expired');
create type listing_status as enum ('Draft','Pending Review','Published','Unavailable','Rejected','Archived');
create type service_type as enum ('self_drive','with_driver');

create table profiles(id uuid primary key references auth.users on delete cascade, full_name text, phone text, role app_role not null default 'customer', created_at timestamptz default now());
create table partner_applications(id uuid primary key default gen_random_uuid(), applicant_id uuid not null references profiles, business_name text not null, owner_name text not null, email text, phone text, address text, description text, vehicle_count int, status partner_status not null default 'Submitted', admin_notes text, created_at timestamptz default now());
create table business_owners(id uuid primary key default gen_random_uuid(), profile_id uuid unique not null references profiles, application_id uuid references partner_applications, business_name text not null, phone text, email text, address text, logo_path text, status partner_status not null default 'Approved', created_at timestamptz default now());
create table business_documents(id uuid primary key default gen_random_uuid(), application_id uuid not null references partner_applications on delete cascade, kind text not null, storage_path text not null, verified boolean default false, created_at timestamptz default now());
create table partnership_contracts(id uuid primary key default gen_random_uuid(), application_id uuid not null references partner_applications, storage_path text, signed_at timestamptz, created_at timestamptz default now());
create table vehicles(id uuid primary key default gen_random_uuid(), owner_id uuid not null references business_owners, name text not null, brand text, model_year int, category text, transmission text, fuel text, seats int not null, luggage int, aircon boolean default true, description text, location text, features text[] default '{}', status listing_status not null default 'Draft', created_at timestamptz default now());
create table vehicle_images(id uuid primary key default gen_random_uuid(), vehicle_id uuid not null references vehicles on delete cascade, storage_path text not null, sort int default 0);
create table vehicle_rates(vehicle_id uuid primary key references vehicles on delete cascade, self_drive_rate numeric(10,2) not null check(self_drive_rate>=0), with_driver_rate numeric(10,2) not null check(with_driver_rate>=0), delivery_fee numeric(10,2) default 0, additional_fee numeric(10,2) default 0, additional_fee_label text default 'Service fee', tax_rate numeric(5,4) default 0.12, tax_inclusive boolean default false, deposit numeric(10,2) default 0, long_stay_days int default 5, long_stay_discount_pct numeric(5,2) default 0);
create table vehicle_availability(id uuid primary key default gen_random_uuid(), vehicle_id uuid not null references vehicles on delete cascade, period daterange not null, reason text not null check(reason in('Unavailable','Maintenance')), exclude using gist(vehicle_id with =, period with &&));
create table bookings(id uuid primary key default gen_random_uuid(), ref text unique not null default 'EDG-'||upper(substr(md5(random()::text),1,6)), customer_id uuid not null references profiles, vehicle_id uuid not null references vehicles, owner_id uuid not null references business_owners, service service_type not null, period daterange not null, pickup_time time, delivery boolean default false, passengers int, address text, notes text, status booking_status not null default 'Pending', reject_reason text, expires_at timestamptz, base numeric(10,2), delivery_fee numeric(10,2), extra_fee numeric(10,2), discount numeric(10,2), tax numeric(10,2), total numeric(10,2), deposit numeric(10,2), tax_inclusive boolean, created_at timestamptz default now(),
  exclude using gist(vehicle_id with =, period with &&) where (status in ('Approved','Confirmed')));
create table booking_charges(id uuid primary key default gen_random_uuid(), booking_id uuid not null references bookings on delete cascade, label text, amount numeric(10,2));
create table notifications(id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles, title text, body text, read boolean default false, created_at timestamptz default now());
create table messages(id uuid primary key default gen_random_uuid(), booking_id uuid references bookings, vehicle_id uuid references vehicles, sender_id uuid not null references profiles, recipient_id uuid not null references profiles, body text not null, created_at timestamptz default now());
create table reviews(id uuid primary key default gen_random_uuid(), booking_id uuid unique not null references bookings, vehicle_id uuid not null references vehicles, customer_id uuid not null references profiles, rating int check(rating between 1 and 5), comment text, created_at timestamptz default now());
create table transactions(id uuid primary key default gen_random_uuid(), booking_id uuid references bookings, amount numeric(10,2), kind text, status text, created_at timestamptz default now());
create table activity_logs(id bigserial primary key, actor_id uuid, action text, entity text, entity_id text, meta jsonb, created_at timestamptz default now());
create table platform_settings(key text primary key, value jsonb);
create table hero_images(id uuid primary key default gen_random_uuid(), storage_path text not null, sort int default 0);
insert into platform_settings values('pending_expiry_hours','24');

-- helpers
create function app_role_of(u uuid) returns app_role language sql security definer stable set search_path=public as $$select role from profiles where id=u$$;
create function is_admin() returns boolean language sql security definer stable set search_path=public as $$select coalesce(app_role_of(auth.uid())='admin',false)$$;
create function my_owner() returns uuid language sql security definer stable set search_path=public as $$select id from business_owners where profile_id=auth.uid() and status='Approved'$$;
create function log_act(a text,e text,i text,m jsonb default '{}') returns void language sql security definer set search_path=public as $$insert into activity_logs(actor_id,action,entity,entity_id,meta) values(auth.uid(),a,e,i,m)$$;
create function handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$begin insert into profiles(id,full_name) values(new.id,new.raw_user_meta_data->>'full_name'); return new; end$$;
create trigger on_signup after insert on auth.users for each row execute function handle_new_user();
-- only approved owners may publish
create function check_publish() returns trigger language plpgsql as $$begin if new.status='Published' and not exists(select 1 from business_owners where id=new.owner_id and status='Approved') then raise exception 'Owner not approved'; end if; return new; end$$;
create trigger vehicles_publish before insert or update on vehicles for each row execute function check_publish();

-- server-side pricing (never trust client totals)
create function quote_booking(p_vehicle uuid,p_service service_type,p_start date,p_end date,p_delivery boolean) returns jsonb language plpgsql security definer stable set search_path=public as $$
declare r vehicle_rates; d int; rate numeric; base numeric; del numeric; ext numeric; disc numeric; taxable numeric; vat numeric; tot numeric;
begin select * into r from vehicle_rates where vehicle_id=p_vehicle; if not found then raise exception 'No rates'; end if;
 d:=p_end-p_start+1; if d<1 then raise exception 'Invalid dates'; end if;
 rate:=case p_service when 'self_drive' then r.self_drive_rate else r.with_driver_rate end;
 base:=rate*d; del:=case when p_delivery then r.delivery_fee else 0 end; ext:=r.additional_fee;
 disc:=case when d>=r.long_stay_days then round(base*r.long_stay_discount_pct/100,2) else 0 end;
 taxable:=base+del+ext-disc;
 if r.tax_inclusive then vat:=round(taxable*r.tax_rate/(1+r.tax_rate),2); tot:=taxable; -- VAT already inside, not added again
 else vat:=round(taxable*r.tax_rate,2); tot:=taxable+vat; end if;
 return jsonb_build_object('rate',rate,'days',d,'base',base,'delivery_fee',del,'extra_fee',ext,'discount',disc,'tax',vat,'tax_inclusive',r.tax_inclusive,'total',tot,'deposit',r.deposit,'estimate',true);
end$$;

-- public availability without private customer data
create function vehicle_busy(p_vehicle uuid) returns table(period daterange,kind text) language sql security definer stable set search_path=public as $$
 select period,case when status in('Approved','Confirmed') then 'Confirmed' else 'Pending' end from bookings where vehicle_id=p_vehicle and (status in('Approved','Confirmed') or (status in('Pending','Under Review') and expires_at>now()))
 union all select period,reason from vehicle_availability where vehicle_id=p_vehicle$$;

create function create_booking(p_vehicle uuid,p_service service_type,p_start date,p_end date,p_delivery boolean,p_time time,p_pass int,p_addr text,p_notes text) returns bookings language plpgsql security definer set search_path=public as $$
declare v vehicles; q jsonb; b bookings; per daterange:=daterange(p_start,p_end,'[]'); hrs int;
begin if auth.uid() is null then raise exception 'Login required'; end if;
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

create function decide_booking(p_id uuid,p_approve boolean,p_reason text default null) returns bookings language plpgsql security definer set search_path=public as $$
declare b bookings;
begin select * into b from bookings where id=p_id; if not found then raise exception 'Not found'; end if;
 if not (is_admin() or b.owner_id=my_owner()) then raise exception 'Forbidden'; end if;
 if b.status not in('Pending','Under Review') or b.expires_at<now() then raise exception 'Not pending'; end if;
 -- exclusion constraint rejects overlapping confirmed bookings even under race conditions
 update bookings set status=case when p_approve then 'Confirmed' else 'Rejected' end::booking_status, reject_reason=p_reason where id=p_id returning * into b;
 insert into notifications(user_id,title,body) values(b.customer_id,'Booking '||b.status,b.ref);
 perform log_act('booking_'||lower(b.status::text),'booking',b.id::text); return b;
end$$;

create function cancel_booking(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin update bookings set status='Cancelled' where id=p_id and (customer_id=auth.uid() or is_admin()) and status in('Pending','Under Review','Approved','Confirmed'); if not found then raise exception 'Cannot cancel'; end if; end$$;

create function expire_pending() returns int language sql security definer set search_path=public as $$
 with x as(update bookings set status='Expired' where status in('Pending','Under Review') and expires_at<now() returning 1) select count(*)::int from x$$;
-- schedule: select cron.schedule('expire','*/10 * * * *','select expire_pending()');  (enable pg_cron)

create function approve_partner(p_app uuid) returns void language plpgsql security definer set search_path=public as $$
declare a partner_applications;
begin if not is_admin() then raise exception 'Admin only'; end if;
 select * into a from partner_applications where id=p_app; update partner_applications set status='Approved' where id=p_app;
 insert into business_owners(profile_id,application_id,business_name,phone,email,address) values(a.applicant_id,a.id,a.business_name,a.phone,a.email,a.address) on conflict(profile_id) do update set status='Approved';
 update profiles set role='owner' where id=a.applicant_id and role<>'admin'; perform log_act('partner_approved','application',p_app::text);
end$$;

revoke execute on all functions in schema public from public, anon;
grant execute on function quote_booking, vehicle_busy to anon, authenticated;
grant execute on function create_booking, decide_booking, cancel_booking, approve_partner to authenticated;

-- RLS
alter table profiles enable row level security; alter table partner_applications enable row level security; alter table business_owners enable row level security; alter table business_documents enable row level security; alter table partnership_contracts enable row level security; alter table vehicles enable row level security; alter table vehicle_images enable row level security; alter table vehicle_rates enable row level security; alter table vehicle_availability enable row level security; alter table bookings enable row level security; alter table booking_charges enable row level security; alter table notifications enable row level security; alter table messages enable row level security; alter table reviews enable row level security; alter table transactions enable row level security; alter table activity_logs enable row level security; alter table platform_settings enable row level security; alter table hero_images enable row level security;
create policy p_sel on profiles for select using(id=auth.uid() or is_admin());
create policy p_upd on profiles for update using(id=auth.uid()) with check(id=auth.uid() and role=app_role_of(auth.uid())); -- cannot self-promote
create policy pa_all on partner_applications for all using(applicant_id=auth.uid() or is_admin()) with check((applicant_id=auth.uid() and status='Submitted') or is_admin());
create policy bo_sel on business_owners for select using(status='Approved' or profile_id=auth.uid() or is_admin());
create policy bo_adm on business_owners for all using(is_admin()) with check(is_admin());
create policy bd_all on business_documents for all using(is_admin() or exists(select 1 from partner_applications a where a.id=application_id and a.applicant_id=auth.uid())) with check(exists(select 1 from partner_applications a where a.id=application_id and a.applicant_id=auth.uid()) or is_admin());
create policy pc_adm on partnership_contracts for all using(is_admin()) with check(is_admin());
create policy v_sel on vehicles for select using(status='Published' or owner_id=my_owner() or is_admin());
create policy v_own on vehicles for all using(owner_id=my_owner() or is_admin()) with check(owner_id=my_owner() or is_admin());
create policy vi_sel on vehicle_images for select using(true);
create policy vi_own on vehicle_images for all using(exists(select 1 from vehicles v where v.id=vehicle_id and (v.owner_id=my_owner() or is_admin()))) with check(exists(select 1 from vehicles v where v.id=vehicle_id and (v.owner_id=my_owner() or is_admin())));
create policy vr_sel on vehicle_rates for select using(exists(select 1 from vehicles v where v.id=vehicle_id and (v.status='Published' or v.owner_id=my_owner() or is_admin())));
create policy vr_own on vehicle_rates for all using(exists(select 1 from vehicles v where v.id=vehicle_id and (v.owner_id=my_owner() or is_admin()))) with check(exists(select 1 from vehicles v where v.id=vehicle_id and (v.owner_id=my_owner() or is_admin())));
create policy va_own on vehicle_availability for all using(exists(select 1 from vehicles v where v.id=vehicle_id and (v.owner_id=my_owner() or is_admin()))) with check(exists(select 1 from vehicles v where v.id=vehicle_id and (v.owner_id=my_owner() or is_admin())));
create policy b_sel on bookings for select using(customer_id=auth.uid() or owner_id=my_owner() or is_admin()); -- writes only via functions
create policy bc_sel on booking_charges for select using(exists(select 1 from bookings b where b.id=booking_id and (b.customer_id=auth.uid() or b.owner_id=my_owner() or is_admin())));
create policy n_own on notifications for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy m_sel on messages for select using(sender_id=auth.uid() or recipient_id=auth.uid() or is_admin());
create policy m_ins on messages for insert with check(sender_id=auth.uid());
create policy r_sel on reviews for select using(true);
create policy r_ins on reviews for insert with check(customer_id=auth.uid() and exists(select 1 from bookings b where b.id=booking_id and b.customer_id=auth.uid() and b.status='Completed'));
create policy t_sel on transactions for select using(is_admin() or exists(select 1 from bookings b where b.id=booking_id and b.owner_id=my_owner()));
create policy l_adm on activity_logs for select using(is_admin());
create policy s_sel on platform_settings for select using(true);
create policy s_adm on platform_settings for all using(is_admin()) with check(is_admin());
create policy h_sel on hero_images for select using(true);
create policy h_adm on hero_images for all using(is_admin()) with check(is_admin());

-- Storage: create buckets 'hero' and 'vehicles' (public) and 'documents' (PRIVATE) in dashboard, then:
create policy doc_ins on storage.objects for insert to authenticated with check(bucket_id='documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy doc_sel on storage.objects for select to authenticated using(bucket_id='documents' and ((storage.foldername(name))[1]=auth.uid()::text or is_admin()));
-- First admin: after signing up, run: update profiles set role='admin' where id='<your-user-uuid>';
