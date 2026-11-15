-- Starter tests: run on a SCRATCH database (ends with ROLLBACK). Adjust if your auth.users needs more columns.
begin;
update platform_settings set value='false' where key='require_vehicle_review';
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-0000000000a1','admin@t'),('00000000-0000-0000-0000-0000000000a2','o1@t'),
 ('00000000-0000-0000-0000-0000000000a3','o2@t'),('00000000-0000-0000-0000-0000000000a4','c1@t'),('00000000-0000-0000-0000-0000000000a5','c2@t');
update profiles set role='admin' where id='00000000-0000-0000-0000-0000000000a1';
update profiles set role='owner' where id in('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a3');
insert into business_owners(id,profile_id,business_name) values
 ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000a2','Owner One'),
 ('00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000a3','Owner Two');
insert into vehicles(id,owner_id,name,seats,status) values('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000b2','Vios',5,'Published');
insert into vehicle_rates(vehicle_id,self_drive_rate,with_driver_rate,delivery_fee,additional_fee,long_stay_days,long_stay_discount_pct) values('00000000-0000-0000-0000-0000000000c1',1600,2000,300,150,5,5);
create function pg_temp.as_user(u uuid) returns void language plpgsql as $$begin perform set_config('request.jwt.claim.sub',u::text,true); perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true); set local role authenticated; end$$;

do $$ declare q jsonb; b1 bookings; b2 bookings; ok boolean; n int;
begin
 -- #10 pricing: 3 days self drive = 4800 + 150 fee = 4950, VAT 12% = 594, total 5544
 q:=quote_booking('00000000-0000-0000-0000-0000000000c1','self_drive',current_date+10,current_date+12,false);
 assert (q->>'total')::numeric=5544, 'pricing total wrong: '||q;
 -- #1 two customers, overlapping dates: both may request, only one can be confirmed
 perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
 b1:=create_booking('00000000-0000-0000-0000-0000000000c1','self_drive',current_date+10,current_date+12,false,'09:00',2,'x','');
 reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a5');
 b2:=create_booking('00000000-0000-0000-0000-0000000000c1','self_drive',current_date+11,current_date+13,false,'09:00',2,'x','');
 reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
 perform decide_booking(b1.id,true);
 begin perform decide_booking(b2.id,true); ok:=false; exception when others then ok:=true; end;
 assert ok, 'double booking was NOT prevented';
 -- #11 booking live location is opt-in and admin cannot read coordinates
 reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
 perform admin_set_booking_location_sharing(b1.id,true);
 select count(*) into n from booking_live_locations;
 assert n=0, 'admin can read live coordinates';
 reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
 perform share_booking_live_location(b1.id,14.4,120.9,10,'Cavite');
 select count(*) into n from booking_live_locations;
 assert n=1, 'customer cannot read their booking location';
 reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
 perform share_booking_live_location(b1.id,14.5,121.0,5);
 select count(*) into n from booking_live_locations;
 assert n=2, 'partner cannot read both booking locations';
 select count(*) into n from booking_live_locations
   where user_id='00000000-0000-0000-0000-0000000000a4' and location_label='Cavite';
 assert n=1, 'customer location label was not shared with the assigned partner';
 reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
 select count(*) into n from booking_live_locations;
 assert n=0, 'admin can read live coordinates';
 reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
 select count(*) into n from booking_live_locations;
 assert n=0, 'unrelated partner can read live coordinates';
 reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
 perform admin_set_booking_location_sharing(b1.id,false);
 reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
 select count(*) into n from booking_live_locations;
 assert n=0, 'disabling sharing did not remove coordinates';
 begin perform share_booking_live_location(b1.id,14.4,120.9,10); ok:=false; exception when others then ok:=true; end;
 assert ok, 'location sharing continued after admin disabled it';
 insert into customer_location_preferences(user_id,location_label)
 values('00000000-0000-0000-0000-0000000000a4','Cavite');
 select count(*) into n from customer_location_preferences;
 assert n=1, 'customer cannot read their saved location';
 reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
 select count(*) into n from customer_location_preferences;
 assert n=0, 'partner can read private location preferences';
 reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
 select count(*) into n from customer_location_preferences;
 assert n=0, 'admin can read private location preferences';
 -- #2 unavailable dates are refused for new requests
 reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a5');
 begin perform create_booking('00000000-0000-0000-0000-0000000000c1','self_drive',current_date+10,current_date+11,false,'09:00',2,'x',''); ok:=false; exception when others then ok:=true; end;
 assert ok, 'booked dates accepted';
 -- #5 owner two cannot see owner one bookings
 reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
 select count(*) into n from bookings; assert n=0, 'owner two sees other bookings';
 -- #6 unapproved partner cannot publish
 reset role; update business_owners set status='Suspended' where id='00000000-0000-0000-0000-0000000000b3';
 begin insert into vehicles(owner_id,name,seats,status) values('00000000-0000-0000-0000-0000000000b3','X',4,'Published'); ok:=false; exception when others then ok:=true; end;
 assert ok, 'suspended owner published';
 raise notice 'ALL SCENARIO CHECKS PASSED';
end$$;
rollback;
