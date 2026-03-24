-- ============================================================
-- Migration: Leave Management System
-- ============================================================

-- Step 1: ปรับ constraint ของ leave_type ให้รองรับ type ใหม่
-- ก่อนอื่นต้องลบ constraint เก่าก่อน
ALTER TABLE public.leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_leave_type_check;

ALTER TABLE public.leave_requests
  ADD CONSTRAINT leave_requests_leave_type_check
  CHECK (leave_type = ANY (ARRAY[
    'sick'::text,
    'vacation'::text,
    'personal'::text,
    'special_personal'::text,
    'other'::text,
    'maternity'::text
  ]));

-- Step 2: เพิ่ม column hours สำหรับลาเป็นชั่วโมง
-- (ใช้เมื่อ leave_type = 'personal' และเลือก hourly mode)
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS "hours" numeric(4,2) DEFAULT NULL;

-- Step 3: เพิ่ม column is_paid เพื่อ track ว่าได้รับเงินไหม
-- (ใช้สำหรับกรณีลาป่วยเกิน 30 วัน)
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS "is_paid" boolean NOT NULL DEFAULT true;

-- ============================================================
-- ตาราง leave_policies: ตั้งค่าสิทธิ์วันลาโดย admin
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leave_policies (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  leave_type        text        NOT NULL,           -- 'sick' | 'vacation' | 'personal' | 'special_personal' | 'other'
  label_th          text        NOT NULL,           -- ชื่อภาษาไทย เช่น "ลาป่วย"
  days_per_year     numeric(5,1) NOT NULL DEFAULT 0, -- สิทธิ์ต่อปี (ใส่ 0 = ไม่จำกัด)
  max_carry_over    numeric(5,1) NOT NULL DEFAULT 0, -- สะสมสูงสุดข้ามปี (0 = ไม่สะสม)
  sick_paid_limit   integer     NOT NULL DEFAULT 0, -- วันที่ยังได้รับเงิน (เฉพาะ sick leave)
  allow_hourly      boolean     NOT NULL DEFAULT false, -- อนุญาตลาเป็นชั่วโมง
  is_active         boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leave_policies_pkey PRIMARY KEY (id),
  CONSTRAINT leave_policies_leave_type_key UNIQUE (leave_type),
  CONSTRAINT leave_policies_leave_type_check CHECK (
    leave_type = ANY (ARRAY[
      'sick'::text, 'vacation'::text, 'personal'::text,
      'special_personal'::text, 'other'::text
    ])
  )
);

ALTER TABLE public.leave_policies ENABLE ROW LEVEL SECURITY;

-- Seed ค่า default ตาม HR policy ที่กำหนด
INSERT INTO public.leave_policies
  (leave_type, label_th, days_per_year, max_carry_over, sick_paid_limit, allow_hourly)
VALUES
  ('vacation',        'ลาพักร้อน',     6,  12, 0,  false),
  ('sick',            'ลาป่วย',        30,  0, 30, false),
  ('personal',        'ลากิจ',         15,  0, 0,  true),
  ('special_personal','ลากิจพิเศษ',    3,   0, 3,  false),
  ('other',           'ลาอื่นๆ',       0,   0, 0,  false)
ON CONFLICT (leave_type) DO NOTHING;

-- ============================================================
-- ตาราง leave_balances: ยอดวันลาของพนักงานแต่ละปี
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id                uuid         NOT NULL DEFAULT gen_random_uuid(),
  user_id           uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year              integer      NOT NULL,
  leave_type        text         NOT NULL,
  entitled_days     numeric(5,1) NOT NULL DEFAULT 0, -- สิทธิ์พื้นฐานของปีนี้
  carried_over_days numeric(5,1) NOT NULL DEFAULT 0, -- ยกยอดมาจากปีก่อน
  total_days        numeric(5,1) GENERATED ALWAYS AS (entitled_days + carried_over_days) STORED,
  used_days         numeric(5,1) NOT NULL DEFAULT 0, -- ใช้ไปแล้ว (approved เท่านั้น)
  pending_days      numeric(5,1) NOT NULL DEFAULT 0, -- รอการอนุมัติ
  remaining_days    numeric(5,1) GENERATED ALWAYS AS
    (entitled_days + carried_over_days - used_days) STORED,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT leave_balances_pkey PRIMARY KEY (id),
  CONSTRAINT leave_balances_user_year_type_key UNIQUE (user_id, year, leave_type),
  CONSTRAINT leave_balances_leave_type_check CHECK (
    leave_type = ANY (ARRAY[
      'sick'::text, 'vacation'::text, 'personal'::text,
      'special_personal'::text, 'other'::text
    ])
  )
);

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_leave_balances_user_year
  ON public.leave_balances (user_id, year);

