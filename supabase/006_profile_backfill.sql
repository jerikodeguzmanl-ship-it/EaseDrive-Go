-- Run after 005_admin_partner_access.sql. Safe to run more than once.
-- Creates missing profile rows for users who signed up before the signup trigger existed.
insert into profiles(id, full_name) select id, raw_user_meta_data->>'full_name' from auth.users on conflict (id) do nothing;
