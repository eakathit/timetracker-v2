-- supabase/migrations/20260317_add_actioned_by_name_to_views.sql
-- เพิ่ม actioned_by_name โดย JOIN profiles ของผู้อนุมัติ/ปฏิเสธ ทั้ง 2 View

CREATE OR REPLACE VIEW public.ot_requests_with_profile AS
SELECT
  o.id,
  o.user_id,
  o.request_date,
  o.start_time,
  o.end_time,
  o.project_id,
  o.reason,
  o.status,
  o.approved_by,
  o.reject_reason,
  o.actioned_at,
  o.created_at,
  o.hours,
  p.first_name,
  p.last_name,
  p.department,
  (p.first_name || ' ' || p.last_name) AS full_name,
  (u.raw_user_meta_data ->> 'avatar_url') AS avatar_url,
  pr.project_no,
  pr.name AS project_name,
  -- ชื่อผู้ที่ approve/reject (JOIN profiles ของ approved_by)
  (ap.first_name || ' ' || ap.last_name) AS actioned_by_name
FROM public.ot_requests o
JOIN public.profiles p  ON p.id = o.user_id
JOIN auth.users u        ON u.id = o.user_id
LEFT JOIN public.projects pr ON pr.id = o.project_id
LEFT JOIN public.profiles ap ON ap.id = o.approved_by;


CREATE OR REPLACE VIEW public.leave_requests_with_profile AS
SELECT
  l.id,
  l.user_id,
  l.leave_type,
  l.start_date,
  l.end_date,
  l.days,
  l.reason,
  l.status,
  l.approved_by,
  l.reject_reason,
  l.actioned_at,
  l.created_at,
  l.period_label,
  p.first_name,
  p.last_name,
  p.department,
  (p.first_name || ' ' || p.last_name) AS full_name,
  (u.raw_user_meta_data ->> 'avatar_url') AS avatar_url,
  -- ชื่อผู้ที่ approve/reject
  (ap.first_name || ' ' || ap.last_name) AS actioned_by_name
FROM public.leave_requests l
JOIN public.profiles p  ON p.id = l.user_id
JOIN auth.users u        ON u.id = l.user_id
LEFT JOIN public.profiles ap ON ap.id = l.approved_by;