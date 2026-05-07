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
