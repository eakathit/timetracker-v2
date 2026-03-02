"use server";

// ============================================================
// app/actions/onsite.ts
// Server Actions สำหรับระบบ On-site Group Check-in/Out
// ============================================================

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type {
  CreateSessionInput,
  OnsiteSessionWithMembers,
  ActionResult,
  OnsiteTimelineEvent,
} from "@/types/onsite";

// ─── Supabase Server Client ───────────────────────────────────────────────────
async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}

/** Helper: ดึง user id ปัจจุบัน */
async function getCurrentUserId(): Promise<string> {
  const supabase = await getSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user.id;
}

/** Helper: วันนี้เป็น string "YYYY-MM-DD" (local) */
function getLocalToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. สร้าง Session ใหม่ (Leader)
// ─────────────────────────────────────────────────────────────────────────────
export async function createOnsiteSession(
  input: CreateSessionInput
): Promise<ActionResult<{ session_id: string; session_code: string }>> {
  try {
    const supabase  = await getSupabase();
    const leaderId  = await getCurrentUserId();
    const today     = getLocalToday();

    // 1. สร้าง Session (session_code จะถูก generate โดย Trigger อัตโนมัติ)
    const { data: session, error: sessionError } = await supabase
      .from("onsite_sessions")
      .insert({
        leader_id:    leaderId,
        site_name:    input.site_name.trim(),
        project_id:   input.project_id,
        status:       "open",
        session_date: today,
      })
      .select("id, session_code")
      .single();

    if (sessionError || !session) {
      return { success: false, error: sessionError?.message ?? "สร้าง Session ไม่สำเร็จ" };
    }

    // 2. เพิ่ม Leader เป็น member role='leader' ก่อน
    const memberRows = [
      { session_id: session.id, user_id: leaderId, role: "leader" as const },
      // เพิ่ม Members ที่ Leader เลือก
      ...input.member_ids.map((uid) => ({
        session_id: session.id,
        user_id:    uid,
        role:       "member" as const,
      })),
    ];

    const { error: membersError } = await supabase
      .from("onsite_session_members")
      .insert(memberRows);

    if (membersError) {
      // Rollback: ลบ session ที่สร้างไปแล้ว
      await supabase.from("onsite_sessions").delete().eq("id", session.id);
      return { success: false, error: "เพิ่มสมาชิกไม่สำเร็จ: " + membersError.message };
    }

    return {
      success: true,
      data: { session_id: session.id, session_code: session.session_code ?? "" },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ดึง Session พร้อม Members (ใช้แสดงในห้อง)
// ─────────────────────────────────────────────────────────────────────────────
export async function getOnsiteSession(
  sessionId: string
): Promise<ActionResult<OnsiteSessionWithMembers>> {
  try {
    const supabase = await getSupabase();

    const { data, error } = await supabase
      .from("onsite_sessions")
      .select(`
        *,
        project:projects ( id, project_no, name ),
        members:onsite_session_members (
          *,
          profile:profiles ( id, first_name, last_name, department, role )
        )
      `)
      .eq("id", sessionId)
      .single();

    if (error || !data) {
      return { success: false, error: error?.message ?? "ไม่พบ Session" };
    }

    return { success: true, data: data as OnsiteSessionWithMembers };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ดึง Active Session ของวันนี้ (สำหรับ Dashboard)
//    — ทั้งห้องที่เราเป็น Leader และห้องที่เราเป็น Member
// ─────────────────────────────────────────────────────────────────────────────
export async function getTodayActiveSession(): Promise<
  ActionResult<OnsiteSessionWithMembers | null>
> {
  try {
    const supabase = await getSupabase();
    const userId   = await getCurrentUserId();
    const today    = getLocalToday();

    // หา session_id ที่ user นี้อยู่ในวันนี้
    const { data: membership } = await supabase
      .from("onsite_session_members")
      .select("session_id")
      .eq("user_id", userId)
      .limit(1);

    if (!membership || membership.length === 0) {
      return { success: true, data: null };
    }

    // ดึง session ที่ยังไม่ปิด ของวันนี้
    const { data, error } = await supabase
      .from("onsite_sessions")
      .select(`
        *,
        project:projects ( id, project_no, name ),
        members:onsite_session_members (
          *,
          profile:profiles ( id, first_name, last_name, department, role )
        )
      `)
      .in("id", membership.map((m) => m.session_id))
      .eq("session_date", today)
      .neq("status", "closed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { success: false, error: error.message };

    return { success: true, data: (data as OnsiteSessionWithMembers) ?? null };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Group Check-in (Leader กด → ทุกคน Check-in พร้อมกัน)
// ─────────────────────────────────────────────────────────────────────────────
export async function groupCheckIn(
  sessionId: string
): Promise<ActionResult> {
  try {
    const supabase  = await getSupabase();
    const leaderId  = await getCurrentUserId();
    const now       = new Date().toISOString();
    const today     = getLocalToday();

    // ตรวจสอบว่า user เป็น Leader ของ session นี้จริง
    const { data: session, error: sessionErr } = await supabase
      .from("onsite_sessions")
      .select("id, status, site_name, members:onsite_session_members(user_id)")
      .eq("id", sessionId)
      .eq("leader_id", leaderId)
      .single();

    if (sessionErr || !session) {
      return { success: false, error: "ไม่พบ Session หรือคุณไม่ใช่ Leader" };
    }
    if (session.status !== "open") {
      return { success: false, error: "Session นี้ Check-in ไปแล้ว" };
    }

    const memberUserIds: string[] = (session.members as { user_id: string }[]).map(
      (m) => m.user_id
    );

    // ─── อัปเดต onsite_sessions → checked_in ───────────────
    const { error: updateErr } = await supabase
      .from("onsite_sessions")
      .update({ status: "checked_in", group_check_in: now })
      .eq("id", sessionId);

    if (updateErr) return { success: false, error: updateErr.message };

    // ─── Upsert daily_time_logs ทุก member พร้อมกัน ────────
    const newEvent: OnsiteTimelineEvent = {
      event:       "onsite_checkin",
      timestamp:   now,
      session_id:  sessionId,
      site_name:   session.site_name,
      synced_from: "leader",
    };

    // ดึง existing logs ของวันนี้ก่อน (เพื่อ merge timeline_events)
    const { data: existingLogs } = await supabase
      .from("daily_time_logs")
      .select("user_id, timeline_events")
      .in("user_id", memberUserIds)
      .eq("log_date", today);

    const existingMap = new Map(
      (existingLogs ?? []).map((l) => [l.user_id, l.timeline_events ?? []])
    );

    // Upsert แต่ละคน
    const upsertRows = memberUserIds.map((uid) => {
      const existing = existingMap.get(uid) ?? [];
      return {
        user_id:           uid,
        log_date:          today,
        work_type:         "on_site",
        first_check_in:    now,
        onsite_session_id: sessionId,
        timeline_events:   [...existing, newEvent],
        status:            "active",
      };
    });

    const { error: upsertErr } = await supabase
      .from("daily_time_logs")
      .upsert(upsertRows, { onConflict: "user_id,log_date" });

    if (upsertErr) return { success: false, error: upsertErr.message };

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Group Check-out (Leader กด → ทุกคนที่ยัง pending ออกพร้อมกัน)
// ─────────────────────────────────────────────────────────────────────────────
export async function groupCheckOut(
  sessionId: string
): Promise<ActionResult> {
  try {
    const supabase = await getSupabase();
    const leaderId = await getCurrentUserId();
    const now      = new Date().toISOString();
    const today    = getLocalToday();

    // ตรวจสิทธิ์ + ดึง members ที่ยัง pending
    const { data: session, error: sessionErr } = await supabase
      .from("onsite_sessions")
      .select(`
        id, status, site_name,
        members:onsite_session_members!inner(user_id, checkout_type)
      `)
      .eq("id", sessionId)
      .eq("leader_id", leaderId)
      .single();

    if (sessionErr || !session) {
      return { success: false, error: "ไม่พบ Session หรือคุณไม่ใช่ Leader" };
    }
    if (session.status !== "checked_in") {
      return { success: false, error: "Session ยังไม่ได้ Check-in หรือ ปิดไปแล้ว" };
    }

    // เฉพาะ member ที่ยัง pending (ยังไม่ออก early)
    const pendingUids: string[] = (
      session.members as { user_id: string; checkout_type: string }[]
    )
      .filter((m) => m.checkout_type === "pending")
      .map((m) => m.user_id);

    // ─── อัปเดต onsite_session_members → checkout_type = 'group' ───
    const { error: memberUpdateErr } = await supabase
      .from("onsite_session_members")
      .update({ checkout_type: "group" })
      .eq("session_id", sessionId)
      .eq("checkout_type", "pending");

    if (memberUpdateErr) return { success: false, error: memberUpdateErr.message };

    // ─── ปิด Session ───────────────────────────────────────────────
    await supabase
      .from("onsite_sessions")
      .update({ status: "closed", group_check_out: now, closed_at: now })
      .eq("id", sessionId);

    // ─── อัปเดต daily_time_logs ของ pending members ───────────────
    if (pendingUids.length > 0) {
      const checkoutEvent: OnsiteTimelineEvent = {
        event:         "onsite_checkout",
        timestamp:     now,
        session_id:    sessionId,
        checkout_type: "group",
      };

      const { data: existingLogs } = await supabase
        .from("daily_time_logs")
        .select("user_id, timeline_events")
        .in("user_id", pendingUids)
        .eq("log_date", today);

      const existingMap = new Map(
        (existingLogs ?? []).map((l) => [l.user_id, l.timeline_events ?? []])
      );

      const upsertRows = pendingUids.map((uid) => {
        const existing = existingMap.get(uid) ?? [];
        return {
          user_id:         uid,
          log_date:        today,
          work_type:       "on_site",
          last_check_out:  now,
          timeline_events: [...existing, checkoutEvent],
        };
      });

      await supabase
        .from("daily_time_logs")
        .upsert(upsertRows, { onConflict: "user_id,log_date" });
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Early Leave (Member ออกก่อนกลุ่ม)
// ─────────────────────────────────────────────────────────────────────────────
export async function earlyLeave(
  sessionId: string,
  note: string
): Promise<ActionResult> {
  try {
    const supabase = await getSupabase();
    const userId   = await getCurrentUserId();
    const now      = new Date().toISOString();
    const today    = getLocalToday();

    // อัปเดต membership
    const { error: memberErr } = await supabase
      .from("onsite_session_members")
      .update({
        checkout_type:      "early",
        early_checkout_at:  now,
        early_checkout_note: note.trim() || null,
      })
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .eq("checkout_type", "pending"); // ป้องกัน double-checkout

    if (memberErr) return { success: false, error: memberErr.message };

    // อัปเดต daily_time_logs ของ member คนนี้
    const earlyEvent: OnsiteTimelineEvent = {
      event:      "onsite_early_leave",
      timestamp:  now,
      session_id: sessionId,
      note:       note.trim() || null,
    };
    const checkoutEvent: OnsiteTimelineEvent = {
      event:         "onsite_checkout",
      timestamp:     now,
      session_id:    sessionId,
      checkout_type: "early",
    };

    const { data: existing } = await supabase
      .from("daily_time_logs")
      .select("timeline_events")
      .eq("user_id", userId)
      .eq("log_date", today)
      .maybeSingle();

    const timeline = [...(existing?.timeline_events ?? []), earlyEvent, checkoutEvent];

    await supabase
      .from("daily_time_logs")
      .update({ last_check_out: now, timeline_events: timeline })
      .eq("user_id", userId)
      .eq("log_date", today);

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. ดึงรายชื่อพนักงานทั้งหมด (สำหรับ Leader ค้นหาเพิ่ม Member)
// ─────────────────────────────────────────────────────────────────────────────
export async function getAllEmployees() {
  const supabase = await getSupabase();
  const userId   = await getCurrentUserId();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, department, role")
    .neq("id", userId)          // ไม่เอาตัวเอง (Leader เพิ่มเป็น role='leader' อัตโนมัติ)
    .order("first_name", { ascending: true });

  if (error) return { success: false as const, error: error.message };
  return { success: true as const, data: data ?? [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. ดึงประวัติ Sessions (สำหรับหน้า History)
// ─────────────────────────────────────────────────────────────────────────────
export async function getSessionHistory(limit = 10) {
  const supabase = await getSupabase();
  const userId   = await getCurrentUserId();

  const { data: membership } = await supabase
    .from("onsite_session_members")
    .select("session_id")
    .eq("user_id", userId);

  if (!membership || membership.length === 0) {
    return { success: true as const, data: [] };
  }

  const { data, error } = await supabase
    .from("onsite_sessions")
    .select(`
      id, site_name, session_date, status,
      group_check_in, group_check_out, session_code,
      project:projects ( project_no, name ),
      members:onsite_session_members ( user_id, role, checkout_type )
    `)
    .in("id", membership.map((m) => m.session_id))
    .order("session_date", { ascending: false })
    .limit(limit);

  if (error) return { success: false as const, error: error.message };
  return { success: true as const, data: data ?? [] };
}