-- Vacation carry-over tooling.
-- Policy: vacation is granted 6 days/year and can accumulate to 12 days total.
-- The database stores leave balances in days; UI can display them as hours (days * 8).

UPDATE public.leave_policies
   SET days_per_year = 6,
       max_carry_over = 12,
       updated_at = now()
 WHERE leave_type = 'vacation';

CREATE OR REPLACE FUNCTION public.assert_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_role text;
BEGIN
  SELECT role
    INTO requester_role
    FROM public.profiles
   WHERE id = auth.uid()
     AND access_status = 'active';

  IF requester_role <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can perform this action.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_vacation_carry_over(
  p_year integer DEFAULT (EXTRACT(YEAR FROM CURRENT_DATE)::integer + 1)
)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  last_name text,
  department text,
  previous_year integer,
  target_year integer,
  previous_remaining_days numeric,
  carry_over_days numeric,
  entitled_days numeric,
  total_days numeric,
  previous_remaining_hours numeric,
  carry_over_hours numeric,
  total_hours numeric,
  already_initialized boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();

  RETURN QUERY
  WITH policy AS (
    SELECT
      lp.days_per_year,
      lp.max_carry_over
    FROM public.leave_policies lp
    WHERE lp.leave_type = 'vacation'
  ),
  preview AS (
    SELECT
      p.id AS user_id,
      p.first_name,
      p.last_name,
      p.department,
      p_year - 1 AS previous_year,
      p_year AS target_year,
      COALESCE(prev.remaining_days, 0)::numeric AS previous_remaining_days,
      LEAST(
        COALESCE(prev.remaining_days, 0),
        GREATEST(policy.max_carry_over - policy.days_per_year, 0)
      )::numeric AS carry_over_days,
      policy.days_per_year::numeric AS entitled_days,
      (target.id IS NOT NULL) AS already_initialized
    FROM public.profiles p
    CROSS JOIN policy
    LEFT JOIN public.leave_balances prev
      ON prev.user_id = p.id
     AND prev.year = p_year - 1
     AND prev.leave_type = 'vacation'
    LEFT JOIN public.leave_balances target
      ON target.user_id = p.id
     AND target.year = p_year
     AND target.leave_type = 'vacation'
    WHERE COALESCE(p.access_status, 'active') = 'active'
  )
  SELECT
    preview.user_id,
    preview.first_name,
    preview.last_name,
    preview.department,
    preview.previous_year,
    preview.target_year,
    preview.previous_remaining_days,
    preview.carry_over_days,
    preview.entitled_days,
    (preview.entitled_days + preview.carry_over_days)::numeric AS total_days,
    (preview.previous_remaining_days * 8)::numeric AS previous_remaining_hours,
    (preview.carry_over_days * 8)::numeric AS carry_over_hours,
    ((preview.entitled_days + preview.carry_over_days) * 8)::numeric AS total_hours,
    preview.already_initialized
  FROM preview
  ORDER BY preview.first_name, preview.last_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.initialize_leave_balances_for_year(
  p_year integer DEFAULT (EXTRACT(YEAR FROM CURRENT_DATE)::integer + 1)
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  employee record;
  processed_count integer := 0;
BEGIN
  PERFORM public.assert_admin();

  FOR employee IN
    SELECT p.id
    FROM public.profiles p
    WHERE COALESCE(p.access_status, 'active') = 'active'
  LOOP
    PERFORM public.initialize_leave_balances(employee.id, p_year);
    processed_count := processed_count + 1;
  END LOOP;

  RETURN processed_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_vacation_carry_over(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_leave_balances_for_year(integer) TO authenticated;

-- Restore leave balance initialization for new users.
-- The employee access-status migration replaced handle_new_user(), so keep the
-- pending-access behavior while also creating current-year leave balances.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    role,
    access_status
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'given_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'family_name', ''),
    'user',
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;

  PERFORM public.initialize_leave_balances(
    NEW.id,
    EXTRACT(YEAR FROM (now() AT TIME ZONE 'Asia/Bangkok'))::integer
  );

  RETURN NEW;
END;
$$;
