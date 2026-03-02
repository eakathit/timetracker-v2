"use server";

// src/app/actions/onsite.ts

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type {
  CreateSessionInput,
  OnsiteSessionWithMembers,
  ActionResult,
  OnsiteTimelineEvent,
} from "@/types/onsite";

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Server Client — Server Action version
//
// ⚠️ Server Actions ต้องใช้ getAll + setAll (ไม่ใช่แค่ get)
//    เพราะ Action อาจต้อง refresh token และ write cookie กลับไปที่ browser
//    ถ้าใช้แค่ get → auth.uid() อาจเป็น null ใน RLS → INSERT สำเร็จแต่ SELECT กลับได้ 0 rows → 406
// ─────────────────────────────────────────────────────────────────────────────
async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Action อาจ throw ถ้า called จาก Server Component
            // ไม่ต้อง handle — token อ่านได้แล้วตอน getAll
          }
        },
      },
    }
  );
}

function getLocalToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. สร้าง Session ใหม่
// ─────────────────────────────────────────────────────────────────────────────
export async function createOnsiteSession(
  input: CreateSessionInput
): Promise<ActionResult<{ session_id: string; session_code: string }>> {
  try {
    console.log("🔥 [ACTION CALLED]", input);
    const supabase = await getSupabaseServer();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "กรุณาล็อกอินใหม่อีกครั้ง" };
    }

    const leaderId = user.id;
    const today    = getLocalToday();

    // ── Step 1: INSERT session ─────────────────────────────────────────────
    // ใช้ insert แล้ว select แยก เพื่อหลีกเลี่ยง 406 จาก .single() หลัง insert
    const { error: insertError } = await supabase
      .from("onsite_sessions")
      .insert({
        leader_id:    leaderId,
        site_name:    input.site_name.trim(),
        project_id:   input.project_id ?? null,
        status:       "open",
        session_date: today,
      });

    if (insertError) {
      console.error("[createOnsiteSession] insert error:", insertError);
      return { success: false, error: "สร้าง Session ไม่สำเร็จ: " + insertError.message };
    }

    // ── Step 2: SELECT session ที่เพิ่งสร้าง ─────────────────────────────
    // แยก SELECT ออกมา ไม่ chain กับ INSERT เพื่อหลีกเลี่ยง 406
    const { data: sessions, error: selectError } = await supabase
      .from("onsite_sessions")
      .select("id, session_code")
      .eq("leader_id", leaderId)
      .eq("session_date", today)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1);

    if (selectError || !sessions || sessions.length === 0) {
      console.error("[createOnsiteSession] select error:", selectError);
      return { success: false, error: "สร้างแล้วแต่อ่านข้อมูลกลับไม่ได้: " + (selectError?.message ?? "ไม่พบ session") };
    }

    const session = sessions[0];
    console.log("[createOnsiteSession] session ok:", session.id, "code:", session.session_code);

    // ── Step 3: INSERT members ────────────────────────────────────────────
    const memberRows = [
      { session_id: session.id, user_id: leaderId, role: "leader" },
      ...input.member_ids.map((uid) => ({
        session_id: session.id,
        user_id:    uid,
        role:       "member",
      })),
    ];

    const { error: membersError } = await supabase
      .from("onsite_session_members")
      .insert(memberRows);

    if (membersError) {
      console.error("[createOnsiteSession] members error:", membersError);
      // Rollback session
      await supabase.from("onsite_sessions").delete().eq("id", session.id);
      return { success: false, error: "เพิ่มสมาชิกไม่สำเร็จ: " + membersError.message };
    }

    console.log("[createOnsiteSession] done ✅", memberRows.length, "members");

    return {
      success: true,
      data: {
        session_id:   session.id,
        session_code: session.session_code ?? "",
      },
    };
  } catch (err) {
    console.error("[createOnsiteSession] unexpected:", err);
    return { success: false, error: "เกิดข้อผิดพลาด: " + String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ดึง Session + Members
// ─────────────────────────────────────────────────────────────────────────────
export async function getOnsiteSession(
  sessionId: string
): Promise<ActionResult<OnsiteSessionWithMembers>> {
  try {
    const supabase = await getSupabaseServer();

    const { data: rows, error } = await supabase
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
      .limit(1);

    if (error) return { success: false, error: error.message };
    if (!rows || rows.length === 0) return { success: false, error: "ไม่พบ Session" };

    return { success: true, data: rows[0] as OnsiteSessionWithMembers };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Active Session วันนี้
// ─────────────────────────────────────────────────────────────────────────────
export async function getTodayActiveSession(): Promise<
  ActionResult<OnsiteSessionWithMembers | null>
> {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const today = getLocalToday();

    const { data: membership } = await supabase
      .from("onsite_session_members")
      .select("session_id")
      .eq("user_id", user.id);

    if (!membership || membership.length === 0) return { success: true, data: null };

    const sessionIds = membership.map((m) => m.session_id);

    const { data: rows, error } = await supabase
      .from("onsite_sessions")
      .select(`
        *,
        project:projects ( id, project_no, name ),
        members:onsite_session_members (
          *,
          profile:profiles ( id, first_name, last_name, department, role )
        )
      `)
      .in("id", sessionIds)
      .eq("session_date", today)
      .neq("status", "closed")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) return { success: false, error: error.message };
    return { success: true, data: rows && rows.length > 0 ? (rows[0] as OnsiteSessionWithMembers) : null };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Group Check-in
// ─────────────────────────────────────────────────────────────────────────────
export async function groupCheckIn(sessionId: string): Promise<ActionResult> {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const now   = new Date().toISOString();
    const today = getLocalToday();

    // ดึง session
    const { data: sessions, error: sessionErr } = await supabase
      .from("onsite_sessions")
      .select("id, status, site_name, members:onsite_session_members(user_id)")
      .eq("id", sessionId)
      .eq("leader_id", user.id)
      .limit(1);

    if (sessionErr || !sessions || sessions.length === 0) {
      return { success: false, error: "ไม่พบ Session หรือคุณไม่ใช่ Leader" };
    }
    const session = sessions[0];
    if (session.status !== "open") return { success: false, error: "Session นี้ Check-in ไปแล้ว" };

    const memberUserIds = (session.members as { user_id: string }[]).map((m) => m.user_id);

    // อัปเดต session status
    const { error: updateErr } = await supabase
      .from("onsite_sessions")
      .update({ status: "checked_in", group_check_in: now })
      .eq("id", sessionId);

    if (updateErr) return { success: false, error: updateErr.message };

    // Upsert daily_time_logs ทุก member
    const newEvent: OnsiteTimelineEvent = {
      event: "onsite_checkin", timestamp: now,
      session_id: sessionId, site_name: session.site_name, synced_from: "leader",
    };

    const { data: existingLogs } = await supabase
      .from("daily_time_logs")
      .select("user_id, timeline_events")
      .in("user_id", memberUserIds)
      .eq("log_date", today);

    const existingMap = new Map(
      (existingLogs ?? []).map((l) => [l.user_id, l.timeline_events ?? []])
    );

    const { error: upsertErr } = await supabase
      .from("daily_time_logs")
      .upsert(
        memberUserIds.map((uid) => ({
          user_id:           uid,
          log_date:          today,
          work_type:         "on_site",
          first_check_in:    now,
          onsite_session_id: sessionId,
          timeline_events:   [...(existingMap.get(uid) ?? []), newEvent],
          status:            "active",
        })),
        { onConflict: "user_id,log_date" }
      );

    if (upsertErr) return { success: false, error: upsertErr.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Group Check-out
// ─────────────────────────────────────────────────────────────────────────────
export async function groupCheckOut(sessionId: string): Promise<ActionResult> {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const now   = new Date().toISOString();
    const today = getLocalToday();

    const { data: sessions, error: sessionErr } = await supabase
      .from("onsite_sessions")
      .select("id, status, members:onsite_session_members(user_id, checkout_type)")
      .eq("id", sessionId)
      .eq("leader_id", user.id)
      .limit(1);

    if (sessionErr || !sessions || sessions.length === 0) {
      return { success: false, error: "ไม่พบ Session หรือคุณไม่ใช่ Leader" };
    }
    const session = sessions[0];
    if (session.status !== "checked_in") return { success: false, error: "Session ยังไม่ได้ Check-in" };

    const pendingUids = (
      session.members as { user_id: string; checkout_type: string }[]
    )
      .filter((m) => m.checkout_type === "pending")
      .map((m) => m.user_id);

    await supabase
      .from("onsite_session_members")
      .update({ checkout_type: "group" })
      .eq("session_id", sessionId)
      .eq("checkout_type", "pending");

    await supabase
      .from("onsite_sessions")
      .update({ status: "closed", group_check_out: now, closed_at: now })
      .eq("id", sessionId);

    if (pendingUids.length > 0) {
      const checkoutEvent: OnsiteTimelineEvent = {
        event: "onsite_checkout", timestamp: now,
        session_id: sessionId, checkout_type: "group",
      };

      const { data: existingLogs } = await supabase
        .from("daily_time_logs")
        .select("user_id, timeline_events")
        .in("user_id", pendingUids)
        .eq("log_date", today);

      const existingMap = new Map(
        (existingLogs ?? []).map((l) => [l.user_id, l.timeline_events ?? []])
      );

      await supabase
        .from("daily_time_logs")
        .upsert(
          pendingUids.map((uid) => ({
            user_id:         uid,
            log_date:        today,
            work_type:       "on_site",
            last_check_out:  now,
            timeline_events: [...(existingMap.get(uid) ?? []), checkoutEvent],
          })),
          { onConflict: "user_id,log_date" }
        );
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Early Leave
// ─────────────────────────────────────────────────────────────────────────────
export async function earlyLeave(sessionId: string, note: string): Promise<ActionResult> {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const now   = new Date().toISOString();
    const today = getLocalToday();

    const { error: memberErr } = await supabase
      .from("onsite_session_members")
      .update({
        checkout_type:       "early",
        early_checkout_at:   now,
        early_checkout_note: note.trim() || null,
      })
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .eq("checkout_type", "pending");

    if (memberErr) return { success: false, error: memberErr.message };

    const { data: existingRows } = await supabase
      .from("daily_time_logs")
      .select("timeline_events")
      .eq("user_id", user.id)
      .eq("log_date", today)
      .limit(1);

    const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

    const timeline = [
      ...(existing?.timeline_events ?? []),
      { event: "onsite_early_leave", timestamp: now, session_id: sessionId, note: note.trim() || null } as OnsiteTimelineEvent,
      { event: "onsite_checkout", timestamp: now, session_id: sessionId, checkout_type: "early" } as OnsiteTimelineEvent,
    ];

    await supabase
      .from("daily_time_logs")
      .update({ last_check_out: now, timeline_events: timeline })
      .eq("user_id", user.id)
      .eq("log_date", today);

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. ประวัติ Sessions
// ─────────────────────────────────────────────────────────────────────────────
export async function getSessionHistory(limit = 10) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false as const, error: "Unauthorized" };

    const { data: membership } = await supabase
      .from("onsite_session_members")
      .select("session_id")
      .eq("user_id", user.id);

    if (!membership || membership.length === 0) return { success: true as const, data: [] };

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
  } catch (err) {
    return { success: false as const, error: String(err) };
  }
}