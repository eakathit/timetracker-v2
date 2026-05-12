alter table public.work_details
  add column if not exists category text not null default 'daily';

alter table public.work_details
  drop constraint if exists work_details_category_check;

alter table public.work_details
  add constraint work_details_category_check
  check (category in ('daily', 'onsite'));

update public.work_details
set category = 'daily'
where category is null;

create index if not exists idx_work_details_category_active
  on public.work_details (category, is_active, created_at);

alter table public.daily_report_items
  add column if not exists onsite_session_id uuid references public.onsite_sessions(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists source text not null default 'daily';

alter table public.daily_report_items
  drop constraint if exists daily_report_items_source_check;

alter table public.daily_report_items
  add constraint daily_report_items_source_check
  check (source in ('daily', 'onsite_leader'));

create index if not exists idx_daily_report_items_onsite_session
  on public.daily_report_items (onsite_session_id);

create index if not exists idx_daily_report_items_source
  on public.daily_report_items (source);
