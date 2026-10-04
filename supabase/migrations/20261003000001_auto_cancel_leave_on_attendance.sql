-- ============================================================
-- Migration: Auto-Cancel Leave On Attendance Check-In
-- ============================================================

-- 0. ตรวจสอบให้แน่ใจว่า leave_requests รองรับ holiday_swap
ALTER TABLE public.leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_leave_type_check;

ALTER TABLE public.leave_requests
  ADD CONSTRAINT leave_requests_leave_type_check
  CHECK (leave_type = ANY (ARRAY[
    'sick'::text, 'vacation'::text, 'personal'::text,
    'special_personal'::text, 'other'::text, 'maternity'::text,
    'holiday_swap'::text
  ]));

-- 1. ปรับปรุง cleanup_cancelled_leave_attendance trigger ให้คง work_type ที่ถูกต้อง
CREATE OR REPLACE FUNCTION public.cleanup_cancelled_leave_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'cancelled' OR OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- ลบแถวลาที่ว่างเปล่า (ไม่มีเวลาเข้า-ออกจริง)
  DELETE FROM public.daily_time_logs dtl
   WHERE dtl.user_id = NEW.user_id
     AND dtl.status = 'leave'
     AND dtl.first_check_in IS NULL
     AND dtl.last_check_out IS NULL
     AND dtl.log_date BETWEEN NEW.start_date AND NEW.end_date;

  -- ถ้ามีเวลาเข้างานจริง ให้คง work_type ไว้ (หรือ fallback ตาม onsite_session) และคำนวณ status จากเวลาเข้างานจริง
  UPDATE public.daily_time_logs dtl
     SET work_type = CASE 
           WHEN dtl.work_type = 'leave' OR dtl.work_type IS NULL THEN
             CASE 
               WHEN dtl.onsite_session_id IS NOT NULL THEN 'on_site'
               ELSE 'in_factory'
             END
           ELSE dtl.work_type
         END,
         status = CASE
           WHEN dtl.shift_type = 'holiday' THEN 'on_time'
           WHEN (
             EXTRACT(HOUR FROM dtl.first_check_in AT TIME ZONE 'Asia/Bangkok') * 60
             + EXTRACT(MINUTE FROM dtl.first_check_in AT TIME ZONE 'Asia/Bangkok')
           ) > 510 THEN 'late'
           ELSE 'on_time'
         END
   WHERE dtl.user_id = NEW.user_id
     AND dtl.first_check_in IS NOT NULL
     AND dtl.log_date BETWEEN NEW.start_date AND NEW.end_date
     AND NOT EXISTS (
       SELECT 1
       FROM public.leave_requests active_leave
       WHERE active_leave.id <> NEW.id
         AND active_leave.user_id = dtl.user_id
         AND active_leave.status IN ('approved', 'cancel_requested')
         AND dtl.log_date BETWEEN active_leave.start_date AND active_leave.end_date
     );

  RETURN NEW;
END;
$$;

-- 2. สร้าง RPC Function: auto_cancel_leave_for_attendance
-- ทำหน้าที่ยกเลิกใบลาเต็มวันอัตโนมัติเมื่อพนักงานมาเข้างานจริง
-- Trigger trg_sync_leave_balance จะคืนโควตาวันลา (remaining_days) ให้โดยอัตโนมัติ
CREATE OR REPLACE FUNCTION public.auto_cancel_leave_for_attendance(
  p_user_id uuid,
  p_date date,
  p_checkin_time timestamptz DEFAULT now(),
  p_action_by uuid DEFAULT NULL
)
RETURNS TABLE (
  cancelled_request_id uuid,
  leave_type text,
  refunded_days numeric,
  refunded_hours numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_thai_time text;
  v_reason text;
  v_actor uuid;
BEGIN
  v_actor := COALESCE(p_action_by, p_user_id);
  v_thai_time := to_char(p_checkin_time AT TIME ZONE 'Asia/Bangkok', 'HH24:MI');
  v_reason := 'ระบบยกเลิกการลาอัตโนมัติ เนื่องจากพนักงานเข้าทำงานจริง ณ เวลา ' || v_thai_time || ' น.';

  FOR r IN
    SELECT lr.id, lr.leave_type, lr.days, lr.hours
    FROM public.leave_requests lr
    WHERE lr.user_id = p_user_id
      AND p_date BETWEEN lr.start_date AND lr.end_date
      AND lr.status = 'approved'
      AND (
        lr.hours IS NULL 
        OR lr.period_label IS NULL 
        OR lr.period_label = 'ทั้งวัน'
        OR lr.period_label = convert_from(decode('e0b897e0b8b1e0b989e0b887e0b8a7e0b8b1e0b899', 'hex'), 'UTF8')
      )
      AND (lr.period_label IS NULL OR lr.period_label NOT LIKE '%:%')
    FOR UPDATE
  LOOP
    UPDATE public.leave_requests
       SET status = 'cancelled',
           cancel_reason = v_reason,
           cancel_requested_at = COALESCE(cancel_requested_at, now()),
           cancel_actioned_by = v_actor,
           cancel_actioned_at = now()
     WHERE id = r.id;

    cancelled_request_id := r.id;
    leave_type := r.leave_type;
    refunded_days := r.days;
    refunded_hours := r.hours;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_cancel_leave_for_attendance(uuid, date, timestamptz, uuid) TO authenticated, service_role;
