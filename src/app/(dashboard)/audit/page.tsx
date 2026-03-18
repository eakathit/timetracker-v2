// src/app/(dashboard)/audit/page.tsx
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AuditClient from "./AuditClient";
import type { AuditEmployee, OnsiteSessionRow } from "./types";

// ─── Supabase server client ────────────────────────────────────────────────
async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────
function getBangkokDateStr(date?: Date): string {
  const d = date ?? new Date();
  return d
    .toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }); // YYYY-MM-DD
}

function fmtTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const supabase = await getSupabase();

  // ── Auth guard ──────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!me || (me.role !== "admin" && me.role !== "manager")) {
    redirect("/");
  }

  // ── Determine audit date ────────────────────────────────────────────────
  const auditDate = dateParam ?? getBangkokDateStr();

  // ── Fetch all data in parallel ──────────────────────────────────────────
  const [profilesRes, timeLogsRes, reportsRes, otReqRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, first_name, last_name, department, role, avatar_url")
      .order("first_name"),

    supabase
      .from("daily_time_logs")
      .select(
        "id, user_id, log_date, work_type, first_check_in, last_check_out, timeline_events, ot_hours, regular_hours, status, day_type, onsite_session_id, auto_checked_out, daily_allowance, pay_multiplier, holiday_name, ot_intent"
      )
      .eq("log_date", auditDate),

    supabase
      .from("daily_reports")
      .select(
        `id, user_id, report_date,
         daily_report_items (
           id, period_type, period_start, period_end, period_label,
           end_users ( name ),
           projects ( project_no, name ),
           work_details ( title )
         )`
      )
      .eq("report_date", auditDate),

    supabase
      .from("ot_requests")
      .select("id, user_id, start_time, end_time, status, hours, reason")
      .eq("request_date", auditDate),
  ]);

  const profiles = profilesRes.data ?? [];
  const timeLogs = timeLogsRes.data ?? [];
  const reports = reportsRes.data ?? [];
  const otRequests = otReqRes.data ?? [];

  // ── Fetch onsite sessions referenced in logs ────────────────────────────
  const sessionIds = timeLogs
    .map((l) => l.onsite_session_id)
    .filter(Boolean) as string[];

  let onsiteSessions: OnsiteSessionRow[] = [];
  if (sessionIds.length > 0) {
    const { data } = await supabase
      .from("onsite_sessions")
      .select(
        `id, site_name, status, group_check_in, group_check_out, session_code,
         projects ( project_no, name, end_users ( name ) )`
      )
      .in("id", sessionIds);
    onsiteSessions = (data as unknown as OnsiteSessionRow[]) ?? [];
  }

  // ── Build session map ───────────────────────────────────────────────────
  const sessionMap = new Map<string, OnsiteSessionRow>(
    onsiteSessions.map((s) => [s.id, s])
  );

  // ── Build lookup maps ───────────────────────────────────────────────────
  const logMap = new Map(timeLogs.map((l) => [l.user_id, l]));
  const reportMap = new Map(reports.map((r) => [r.user_id, r]));
  const otMap = new Map(otRequests.map((r) => [r.user_id, r]));

  // ── Assemble AuditEmployee list ─────────────────────────────────────────
  const employees: AuditEmployee[] = profiles.map((p) => {
    const log = logMap.get(p.id);
    const report = reportMap.get(p.id);
    const ot = otMap.get(p.id);

    const checkIn = fmtTime(log?.first_check_in ?? null);
    const checkOut = fmtTime(log?.last_check_out ?? null);
    const otStart = log?.ot_intent
      ? (log.timeline_events as Record<string, string>[])?.find(
          (e) => e.event === "ot_start"
        )?.timestamp ?? null
      : null;
    const otEnd = otStart
      ? (log?.timeline_events as Record<string, string>[])?.find(
          (e) => e.event === "ot_end"
        )?.timestamp ?? null
      : null;

    // ── Anomaly detection ──────────────────────────────────────────────
    const anomalies: string[] = [];
    if (log?.status === "late") anomalies.push("late");
    if (log?.first_check_in && !log?.last_check_out) anomalies.push("no_checkout");
    if (!log?.first_check_in && log?.status !== "leave") anomalies.push("absent");
    if (log?.auto_checked_out) anomalies.push("auto_checkout");
    if (log?.ot_intent && !otStart) anomalies.push("ot_no_start");

    const onsiteSession = log?.onsite_session_id
      ? sessionMap.get(log.onsite_session_id) ?? null
      : null;

    return {
      id: p.id,
      firstName: p.first_name ?? "",
      lastName: p.last_name ?? "",
      department: p.department ?? "—",
      role: p.role,
      avatarUrl: p.avatar_url ?? null,

      // Attendance
      attendanceStatus: (log?.status ?? "absent") as AuditEmployee["attendanceStatus"],
      workType: (log?.work_type ?? null) as AuditEmployee["workType"],
      checkIn,
      checkOut,
      rawCheckIn: log?.first_check_in ?? null,
      rawCheckOut: log?.last_check_out ?? null,
      otHours: log?.ot_hours ?? 0,
      regularHours: log?.regular_hours ?? 0,
      dayType: log?.day_type ?? "workday",
      holidayName: log?.holiday_name ?? null,
      autoCheckedOut: log?.auto_checked_out ?? false,
      dailyAllowance: log?.daily_allowance ?? false,
      payMultiplier: log?.pay_multiplier ?? 1.0,

      // OT timestamps
      otStart: fmtTime(otStart),
      otEnd: fmtTime(otEnd),
      otRequest: ot
        ? {
            id: ot.id,
            startTime: ot.start_time,
            endTime: ot.end_time,
            status: ot.status,
            hours: ot.hours,
            reason: ot.reason,
          }
        : null,

      // Timeline
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      timelineEvents: (log?.timeline_events as any[]) ?? [],

      // Report
      reportFiled: !!report,
      reportItems: report
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (report.daily_report_items as any[]).map((item: any) => ({
            id: item.id,
            endUserName: item.end_users?.name ?? null,
            projectNo: item.projects?.project_no ?? null,
            projectName: item.projects?.name ?? null,
            workDetail: item.work_details?.title ?? null,
            periodType: item.period_type,
            periodStart: item.period_start,
            periodEnd: item.period_end,
            periodLabel: item.period_label,
          }))
        : [],

      // On-site
      onsiteSession: onsiteSession
        ? {
            id: onsiteSession.id,
            siteName: onsiteSession.site_name,
            status: onsiteSession.status,
            groupCheckIn: fmtTime(onsiteSession.group_check_in),
            groupCheckOut: fmtTime(onsiteSession.group_check_out),
            sessionCode: onsiteSession.session_code,
            rawCheckIn: onsiteSession.group_check_in,
            rawCheckOut: onsiteSession.group_check_out,
            projectNo: (onsiteSession.projects as any)?.project_no ?? null,
            projectName: (onsiteSession.projects as any)?.name ?? null,
            endUserName: (onsiteSession.projects as any)?.end_users?.name ?? null,
          }
        : null,

      anomalies,
    };
  });

  // ── Summary ─────────────────────────────────────────────────────────────
  const summary = {
    total: employees.length,
    present: employees.filter(
      (e) => e.attendanceStatus === "on_time" || e.attendanceStatus === "late"
    ).length,
    late: employees.filter((e) => e.attendanceStatus === "late").length,
    absent: employees.filter(
      (e) => !e.checkIn && e.attendanceStatus !== "leave"
    ).length,
    leave: employees.filter((e) => e.attendanceStatus === "leave").length,
    onsite: employees.filter((e) => e.workType === "on_site").length,
    factory: employees.filter((e) => e.workType === "in_factory").length,
    withOT: employees.filter((e) => e.otHours > 0).length,
    reportFiled: employees.filter((e) => e.reportFiled).length,
  };

  return (
    <AuditClient
      employees={employees}
      summary={summary}
      auditDate={auditDate}
    />
  );
}