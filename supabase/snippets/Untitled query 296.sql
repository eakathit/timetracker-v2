SELECT 
  user_id,
  first_check_in,
  last_check_out,
  daily_allowance,
  status,
  ot_hours,
  timeline_events
FROM daily_time_logs
WHERE log_date = CURRENT_DATE
ORDER BY user_id;