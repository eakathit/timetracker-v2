-- Recalculate On-site daily allowance from the On-site check-in timestamp.
-- Factory check-in time should not grant the On-site allowance by itself.
WITH onsite_allowance AS (
  SELECT
    dtl.id,
    bool_or(
      (((event_item ->> 'timestamp')::timestamptz AT TIME ZONE 'Asia/Bangkok')::time < TIME '08:30')
    ) AS should_have_allowance
  FROM public.daily_time_logs AS dtl
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(dtl.timeline_events, '[]'::jsonb)) AS event_item
  WHERE dtl.work_type IN ('on_site', 'mixed')
    AND event_item ->> 'event' = 'onsite_checkin'
    AND event_item ? 'timestamp'
  GROUP BY dtl.id
)
UPDATE public.daily_time_logs AS dtl
SET daily_allowance = onsite_allowance.should_have_allowance
FROM onsite_allowance
WHERE dtl.id = onsite_allowance.id
  AND dtl.daily_allowance IS DISTINCT FROM onsite_allowance.should_have_allowance;
