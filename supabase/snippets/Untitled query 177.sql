-- Insert time log ให้ทุกคนใน profiles วันนี้
INSERT INTO daily_time_logs (
  user_id, log_date, work_type,
  first_check_in, last_check_out,
  status, regular_hours, ot_hours,
  day_type, pay_multiplier,
  timeline_events
)
SELECT
  id,
  (NOW() AT TIME ZONE 'Asia/Bangkok')::date,
  CASE (row_number() OVER (ORDER BY created_at) % 2)
    WHEN 0 THEN 'on_site'
    ELSE 'in_factory'
  END,
  ((NOW() AT TIME ZONE 'Asia/Bangkok')::date || 'T08:00:00+07:00')::timestamptz,
  ((NOW() AT TIME ZONE 'Asia/Bangkok')::date || 'T17:00:00+07:00')::timestamptz,
  'on_time',
  8, 0,
  'workday', 1.0,
  '[{"event":"arrive_factory","timestamp":"2026-03-17T08:00:00+07:00","method":"qr_scan"}]'::jsonb
FROM profiles
WHERE role != 'admin'
ON CONFLICT (user_id, log_date) DO UPDATE SET
  first_check_in  = EXCLUDED.first_check_in,
  last_check_out  = EXCLUDED.last_check_out,
  status          = EXCLUDED.status,
  work_type       = EXCLUDED.work_type,
  timeline_events = EXCLUDED.timeline_events;