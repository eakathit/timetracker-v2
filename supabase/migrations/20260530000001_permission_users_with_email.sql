create or replace function public.get_permission_users()
returns table (
  id uuid,
  first_name text,
  last_name text,
  auth_display_name text,
  email text,
  department text,
  role text,
  avatar_url text,
  access_status text,
  approved_at timestamptz,
  approved_by uuid,
  suspended_at timestamptz,
  suspended_by uuid,
  suspend_reason text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  return query
  select
    p.id,
    p.first_name,
    p.last_name,
    coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'name'), '')
    ),
    u.email::text,
    p.department,
    p.role,
    (u.raw_user_meta_data ->> 'avatar_url'::text),
    p.access_status,
    p.approved_at,
    p.approved_by,
    p.suspended_at,
    p.suspended_by,
    p.suspend_reason,
    p.updated_at
  from public.profiles p
  join auth.users u on u.id = p.id
  order by p.first_name asc;
end;
$$;

revoke all on function public.get_permission_users() from public;
grant execute on function public.get_permission_users() to authenticated;
