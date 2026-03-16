-- QR Display Page: Allow anon to read check-in data
-- ใช้สำหรับหน้า /qr-display ที่ไม่ต้อง login

CREATE POLICY "Anon can view profiles for qr display"
ON profiles
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Anon can view today checkins for qr display"
ON daily_time_logs
FOR SELECT
TO anon
USING (
  log_date = (NOW() AT TIME ZONE 'Asia/Bangkok')::date
  AND first_check_in IS NOT NULL
);