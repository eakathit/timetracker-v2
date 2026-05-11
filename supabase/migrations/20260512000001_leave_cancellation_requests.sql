-- Add cancellation workflow for approved leave requests.
-- cancel_requested still counts as used leave until an approver confirms cancellation.

ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_actioned_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS cancel_actioned_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reject_reason text;

ALTER TABLE public.leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_status_check;

ALTER TABLE public.leave_requests
  ADD CONSTRAINT leave_requests_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'pending'::text,
        'approved'::text,
        'rejected'::text,
        'cancel_requested'::text,
        'cancelled'::text
      ]
    )
  );

DROP POLICY IF EXISTS "Users can request own approved leave cancellation" ON public.leave_requests;
CREATE POLICY "Users can request own approved leave cancellation"
  ON public.leave_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'approved')
  WITH CHECK (auth.uid() = user_id AND status = 'cancel_requested');

CREATE OR REPLACE VIEW public.leave_requests_with_profile AS
SELECT
  l.id,
  l.user_id,
  l.leave_type,
  l.start_date,
  l.end_date,
  l.days,
  l.reason,
  l.status,
  l.approved_by,
  l.reject_reason,
  l.actioned_at,
  l.created_at,
  l.period_label,
  p.first_name,
  p.last_name,
  p.department,
  (p.first_name || ' ' || p.last_name) AS full_name,
  (u.raw_user_meta_data ->> 'avatar_url') AS avatar_url,
  (ap.first_name || ' ' || ap.last_name) AS actioned_by_name,
  l.hours,
  l.cancel_reason,
  l.cancel_requested_at,
  l.cancel_actioned_by,
  l.cancel_actioned_at,
  l.cancel_reject_reason,
  (cap.first_name || ' ' || cap.last_name) AS cancel_actioned_by_name
FROM public.leave_requests l
JOIN public.profiles p ON p.id = l.user_id
JOIN auth.users u ON u.id = l.user_id
LEFT JOIN public.profiles ap ON ap.id = l.approved_by
LEFT JOIN public.profiles cap ON cap.id = l.cancel_actioned_by;

CREATE OR REPLACE FUNCTION public.sync_leave_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  req_year integer;
  req_days numeric(5,1);
  req_hours numeric(4,2);
  deduct numeric(8,4);
BEGIN
  IF TG_OP = 'DELETE' THEN
    req_year := EXTRACT(YEAR FROM OLD.start_date)::integer;
    req_days := OLD.days;
    req_hours := OLD.hours;
  ELSE
    req_year := EXTRACT(YEAR FROM NEW.start_date)::integer;
    req_days := NEW.days;
    req_hours := NEW.hours;
  END IF;

  IF req_hours IS NOT NULL AND req_hours > 0 THEN
    deduct := req_hours / 8.0;
  ELSE
    deduct := req_days;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    UPDATE public.leave_balances
       SET pending_days = pending_days + deduct,
           updated_at = now()
     WHERE user_id = NEW.user_id
       AND year = req_year
       AND leave_type = NEW.leave_type;

  ELSIF TG_OP = 'UPDATE'
        AND OLD.status = 'pending'
        AND NEW.status = 'approved' THEN
    UPDATE public.leave_balances
       SET pending_days = GREATEST(pending_days - deduct, 0),
           used_days = used_days + deduct,
           updated_at = now()
     WHERE user_id = NEW.user_id
       AND year = req_year
       AND leave_type = NEW.leave_type;

  ELSIF TG_OP = 'UPDATE'
        AND OLD.status = 'pending'
        AND NEW.status = 'rejected' THEN
    UPDATE public.leave_balances
       SET pending_days = GREATEST(pending_days - deduct, 0),
           updated_at = now()
     WHERE user_id = NEW.user_id
       AND year = req_year
       AND leave_type = NEW.leave_type;

  ELSIF TG_OP = 'UPDATE'
        AND OLD.status = 'approved'
        AND NEW.status = 'rejected' THEN
    UPDATE public.leave_balances
       SET used_days = GREATEST(used_days - deduct, 0),
           updated_at = now()
     WHERE user_id = NEW.user_id
       AND year = req_year
       AND leave_type = NEW.leave_type;

  ELSIF TG_OP = 'UPDATE'
        AND OLD.status IN ('approved', 'cancel_requested')
        AND NEW.status = 'cancelled' THEN
    UPDATE public.leave_balances
       SET used_days = GREATEST(used_days - deduct, 0),
           updated_at = now()
     WHERE user_id = NEW.user_id
       AND year = req_year
       AND leave_type = NEW.leave_type;

  ELSIF TG_OP = 'DELETE' AND OLD.status = 'pending' THEN
    UPDATE public.leave_balances
       SET pending_days = GREATEST(pending_days - deduct, 0),
           updated_at = now()
     WHERE user_id = OLD.user_id
       AND year = req_year
       AND leave_type = OLD.leave_type;

  ELSIF TG_OP = 'DELETE' AND OLD.status IN ('approved', 'cancel_requested') THEN
    UPDATE public.leave_balances
       SET used_days = GREATEST(used_days - deduct, 0),
           updated_at = now()
     WHERE user_id = OLD.user_id
       AND year = req_year
       AND leave_type = OLD.leave_type;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
