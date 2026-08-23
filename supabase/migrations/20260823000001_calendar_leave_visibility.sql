-- ============================================================
-- Migration: Allow all authenticated users to view approved
--            leave requests in the Calendar page
-- ============================================================

-- ── Leave Requests: ทุก role เห็นการลาที่ "approved" ได้ ──────────────────────
-- Policy นี้ช่วยให้ Employee ทั่วไปมองเห็น avatar การลาของเพื่อนร่วมงาน
-- ในหน้า Calendar โดยจำกัดเฉพาะ status = 'approved' เท่านั้น
-- (Pending / Rejected ยังคงถูกซ่อน)

drop policy if exists "All authenticated users can view approved leave requests" on leave_requests;

create policy "All authenticated users can view approved leave requests"
  on "public"."leave_requests"
  as permissive
  for select
  to authenticated
  using (status = 'approved');
