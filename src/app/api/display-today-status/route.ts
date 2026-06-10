import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasDisplayOrAdminAccess } from "@/lib/display-api-access";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  department?: string | null;
  avatar_url: string | null;
};

type TimeLogRow = {
  id: string;
  user_id: string;
  work_type: string;
  first_check_in: string | null;
  last_check_out: string | null;
  onsite_session_id: string | null;
  timeline_events: {
    session_id?: string;
    event?: string;
    checkout_lat?: number;
    checkout_lng?: number;
  }[] | null;
};

type Related<T> = T | T[] | null | undefined;

type OnsiteSessionRow = {
  id: string;
  site_name: string | null;
  status: string;
  group_check_in: string | null;
  group_check_out: string | null;
  session_code?: string | null;
  projects?: Related<{
    project_no: string | null;
    name: string | null;
    end_users?: Related<{ name: string | null }>;
  }>;
  members?: { user_id: string }[];
};

type ReportItemRow = {
  id: string;
  period_type: string | null;
  period_start: string | null;
  period_end: string | null;
  period_label: string | null;
  custom_end_user_text: string | null;
  custom_project_no_text: string | null;
  end_users?: Related<{ name: string | null }>;
  projects?: Related<{ project_no: string | null; name: string | null }>;
  work_details?: Related<{ title: string | null }>;
};

type ReportRow = {
  id: string;
  user_id: string;
  daily_report_items?: ReportItemRow[];
};

const LEAVE_LABELS: Record<string, string> = {
  vacation: "ลาพักร้อน",
  sick: "ลาป่วย",
  personal: "ลากิจ",
  special_personal: "ลากิจพิเศษ",
  other: "ลาอื่นๆ",
  holiday_swap: "แลกวันหยุด",
};

function getLocalToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function firstRelated<T>(value: Related<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function collectSessionIds(logs: TimeLogRow[]) {
  return Array.from(
    new Set(
      logs.flatMap((log) => [
        ...(log.onsite_session_id ? [log.onsite_session_id] : []),
        ...((log.timeline_events ?? [])
          .map((event) => event.session_id)
          .filter((id): id is string => !!id)),
      ]),
    ),
  );
}

function sessionLabel(session: OnsiteSessionRow | undefined) {
  if (!session) return null;
  const project = firstRelated(session.projects);
  const endUser = firstRelated(project?.end_users);
  const projectNo = project?.project_no;
  const projectName = project?.name;

  if (session.site_name) return session.site_name;
  if (projectNo && projectName) return `${projectNo} - ${projectName}`;
  if (projectNo) return projectNo;
  if (projectName) return projectName;
  if (endUser?.name) return endUser.name;
  return "On-site";
}

function itemPeriodLabel(item: ReportItemRow) {
  if (item.period_label) return item.period_label;
  if (item.period_start && item.period_end) {
    return `${item.period_start.slice(0, 5)}-${item.period_end.slice(0, 5)}`;
  }
  return null;
}

function formatWorkItems(report: ReportRow | undefined) {
  return (report?.daily_report_items ?? []).map((item) => {
    const endUser = firstRelated(item.end_users);
    const project = firstRelated(item.projects);
    const workDetail = firstRelated(item.work_details);
    const customer =
      endUser?.name ??
      item.custom_end_user_text ??
      project?.name ??
      null;
    const projectNo = project?.project_no ?? item.custom_project_no_text ?? null;
    return {
      id: item.id,
      period: itemPeriodLabel(item),
      customer,
      projectNo,
      detail: workDetail?.title ?? "ไม่ระบุรายละเอียดงาน",
    };
  });
}

function onsiteMapUrl(log: TimeLogRow) {
  const checkoutEvent = (log.timeline_events ?? [])
    .find((event) => event.event === "onsite_checkout");
  if (
    typeof checkoutEvent?.checkout_lat === "number" &&
    typeof checkoutEvent?.checkout_lng === "number"
  ) {
    return `https://www.google.com/maps?q=${checkoutEvent.checkout_lat},${checkoutEvent.checkout_lng}`;
  }
  return null;
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
        .select("id, user_id, work_type, first_check_in, last_check_out, onsite_session_id, timeline_events")
        .eq("log_date", today)
        .not("first_check_in", "is", null)
        .order("first_check_in", { ascending: false }),

      supabase
        .from("leave_requests_with_profile")
        .select("id, user_id, leave_type, start_date, end_date, period_label, days, hours, reason, first_name, last_name, avatar_url")
        .eq("status", "approved")
        .lte("start_date", today)
        .gte("end_date", today)
        .order("first_name", { ascending: true }),
    ]);

    if (logsRes.error) {
      console.error("[display-today-status] logs error:", logsRes.error);
      return NextResponse.json({ error: logsRes.error.message }, { status: 500 });
    }

    if (leavesRes.error) {
      console.error("[display-today-status] leaves error:", leavesRes.error);
      return NextResponse.json({ error: leavesRes.error.message }, { status: 500 });
    }

    const logs = ((logsRes.data ?? []) as TimeLogRow[]).filter((log) => log.first_check_in);
    const userIds = Array.from(new Set(logs.map((log) => log.user_id)));
    const sessionIds = collectSessionIds(logs);

    const [profilesRes, reportsRes, sessionsByDateRes, sessionsByIdRes] = await Promise.all([
      userIds.length > 0
        ? supabase
            .from("profiles_with_avatar")
            .select("id, first_name, last_name, department, avatar_url")
            .eq("access_status", "active")
            .eq("is_hidden_from_app", false)
            .in("id", userIds)
        : Promise.resolve({ data: [], error: null }),

      userIds.length > 0
        ? supabase
            .from("daily_reports")
            .select(
              `id, user_id,
               daily_report_items (
                 id, period_type, period_start, period_end, period_label,
                 custom_end_user_text, custom_project_no_text,
                 end_users ( name ),
                 projects ( project_no, name ),
                 work_details ( title )
               )`,
            )
            .eq("report_date", today)
            .in("user_id", userIds)
        : Promise.resolve({ data: [], error: null }),

      supabase
        .from("onsite_sessions")
        .select(
          `id, site_name, status, group_check_in, group_check_out, session_code,
           members:onsite_session_members ( user_id ),
           projects ( project_no, name, end_users ( name ) )`,
        )
        .eq("session_date", today),

      sessionIds.length > 0
        ? supabase
            .from("onsite_sessions")
            .select(
              `id, site_name, status, group_check_in, group_check_out, session_code,
               members:onsite_session_members ( user_id ),
               projects ( project_no, name, end_users ( name ) )`,
            )
            .in("id", sessionIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const profileMap = new Map(((profilesRes.data ?? []) as Profile[]).map((p) => [p.id, p]));
    const reportMap = new Map((((reportsRes.data ?? []) as unknown) as ReportRow[]).map((r) => [r.user_id, r]));
    const sessions = Array.from(
      new Map(
        [
          ...(((sessionsByDateRes.data ?? []) as unknown) as OnsiteSessionRow[]),
          ...(((sessionsByIdRes.data ?? []) as unknown) as OnsiteSessionRow[]),
        ].map((session) => [session.id, session]),
      ).values(),
    );
    const sessionMap = new Map(sessions.map((session) => [session.id, session]));
    const memberSessionMap = new Map<string, OnsiteSessionRow>();
    sessions.forEach((session) => {
      session.members?.forEach((member) => {
        const existing = memberSessionMap.get(member.user_id);
        if (!existing || (existing.status !== "checked_in" && session.status === "checked_in")) {
          memberSessionMap.set(member.user_id, session);
        }
      });
    });

    const checkins = logs
      .filter((log) => profileMap.has(log.user_id))
      .map((log) => {
        const profile = profileMap.get(log.user_id)!;
        const session =
          (log.onsite_session_id ? sessionMap.get(log.onsite_session_id) : undefined) ??
          memberSessionMap.get(log.user_id);
        const report = reportMap.get(log.user_id);
        return {
          id: log.id,
          user_id: log.user_id,
          work_type: log.work_type,
          first_check_in: log.first_check_in,
          last_check_out: log.last_check_out,
          onsite_location: log.work_type === "in_factory" ? null : sessionLabel(session),
          onsite_status: session?.status ?? null,
          onsite_session_code: session?.session_code ?? null,
          onsite_group_check_in: session?.group_check_in ?? null,
          onsite_group_check_out: session?.group_check_out ?? null,
          onsite_map_url: log.work_type === "in_factory" ? null : onsiteMapUrl(log),
          report_id: report?.id ?? null,
          profiles: profile,
          work_items: formatWorkItems(report),
        };
      });

    const leaves = ((leavesRes.data ?? []) as {
      id: string;
      user_id: string;
      leave_type: string;
      start_date: string;
      end_date: string;
      period_label: string | null;
      days: number | null;
      hours: number | null;
      reason: string | null;
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
    }[]).map((leave) => ({
      id: leave.id,
      user_id: leave.user_id,
      leave_type: leave.leave_type,
      leave_label: LEAVE_LABELS[leave.leave_type] ?? "ลา",
      start_date: leave.start_date,
      end_date: leave.end_date,
      period_label: leave.period_label,
      days: leave.days,
      hours: leave.hours,
      reason: leave.reason,
      profiles: {
        first_name: leave.first_name,
        last_name: leave.last_name,
        avatar_url: leave.avatar_url,
      },
    }));

    return NextResponse.json(
      {
        date: today,
        checkins,
        leaves,
        summary: {
          total_checkins: checkins.length,
          factory: checkins.filter((entry) => entry.work_type === "in_factory").length,
          onsite: checkins.filter((entry) => entry.work_type !== "in_factory").length,
          leave: leaves.length,
        },
      },
      { headers: { "Cache-Control": "no-store, no-cache" } },
    );
  } catch (err) {
    console.error("[display-today-status]", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
