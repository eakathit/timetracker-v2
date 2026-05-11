-- Cancel an approved leave request through a database-owned function.
-- This keeps balance updates and attendance cleanup in the same server-side action.

CREATE OR REPLACE FUNCTION public.cancel_leave_request(
  p_request_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req record;
  actor record;
BEGIN
  SELECT
    lr.id,
    lr.user_id,
    lr.status,
    lr.start_date,
    lr.end_date,
    requester.department AS requester_department
  INTO req
  FROM public.leave_requests lr
  JOIN public.profiles requester ON requester.id = lr.user_id
  WHERE lr.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'leave request not found';
  END IF;

  IF req.status <> 'cancel_requested' THEN
    RAISE EXCEPTION 'leave request is not waiting for cancellation approval';
  END IF;

  SELECT id, role, department
  INTO actor
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND OR actor.role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'not allowed to approve leave cancellation';
  END IF;

  IF actor.role <> 'admin' AND actor.department IS DISTINCT FROM req.requester_department THEN
    RAISE EXCEPTION 'not allowed to approve leave cancellation outside department';
  END IF;

  UPDATE public.leave_requests
     SET status = 'cancelled',
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
           WHEN dtl.first_check_in IS NULL THEN 'absent'
           WHEN (
             EXTRACT(HOUR FROM dtl.first_check_in AT TIME ZONE 'Asia/Bangkok') * 60
             + EXTRACT(MINUTE FROM dtl.first_check_in AT TIME ZONE 'Asia/Bangkok')
           ) > 510 THEN 'late'
           ELSE 'on_time'
         END
   WHERE dtl.user_id = req.user_id
     AND dtl.status = 'leave'
     AND dtl.log_date BETWEEN req.start_date AND req.end_date;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_leave_request(uuid) TO authenticated;
