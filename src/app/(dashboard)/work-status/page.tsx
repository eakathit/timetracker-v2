import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAdminRole } from "@/lib/roles";

type Related<T> = T | T[] | null | undefined;

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
  role: string | null;
  avatar_url: string | null;
};

type TimeLogRow = {
  id: string;
  user_id: string;
  work_type: string | null;
  first_check_in: string | null;
  last_check_out: string | null;
  status: string | null;
  onsite_session_id: string | null;
  timeline_events: { event?: string; session_id?: string; timestamp?: string }[] | null;
};

type ReportItemRow = {
  id: string;
  period_type: string | null;
  period_start: string | null;
  period_end: string | null;
  period_label: string | null;
  custom_end_user_text?: string | null;
  custom_project_no_text?: string | null;
  end_users?: Related<{ name: string | null }>;
  projects?: Related<{ project_no: string | null; name: string | null }>;
  work_details?: Related<{ title: string | null }>;
};

type ReportRow = {
  id: string;
  user_id: string;
  daily_report_items?: ReportItemRow[];
};

type OnsiteSessionRow = {
  id: string;
  site_name: string | null;
  status: string | null;
  group_check_in: string | null;
  group_check_out: string | null;
  session_code: string | null;
  members?: { user_id: string }[];
  projects?: Related<{
    project_no: string | null;
    name: string | null;
    end_users?: Related<{ name: string | null }>;
  }>;
};

type LeaveRow = {
  id: string;
  user_id: string;
  leave_type: string;
  period_label: string | null;
  hours: number | null;
  reason: string | null;
};

type WorkStatusRecord = {
  id: string;
  name: string;
  department: string;
  avatarUrl: string | null;
  status: "factory" | "onsite" | "leave" | "not_checked_in";
  statusLabel: string;
  checkIn: string | null;
  checkOut: string | null;
  onsiteLocation: string | null;
  reportItems: Array<{
    id: string;
    period: string | null;
    customer: string | null;
    projectNo: string | null;
    detail: string | null;
  }>;
  leaveLabel: string | null;
};

const LEAVE_LABELS: Record<string, string> = {
  vacation: "ลาพักร้อน",
  sick: "ลาป่วย",
  personal: "ลากิจ",
  special_personal: "ลากิจพิเศษ",
  other: "ลาอื่นๆ",
  holiday_swap: "แลกวันหยุด",
};

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
              cookieStore.set(name, value, options),
            );
          } catch {}
        },
      },
    },
  );
}

function getBangkokDateStr(date?: Date): string {
  return (date ?? new Date()).toLocaleDateString("en-CA", {
    timeZone: "Asia/Bangkok",
  });
}

function fmtTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
}

