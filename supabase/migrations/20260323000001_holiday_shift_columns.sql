-- Add shift_type and dayoff_credit columns to daily_time_logs for holiday shift feature

ALTER TABLE daily_time_logs
  ADD COLUMN shift_type TEXT NOT NULL DEFAULT 'regular'
    CHECK (shift_type IN ('regular', 'holiday'));

ALTER TABLE daily_time_logs
  ADD COLUMN dayoff_credit TEXT DEFAULT NULL
    CHECK (dayoff_credit IN ('pending', 'earned', 'forfeited'));
