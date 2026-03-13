SELECT 
  user_id, 
  role, 
  checkout_type, 
  checkin_at,
  early_checkout_at
FROM onsite_session_members
WHERE session_id = '3ec4b68c-aa93-48d0-9311-74a44d0d65bd'
ORDER BY joined_at;