CREATE INDEX IF NOT EXISTS idx_leave_balances_user_type
  ON public.leave_balances (user_id, leave_type);

-- ============================================================
-- Function: สร้าง leave_balances สำหรับ user ทุก type ในปีที่กำหนด
-- ============================================================
CREATE OR REPLACE FUNCTION public.initialize_leave_balances(
  p_user_id uuid,
  p_year    integer DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  policy record;
  prev_remaining numeric(5,1);
  carry numeric(5,1);
BEGIN
  FOR policy IN
    SELECT * FROM public.leave_policies WHERE is_active = true
  LOOP
    -- คำนวณยกยอดจากปีก่อน (เฉพาะ vacation)
    carry := 0;
    IF policy.max_carry_over > 0 THEN
      SELECT COALESCE(remaining_days, 0)
        INTO prev_remaining
        FROM public.leave_balances
       WHERE user_id = p_user_id
         AND year = p_year - 1
         AND leave_type = policy.leave_type;

      -- ยกยอดได้แต่ total ไม่เกิน max_carry_over
      -- total = entitled_days(ปีใหม่) + carry_over
      -- carry_over = min(prev_remaining, max_carry_over - entitled_days)
      carry := LEAST(
        COALESCE(prev_remaining, 0),
        GREATEST(policy.max_carry_over - policy.days_per_year, 0)
      );
    END IF;

    INSERT INTO public.leave_balances (
      user_id, year, leave_type, entitled_days, carried_over_days
    )
    VALUES (
      p_user_id,
      p_year,
      policy.leave_type,
      policy.days_per_year,
      carry
    )
    ON CONFLICT (user_id, year, leave_type) DO NOTHING;
  END LOOP;
END;
$$;

-- ============================================================
-- Function: อัปเดต used_days / pending_days เมื่อ leave_request เปลี่ยนสถานะ
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_leave_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  req_year integer;
  req_days numeric(5,1);
  req_hours numeric(4,2);
  deduct   numeric(5,1);
BEGIN
  -- คำนวณ deduction (วัน หรือ ชั่วโมง/8 สำหรับ hourly)
  IF TG_OP = 'DELETE' THEN
    req_year  := EXTRACT(YEAR FROM OLD.start_date)::integer;
    req_days  := OLD.days;
    req_hours := OLD.hours;
  ELSE
    req_year  := EXTRACT(YEAR FROM NEW.start_date)::integer;
    req_days  := NEW.days;
    req_hours := NEW.hours;
  END IF;

  -- ถ้าเป็นการลาเป็นชั่วโมง ให้แปลงเป็นวัน (8 ชม = 1 วัน)
  IF req_hours IS NOT NULL AND req_hours > 0 THEN
    deduct := req_hours / 8.0;
  ELSE
    deduct := req_days;
  END IF;

  -- ── INSERT (สร้าง request ใหม่ → เพิ่ม pending) ──────────────
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    UPDATE public.leave_balances
       SET pending_days = pending_days + deduct,
           updated_at   = now()
     WHERE user_id    = NEW.user_id
       AND year       = req_year
       AND leave_type = NEW.leave_type;

  -- ── UPDATE: pending → approved ───────────────────────────────
  ELSIF TG_OP = 'UPDATE'
        AND OLD.status = 'pending'
        AND NEW.status = 'approved' THEN
    UPDATE public.leave_balances
       SET pending_days = GREATEST(pending_days - deduct, 0),
           used_days    = used_days + deduct,
           updated_at   = now()
     WHERE user_id    = NEW.user_id
       AND year       = req_year
       AND leave_type = NEW.leave_type;

  -- ── UPDATE: pending → rejected ───────────────────────────────
  ELSIF TG_OP = 'UPDATE'
        AND OLD.status = 'pending'
        AND NEW.status = 'rejected' THEN
    UPDATE public.leave_balances
       SET pending_days = GREATEST(pending_days - deduct, 0),
           updated_at   = now()
     WHERE user_id    = NEW.user_id
       AND year       = req_year
       AND leave_type = NEW.leave_type;

  -- ── UPDATE: approved → rejected (revert) ─────────────────────
  ELSIF TG_OP = 'UPDATE'
        AND OLD.status = 'approved'
        AND NEW.status = 'rejected' THEN
    UPDATE public.leave_balances
       SET used_days  = GREATEST(used_days - deduct, 0),
           updated_at = now()
     WHERE user_id    = NEW.user_id
       AND year       = req_year
       AND leave_type = NEW.leave_type;

  -- ── DELETE (ลบ pending request) ──────────────────────────────
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'pending' THEN
    UPDATE public.leave_balances
       SET pending_days = GREATEST(pending_days - deduct, 0),
           updated_at   = now()
     WHERE user_id    = OLD.user_id
       AND year       = req_year
       AND leave_type = OLD.leave_type;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ผูก trigger กับตาราง leave_requests
DROP TRIGGER IF EXISTS trg_sync_leave_balance ON public.leave_requests;
CREATE TRIGGER trg_sync_leave_balance
  AFTER INSERT OR UPDATE OF status OR DELETE
  ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.sync_leave_balance();

-- ============================================================
-- Function: set is_paid อัตโนมัติสำหรับ sick leave ที่เกิน limit
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_leave_paid_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  policy        public.leave_policies%ROWTYPE;
  already_used  numeric(5,1);
BEGIN
  -- ดึง policy
  SELECT * INTO policy
    FROM public.leave_policies
   WHERE leave_type = NEW.leave_type;

  -- ถ้าไม่มี sick_paid_limit หรือ = 0 → paid เสมอ
  IF policy.sick_paid_limit = 0 OR policy.sick_paid_limit IS NULL THEN
    NEW.is_paid := true;
    RETURN NEW;
  END IF;

  -- นับวันที่ใช้ไปแล้ว (approved) ในปีเดียวกัน ไม่รวม row นี้
  SELECT COALESCE(SUM(days), 0) INTO already_used
    FROM public.leave_requests
   WHERE user_id    = NEW.user_id
     AND leave_type = NEW.leave_type
     AND status     = 'approved'
     AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM NEW.start_date)
     AND id != COALESCE(NEW.id, gen_random_uuid());

  -- ถ้ายอดรวมยังไม่เกิน paid_limit → paid
  NEW.is_paid := (already_used + NEW.days) <= policy.sick_paid_limit;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_leave_paid_status ON public.leave_requests;
