-- ① เข้างาน 08:30 เลิก 19:30 (OT จาก checkout = 18:00-19:30)
INSERT INTO daily_time_logs 
  (user_id, log_date, status, first_check_in, last_check_out, ot_hours, work_type)
VALUES (
  'ead99f60-41c2-49c5-9261-bc4ebabf03ef',
  '2026-03-05',
  'on_time',
  '2026-03-05T08:30:00+07:00',
  '2026-03-05T19:30:00+07:00',
  1.5,
  'in_factory'
);

-- ② เข้างาน 08:45 (มาสาย) เลิก 19:00 + มี OT Request เพิ่ม 19:00-20:30
INSERT INTO daily_time_logs 
  (user_id, log_date, status, first_check_in, last_check_out, ot_hours, work_type)
VALUES (
  'ead99f60-41c2-49c5-9261-bc4ebabf03ef',
  '2026-03-06',
  'late',
  '2026-03-06T08:45:00+07:00',
  '2026-03-06T19:00:00+07:00',
  1.0,
  'in_factory'
);

-- OT Request สำหรับวันที่ 6 (approved)
INSERT INTO ot_requests 
  (user_id, request_date, start_time, end_time, hours, reason, status)
VALUES (
  'ead99f60-41c2-49c5-9261-bc4ebabf03ef',
  '2026-03-06',
  '19:00',
  '20:30',
  1.5,
  'งานด่วน',
  'approved'
);

-- ③ เข้างาน 08:20 เลิก 17:30 (ไม่มี OT)
INSERT INTO daily_time_logs 
  (user_id, log_date, status, first_check_in, last_check_out, ot_hours, work_type)
VALUES (
  'ead99f60-41c2-49c5-9261-bc4ebabf03ef',
  '2026-03-07',
  'on_time',
  '2026-03-07T08:20:00+07:00',
  '2026-03-07T17:30:00+07:00',
  0,
  'in_factory'
);