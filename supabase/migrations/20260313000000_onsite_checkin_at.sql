ALTER TABLE onsite_session_members 
ADD COLUMN IF NOT EXISTS checkin_at timestamptz NULL;

UPDATE onsite_session_members m
SET checkin_at = s.group_check_in
FROM onsite_sessions s
WHERE m.session_id = s.id
  AND s.group_check_in IS NOT NULL
  AND m.checkin_at IS NULL;