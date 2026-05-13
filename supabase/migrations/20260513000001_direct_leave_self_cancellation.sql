-- Allow employees to cancel their own approved leave directly.
-- The database-owned RPC keeps leave status, balance trigger, and attendance cleanup together.

DROP FUNCTION IF EXISTS public.cancel_leave_request(uuid);
DROP FUNCTION IF EXISTS public.cancel_leave_request(uuid, text);

CREATE OR REPLACE FUNCTION public.cancel_leave_request(
  p_request_id uuid,
  p_cancel_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req record;
  actor record;
  cleaned_reason text;
BEGIN
  SELECT
    lr.id,
    lr.user_id,
    lr.status,
    lr.start_date,
    lr.end_date,
    lr.cancel_reason,
    requester.department AS requester_department
  INTO req
  FROM public.leave_requests lr
  JOIN public.profiles requester ON requester.id = lr.user_id
  WHERE lr.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'leave request not found';
  END IF;

  IF req.status NOT IN ('approved', 'cancel_requested') THEN
    RAISE EXCEPTION 'leave request cannot be cancelled from current status';
  END IF;

  SELECT id, role, department
  INTO actor
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not allowed to cancel leave';
  END IF;

  IF actor.id <> req.user_id THEN
    IF actor.role NOT IN ('admin', 'manager') THEN
      RAISE EXCEPTION 'not allowed to cancel this leave';
    END IF;

    IF actor.role <> 'admin' AND actor.department IS DISTINCT FROM req.requester_department THEN
      RAISE EXCEPTION 'not allowed to cancel leave outside department';
    END IF;
  END IF;

  cleaned_reason := NULLIF(BTRIM(COALESCE(p_cancel_reason, '')), '');

  UPDATE public.leave_requests
     SET status = 'cancelled',
         cancel_reason = COALESCE(cleaned_reason, cancel_reason),
         cancel_requested_at = COALESCE(cancel_requested_at, now()),
         cancel_actioned_by = actor.id,
         cancel_actioned_at = now()
   WHERE id = req.id;

  DELETE FROM public.daily_time_logs dtl
   WHERE dtl.user_id = req.user_id
     AND dtl.status = 'leave'
     AND dtl.first_check_in IS NULL
     AND dtl.last_check_out IS NULL
     AND dtl.log_date BETWEEN req.start_date AND req.end_date;

  UPDATE public.daily_time_logs dtl
     SET work_type = NULL,
         status = CASE
           WHEN (
             EXTRACT(HOUR FROM dtl.first_check_in AT TIME ZONE 'Asia/Bangkok') * 60
             + EXTRACT(MINUTE FROM dtl.first_check_in AT TIME ZONE 'Asia/Bangkok')
           ) > 510 THEN 'late'
           ELSE 'on_time'
         END
   WHERE dtl.user_id = req.user_id
     AND dtl.first_check_in IS NOT NULL
     AND dtl.log_date BETWEEN req.start_date AND req.end_date
     AND NOT EXISTS (
       SELECT 1
       FROM public.leave_requests active_leave
       WHERE active_leave.id <> req.id
         AND active_leave.user_id = dtl.user_id
         AND active_leave.status IN ('approved', 'cancel_requested')
         AND dtl.log_date BETWEEN active_leave.start_date AND active_leave.end_date
     );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_leave_request(uuid, text) TO authenticated;
