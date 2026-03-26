-- supabase/migrations/20260326000000_add_custom_fields_to_report_items.sql

ALTER TABLE public.daily_report_items
  ADD COLUMN IF NOT EXISTS custom_end_user_text   text,
  ADD COLUMN IF NOT EXISTS custom_project_no_text text;

COMMENT ON COLUMN public.daily_report_items.custom_end_user_text   
  IS 'Free-text end user name when end_user_id is NULL (Other option)';
COMMENT ON COLUMN public.daily_report_items.custom_project_no_text 
  IS 'Free-text project number when project_id is NULL (Other option)';