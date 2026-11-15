-- Run after 002_backend.sql. Lets partners see their own customers + storage upload rules.
create policy p_owner_sel on profiles for select using(exists(select 1 from bookings b where b.customer_id=profiles.id and b.owner_id=my_owner()));
create policy veh_up on storage.objects for insert to authenticated with check(bucket_id='vehicles' and (storage.foldername(name))[1]=auth.uid()::text and my_owner() is not null);
create policy hero_up on storage.objects for all to authenticated using(bucket_id='hero' and is_admin()) with check(bucket_id='hero' and is_admin());
