INSERT INTO daily_time_logs (
  user_id, log_date, work_type, first_check_in, status, timeline_events
)
SELECT
  id,
  (NOW() AT TIME ZONE 'Asia/Bangkok')::date,
  'in_factory',
  ((NOW() AT TIME ZONE 'Asia/Bangkok')::date || 'T08:15:00+07:00')::timestamptz,
  'on_time',
  jsonb_build_array(
    jsonb_build_object(
      'event', 'arrive_factory',
      'timestamp', ((NOW() AT TIME ZONE 'Asia/Bangkok')::date || 'T08:15:00+07:00'),
      'method', 'qr_scan',
      'location', 'factory-main'
    )
  )
FROM profiles
WHERE role != 'admin'
LIMIT 1
ON CONFLICT (user_id, log_date) DO UPDATE SET
  first_check_in  = EXCLUDED.first_check_in,
  work_type       = EXCLUDED.work_type,
  status          = EXCLUDED.status,
  timeline_events = EXCLUDED.timeline_events;