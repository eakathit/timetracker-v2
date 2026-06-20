import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasDisplayOrAdminAccess } from "@/lib/display-api-access";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type TimeLogRow = {
  id: string;
  user_id: string;
  work_type: string;
  first_check_in: string | null;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type LeaveRow = {
  id: string;
  user_id: string;
  leave_type: string;
  period_label: string | null;
  hours: number | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

const LEAVE_LABELS: Record<string, string> = {
  vacation: "\u0e25\u0e32\u0e1e\u0e31\u0e01\u0e23\u0e49\u0e2d\u0e19",
  sick: "\u0e25\u0e32\u0e1b\u0e48\u0e27\u0e22",
  personal: "\u0e25\u0e32\u0e01\u0e34\u0e08",
  special_personal: "\u0e25\u0e32\u0e01\u0e34\u0e08\u0e1e\u0e34\u0e40\u0e28\u0e29",
  other: "\u0e25\u0e32\u0e2d\u0e37\u0e48\u0e19\u0e46",
  holiday_swap: "\u0e41\u0e25\u0e01\u0e27\u0e31\u0e19\u0e2b\u0e22\u0e38\u0e14",
};

function getLocalToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

export async function GET(request: NextRequest) {
  try {
    if (!(await hasDisplayOrAdminAccess(request))) {
      return NextResponse.json({ error: "Unauthorized display" }, { status: 401 });
    }

    const today = getLocalToday();

    const [logsRes, leavesRes] = await Promise.all([
      supabase
        .from("daily_time_logs")
        .select("id, user_id, work_type, first_check_in")
        .eq("log_date", today)
        .not("first_check_in", "is", null)
        .order("first_check_in", { ascending: false }),

      supabase
        .from("leave_requests_with_profile")
        .select("id, user_id, leave_type, period_label, hours, first_name, last_name, avatar_url")
        .eq("status", "approved")
        .lte("start_date", today)
        .gte("end_date", today)
        .order("first_name", { ascending: true }),
    ]);

    if (logsRes.error) {
      console.error("[qr-display-status] logs error:", logsRes.error);
      return NextResponse.json({ error: logsRes.error.message }, { status: 500 });
    }

    if (leavesRes.error) {
      console.error("[qr-display-status] leaves error:", leavesRes.error);
      return NextResponse.json({ error: leavesRes.error.message }, { status: 500 });
    }

    const logs = ((logsRes.data ?? []) as TimeLogRow[]).filter((log) => log.first_check_in);
    const userIds = Array.from(new Set(logs.map((log) => log.user_id)));

    const profilesRes = userIds.length > 0
      ? await supabase
          .from("profiles_with_avatar")
          .select("id, first_name, last_name, avatar_url")
          .eq("access_status", "active")
          .eq("is_hidden_from_app", false)
          .in("id", userIds)
      : { data: [], error: null };

    if (profilesRes.error) {
      console.error("[qr-display-status] profiles error:", profilesRes.error);
      return NextResponse.json({ error: profilesRes.error.message }, { status: 500 });
    }

    const profileMap = new Map(
      ((profilesRes.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
    );

    const checkins = logs
      .filter((log) => profileMap.has(log.user_id))
      .map((log) => ({
        id: log.id,
        user_id: log.user_id,
        work_type: log.work_type,
        first_check_in: log.first_check_in,
        profiles: profileMap.get(log.user_id) ?? null,
      }));

    const leaves = ((leavesRes.data ?? []) as LeaveRow[]).map((leave) => ({
      id: leave.id,
      user_id: leave.user_id,
      leave_type: leave.leave_type,
      leave_label: LEAVE_LABELS[leave.leave_type] ?? "\u0e25\u0e32",
      period_label: leave.period_label,
      hours: leave.hours,
      profiles: {
        first_name: leave.first_name,
        last_name: leave.last_name,
        avatar_url: leave.avatar_url,
      },
    }));

    return NextResponse.json(
      { date: today, checkins, leaves },
      { headers: { "Cache-Control": "no-store, no-cache" } },
    );
  } catch (err) {
    console.error("[qr-display-status]", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
