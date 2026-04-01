-- ============================================================
-- Fix: used_days / pending_days เป็น numeric(5,1) → เก็บได้แค่ 1 ตำแหน่ง
--      ทำให้ 0.4375 ถูก round → 0.4 → profile แสดง 3.2 แทน 3.5
--
-- แก้: เปลี่ยนเป็น numeric(8,4) รองรับ 4 ตำแหน่ง
--      (generated columns ที่ depend ต้อง drop แล้ว recreate)
-- ============================================================

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
