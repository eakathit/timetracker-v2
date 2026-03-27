"use server";
// src/app/actions/audit.ts

import { revalidatePath } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getEffectiveThreshold, computeAttendanceStatus } from "@/lib/attendance";
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

function getLocalToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

// ── Admin: Force Check-in ──────────────────────────────────────────────────
export async function adminForceCheckIn(
  targetUserId: string,
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
    if (profile?.role !== "admin") return { success: false, error: "Admin only" };

    const iso = new Date(`${logDate}T${timeHHMM}:00+07:00`).toISOString();

    // ดึง log เดิมก่อนเสมอ
    const { data: log } = await supabase
      .from("daily_time_logs")
      .select("timeline_events, work_type")
      .eq("user_id", targetUserId)
      .eq("log_date", logDate)
      .maybeSingle();

    const prevEvents: object[] = log?.timeline_events ?? [];
    const adminEvent = {
      event: "admin_checkin_override",
      timestamp: iso,
      by: user.id,
      note: `Admin force check-in → ${timeHHMM}`,
    };

    const threshold = await getEffectiveThreshold(supabase, targetUserId, logDate);
    const status = computeAttendanceStatus(iso, threshold);

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
    if (profile?.role !== "admin") return { success: false, error: "Admin only" };

    const iso = new Date(`${logDate}T${timeHHMM}:00+07:00`).toISOString();

    const { data: log } = await supabase
      .from("daily_time_logs")
      .select("timeline_events, first_check_in")
      .eq("user_id", targetUserId)
      .eq("log_date", logDate)
      .maybeSingle();

    const prevEvents: object[] = log?.timeline_events ?? [];
    const adminEvent = {
      event: "admin_checkout_override",
      timestamp: iso,
      by: user.id,
      note: `Admin force check-out → ${timeHHMM}`,
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