-- Run after 004_optional_permit.sql. Keep admin role when the same account is approved as a partner.
create or replace function approve_partner(p_app uuid) returns void language plpgsql security definer set search_path=public as $$
declare a partner_applications;
begin if not is_admin() then raise exception 'Admin only'; end if;
 select * into a from partner_applications where id=p_app;
 update partner_applications set status='Approved' where id=p_app;
 insert into business_owners(profile_id,application_id,business_name,phone,email,address)
 values(a.applicant_id,a.id,a.business_name,a.phone,a.email,a.address)
 on conflict(profile_id) do update set status='Approved';
 update profiles set role='owner' where id=a.applicant_id and role<>'admin';
 perform log_act('partner_approved','application',p_app::text);
end$$;
