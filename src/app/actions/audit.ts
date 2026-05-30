"use server";
// src/app/actions/audit.ts

import { revalidatePath } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getEffectiveThreshold, computeAttendanceStatus } from "@/lib/attendance";
import { isAdminRole } from "@/lib/roles";
type ActionResult = { success: boolean; error?: string };

// ── Supabase Server Client (inline — same pattern as onsite.ts) ───────────
async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

// ── Admin: Force Check-in ──────────────────────────────────────────────────
export async function adminForceCheckIn(
  targetUserId: string,
  logDate: string,
  timeHHMM: string,
  reason = "",
): Promise<ActionResult> {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!isAdminRole(profile?.role)) return { success: false, error: "Admin only" };

    const trimmedReason = reason.trim();

    const iso = new Date(`${logDate}T${timeHHMM}:00+07:00`).toISOString();

    // ดึง log เดิมก่อนเสมอ
    const { data: log } = await supabase
      .from("daily_time_logs")
      .select("timeline_events, work_type, shift_type, first_check_in")
      .eq("user_id", targetUserId)
      .eq("log_date", logDate)
      .maybeSingle();

    const prevEvents: object[] = log?.timeline_events ?? [];
    const adminEvent = {
      event: "admin_checkin_override",
      timestamp: iso,
      by: user.id,
      note: trimmedReason
        ? `Admin force check-in → ${timeHHMM} (${trimmedReason})`
        : `Admin force check-in → ${timeHHMM}`,
      reason: trimmedReason || null,
      previous_first_check_in: log?.first_check_in ?? null,
      new_first_check_in: iso,
    };

    // วันหยุดไม่นับสาย — ดู shift_type จาก log เดิม หรือ fallback เสาร์/อาทิตย์
    const isHolidayDate =
      log?.shift_type === "holiday" ||
      (() => { const d = new Date(logDate).getDay(); return d === 0 || d === 6; })();
    const threshold = isHolidayDate ? null : await getEffectiveThreshold(supabase, targetUserId, logDate);
    const status = isHolidayDate ? "on_time" : computeAttendanceStatus(iso, threshold!);

    if (log) {
      // ── Row มีอยู่แล้ว → UPDATE เท่านั้น (ไม่แตะ work_type) ──
      const { error } = await supabase
        .from("daily_time_logs")
        .update({
          first_check_in: iso,
          status,
          timeline_events: [...prevEvents, adminEvent],
        })
        .eq("user_id", targetUserId)
        .eq("log_date", logDate);

      if (error) return { success: false, error: error.message };
    } else {
      // ── ยังไม่มี row → INSERT พร้อม work_type default ──
      const { error } = await supabase
        .from("daily_time_logs")
        .insert({
          user_id: targetUserId,
          log_date: logDate,
          first_check_in: iso,
          status,
          work_type: "in_factory", // default
          timeline_events: [adminEvent],
        });

      if (error) return { success: false, error: error.message };
    }

    revalidatePath("/audit");
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ── Admin: Force Check-out ──────────────────────────────────────────────────
export async function adminForceCheckOut(
  targetUserId: string,
  logDate: string,
  timeHHMM: string,
  reason = "",
): Promise<ActionResult> {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!isAdminRole(profile?.role)) return { success: false, error: "Admin only" };

    const trimmedReason = reason.trim();

    const iso = new Date(`${logDate}T${timeHHMM}:00+07:00`).toISOString();

    const { data: log } = await supabase
      .from("daily_time_logs")
      .select("timeline_events, first_check_in, last_check_out")
      .eq("user_id", targetUserId)
      .eq("log_date", logDate)
      .maybeSingle();

    if (!log?.first_check_in) {
      return { success: false, error: "ต้องบันทึกเวลา Check-in ก่อนจึงจะเพิ่ม Check-out ได้" };
    }

    const prevEvents: object[] = log?.timeline_events ?? [];
    const adminEvent = {
      event: "admin_checkout_override",
      timestamp: iso,
      by: user.id,
      note: trimmedReason
        ? `Admin force check-out → ${timeHHMM} (${trimmedReason})`
        : `Admin force check-out → ${timeHHMM}`,
      reason: trimmedReason || null,
      previous_last_check_out: log?.last_check_out ?? null,
      new_last_check_out: iso,
    };

    // คำนวณ regular_hours
    let regularHours = 0;
    if (log?.first_check_in) {
      const diff = (new Date(iso).getTime() - new Date(log.first_check_in).getTime()) / 3_600_000;
      regularHours = Math.max(0, Math.round((diff - 1) * 10) / 10); // หัก break 1h
    }

    const { error } = await supabase
      .from("daily_time_logs")
      .update({
        last_check_out: iso,
        regular_hours: regularHours,
        auto_checked_out: false,
        timeline_events: [...prevEvents, adminEvent],
      })
      .eq("user_id", targetUserId)
      .eq("log_date", logDate);

    if (error) return { success: false, error: error.message };
    revalidatePath("/audit");
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// Admin: close a forgotten On-site group checkout at an explicit Bangkok time.
export async function adminForceOnsiteCheckOut(
  sessionId: string,
  logDate: string,
  timeHHMM: string,
): Promise<ActionResult> {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!isAdminRole(profile?.role)) return { success: false, error: "Admin only" };

    const iso = new Date(`${logDate}T${timeHHMM}:00+07:00`).toISOString();
    const checkoutMinutes = Number(timeHHMM.slice(0, 2)) * 60 + Number(timeHHMM.slice(3, 5));
    const rawOtHours = Math.max(0, Math.round(((checkoutMinutes - (17 * 60 + 30)) / 60) * 100) / 100);

    const { data: session, error: sessionError } = await supabase
      .from("onsite_sessions")
      .select("id, status, members:onsite_session_members(user_id, checkout_type)")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) return { success: false, error: sessionError.message };
    if (!session) return { success: false, error: "ไม่พบ On-site session" };
    if (session.status !== "checked_in" && session.status !== "closed") {
      return { success: false, error: "On-site session นี้ยังไม่ได้ Check-in" };
    }

    const checkoutUserIds = (
      session.members as { user_id: string; checkout_type: string }[]
    )
      .filter((member) => member.checkout_type === "pending" || member.checkout_type === "group")
      .map((member) => member.user_id);

    if (checkoutUserIds.length === 0) {
      return { success: false, error: "ไม่มีสมาชิก On-site แบบกลุ่มให้แก้ไข" };
    }

    const { data: logs, error: logsError } = await supabase
      .from("daily_time_logs")
      .select("user_id, timeline_events")
      .in("user_id", checkoutUserIds)
      .eq("log_date", logDate);
    if (logsError) return { success: false, error: logsError.message };

    const logMap = new Map((logs ?? []).map((log) => [log.user_id, log]));
    const missingLogUserIds = checkoutUserIds.filter((targetUserId) => !logMap.has(targetUserId));
    if (missingLogUserIds.length > 0) {
      return { success: false, error: "พบสมาชิก On-site ที่ไม่มีข้อมูลเวลาเข้า กรุณาตรวจสอบข้อมูลก่อนปิดห้อง" };
    }
    const checkoutEvent = {
      event: "onsite_checkout",
      timestamp: iso,
      session_id: sessionId,
      checkout_type: "group",
      break_minutes: 0,
      raw_ot_hours: rawOtHours,
      net_ot_hours: rawOtHours,
      ot_starts_from: "17:30",
      admin_override: true,
      actioned_by: user.id,
    };
    const adminEvent = {
      event: "admin_onsite_checkout_override",
      timestamp: iso,
      session_id: sessionId,
      by: user.id,
      note: `Admin force On-site check-out → ${timeHHMM}`,
    };

    const updateResults = await Promise.all(
      checkoutUserIds.map((targetUserId) =>
        supabase
          .from("daily_time_logs")
          .update({
            last_check_out: iso,
            ot_hours: rawOtHours,
            auto_checked_out: false,
            timeline_events: [
              ...(logMap.get(targetUserId)?.timeline_events ?? []).filter(
                (event: { event?: string; session_id?: string }) =>
                  event.session_id !== sessionId ||
                  (event.event !== "onsite_checkout" &&
                    event.event !== "admin_onsite_checkout_override"),
              ),
              checkoutEvent,
              adminEvent,
            ],
          })
          .eq("user_id", targetUserId)
          .eq("log_date", logDate),
      ),
    );
    const logsUpdateError = updateResults.find((result) => result.error)?.error;
    if (logsUpdateError) return { success: false, error: logsUpdateError.message };

    const { error: membersError } = await supabase
      .from("onsite_session_members")
      .update({ checkout_type: "group" })
      .eq("session_id", sessionId)
      .eq("checkout_type", "pending");
    if (membersError) return { success: false, error: membersError.message };

    const { error: closeError } = await supabase
      .from("onsite_sessions")
      .update({ status: "closed", group_check_out: iso, closed_at: iso })
      .eq("id", sessionId);
    if (closeError) return { success: false, error: closeError.message };

    revalidatePath("/audit");
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
