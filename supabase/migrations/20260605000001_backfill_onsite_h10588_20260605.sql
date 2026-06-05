-- Targeted production fix:
-- Backfill only the DJK-BANDO / H1-0588 On-site group check-in at 05:35
-- on 2026-06-05 for members whose daily_time_logs.first_check_in is missing.
--
-- This intentionally does not touch members who already have a Factory
-- check-in, such as the Factory + On-site employees in the same group.
WITH target_onsite_members AS (
  SELECT
    s.id AS session_id,
    s.session_date AS log_date,
    s.group_check_in,
    m.user_id,
    CASE
      WHEN h.holiday_date IS NOT NULL AND h.holiday_type <> 'working_sat' THEN 'holiday'
      WHEN EXTRACT(DOW FROM s.session_date::date) IN (0, 6) THEN 'holiday'
      ELSE 'regular'
    END AS shift_type
  FROM public.onsite_sessions s
  JOIN public.onsite_session_members m ON m.session_id = s.id
  LEFT JOIN public.projects p ON p.id = s.project_id
  LEFT JOIN public.holidays h ON h.holiday_date = s.session_date
  WHERE s.session_date = DATE '2026-06-05'
    AND p.project_no = 'H1-0588'
    AND s.group_check_in IS NOT NULL
    AND (s.group_check_in AT TIME ZONE 'Asia/Bangkok')::time >= TIME '05:35'
    AND (s.group_check_in AT TIME ZONE 'Asia/Bangkok')::time < TIME '05:36'
),
updated_logs AS (
  UPDATE public.daily_time_logs dtl
  SET
    first_check_in = tom.group_check_in,
    work_type = CASE WHEN dtl.work_type = 'in_factory' THEN 'mixed' ELSE 'on_site' END,
    onsite_session_id = tom.session_id,
    shift_type = tom.shift_type,
    status = CASE
      WHEN tom.shift_type = 'holiday' THEN 'on_time'
      WHEN ((tom.group_check_in AT TIME ZONE 'Asia/Bangkok')::time > TIME '08:30') THEN 'late'
      ELSE 'on_time'
    END,
    daily_allowance = ((tom.group_check_in AT TIME ZONE 'Asia/Bangkok')::time < TIME '08:30'),
    timeline_events = COALESCE(dtl.timeline_events, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'event', 'onsite_checkin',
        'timestamp', tom.group_check_in,
        'session_id', tom.session_id,
        'synced_from', 'targeted_migration_backfill'
      )
    )
  FROM target_onsite_members tom
  WHERE dtl.user_id = tom.user_id
    AND dtl.log_date = tom.log_date
    AND dtl.first_check_in IS NULL
  RETURNING dtl.user_id, dtl.log_date
)
INSERT INTO public.daily_time_logs (
  user_id,
  log_date,
  work_type,
  first_check_in,
  onsite_session_id,
  shift_type,
  status,
  daily_allowance,
  timeline_events
)
SELECT
  tom.user_id,
  tom.log_date,
  'on_site',
  tom.group_check_in,
  tom.session_id,
  tom.shift_type,
  CASE
    WHEN tom.shift_type = 'holiday' THEN 'on_time'
    WHEN ((tom.group_check_in AT TIME ZONE 'Asia/Bangkok')::time > TIME '08:30') THEN 'late'
    ELSE 'on_time'
  END,
  ((tom.group_check_in AT TIME ZONE 'Asia/Bangkok')::time < TIME '08:30'),
  jsonb_build_array(
    jsonb_build_object(
      'event', 'onsite_checkin',
      'timestamp', tom.group_check_in,
      'session_id', tom.session_id,
      'synced_from', 'targeted_migration_backfill'
    )
  )
FROM target_onsite_members tom
WHERE NOT EXISTS (
  SELECT 1
  FROM public.daily_time_logs dtl
  WHERE dtl.user_id = tom.user_id
    AND dtl.log_date = tom.log_date
);
