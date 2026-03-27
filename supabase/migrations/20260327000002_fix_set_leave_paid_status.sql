-- ============================================================
-- Fix: set_leave_paid_status() ใช้ NEW.days ซึ่งเป็น generated column
--      ใน BEFORE INSERT trigger NEW.days ยังเป็น NULL อยู่
--      → is_paid = NULL → violates not-null constraint
--
-- แก้: คำนวณ effective_days เองจาก hours หรือ dates
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_leave_paid_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  policy         public.leave_policies%ROWTYPE;
  already_used   numeric(5,1);
  effective_days numeric(5,1);
BEGIN
  SELECT * INTO policy
    FROM public.leave_policies
   WHERE leave_type = NEW.leave_type;

  -- ถ้าไม่มี policy หรือ sick_paid_limit = 0 → paid เสมอ
  IF policy.sick_paid_limit IS NULL OR policy.sick_paid_limit = 0 THEN
    NEW.is_paid := true;
    RETURN NEW;
  END IF;

  -- คำนวณ effective days (ไม่ใช้ generated column NEW.days)
  IF NEW.hours IS NOT NULL THEN
    effective_days := ROUND((NEW.hours / 8.0)::numeric, 4);
  ELSE
    effective_days := (NEW.end_date - NEW.start_date + 1)::numeric(5,1);
  END IF;

  -- นับวันที่ approved ไปแล้วในปีนี้
  SELECT COALESCE(SUM(
    CASE WHEN hours IS NOT NULL THEN ROUND((hours / 8.0)::numeric, 4)
         ELSE days
    END
  ), 0) INTO already_used
    FROM public.leave_requests
   WHERE user_id    = NEW.user_id
     AND leave_type = NEW.leave_type
     AND status     = 'approved'
     AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM NEW.start_date);

  NEW.is_paid := (already_used + effective_days) <= policy.sick_paid_limit;
  RETURN NEW;
END;
$$;
