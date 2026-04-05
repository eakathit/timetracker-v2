-- ============================================================
-- Fix: used_days / pending_days เป็น numeric(5,1) → เก็บได้แค่ 1 ตำแหน่ง
--      ทำให้ 0.4375 ถูก round → 0.4 → profile แสดง 3.2 แทน 3.5
--
-- แก้: เปลี่ยนเป็น numeric(8,4) รองรับ 4 ตำแหน่ง
--      (ต้อง drop view + generated columns ก่อน แล้ว recreate)
-- ============================================================

-- 0. Drop view ที่ depend อยู่ก่อน (จะ recreate ด้านล่าง)
DROP VIEW IF EXISTS public.leave_balances_with_policy;

-- 1. Drop generated columns ที่ขึ้นกับ used_days ก่อน
ALTER TABLE public.leave_balances DROP COLUMN IF EXISTS remaining_days;
ALTER TABLE public.leave_balances DROP COLUMN IF EXISTS total_days;

-- 2. เปลี่ยน precision ของ columns ที่รับค่าเศษชั่วโมง
ALTER TABLE public.leave_balances
  ALTER COLUMN used_days    TYPE numeric(8,4),
  ALTER COLUMN pending_days TYPE numeric(8,4);

-- 3. Recreate generated columns ด้วย precision ใหม่
ALTER TABLE public.leave_balances
  ADD COLUMN total_days numeric(8,4)
    GENERATED ALWAYS AS (entitled_days + carried_over_days) STORED;

ALTER TABLE public.leave_balances
  ADD COLUMN remaining_days numeric(8,4)
    GENERATED ALWAYS AS (entitled_days + carried_over_days - used_days) STORED;

-- 4. Recreate view leave_balances_with_policy
CREATE OR REPLACE VIEW public.leave_balances_with_policy AS
SELECT
  lb.id,
  lb.user_id,
  lb.year,
  lb.leave_type,
  lp.label_th,
  lp.allow_hourly,
  lp.sick_paid_limit,
  lb.entitled_days,
  lb.carried_over_days,
  lb.total_days,
  lb.used_days,
  lb.pending_days,
  lb.remaining_days,
  CASE
    WHEN lb.total_days > 0
    THEN ROUND((lb.used_days / lb.total_days) * 100, 1)
    ELSE 0
  END AS used_pct
FROM public.leave_balances lb
JOIN public.leave_policies lp ON lp.leave_type = lb.leave_type;

GRANT SELECT ON public.leave_balances_with_policy TO authenticated;