create table if not exists public.calendar_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_date date not null,
  plan_time time without time zone not null default '09:00',
  title text not null,
  category text not null default 'meeting',
  note text,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint calendar_plans_category_check
    check (category in ('meeting', 'task', 'travel', 'training', 'other'))
);

create index if not exists idx_calendar_plans_user_date
  on public.calendar_plans (user_id, plan_date);

alter table public.calendar_plans enable row level security;

drop policy if exists "Users can read own calendar plans" on public.calendar_plans;
create policy "Users can read own calendar plans"
on public.calendar_plans
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own calendar plans" on public.calendar_plans;
create policy "Users can insert own calendar plans"
on public.calendar_plans
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own calendar plans" on public.calendar_plans;
create policy "Users can update own calendar plans"
on public.calendar_plans
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own calendar plans" on public.calendar_plans;
create policy "Users can delete own calendar plans"
on public.calendar_plans
for delete
to authenticated
using (auth.uid() = user_id);
