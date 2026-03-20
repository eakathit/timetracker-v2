INSERT INTO daily_time_logs (
  user_id, log_date, work_type,
  first_check_in, last_check_out,
  auto_checked_out, ot_hours,
  timeline_events
)
VALUES (
  '1dae80f2-9d7c-4182-b010-2a3fc140ff73',         -- แทนด้วย user id ของคุณ
  CURRENT_DATE,
  'in_factory',
  NOW() - interval '8 hours',   -- check-in 8 ชม.ที่แล้ว
  NOW() - interval '30 minutes', -- auto-checkout 30 นาทีที่แล้ว
  true,                          -- ← Cron set แล้ว
  null,                          -- ← ยังไม่มี OT
  '[
    {"event": "arrive_factory", "timestamp": "..."},
    {"event": "checkout",       "timestamp": "..."},
    {"event": "auto_checkout",  "timestamp": "..."}
  ]'::jsonb
)
ON CONFLICT (user_id, log_date) DO UPDATE SET
  auto_checked_out = true,
  last_check_out   = NOW() - interval '30 minutes',
  ot_hours         = null,
  timeline_events  = EXCLUDED.timeline_events;