CREATE TRIGGER trg_set_leave_paid_status
  BEFORE INSERT ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_leave_paid_status();

-- ============================================================
-- RLS Policies
-- ============================================================

-- leave_policies: admin เขียนได้, ทุกคนอ่านได้
CREATE POLICY "Anyone can read leave policies"
  ON public.leave_policies FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can modify leave policies"
  ON public.leave_policies FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- leave_balances: user เห็นของตัวเอง, admin/manager เห็นทั้งหมด
CREATE POLICY "Users can view own leave balances"
  ON public.leave_balances FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins have full access to leave balances"
  ON public.leave_balances FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Managers can view dept leave balances"
  ON public.leave_balances FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles mgr
    WHERE mgr.id = auth.uid()
      AND mgr.role = 'manager'
      AND mgr.department = (
        SELECT emp.department FROM public.profiles emp WHERE emp.id = leave_balances.user_id
      )
  ));

-- ============================================================
-- View: leave_balances_with_policy (สะดวกสำหรับ query ฝั่ง client)
-- ============================================================
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
  -- คำนวณ % การใช้งาน
  CASE
    WHEN lb.total_days > 0
    THEN ROUND((lb.used_days / lb.total_days) * 100, 1)
    ELSE 0
  END AS used_pct
FROM public.leave_balances lb
JOIN public.leave_policies  lp ON lp.leave_type = lb.leave_type;

-- Grant
GRANT ALL ON TABLE public.leave_policies   TO authenticated, service_role;
GRANT ALL ON TABLE public.leave_balances   TO authenticated, service_role;
GRANT SELECT ON public.leave_balances_with_policy TO authenticated;