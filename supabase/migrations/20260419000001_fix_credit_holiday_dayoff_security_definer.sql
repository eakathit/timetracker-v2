-- ============================================================
-- Fix: credit_holiday_dayoff() ต้องเป็น SECURITY DEFINER
-- เพื่อให้ trigger สามารถ upsert leave_balances ได้
-- โดยไม่ถูก RLS block (user ไม่มีสิทธิ์ INSERT/UPDATE leave_balances โดยตรง)
-- ============================================================
CREATE OR REPLACE FUNCTION public.credit_holiday_dayoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_year integer;
BEGIN
  -- เฉพาะเมื่อ dayoff_credit เพิ่งเปลี่ยนเป็น 'earned'
  IF NEW.dayoff_credit IS DISTINCT FROM OLD.dayoff_credit
     AND NEW.dayoff_credit = 'earned' THEN

    req_year := EXTRACT(YEAR FROM NEW.log_date)::integer;

    -- upsert leave_balances: เพิ่ม entitled_days +1
    INSERT INTO public.leave_balances (user_id, year, leave_type, entitled_days, carried_over_days)
    VALUES (NEW.user_id, req_year, 'holiday_swap', 1, 0)
    ON CONFLICT (user_id, year, leave_type)
    DO UPDATE SET
      entitled_days = leave_balances.entitled_days + 1,
      updated_at    = now();

  END IF;

  RETURN NEW;
END;
$$;
