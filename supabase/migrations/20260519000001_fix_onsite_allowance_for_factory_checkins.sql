-- Ensure factory-first employees who later joined an On-site session still receive
-- the On-site daily allowance when their first check-in was before 08:30 Bangkok.
UPDATE public.daily_time_logs
SET daily_allowance = true
WHERE COALESCE(daily_allowance, false) = false
  AND work_type IN ('on_site', 'mixed')
  AND first_check_in IS NOT NULL
  AND ((first_check_in AT TIME ZONE 'Asia/Bangkok')::time < TIME '08:30')
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(timeline_events, '[]'::jsonb)) AS event_item
    WHERE event_item ->> 'event' = 'onsite_checkin'
  );
