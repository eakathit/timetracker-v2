-- ============================================================
-- Fix: deduct ใน sync_leave_balance() เป็น numeric(5,1)
--      ทำให้ 3.5/8 = 0.4375 ถูก round → 0.4 → balance ผิด
-- แก้: เพิ่ม precision เป็น numeric(8,4)
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_leave_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  req_year integer;
  req_days numeric(5,1);
  req_hours numeric(4,2);
  deduct   numeric(8,4);   -- เพิ่ม precision จาก (5,1) → (8,4)
BEGIN
  IF TG_OP = 'DELETE' THEN
    req_year  := EXTRACT(YEAR FROM OLD.start_date)::integer;
    req_days  := OLD.days;
    req_hours := OLD.hours;
  ELSE
    req_year  := EXTRACT(YEAR FROM NEW.start_date)::integer;
    req_days  := NEW.days;
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
           updated_at   = now()
     WHERE user_id    = NEW.user_id
       AND year       = req_year
       AND leave_type = NEW.leave_type;

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

  ELSIF TG_OP = 'UPDATE'
        AND OLD.status = 'pending'
        AND NEW.status = 'rejected' THEN
    UPDATE public.leave_balances
       SET pending_days = GREATEST(pending_days - deduct, 0),
           updated_at   = now()
     WHERE user_id    = NEW.user_id
       AND year       = req_year
       AND leave_type = NEW.leave_type;

  ELSIF TG_OP = 'UPDATE'
        AND OLD.status = 'approved'
        AND NEW.status = 'rejected' THEN
    UPDATE public.leave_balances
       SET used_days  = GREATEST(used_days - deduct, 0),
           updated_at = now()
     WHERE user_id    = NEW.user_id
       AND year       = req_year
       AND leave_type = NEW.leave_type;

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
