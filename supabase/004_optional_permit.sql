-- Run after 003_app.sql. Business permits are optional; the signed agreement is required for approval.
create or replace function set_application_status(p_app uuid,p_status partner_status,p_notes text default null) returns void language plpgsql security definer set search_path=public as $$
begin if not is_admin() then raise exception 'Admin only'; end if;
 if p_status='Approved' then
  if not exists(select 1 from partnership_contracts where application_id=p_app and signed_at is not null) then raise exception 'Signed contract required'; end if;
  perform approve_partner(p_app);
 else update partner_applications set status=p_status,admin_notes=coalesce(p_notes,admin_notes) where id=p_app; end if;
 perform log_act('application_status','application',p_app::text,jsonb_build_object('status',p_status,'notes',p_notes));
end$$;
