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

const AVATAR_COLORS = [
  "bg-blue-600", "bg-emerald-600", "bg-sky-500", "bg-amber-500",
  "bg-rose-500", "bg-indigo-500", "bg-teal-600", "bg-orange-500",
];
const avatarColor = (id: string) =>
  AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];

function AvatarBubble({ record }: { record: WorkStatusRecord }) {
  if (record.avatarUrl) {
    return (
      <img
        src={record.avatarUrl}
        alt={record.name}
        referrerPolicy="no-referrer"
        className="w-10 h-10 rounded-xl object-cover ring-2 ring-slate-100 flex-shrink-0 shadow-sm"
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
    <span
      className={`w-10 h-10 rounded-xl ${avatarColor(record.id)} text-white text-sm font-bold flex items-center justify-center flex-shrink-0 ring-2 ring-white shadow-sm`}
    >
      {initials || "?"}
    </span>
  );
}

function EmployeeCard({ record }: { record: WorkStatusRecord }) {
  return (
    <div className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-3 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-start gap-3">
        <AvatarBubble record={record} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 text-sm leading-tight truncate">{record.name}</p>
          <p className="text-slate-400 text-xs mt-0.5 truncate">{record.department}</p>
          
          <div className="mt-2 text-xs">
            {record.status === "factory" && (
              <div className="flex flex-col gap-1 text-slate-500">
                <div className="flex items-center gap-1.5 text-blue-600 font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span>Factory</span>
                </div>
                <span>เข้า {record.checkIn ?? "-"} {record.checkOut ? `· ออก ${record.checkOut}` : ""}</span>
              </div>
            )}
            {record.status === "onsite" && (
              <div className="flex flex-col gap-1 text-slate-500">
                <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="truncate">{record.onsiteLocation || "On-site"}</span>
                </div>
                {record.checkIn && <span>เข้า {record.checkIn}</span>}
              </div>
            )}
            {record.status === "leave" && (
              <div className="flex items-center gap-1.5 text-rose-500 font-medium">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M4 11h16M6 5h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z" />
                </svg>
                <span className="truncate">{record.leaveLabel}</span>
              </div>
            )}
            {record.status === "not_checked_in" && (
              <div className="flex items-center gap-1.5 text-slate-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="italic">ยังไม่เข้างาน</span>
              </div>
            )}
          </div>
          
          {record.reportItems.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5 mb-1.5">
                <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-xs font-semibold text-indigo-600">มีรายงาน ({record.reportItems.length})</span>
              </div>
              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                {record.reportItems[0].detail ?? record.reportItems[0].projectNo ?? "อัปเดตงานแล้ว"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusColumn({
  title,
  count,
  icon,
  accentColor,
  accentBg,
  records,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  accentColor: string;
  accentBg: string;
  records: WorkStatusRecord[];
}) {
  return (
    <div className="flex flex-col bg-slate-50/70 rounded-3xl p-3 border border-slate-200/60 min-w-[280px] w-[300px] shrink-0 max-h-full">
      <div className="flex items-center justify-between mb-4 px-2 pt-1">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl ${accentBg} flex items-center justify-center shadow-sm text-white`}>
            {icon}
          </div>
          <h2 className={`font-bold text-sm ${accentColor}`}>{title}</h2>
        </div>
        <span className="bg-white border border-slate-200 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
          {count}
        </span>
      </div>
      
      <div className="flex flex-col gap-3 overflow-y-auto pr-1 pb-2 scrollbar-hide h-full">
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
            <span className="text-slate-300 mb-2">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </span>
            <p className="text-slate-400 text-sm font-semibold">ไม่มีข้อมูล</p>
          </div>
        ) : (
          records.map((record) => <EmployeeCard key={record.id} record={record} />)
        )}
      </div>
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

  const factoryRecords = records.filter((r) => r.status === "factory");
  const onsiteRecords = records.filter((r) => r.status === "onsite");
  const leaveRecords = records.filter((r) => r.status === "leave");
  const notCheckedInRecords = records.filter((r) => r.status === "not_checked_in");

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] md:h-screen bg-[#f7f9fc]">
      {/* Header Bar */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Work Status</h1>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
              {records.length} Employees
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            สรุปสถานะการทำงานและรายงานประจำวันที่ {workDate}
          </p>
        </div>

        <form className="flex items-center gap-2 shrink-0" action="/work-status">
          <input
            type="date"
            name="date"
            defaultValue={workDate}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-all shadow-sm"
          />
          <button className="h-10 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 transition-colors">
            ดูข้อมูล
          </button>
        </form>
      </div>

      {/* Kanban Board Container */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        <div className="flex gap-6 h-full items-stretch pb-4 min-w-max">
          
          <StatusColumn 
            title="Factory" 
            count={factoryRecords.length}
            records={factoryRecords}
            accentColor="text-blue-700"
            accentBg="bg-blue-600"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          />
          
          <StatusColumn 
            title="On-site" 
            count={onsiteRecords.length}
            records={onsiteRecords}
            accentColor="text-emerald-700"
            accentBg="bg-emerald-600"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />

          <StatusColumn 
            title="ลาพัก / ลากิจ" 
            count={leaveRecords.length}
            records={leaveRecords}
            accentColor="text-rose-700"
            accentBg="bg-rose-600"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3M4 11h16M6 5h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z" />
              </svg>
            }
          />

          <StatusColumn 
            title="ยังไม่เข้างาน" 
            count={notCheckedInRecords.length}
            records={notCheckedInRecords}
            accentColor="text-slate-600"
            accentBg="bg-slate-500"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />

        </div>
      </div>
    </div>
  );
}
