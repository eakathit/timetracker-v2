-- ============================================================
-- เพิ่ม leave_type 'holiday_swap' (วันหยุดชดเชย)
-- สิทธิ์ได้มาจากการทำงานครบ 8ชม. ในวันหยุด
-- ============================================================

-- 1. แก้ CHECK constraint ของ leave_policies
ALTER TABLE public.leave_policies
  DROP CONSTRAINT IF EXISTS leave_policies_leave_type_check;

ALTER TABLE public.leave_policies
  ADD CONSTRAINT leave_policies_leave_type_check CHECK (
    leave_type = ANY (ARRAY[
      'sick'::text, 'vacation'::text, 'personal'::text,
      'special_personal'::text, 'other'::text, 'holiday_swap'::text
    ])
  );

-- 2. แก้ CHECK constraint ของ leave_balances
ALTER TABLE public.leave_balances
  DROP CONSTRAINT IF EXISTS leave_balances_leave_type_check;

ALTER TABLE public.leave_balances
  ADD CONSTRAINT leave_balances_leave_type_check CHECK (
    leave_type = ANY (ARRAY[
      'sick'::text, 'vacation'::text, 'personal'::text,
      'special_personal'::text, 'other'::text, 'holiday_swap'::text
    ])
  );

-- 3. เพิ่ม policy ของ holiday_swap
--    days_per_year = 0  (ไม่ได้รับสิทธิ์ตายตัว — ได้จาก trigger)
--    allow_hourly  = false (ลาได้เฉพาะเต็มวัน)
--    is_active     = true
INSERT INTO public.leave_policies
  (leave_type, label_th, days_per_year, max_carry_over, sick_paid_limit, allow_hourly, is_active)
VALUES
  ('holiday_swap', 'แลกวันหยุด', 0, 0, 0, false, true)
ON CONFLICT (leave_type) DO NOTHING;

-- 4. สร้าง leave_balances สำหรับ holiday_swap ให้ users ทุกคนที่มีอยู่แล้ว
INSERT INTO public.leave_balances (user_id, year, leave_type, entitled_days, carried_over_days)
SELECT
  DISTINCT user_id,
  EXTRACT(YEAR FROM CURRENT_DATE)::integer,
  'holiday_swap',
  0,
  0
FROM public.leave_balances
WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)::integer
ON CONFLICT (user_id, year, leave_type) DO NOTHING;

-- ============================================================
-- 5. Trigger: เมื่อ dayoff_credit เปลี่ยนเป็น 'earned'
--    → เพิ่ม entitled_days +1 ใน leave_balances (holiday_swap)
-- ============================================================
CREATE OR REPLACE FUNCTION public.credit_holiday_dayoff()
RETURNS trigger
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS trg_credit_holiday_dayoff ON public.daily_time_logs;
CREATE TRIGGER trg_credit_holiday_dayoff
  AFTER UPDATE OF dayoff_credit ON public.daily_time_logs
  FOR EACH ROW EXECUTE FUNCTION public.credit_holiday_dayoff();
