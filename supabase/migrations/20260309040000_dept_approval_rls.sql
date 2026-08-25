-- supabase/migrations/20260309_dept_approval_rls.sql

-- ── OT Requests: Manager เห็นแค่แผนกตัวเอง, Admin เห็นทุกแผนก ──────────────
drop policy if exists "manager_sees_dept_ot" on ot_requests;
create policy "manager_sees_dept_ot" on ot_requests
  for select using (
    auth.uid() = user_id  -- เจ้าของดูของตัวเองได้
    or exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'admin'  -- admin เห็นทั้งหมด
    )
    or exists (
      select 1 from profiles manager_p
      join  profiles requester_p on requester_p.id = ot_requests.user_id
      where manager_p.id   = auth.uid()
        and manager_p.role = 'manager'
        and manager_p.department = requester_p.department  -- manager เห็นแค่แผนกตัวเอง
    )
  );

-- ── Leave Requests: เหมือนกัน ─────────────────────────────────────────────────
drop policy if exists "manager_sees_dept_leave" on leave_requests;
create policy "manager_sees_dept_leave" on leave_requests
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
    or exists (
      select 1 from profiles manager_p
      join  profiles requester_p on requester_p.id = leave_requests.user_id
      where manager_p.id   = auth.uid()
        and manager_p.role = 'manager'
        and manager_p.department = requester_p.department
    )
  );

-- ── Allow manager/admin to UPDATE (approve/reject) ───────────────────────────
drop policy if exists "manager_can_action_ot" on ot_requests;
create policy "manager_can_action_ot" on ot_requests
  for update using (
    exists (
      select 1 from profiles manager_p
      join  profiles requester_p on requester_p.id = ot_requests.user_id
      where manager_p.id   = auth.uid()
        and manager_p.role in ('manager', 'admin')
        and (
          manager_p.role = 'admin'
          or manager_p.department = requester_p.department
        )
    )
  );

drop policy if exists "manager_can_action_leave" on leave_requests;
create policy "manager_can_action_leave" on leave_requests
  for update using (
    exists (
      select 1 from profiles manager_p
      join  profiles requester_p on requester_p.id = leave_requests.user_id
      where manager_p.id   = auth.uid()
        and manager_p.role in ('manager', 'admin')
        and (
          manager_p.role = 'admin'
          or manager_p.department = requester_p.department
        )
    )
  );