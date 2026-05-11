-- Ensure approved leave cancellation always removes the attendance leave marker.
-- This runs inside the database so it is not blocked by browser-side RLS limits.

CREATE OR REPLACE FUNCTION public.cleanup_cancelled_leave_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'cancelled' OR OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Full-day leave rows created by approval have status = leave.
  -- If there is no real check-in/out, remove the synthetic row.
  DELETE FROM public.daily_time_logs dtl
   WHERE dtl.user_id = NEW.user_id
     AND dtl.status = 'leave'
     AND dtl.first_check_in IS NULL
     AND dtl.last_check_out IS NULL
     AND dtl.log_date BETWEEN NEW.start_date AND NEW.end_date;

  -- If a real check-in exists on that day, keep the log but restore normal status.
  UPDATE public.daily_time_logs dtl
     SET work_type = NULL,
         status = CASE
           WHEN dtl.first_check_in IS NULL THEN 'absent'
           WHEN (
             EXTRACT(HOUR FROM dtl.first_check_in AT TIME ZONE 'Asia/Bangkok') * 60
             + EXTRACT(MINUTE FROM dtl.first_check_in AT TIME ZONE 'Asia/Bangkok')
           ) > 510 THEN 'late'
           ELSE 'on_time'
         END
   WHERE dtl.user_id = NEW.user_id
     AND dtl.status = 'leave'
     AND dtl.log_date BETWEEN NEW.start_date AND NEW.end_date;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_cancelled_leave_attendance ON public.leave_requests;
CREATE TRIGGER trg_cleanup_cancelled_leave_attendance
  AFTER UPDATE OF status
  ON public.leave_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.cleanup_cancelled_leave_attendance();
