-- Match production UI: holiday_swap balances are displayed/managed in hours.
-- This also fixes local environments where the original seed used full-day mode.

INSERT INTO public.leave_policies
  (leave_type, label_th, days_per_year, max_carry_over, sick_paid_limit, allow_hourly, is_active)
VALUES
  ('holiday_swap', 'แลกวันหยุด', 0, 0, 0, true, true)
ON CONFLICT (leave_type)
DO UPDATE SET
  label_th = EXCLUDED.label_th,
  days_per_year = EXCLUDED.days_per_year,
  max_carry_over = EXCLUDED.max_carry_over,
  sick_paid_limit = EXCLUDED.sick_paid_limit,
  allow_hourly = true,
  is_active = true,
  updated_at = now();

