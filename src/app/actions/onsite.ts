"use server";

// src/app/actions/onsite.ts

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type {
  CreateSessionInput,
  OnsiteSessionWithMembers,
  ActionResult,
  OnsiteTimelineEvent,
  MemberProfile,
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
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Action อาจ throw ถ้า called จาก Server Component
            // ไม่ต้อง handle — token อ่านได้แล้วตอน getAll
          }
        },
      },
    },
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
  input: CreateSessionInput,
): Promise<ActionResult<{ session_id: string; session_code: string }>> {
  try {
    console.log("🔥 [ACTION CALLED]", input);
    const supabase = await getSupabaseServer();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "กรุณาล็อกอินใหม่อีกครั้ง" };
    }

    const leaderId = user.id;
    const today = getLocalToday();

    // ── Step 1: INSERT session ─────────────────────────────────────────────
    // ใช้ insert แล้ว select แยก เพื่อหลีกเลี่ยง 406 จาก .single() หลัง insert
    const { error: insertError } = await supabase
      .from("onsite_sessions")
      .insert({
        leader_id: leaderId,
        site_name: input.site_name.trim(),
        project_id: input.project_id ?? null,
        status: "open",
        session_date: today,
      });

    if (insertError) {
      console.error("[createOnsiteSession] insert error:", insertError);
      return {
        success: false,
        error: "สร้าง Session ไม่สำเร็จ: " + insertError.message,
      };
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
      return {
        success: false,
        error:
          "สร้างแล้วแต่อ่านข้อมูลกลับไม่ได้: " +
          (selectError?.message ?? "ไม่พบ session"),
      };
    }

    const session = sessions[0];
    console.log(
      "[createOnsiteSession] session ok:",
      session.id,
      "code:",
      session.session_code,
    );

    // ── Step 3: INSERT members ────────────────────────────────────────────
    const memberRows = [
      { session_id: session.id, user_id: leaderId, role: "leader" },
      ...input.member_ids.map((uid) => ({
        session_id: session.id,
        user_id: uid,
        role: "member",
      })),
    ];

    const { error: membersError } = await supabase
      .from("onsite_session_members")
      .insert(memberRows);

    if (membersError) {
      console.error("[createOnsiteSession] members error:", membersError);
      // Rollback session
      await supabase.from("onsite_sessions").delete().eq("id", session.id);
      return {
        success: false,
        error: "เพิ่มสมาชิกไม่สำเร็จ: " + membersError.message,
      };
    }

    console.log("[createOnsiteSession] done ✅", memberRows.length, "members");

    return {
      success: true,
      data: {
        session_id: session.id,
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
  sessionId: string,
): Promise<ActionResult<OnsiteSessionWithMembers>> {
  try {
    const supabase = await getSupabaseServer();

    const { data: rows, error } = await supabase
      .from("onsite_sessions")
      .select(
        `
        *,
        project:projects ( id, project_no, name ),
        members:onsite_session_members (
          *,
          profile:profiles_with_avatar ( id, first_name, last_name, department, role, avatar_url )
        )
      `,
      )
      .eq("id", sessionId)
      .limit(1);

    if (error) return { success: false, error: error.message };
    if (!rows || rows.length === 0)
      return { success: false, error: "ไม่พบ Session" };

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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const today = getLocalToday();

    const { data: membership } = await supabase
      .from("onsite_session_members")
      .select("session_id")
      .eq("user_id", user.id);

    if (!membership || membership.length === 0)
      return { success: true, data: null };

    const sessionIds = membership.map((m) => m.session_id);

    const { data: rows, error } = await supabase
      .from("onsite_sessions")
      .select(
        `
        *,
        project:projects ( id, project_no, name ),
        members:onsite_session_members (
          *,
        profile:profiles_with_avatar ( id, first_name, last_name, department, role, avatar_url )
        )
      `,
      )
      .in("id", sessionIds)
      .eq("session_date", today)
      .neq("status", "closed")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) return { success: false, error: error.message };
    return {
      success: true,
      data:
        rows && rows.length > 0 ? (rows[0] as OnsiteSessionWithMembers) : null,
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// Halper: คำนวณ status จากเวลา check-in (เหมือน factory)
function calcAttendanceStatus(checkInIso: string): "on_time" | "late" {
  const checkIn = new Date(checkInIso);
  const lateThreshold = new Date(checkIn);
  lateThreshold.setHours(8, 31, 0, 0); // 08:31:00 ถึงสาย
  return checkIn >= lateThreshold ? "late" : "on_time";
}

// Helper: ตรวจสอบสิทธิ์เบี้ยเลี้ยง On-site (Check-in ก่อน 08:30)
function calcDailyAllowance(checkInIso: string): boolean {
  const checkIn = new Date(checkInIso);
  const cutoff = new Date(checkIn);
  cutoff.setHours(8, 30, 0, 0);
  return checkIn < cutoff; // true = ก่อน 08:30 → ได้เบี้ยเลี้ยง
}

// Helper: คำนวณ OT On-site นับจาก 17:30 (ต่างจาก Factory ที่นับ 18:00)
function calcOnsiteOTHours(checkoutIso: string): number {
  const checkout = new Date(checkoutIso);
  const otStart = new Date(checkout);
  otStart.setHours(17, 30, 0, 0);
  if (checkout <= otStart) return 0;
  const diffHours = (checkout.getTime() - otStart.getTime()) / (1000 * 60 * 60);
  return Math.round(diffHours * 100) / 100; // ← ตามจริง
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Group Check-in
// ─────────────────────────────────────────────────────────────────────────────
export async function groupCheckIn(sessionId: string): Promise<ActionResult> {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const now = new Date().toISOString();
    const today = getLocalToday();

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
    if (session.status !== "open") {
      return { success: false, error: "Session นี้ Check-in ไปแล้ว" };
    }

    const memberUserIds = (session.members as { user_id: string }[]).map(
      (m) => m.user_id,
    );

    const { error: updateErr } = await supabase
      .from("onsite_sessions")
      .update({ status: "checked_in", group_check_in: now })
      .eq("id", sessionId);

    if (updateErr) return { success: false, error: updateErr.message };

    const newEvent: OnsiteTimelineEvent = {
      event: "onsite_checkin",
      timestamp: now,
      session_id: sessionId,
      site_name: session.site_name,
      synced_from: "leader",
    };

    const { data: existingLogs } = await supabase
      .from("daily_time_logs")
      .select("user_id, timeline_events")
      .in("user_id", memberUserIds)
      .eq("log_date", today);

    const existingMap = new Map(
      (existingLogs ?? []).map((l) => [l.user_id, l.timeline_events ?? []]),
    );

    // ✅ คำนวณ attendance status ที่ถูกต้อง
    const attendanceStatus = calcAttendanceStatus(now);
    const dailyAllowance = calcDailyAllowance(now); // ก่อน 08:30 = true

    const { error: upsertErr } = await supabase.from("daily_time_logs").upsert(
      memberUserIds.map((uid) => ({
        user_id: uid,
        log_date: today,
        work_type: "on_site",
        first_check_in: now,
        onsite_session_id: sessionId,
        timeline_events: [...(existingMap.get(uid) ?? []), newEvent],
        status: attendanceStatus,
        daily_allowance: dailyAllowance, // ✅ เพิ่มบรรทัดนี้
      })),
      { onConflict: "user_id,log_date" },
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
export async function groupCheckOut(
  sessionId: string,
  breakMinutes: number = 0,
): Promise<ActionResult> {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const now = new Date().toISOString();
    const today = getLocalToday();

    const { data: sessions, error: sessionErr } = await supabase
      .from("onsite_sessions")
      .select(
        "id, status, members:onsite_session_members(user_id, checkout_type)",
      )
      .eq("id", sessionId)
      .eq("leader_id", user.id)
      .limit(1);

    if (sessionErr || !sessions || sessions.length === 0) {
      return { success: false, error: "ไม่พบ Session หรือคุณไม่ใช่ Leader" };
    }
    const session = sessions[0];
    if (session.status !== "checked_in")
      return { success: false, error: "Session ยังไม่ได้ Check-in" };

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
      // ── คำนวณ OT ก่อน checkoutEvent ──────────────────────────
      const rawOT = calcOnsiteOTHours(now);
      const adjHours = Math.max(0, rawOT - breakMinutes / 60);
      const otHours = Math.round(adjHours * 100) / 100;

      const checkoutEvent = {
        event: "onsite_checkout",
        timestamp: now,
        session_id: sessionId,
        checkout_type: "group" as const,
        break_minutes: breakMinutes,
        raw_ot_hours: rawOT,
        net_ot_hours: otHours,
        ot_starts_from: "17:30",
      };

      const { data: existingLogs } = await supabase
        .from("daily_time_logs")
        .select("user_id, timeline_events, first_check_in, work_type")
        .in("user_id", pendingUids)
        .eq("log_date", today);

      const existingMap = new Map(
        (existingLogs ?? []).map((l) => [l.user_id, l]),
      );

      await supabase.from("daily_time_logs").upsert(
        pendingUids.map((uid) => {
          const existing = existingMap.get(uid);
          const currentWorkType = existing?.work_type ?? "on_site";

          return {
            user_id: uid,
            log_date: today,
            work_type: currentWorkType, // ← ใช้ตรงนี้
            last_check_out: now,
            ot_hours: otHours,
            timeline_events: [
              ...(existing?.timeline_events ?? []),
              checkoutEvent,
            ],
          };
        }),
        { onConflict: "user_id,log_date" },
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
export async function earlyLeave(
  sessionId: string,
  note: string,
): Promise<ActionResult> {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const now = new Date().toISOString();
    const today = getLocalToday();

    const { error: memberErr } = await supabase
      .from("onsite_session_members")
      .update({
        checkout_type: "early",
        early_checkout_at: now,
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

    const existing =
      existingRows && existingRows.length > 0 ? existingRows[0] : null;

    // ── เปลี่ยนจาก otHours → rawOtHours ──────────────────────────
    const rawOtHours = calcOnsiteOTHours(now); // นับจาก 17:30

    const timeline = [
      ...(existing?.timeline_events ?? []),
      {
        event: "onsite_early_leave",
        timestamp: now,
        session_id: sessionId,
        note: note.trim() || null,
      },
      {
        event: "onsite_checkout",
        timestamp: now,
        session_id: sessionId,
        checkout_type: "early" as const,
        break_minutes: 0, // early leave ไม่มีเบรค
        raw_ot_hours: rawOtHours,
        net_ot_hours: rawOtHours, // ไม่หักเบรค
        ot_starts_from: "17:30",
      },
    ];

    await supabase
      .from("daily_time_logs")
      .update({
        last_check_out: now,
        ot_hours: rawOtHours, // ← เปลี่ยนจาก otHours
        timeline_events: timeline,
      })
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false as const, error: "Unauthorized" };

    const { data: membership } = await supabase
      .from("onsite_session_members")
      .select("session_id")
      .eq("user_id", user.id);

    if (!membership || membership.length === 0)
      return { success: true as const, data: [] };

    const { data, error } = await supabase
      .from("onsite_sessions")
      .select(
        `
        id, site_name, session_date, status,
        group_check_in, group_check_out, session_code,
        project:projects ( project_no, name ),
        members:onsite_session_members ( user_id, role, checkout_type )
      `,
      )
      .in(
        "id",
        membership.map((m) => m.session_id),
      )
      .order("session_date", { ascending: false })
      .limit(limit);

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data: data ?? [] };
  } catch (err) {
    return { success: false as const, error: String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. เพิ่มสมาชิกระหว่าง Session (Mid-session)
// ─────────────────────────────────────────────────────────────────────────────
export async function addMidSessionMember(
  sessionId: string,
  targetUserId: string,
): Promise<ActionResult<{ member: unknown }>> {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    // เช็ค session + leader
    const { data: sessions } = await supabase
      .from("onsite_sessions")
      .select("id, status, leader_id, site_name")
      .eq("id", sessionId)
      .limit(1);

    const session = sessions?.[0];
    if (!session) return { success: false, error: "ไม่พบ Session" };
    if (session.leader_id !== user.id)
      return { success: false, error: "เฉพาะ Leader เท่านั้น" };
    if (session.status !== "checked_in")
      return { success: false, error: "Session ต้องอยู่ในสถานะ checked_in" };

    // เช็คซ้ำ
    const { data: existing } = await supabase
      .from("onsite_session_members")
      .select("id")
      .eq("session_id", sessionId)
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (existing)
      return { success: false, error: "พนักงานคนนี้อยู่ในห้องแล้ว" };

    const now = new Date().toISOString();
    const today = getLocalToday();

    // ✅ ใช้ now เป็น effective check-in เสมอ
    // เพราะพนักงานที่เพิ่มกลางวันไม่ควรได้ daily_allowance เหมือนคนที่เข้าก่อน 08:30
    const attendanceStatus = calcAttendanceStatus(now);
    const dailyAllowance = calcDailyAllowance(now);

    // Insert member
    const { data: newMember, error: mErr } = await supabase
      .from("onsite_session_members")
      .insert({
        session_id: sessionId,
        user_id: targetUserId,
        role: "member",
        checkout_type: "pending",
        checkin_at: now, // ✅ เวลาที่ leader กดเพิ่มจริงๆ
      })
      .select()
      .single();

    if (mErr) return { success: false, error: mErr.message };

    // Timeline event
    const newEvent: OnsiteTimelineEvent = {
      event: "onsite_checkin",
      timestamp: now,
      session_id: sessionId,
      site_name: session.site_name,
      synced_from: "leader_mid_session",
    };

    // ดึง existing log ของพนักงานวันนี้
    const { data: existingRows } = await supabase
      .from("daily_time_logs")
      .select("id, timeline_events")
      .eq("user_id", targetUserId)
      .eq("log_date", today)
      .limit(1);

    const existingLog = existingRows?.[0];

    if (existingLog) {
      // ✅ อัปเดต status + daily_allowance ด้วย (เดิมไม่มี)
      await supabase
        .from("daily_time_logs")
        .update({
          work_type: "on_site",
          onsite_session_id: sessionId,
          status: attendanceStatus,
          daily_allowance: dailyAllowance,
          timeline_events: [...(existingLog.timeline_events ?? []), newEvent],
        })
        .eq("id", existingLog.id);
    } else {
      // ✅ คำนวณจริง ไม่ hardcode "late" / false แล้ว
      await supabase.from("daily_time_logs").insert({
        user_id: targetUserId,
        log_date: today,
        work_type: "on_site",
        first_check_in: now,
        onsite_session_id: sessionId,
        timeline_events: [newEvent],
        status: attendanceStatus,
        daily_allowance: dailyAllowance,
      });
    }

    return { success: true, data: { member: newMember } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. ดึงพนักงานที่ยังไม่อยู่ใน Session (สำหรับ Add Member Modal)
// ─────────────────────────────────────────────────────────────────────────────
export async function getAvailableEmployees(
  sessionId: string,
): Promise<ActionResult<MemberProfile[]>> {
  try {
    const supabase = await getSupabaseServer();

    const { data: existing } = await supabase
      .from("onsite_session_members")
      .select("user_id")
      .eq("session_id", sessionId);

    const existingIds = (existing ?? []).map((m) => m.user_id);

    let query = supabase
      .from("profiles_with_avatar")
      .select("id, first_name, last_name, department, role, avatar_url")
      .order("first_name");

    if (existingIds.length > 0) {
      query = query.not("id", "in", `(${existingIds.join(",")})`);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    return {
      success: true,
      data: (data ?? []) as import("@/types/onsite").MemberProfile[],
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
