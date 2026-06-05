-- Targeted production fix for the H1-0588 On-site session that was created
-- with a UTC-based session_date of 2026-06-04 while the actual Bangkok
-- group check-in happened on 2026-06-05 at 05:35.
WITH target_onsite_members AS (
  SELECT
    s.id AS session_id,
    (s.group_check_in AT TIME ZONE 'Asia/Bangkok')::date AS log_date,
    s.group_check_in,
    m.user_id,
    CASE
      WHEN h.holiday_date IS NOT NULL AND h.holiday_type <> 'working_sat' THEN 'holiday'
      WHEN EXTRACT(DOW FROM (s.group_check_in AT TIME ZONE 'Asia/Bangkok')::date) IN (0, 6) THEN 'holiday'
      ELSE 'regular'
    END AS shift_type
  FROM public.onsite_sessions s
  JOIN public.onsite_session_members m ON m.session_id = s.id
  LEFT JOIN public.holidays h
    ON h.holiday_date = (s.group_check_in AT TIME ZONE 'Asia/Bangkok')::date
  WHERE s.id = '83c250f7-3360-4e30-b998-4ace0fbe4309'
    AND s.group_check_in IS NOT NULL
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
        'synced_from', 'targeted_session_date_fix'
      )
    )
  FROM target_onsite_members tom
  WHERE dtl.user_id = tom.user_id
    AND dtl.log_date = tom.log_date
    AND dtl.first_check_in IS NULL
  RETURNING dtl.user_id
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
      'synced_from', 'targeted_session_date_fix'
    )
  )
FROM target_onsite_members tom
WHERE NOT EXISTS (
  SELECT 1
  FROM public.daily_time_logs dtl
  WHERE dtl.user_id = tom.user_id
    AND dtl.log_date = tom.log_date
);
