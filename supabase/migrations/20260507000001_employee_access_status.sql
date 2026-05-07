alter table public.profiles
  add column if not exists access_status text not null default 'pending',
  add column if not exists approved_at timestamp with time zone,
  add column if not exists approved_by uuid,
  add column if not exists suspended_at timestamp with time zone,
  add column if not exists suspended_by uuid,
  add column if not exists suspend_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_access_status_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_access_status_check
      check (access_status in ('pending', 'active', 'suspended'));
  end if;
end $$;

update public.profiles
set access_status = 'active'
where access_status = 'pending';

create index if not exists idx_profiles_access_status
  on public.profiles (access_status);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    first_name,
    last_name,
    role,
    access_status
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'given_name', ''),
    coalesce(new.raw_user_meta_data ->> 'family_name', ''),
    'user',
    'pending'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.protect_profile_access_fields()
returns trigger
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

  if requester_role = 'admin' then
    return new;
  end if;

  if new.role is distinct from old.role
    or new.access_status is distinct from old.access_status
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

drop trigger if exists trg_protect_profile_access_fields on public.profiles;

create trigger trg_protect_profile_access_fields
before update on public.profiles
for each row
execute function public.protect_profile_access_fields();

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
  p.suspend_reason
from public.profiles p
join auth.users u on u.id = p.id;
