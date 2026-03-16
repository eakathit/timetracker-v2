-- Auto-pick 5 คนแรกจาก profiles มา insert เลย
INSERT INTO daily_time_logs (user_id, log_date, work_type, first_check_in, status, timeline_events)
SELECT
  id,
  '2026-03-16',
  CASE WHEN row_number() OVER (ORDER BY created_at) <= 3
    THEN 'in_factory'
    ELSE 'on_site'
  END,
  ('2026-03-16T0' || (7 + row_number() OVER (ORDER BY created_at))::text || ':30:00+07:00')::timestamptz,
  CASE WHEN row_number() OVER (ORDER BY created_at) = 2
    THEN 'late'
    ELSE 'on_time'
  END,
  '[{"event": "arrive_factory", "timestamp": "2026-03-16T08:30:00+07:00", "method": "qr_scan", "location": "factory-main"}]'::jsonb
FROM (
  SELECT id, created_at, row_number() OVER (ORDER BY created_at) as rn
  FROM profiles
  LIMIT 5
) sub
WHERE NOT EXISTS (
  SELECT 1 FROM daily_time_logs d
  WHERE d.user_id = sub.id AND d.log_date = '2026-03-16'
);