-- ============================================================
-- Migration: init leave balances for existing & new users
--
-- ปัญหา: handle_new_user() ไม่ได้เรียก initialize_leave_balances()
--        ทำให้ user ทุกคนไม่มีแถวใน leave_balances
--        และ view leave_balances_with_policy คืน empty
-- ============================================================

-- 1. อัพเดต handle_new_user() ให้ init leave balances ด้วย
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (new.id, '', '', 'employee');

  PERFORM public.initialize_leave_balances(
    new.id,
    EXTRACT(YEAR FROM CURRENT_DATE)::integer
  );

  RETURN new;
END;
$$;

-- 2. Backfill user ที่มีอยู่แล้วทั้งหมด ที่ยังไม่มี leave_balances ปีนี้
DO $$
DECLARE
  u        record;
  cur_year integer := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
BEGIN
  FOR u IN
    SELECT p.id
    FROM public.profiles p
    WHERE p.id NOT IN (
      SELECT DISTINCT lb.user_id
      FROM public.leave_balances lb
      WHERE lb.year = cur_year
    )
  LOOP
    PERFORM public.initialize_leave_balances(u.id, cur_year);
  END LOOP;
END;
$$;
