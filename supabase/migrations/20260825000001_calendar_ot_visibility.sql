-- ============================================================
-- Migration: Allow all authenticated users to view approved
--            OT requests in the Calendar page
-- ============================================================

-- ── OT Requests: ทุก role เห็น OT ที่ "approved" ได้ ──────────────────────
-- Policy นี้ช่วยให้พนักงานมองเห็น OT ที่อนุมัติแล้วของเพื่อนร่วมงาน
-- ในหน้า ปฏิทิน OT (Calendar OT)

drop policy if exists "All authenticated users can view approved OT requests" on ot_requests;

create policy "All authenticated users can view approved OT requests"
  on "public"."ot_requests"
  as permissive
  for select
  to authenticated
  using (status = 'approved');
