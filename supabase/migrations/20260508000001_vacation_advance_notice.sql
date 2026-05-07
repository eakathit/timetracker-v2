-- Enforce vacation leave advance notice.
-- Vacation leave must be requested at least 3 calendar days in advance,
-- counting the request date as day 1.

CREATE OR REPLACE FUNCTION public.validate_vacation_advance_notice()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  local_today date;
BEGIN
  local_today := (now() AT TIME ZONE 'Asia/Bangkok')::date;

  IF NEW.leave_type = 'vacation'
     AND NEW.status = 'pending'
     AND NEW.start_date < local_today + 2 THEN
    RAISE EXCEPTION
      'Vacation leave must be requested at least 3 days in advance, counting the request date.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_vacation_advance_notice ON public.leave_requests;
CREATE TRIGGER trg_validate_vacation_advance_notice
  BEFORE INSERT OR UPDATE OF leave_type, start_date, status
  ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_vacation_advance_notice();
