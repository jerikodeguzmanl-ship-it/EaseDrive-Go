-- Run after 007_admin_ids.sql. Booking-scoped, opt-in live location sharing.
create table if not exists customer_location_preferences (
  user_id uuid primary key references profiles(id) on delete cascade,
  location_label text not null check(length(location_label) between 1 and 120),
  updated_at timestamptz not null default now()
);
alter table customer_location_preferences enable row level security;
revoke all on customer_location_preferences from anon, authenticated;
grant select, insert, update on customer_location_preferences to authenticated;

drop policy if exists customer_location_preferences_self on customer_location_preferences;
create policy customer_location_preferences_self on customer_location_preferences
  for all to authenticated
  using (user_id = auth.uid() and not is_admin())
  with check (user_id = auth.uid() and not is_admin());

create table if not exists booking_location_sharing (
  booking_id uuid primary key references bookings(id) on delete cascade,
  enabled boolean not null default false,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

create table if not exists booking_live_locations (
  booking_id uuid not null references bookings(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  latitude double precision not null check(latitude between -90 and 90),
  longitude double precision not null check(longitude between -180 and 180),
  accuracy_m double precision check(accuracy_m is null or accuracy_m >= 0),
  location_label text check(location_label is null or length(location_label) <= 120),
  updated_at timestamptz not null default now(),
  primary key (booking_id, user_id)
);

alter table booking_location_sharing enable row level security;
alter table booking_live_locations enable row level security;

revoke all on booking_location_sharing from anon, authenticated;
revoke all on booking_live_locations from anon, authenticated;
grant select on booking_location_sharing to authenticated;
grant select on booking_live_locations to authenticated;

drop policy if exists booking_location_sharing_read on booking_location_sharing;
create policy booking_location_sharing_read on booking_location_sharing
  for select to authenticated
  using (
    is_admin()
    or exists (
      select 1
      from bookings b
      join business_owners bo on bo.id = b.owner_id
      where b.id = booking_location_sharing.booking_id
        and (b.customer_id = auth.uid() or bo.profile_id = auth.uid())
    )
  );

drop policy if exists booking_live_locations_read on booking_live_locations;
create policy booking_live_locations_read on booking_live_locations
  for select to authenticated
  using (
    not is_admin()
    and updated_at > now() - interval '90 seconds'
    and exists (
      select 1
      from bookings b
      join business_owners bo on bo.id = b.owner_id
      join booking_location_sharing s on s.booking_id = b.id
      where b.id = booking_live_locations.booking_id
        and b.status = 'Confirmed'
        and s.enabled
        and (b.customer_id = auth.uid() or bo.profile_id = auth.uid())
        and booking_live_locations.user_id in (b.customer_id, bo.profile_id)
    )
  );

create or replace function admin_set_booking_location_sharing(p_booking uuid, p_enabled boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare booking_state booking_status;
begin
  if auth.uid() is null or not is_admin() then raise exception 'Admin only'; end if;

  select status into booking_state from bookings where id = p_booking;
  if not found then raise exception 'Booking not found'; end if;
  if p_enabled and booking_state <> 'Confirmed' then raise exception 'Only confirmed bookings can share location'; end if;

  insert into booking_location_sharing(booking_id, enabled, updated_by, updated_at)
  values(p_booking, p_enabled, auth.uid(), now())
  on conflict (booking_id) do update
    set enabled = excluded.enabled, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  if not p_enabled then
    delete from booking_live_locations where booking_id = p_booking;
  end if;

  perform log_act(
    case when p_enabled then 'booking_location_enabled' else 'booking_location_disabled' end,
    'booking',
    p_booking::text
  );
  return p_enabled;
end$$;

create or replace function share_booking_live_location(
  p_booking uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision default null,
  p_location_label text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or is_admin() then raise exception 'Location sharing unavailable'; end if;
  if p_latitude is null or p_latitude not between -90 and 90
    or p_longitude is null or p_longitude not between -180 and 180
    or (p_accuracy_m is not null and p_accuracy_m < 0)
    or (p_location_label is not null and length(p_location_label) > 120) then
    raise exception 'Invalid coordinates';
  end if;

  if not exists (
    select 1
    from bookings b
    join business_owners bo on bo.id = b.owner_id
    join booking_location_sharing s on s.booking_id = b.id
    where b.id = p_booking
      and b.status = 'Confirmed'
      and s.enabled
      and (b.customer_id = auth.uid() or bo.profile_id = auth.uid())
  ) then
    raise exception 'Location sharing is not enabled for this confirmed booking';
  end if;

  insert into booking_live_locations(booking_id, user_id, latitude, longitude, accuracy_m, location_label, updated_at)
  values(p_booking, auth.uid(), p_latitude, p_longitude, p_accuracy_m, nullif(trim(p_location_label), ''), now())
  on conflict (booking_id, user_id) do update
    set latitude = excluded.latitude,
        longitude = excluded.longitude,
        accuracy_m = excluded.accuracy_m,
        location_label = excluded.location_label,
        updated_at = excluded.updated_at;

  delete from booking_live_locations where updated_at < now() - interval '5 minutes';
end$$;

create or replace function stop_booking_live_location(p_booking uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or is_admin() or not exists (
    select 1
    from bookings b
    join business_owners bo on bo.id = b.owner_id
    where b.id = p_booking
      and (b.customer_id = auth.uid() or bo.profile_id = auth.uid())
  ) then
    raise exception 'Forbidden';
  end if;

  delete from booking_live_locations
  where booking_id = p_booking and user_id = auth.uid();
end$$;

create or replace function prune_booking_live_locations()
returns integer language plpgsql security definer set search_path = public as $$
declare removed integer;
begin
  delete from booking_live_locations where updated_at < now() - interval '90 seconds';
  get diagnostics removed = row_count;
  return removed;
end$$;

create or replace function clear_booking_live_locations_on_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'Confirmed' and new.status <> 'Confirmed' then
    update booking_location_sharing
      set enabled = false, updated_at = now()
      where booking_id = new.id;
    delete from booking_live_locations where booking_id = new.id;
  end if;
  return new;
end$$;

drop trigger if exists booking_location_cleanup on bookings;
create trigger booking_location_cleanup
  after update of status on bookings
  for each row execute function clear_booking_live_locations_on_status_change();

revoke execute on function admin_set_booking_location_sharing(uuid, boolean) from public, anon;
revoke execute on function share_booking_live_location(uuid, double precision, double precision, double precision, text) from public, anon;
revoke execute on function stop_booking_live_location(uuid) from public, anon;
revoke execute on function prune_booking_live_locations() from public, anon, authenticated;
grant execute on function admin_set_booking_location_sharing(uuid, boolean) to authenticated;
grant execute on function share_booking_live_location(uuid, double precision, double precision, double precision, text) to authenticated;
grant execute on function stop_booking_live_location(uuid) to authenticated;