function fullName(profile: ProfileRow) {
  return [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "ไม่ระบุชื่อ";
}

function firstRelated<T>(value: Related<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function reportPeriod(item: ReportItemRow) {
  if (item.period_label) return item.period_label;
  if (item.period_start && item.period_end) {
    return `${item.period_start.slice(0, 5)}-${item.period_end.slice(0, 5)}`;
  }
  return null;
}

function onsiteLocation(session: OnsiteSessionRow | null) {
  if (!session) return null;
  const project = firstRelated(session.projects);
  const endUser = firstRelated(project?.end_users);
  if (session.site_name) return session.site_name;
  if (project?.project_no && project?.name) return `${project.project_no} - ${project.name}`;
  if (project?.project_no) return project.project_no;
  if (project?.name) return project.name;
  if (endUser?.name) return endUser.name;
  return "On-site";
}

function mapReportItems(report: ReportRow | undefined): WorkStatusRecord["reportItems"] {
  return (report?.daily_report_items ?? []).map((item) => {
    const endUser = firstRelated(item.end_users);
    const project = firstRelated(item.projects);
    const detail = firstRelated(item.work_details);
    return {
      id: item.id,
      period: reportPeriod(item),
      customer: endUser?.name ?? item.custom_end_user_text ?? project?.name ?? null,
      projectNo: project?.project_no ?? item.custom_project_no_text ?? null,
      detail: detail?.title ?? null,
    };
  });
}

function Avatar({ record }: { record: WorkStatusRecord }) {
  if (record.avatarUrl) {
    return (
      <img
        src={record.avatarUrl}
        alt={record.name}
        referrerPolicy="no-referrer"
        className="h-10 w-10 rounded-lg object-cover ring-2 ring-white"
      />
    );
  }

  const initials = record.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sm font-bold text-sky-700 ring-2 ring-white">
      {initials || "?"}
    </span>
  );
}

function StatusBadge({ status, label }: { status: WorkStatusRecord["status"]; label: string }) {
  const classes = {
    factory: "border-blue-200 bg-blue-50 text-blue-700",
    onsite: "border-emerald-200 bg-emerald-50 text-emerald-700",
    leave: "border-rose-200 bg-rose-50 text-rose-700",
    not_checked_in: "border-slate-200 bg-slate-50 text-slate-500",
  }[status];

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${classes}`}>
      {label}
    </span>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

export default async function WorkStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!me || !isAdminRole(me.role)) redirect("/");

  const workDate = dateParam ?? getBangkokDateStr();

  const [profilesRes, logsRes, reportsRes, leavesRes] = await Promise.all([
    supabase
      .from("profiles_with_avatar")
      .select("id, first_name, last_name, department, role, avatar_url")
      .eq("access_status", "active")
      .eq("is_hidden_from_app", false)
      .order("first_name"),
    supabase
      .from("daily_time_logs")
      .select("id, user_id, work_type, first_check_in, last_check_out, status, onsite_session_id, timeline_events")
      .eq("log_date", workDate),
    supabase
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
      .eq("report_date", workDate),
    supabase
      .from("leave_requests")
      .select("id, user_id, leave_type, period_label, hours, reason")
      .eq("status", "approved")
      .lte("start_date", workDate)
      .gte("end_date", workDate),
  ]);

  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const logs = (logsRes.data ?? []) as TimeLogRow[];
  const reports = ((reportsRes.data ?? []) as unknown) as ReportRow[];
  const leaves = (leavesRes.data ?? []) as LeaveRow[];

  const referencedSessionIds = Array.from(
    new Set(
      logs.flatMap((log) => [
        ...(log.onsite_session_id ? [log.onsite_session_id] : []),
        ...((log.timeline_events ?? [])
          .map((event) => event.session_id)
          .filter((id): id is string => !!id)),
      ]),
    ),
  );

  const onsiteSessionSelect = `
    id, site_name, status, group_check_in, group_check_out, session_code,
    members:onsite_session_members ( user_id ),
    projects ( project_no, name, end_users ( name ) )
  `;
  const [datedSessionsRes, referencedSessionsRes] = await Promise.all([
    supabase.from("onsite_sessions").select(onsiteSessionSelect).eq("session_date", workDate),
    referencedSessionIds.length > 0
      ? supabase.from("onsite_sessions").select(onsiteSessionSelect).in("id", referencedSessionIds)
      : Promise.resolve({ data: [] }),
  ]);

  const onsiteSessions = Array.from(
    new Map(
      [
        ...(((datedSessionsRes.data ?? []) as unknown) as OnsiteSessionRow[]),
        ...(((referencedSessionsRes.data ?? []) as unknown) as OnsiteSessionRow[]),
      ].map((session) => [session.id, session]),
    ).values(),
  );
  const sessionMap = new Map(onsiteSessions.map((session) => [session.id, session]));
  const memberSessionMap = new Map<string, OnsiteSessionRow>();
  onsiteSessions.forEach((session) => {
    session.members?.forEach((member) => {
      const current = memberSessionMap.get(member.user_id);
      if (!current || (current.status !== "checked_in" && session.status === "checked_in")) {
        memberSessionMap.set(member.user_id, session);
      }
    });
  });

  const logMap = new Map(logs.map((log) => [log.user_id, log]));
  const reportMap = new Map(reports.map((report) => [report.user_id, report]));
  const leaveMap = new Map(leaves.map((leave) => [leave.user_id, leave]));

  const records: WorkStatusRecord[] = profiles.map((profile) => {
    const log = logMap.get(profile.id);
    const report = reportMap.get(profile.id);
    const leave = leaveMap.get(profile.id);
    const session =
      (log?.onsite_session_id ? sessionMap.get(log.onsite_session_id) : null) ??
      memberSessionMap.get(profile.id) ??
      null;

    const isOnsite = log?.work_type && log.work_type !== "in_factory";
    const status: WorkStatusRecord["status"] = leave
      ? "leave"
      : isOnsite
        ? "onsite"
        : log?.first_check_in
          ? "factory"
          : "not_checked_in";

    const leaveLabel = leave
      ? `${LEAVE_LABELS[leave.leave_type] ?? "ลา"}${leave.hours ? ` ${leave.hours} ชม.` : leave.period_label ? ` ${leave.period_label}` : ""}`
      : null;

    return {
      id: profile.id,
      name: fullName(profile),
      department: profile.department ?? "—",
      avatarUrl: profile.avatar_url,
      status,
      statusLabel:
        status === "leave"
          ? "ลา"
          : status === "onsite"
            ? "On-site"
            : status === "factory"
              ? "Factory"
              : "ยังไม่ Check-in",
      checkIn: fmtTime(log?.first_check_in ?? null),
      checkOut: fmtTime(log?.last_check_out ?? null),
      onsiteLocation: status === "onsite" ? onsiteLocation(session) : null,
      reportItems: mapReportItems(report),
      leaveLabel,
    };
  });

  const summary = {
    total: records.length,
    factory: records.filter((record) => record.status === "factory").length,
    onsite: records.filter((record) => record.status === "onsite").length,
    leave: records.filter((record) => record.status === "leave").length,
    noCheckin: records.filter((record) => record.status === "not_checked_in").length,
    reportFiled: records.filter((record) => record.reportItems.length > 0).length,
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Admin · Management
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Work Status</h1>
          <p className="mt-1 text-sm text-slate-500">
            สรุปสถานะการทำงานและรายงานของพนักงานประจำวันที่ {workDate}
          </p>
        </div>

        <form className="flex items-center gap-2" action="/work-status">
          <input
            type="date"
            name="date"
            defaultValue={workDate}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          />
          <button className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800">
            ดูข้อมูล
          </button>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard label="ทั้งหมด" value={summary.total} tone="text-slate-800" />
        <SummaryCard label="Factory" value={summary.factory} tone="text-blue-700" />
        <SummaryCard label="On-site" value={summary.onsite} tone="text-emerald-700" />
        <SummaryCard label="ลา" value={summary.leave} tone="text-rose-700" />
        <SummaryCard label="ยังไม่เข้า" value={summary.noCheckin} tone="text-slate-500" />
        <SummaryCard label="มี Report" value={summary.reportFiled} tone="text-indigo-700" />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">พนักงาน</th>
                <th className="px-4 py-3">สถานะ</th>
                <th className="px-4 py-3">เวลา</th>
                <th className="px-4 py-3">On-site</th>
                <th className="px-4 py-3">Report / งานที่ทำ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((record) => (
                <tr key={record.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar record={record} />
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900">{record.name}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{record.department}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-2">
                      <StatusBadge status={record.status} label={record.statusLabel} />
                      {record.leaveLabel && (
                        <p className="text-xs font-semibold text-rose-600">{record.leaveLabel}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    <p>เข้า: <span className="font-semibold">{record.checkIn ?? "-"}</span></p>
                    <p className="mt-1">ออก: <span className="font-semibold">{record.checkOut ?? "-"}</span></p>
                  </td>
                  <td className="px-4 py-4">
                    {record.onsiteLocation ? (
                      <p className="max-w-64 font-semibold text-emerald-700">{record.onsiteLocation}</p>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {record.reportItems.length > 0 ? (
                      <div className="space-y-2">
                        {record.reportItems.map((item) => (
                          <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                            <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-400">
                              {item.period && <span className="font-mono">{item.period}</span>}
                              {item.projectNo && <span>{item.projectNo}</span>}
                              {item.customer && <span>{item.customer}</span>}
                            </div>
                            <p className="mt-1 font-semibold text-slate-700">
                              {item.detail ?? "ไม่ระบุรายละเอียดงาน"}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-300">ยังไม่มี Report</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
