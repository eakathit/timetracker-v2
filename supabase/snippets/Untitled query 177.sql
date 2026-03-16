-- ลบ policy เก่าที่ใช้ CURRENT_DATE (UTC)
DROP POLICY IF EXISTS "Anon can view today checkins for qr display" ON daily_time_logs;

-- สร้างใหม่ให้ใช้ timezone Bangkok แทน
CREATE POLICY "Anon can view today checkins for qr display"
ON daily_time_logs
FOR SELECT
TO anon
USING (
  log_date = (NOW() AT TIME ZONE 'Asia/Bangkok')::date
  AND first_check_in IS NOT NULL
);