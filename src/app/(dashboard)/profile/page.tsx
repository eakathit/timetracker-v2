"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { LeaveBalanceWithPolicy } from "@/types/leave";
import { LEAVE_TYPE_CONFIG } from "@/types/leave";

// ─── Supabase Client (Browser) ────────────────────────────────────────────────
function useSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface DayLog {
  date: string;                // "YYYY-MM-DD"
  checkIn: string | null;      // "HH:mm"
  checkOut: string | null;     // "HH:mm"
  workType: "in_factory" | "on_site" | "mixed" | "leave" | "holiday" | null;
  status: "on_time" | "late" | "absent" | "holiday" | "leave";
  isReportSent: boolean;
  otHours: number;             // รวม OT จาก daily_time_logs + ot_requests ที่อนุมัติ
}

// Row จาก daily_time_logs
interface TimeLogRow {
  log_date: string;
  work_type: string;
  first_check_in: string | null;
  last_check_out: string | null;
  ot_hours: number;
  status: string;
}

// Row จาก ot_requests
interface OTRequestRow {
  request_date: string;
  start_time: string;
  end_time: string;
  hours: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────


const MONTHS_TH = [
  "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน",
  "พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม",
  "กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม",
];
const DAYS_SHORT = ["อา","จ","อ","พ","พฤ","ศ","ส"];

const DEPARTMENTS = [
  "Mechanic",
  "HR",
  "Design",
  "Electrical",
  "Accounting",
];

const LEAVE_BAR_COLOR: Record<string, string> = {
  vacation:         "bg-violet-400",
  sick:             "bg-rose-400",
  personal:         "bg-amber-400",
  special_personal: "bg-sky-400",
  other:            "bg-gray-400",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** แปลง ISO timestamp → "HH:mm" ตาม local timezone */
function fmtTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 5);
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function classifyStatus(
  checkIn: string | null,
  timeLog: TimeLogRow | undefined,
  isFuture: boolean,
): DayLog["status"] {
  if (timeLog?.status) {
    const s = timeLog.status;
    if (s === "on_time" || s === "late" || s === "absent" || s === "leave") return s;
  }
  if (!checkIn) return isFuture ? "absent" : "absent";
  const [h, m] = fmtTime(checkIn).split(":").map(Number);
  return h > 8 || (h === 8 && m > 15) ? "late" : "on_time";
}

/** คำนวณ OT hours จาก time string "HH:mm:ss" หรือ "HH:mm" */
function calcOTHours(startTime: string, endTime: string): number {
  const parseMin = (t: string) => {
    const p = t.split(":").map(Number);
    return p[0] * 60 + (p[1] ?? 0);
  };
  const diff = parseMin(endTime) - parseMin(startTime);
  return diff > 0 ? Math.round((diff / 60) * 100) / 100 : 0;
}

function pct(used: number, quota: number) {
  return quota > 0 ? Math.min(Math.round((used / quota) * 100), 100) : 0;
}

// ─── Sub Components ───────────────────────────────────────────────────────────
// ใหม่
function StatCard({
  icon, label, value, sub, accent, comingSoon,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent: string; comingSoon?: boolean;
}) {
  return (
    <div className={`relative bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-4 overflow-hidden ${comingSoon ? "border-gray-100 opacity-75" : "border-gray-100"}`}>
      {/* Coming Soon overlay badge */}
      {comingSoon && (
        <span className="absolute top-2 right-2 text-[9px] font-black tracking-wider uppercase bg-amber-100 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-lg">
          Coming Soon
        </span>
      )}
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 font-medium truncate">{label}</p>
        <p className={`text-2xl font-extrabold leading-tight ${comingSoon ? "text-gray-300" : "text-gray-800"}`}>{value}</p>
        {sub && <p className={`text-xs mt-0.5 ${comingSoon ? "text-gray-300" : "text-gray-400"}`}>{sub}</p>}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: DayLog["status"] }) {
  const map: Record<string, string> = {
    on_time: "bg-emerald-400", late: "bg-amber-400",
    absent:  "bg-rose-400",   holiday: "bg-gray-200", leave: "bg-violet-400",
  };
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${map[status]}`} />;
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────────
function CalendarSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="grid grid-cols-7 gap-y-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="w-7 h-7 rounded-lg bg-gray-100" />
            <div className="w-1.5 h-1.5 rounded-full bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Attendance Calendar ──────────────────────────────────────────────────────
function AttendanceCalendar({
  year, month, logs,
}: {
  year: number; month: number; logs: DayLog[];
}) {
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const logMap = useMemo(() => {
    const m: Record<string, DayLog> = {};
    logs.forEach(l => { m[l.date] = l; });
    return m;
  }, [logs]);

  const dotColor: Record<string, string> = {
    on_time: "bg-emerald-400", late: "bg-amber-400",
    absent:  "bg-rose-400",   holiday: "bg-gray-100", leave: "bg-violet-400",
  };

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_SHORT.map((d, i) => (
          <div key={d} className={`text-center text-[10px] font-bold pb-1.5 ${
            i === 0 ? "text-rose-400" : i === 6 ? "text-sky-400" : "text-gray-400"
          }`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />;
          const col     = idx % 7;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const log     = logMap[dateStr];
          const sc      = log ? dotColor[log.status] : "bg-gray-100";

          return (
            <div key={day} className="flex flex-col items-center gap-0.5">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold ${
                log?.status === "on_time" ? "text-emerald-700" :
                log?.status === "late"   ? "text-amber-700"  :
                log?.status === "absent" ? "text-rose-700"   :
                log?.status === "leave"  ? "text-violet-600" :
                (col === 0 || col === 6) ? "text-gray-300"   : "text-gray-400"
              }`}>
                {day}
              </div>
              <div className={`w-1.5 h-1.5 rounded-full ${sc}`} />
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50 flex-wrap">
        {[
          { color: "bg-emerald-400", label: "ตรงเวลา" },
          { color: "bg-amber-400",   label: "สาย" },
          { color: "bg-rose-400",    label: "ขาด" },
          { color: "bg-violet-400",  label: "ลา" },
          { color: "bg-gray-200",    label: "หยุด" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
            <span className="text-[10px] text-gray-400 font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Report Calendar ──────────────────────────────────────────────────────────
function ReportCalendar({
  year, month, logs,
}: {
  year: number; month: number; logs: DayLog[];
}) {
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const logMap = useMemo(() => {
    const m: Record<string, DayLog> = {};
    logs.forEach(l => { m[l.date] = l; });
    return m;
  }, [logs]);

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_SHORT.map((d, i) => (
          <div key={d} className={`text-center text-[10px] font-bold pb-1.5 ${
            i === 0 ? "text-rose-400" : i === 6 ? "text-sky-400" : "text-gray-400"
          }`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />;
          const col     = idx % 7;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const log     = logMap[dateStr];
          const isSunday     = col === 0;
          const isSat        = col === 6;
          // ตรวจสอบจาก log ว่าเป็น working_sat หรือเปล่า (ถ้า log มีข้อมูล = วันนั้นทำงานอยู่)
          const isOffWeekend = (isSunday || isSat) && (!log || log.status === "holiday");
          const isWork       = log && log.checkIn !== null && log.workType !== "holiday" && log.status !== "leave" && !isOffWeekend;

          return (
            <div key={day} className="relative group flex flex-col items-center">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold cursor-default transition-all ${
                !isWork
                  ? "bg-gray-50 text-gray-300"
                  : log.isReportSent
                  ? "bg-violet-100 text-violet-600 hover:bg-violet-200"
                  : "bg-rose-50 text-rose-400 hover:bg-rose-100"
              }`}>
                {day}
              </div>
              {isWork && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-gray-800 text-white text-[9px] font-bold px-2 py-1 rounded-lg whitespace-nowrap shadow-xl">
                    {log.isReportSent ? "✅ ส่งแล้ว" : "❌ ยังไม่ส่ง"}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-md bg-violet-100 border border-violet-300" />
          <span className="text-[10px] text-gray-400 font-medium">ส่งแล้ว</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-md bg-rose-50 border border-rose-200" />
          <span className="text-[10px] text-gray-400 font-medium">ยังไม่ส่ง</span>
        </div>
      </div>
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────
function ListView({ logs }: { logs: DayLog[] }) {
  const workdays = logs.filter(l => l.status !== "holiday" && l.checkIn);
  if (!workdays.length) {
    return (
      <div className="text-center py-8 text-gray-300">
        <p className="text-sm">ไม่มีข้อมูลการมาทำงาน</p>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {workdays.map(log => (
        <div key={log.date} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-gray-50 transition-colors">
          <StatusDot status={log.status} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-700 truncate">
              {new Date(log.date + "T00:00:00").toLocaleDateString("th-TH", {
                weekday: "short", day: "numeric", month: "short",
              })}
            </p>
            <p className="text-[10px] text-gray-400">
              {log.checkIn ?? "-"} → {log.checkOut ?? "-"}
              {log.otHours > 0 && (
                <span className="ml-2 text-amber-500 font-bold">+{log.otHours}h OT</span>
              )}
            </p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
            log.status === "on_time" ? "bg-emerald-50 text-emerald-600" :
            log.status === "late"    ? "bg-amber-50  text-amber-600"   :
            log.status === "leave"   ? "bg-violet-50 text-violet-600"  :
            "bg-rose-50 text-rose-500"
          }`}>
            {log.status === "on_time" ? "ตรงเวลา" :
             log.status === "late"    ? "สาย"     :
             log.status === "leave"   ? "ลา"      : "ขาด"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Leave Quota Section ──────────────────────────────────────────────────────
function LeaveQuotaSection({ userId }: { userId: string }) {
  const supabase = useSupabase();
  const [balances, setBalances] = useState<LeaveBalanceWithPolicy[]>([]);
  const [loading, setLoading]   = useState(true);
  const currentYear = new Date().getFullYear();

  // จัดลำดับ: vacation → sick → personal → special_personal → other
  const ORDER = ["vacation", "sick", "personal", "special_personal", "other"];

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("leave_balances_with_policy")
      .select("*")
      .eq("user_id", userId)
      .eq("year", currentYear)
      .then(({ data }) => {
        if (data) {
          const sorted = [...(data as LeaveBalanceWithPolicy[])].sort(
            (a, b) => ORDER.indexOf(a.leave_type) - ORDER.indexOf(b.leave_type)
          );
          setBalances(sorted);
        }
        setLoading(false);
      });
  }, [userId]);

  const totalUsed  = balances.reduce((s, b) => s + Number(b.used_days), 0);
  const totalTotal = balances.reduce((s, b) => s + Number(b.total_days), 0);
  const totalPct   = totalTotal > 0 ? Math.round((totalUsed / totalTotal) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* header */}
      <div className="px-5 py-4 border-b border-gray-50">
        <h3 className="text-sm font-bold text-gray-700">สิทธิ์วันลา</h3>
        {loading
          ? <div className="h-3 w-36 bg-gray-100 rounded-full animate-pulse mt-1" />
          : <p className="text-xs text-gray-400 mt-0.5">
              ใช้ไป {totalUsed} / {totalTotal} วัน ({totalPct}%)
            </p>
        }
      </div>

      <div className="p-5 space-y-4">
        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <div className="h-3 w-20 bg-gray-100 rounded-full animate-pulse" />
                <div className="h-3 w-14 bg-gray-100 rounded-full animate-pulse" />
              </div>
              <div className="h-2 bg-gray-100 rounded-full animate-pulse" />
            </div>
          ))
        ) : balances.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">ไม่พบข้อมูลสิทธิ์วันลา</p>
        ) : (
          <>
            {balances.map((b) => {
              const cfg      = LEAVE_TYPE_CONFIG[b.leave_type as keyof typeof LEAVE_TYPE_CONFIG];
              const barColor = LEAVE_BAR_COLOR[b.leave_type] ?? "bg-gray-400";
              const usedPct  = Number(b.used_pct);

              return (
                <div key={b.id}>
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${cfg?.color ?? "text-gray-600"}`}>
                        {b.label_th}
                      </span>
                      {Number(b.carried_over_days) > 0 && (
                        <span className="text-[9px] font-bold bg-violet-50 text-violet-600 border border-violet-200 px-1.5 py-0.5 rounded-full">
                          +{b.carried_over_days} ยกยอด
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {Number(b.pending_days) > 0 && (
                        <span className="text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full">
                          รอ {b.pending_days}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400 font-medium">
                        {b.used_days}/{b.total_days} วัน
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        usedPct >= 100 ? "bg-rose-400" : barColor
                      }`}
                      style={{ width: `${Math.min(usedPct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {/* legend */}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {balances.map((b) => {
                const barColor = LEAVE_BAR_COLOR[b.leave_type] ?? "bg-gray-400";
                return (
                  <div key={b.leave_type} className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${barColor}`} />
                    <span className="text-[10px] text-gray-400">{b.label_th}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const supabase = useSupabase();
  const today    = new Date();

  // ── View state ────────────────────────────────────────────────────────────────
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [activeTab, setActiveTab] = useState<"calendar" | "list">("calendar");

  // ── Profile state ─────────────────────────────────────────────────────────────
  const [isEditing,      setIsEditing]      = useState(false);
  const [profileForm,    setProfileForm]    = useState({ firstName: "", lastName: "", department: "" });
  const [userId,         setUserId]         = useState<string | null>(null);
  const [userEmail,      setUserEmail]      = useState<string>("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [isSaving,       setIsSaving]       = useState(false);

  // ── Calendar / logs state ─────────────────────────────────────────────────────
  const [logs,        setLogs]        = useState<DayLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // ─── 1. โหลด Profile ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setUserEmail(user.email ?? "");
        setAvatarUrl(user.user_metadata?.avatar_url ?? null);
        const { data } = await supabase
  .from("profiles")
  .select("first_name, last_name, department")
  .eq("id", user.id)
  .single();
        if (data) {
          setProfileForm({
            firstName:  data.first_name  ?? "",
            lastName:   data.last_name   ?? "",
            department: data.department  ?? "",
          });
        }
      }
      setProfileLoading(false);
    })();
  }, []);

// ─── 2. โหลดข้อมูลประจำเดือน ────────────────────────────────────────────────
// ดึง 4 ตารางพร้อมกัน: daily_time_logs, holidays, daily_reports, ot_requests
const fetchMonthLogs = useCallback(async () => {
  if (!userId) return;
  setLogsLoading(true);

  const { start, end } = getMonthRange(viewYear, viewMonth);
  const todayStr = today.toISOString().split("T")[0];

  try {
    const [timeRes, holidayRes, reportRes, otReqRes] = await Promise.all([
      // ── time logs ของ user เดือนนี้
      supabase
        .from("daily_time_logs")
        .select("log_date, work_type, first_check_in, last_check_out, ot_hours, status")
        .eq("user_id", userId)
        .gte("log_date", start)
        .lte("log_date", end),

      // ── วันหยุดทั้งเดือน
      supabase
        .from("holidays")
        .select("holiday_date, holiday_type")
        .gte("holiday_date", start)
        .lte("holiday_date", end),

      // ── วันที่ส่ง daily report แล้ว
      supabase
        .from("daily_reports")
        .select("report_date")
        .eq("user_id", userId)
        .gte("report_date", start)
        .lte("report_date", end),

      // ── OT requests ที่ได้รับการอนุมัติแล้ว
      supabase
        .from("ot_requests")
        .select("request_date, start_time, end_time, hours")
        .eq("user_id", userId)
        .eq("status", "approved")
        .gte("request_date", start)
        .lte("request_date", end),
    ]);

    // ── Build lookup maps ────────────────────────────────────────────────────
    const timeLogMap: Record<string, TimeLogRow> = {};
    (timeRes.data ?? []).forEach(r => { timeLogMap[r.log_date] = r; });

    type HolidayRow = { holiday_date: string; holiday_type: string };
    const holidayData = (holidayRes.data ?? []) as HolidayRow[];

    const holidaySet = new Set<string>(
      holidayData
        .filter(h => h.holiday_type !== "working_sat")
        .map(h => h.holiday_date)
    );
    const workingSatSet = new Set<string>(
      holidayData
        .filter(h => h.holiday_type === "working_sat")
        .map(h => h.holiday_date)
    );

    const reportSet = new Set<string>((reportRes.data ?? []).map(r => r.report_date));

    // สร้าง map: request_date -> approved OT hours รวม
    const otRequestMap: Record<string, number> = {};
    ((otReqRes.data ?? []) as OTRequestRow[]).forEach(r => {
      const h = (r.hours != null && r.hours > 0)
        ? r.hours
        : calcOTHours(r.start_time, r.end_time);
      otRequestMap[r.request_date] = (otRequestMap[r.request_date] ?? 0) + h;
    });

    // ── สร้าง DayLog ครบทุกวันในเดือน ───────────────────────────────────────
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const result: DayLog[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr      = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dow          = new Date(viewYear, viewMonth, d).getDay();
      const isWorkingSat = workingSatSet.has(dateStr);
      const isWeekend    = (dow === 0) || (dow === 6 && !isWorkingSat);
      const isHoliday    = holidaySet.has(dateStr);
      const timeLog      = timeLogMap[dateStr];
      const isFuture     = dateStr > todayStr;

      // ── 1. Leave มา priority สูงสุด ──────────────────────────────────────
      if (timeLog?.status === "leave") {
        result.push({
          date: dateStr, checkIn: null, checkOut: null,
          workType: "leave",
          status: "leave",
          isReportSent: reportSet.has(dateStr),
          otHours: 0,
        });
        continue;
      }

      // ── 2. Weekend / Holiday — แต่ถ้ามี check-in จริงให้ไหลต่อ ──────────
      if ((isWeekend || isHoliday) && !timeLog?.first_check_in) {
        result.push({
          date: dateStr, checkIn: null, checkOut: null,
          workType: isHoliday ? "holiday" : null,
          status: "holiday",
          isReportSent: false,
          otHours: 0,
        });
        continue;
      }

      // ── 3. วันทำงานปกติ (รวม weekend / holiday ที่มี check-in จริง) ──────
      const checkIn  = timeLog?.first_check_in ? fmtTime(timeLog.first_check_in) : null;
      const checkOut = timeLog?.last_check_out  ? fmtTime(timeLog.last_check_out) : null;

      const otFromLog  = timeLog?.ot_hours ?? 0;
      const otFromReq  = otRequestMap[dateStr] ?? 0;
      const combinedOT = otFromLog + otFromReq;

      // ── 3a. ขาดงาน ───────────────────────────────────────────────────────
      if (!checkIn && !isFuture) {
        result.push({
          date: dateStr, checkIn: null, checkOut: null,
          workType: null,
          status: "absent",
          isReportSent: false,
          otHours: 0,
        });
        continue;
      }

      // ── 3b. อนาคตที่ยังไม่มีข้อมูล → ข้ามไม่แสดง ────────────────────────
      if (isFuture && !checkIn) continue;

      // ── 3c. มี check-in → แสดงปกติ ───────────────────────────────────────
      result.push({
        date: dateStr,
        checkIn,
        checkOut,
        workType: timeLog?.work_type as DayLog["workType"] ?? null,
        status: classifyStatus(timeLog?.first_check_in ?? null, timeLog, isFuture),
        isReportSent: reportSet.has(dateStr),
        otHours: combinedOT,
      });
    }

    setLogs(result);
  } catch (err) {
    console.error("fetchMonthLogs error:", err);
  } finally {
    setLogsLoading(false);
  }
}, [userId, viewYear, viewMonth]);

  // Re-fetch ทุกครั้งที่ userId โหลดเสร็จหรือเปลี่ยนเดือน
  useEffect(() => {
    if (userId) fetchMonthLogs();
  }, [fetchMonthLogs]);

  // ─── 3. บันทึก Profile ───────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!userId) return;
    setIsSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id:         userId,
      first_name: profileForm.firstName,
      last_name:  profileForm.lastName,
      department: profileForm.department,
      updated_at: new Date().toISOString(),
    });
    setIsSaving(false);
    if (error) {
      console.error("Save profile error:", error);
      alert("บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่");
    } else {
      setIsEditing(false);
    }
  };
  
  // ─── Month Navigation ─────────────────────────────────────────────────────────
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewYear === today.getFullYear() && viewMonth === today.getMonth()) return;
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  // ─── Derived Stats ────────────────────────────────────────────────────────────
  const workdays    = useMemo(() => logs.filter(l => l.status !== "holiday"), [logs]);
  const presentDays = useMemo(() => logs.filter(l => l.status === "on_time" || l.status === "late"), [logs]);
  const reportSent  = useMemo(() => logs.filter(l => l.isReportSent), [logs]);
  const reportTotal = useMemo(() =>
    logs.filter(l => l.checkIn !== null && l.status !== "leave" && l.status !== "holiday"),
  [logs]);
  const otTotal = useMemo(() => logs.reduce((s, l) => s + l.otHours, 0), [logs]);

  const lateCount = useMemo(() => logs.filter(l => l.status === "late").length, [logs]);


  const reportRate = reportTotal.length > 0
    ? Math.round((reportSent.length / reportTotal.length) * 100)
    : 0;

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-50 pb-28 md:pb-10">

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-gray-50/90 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-5 pb-4">
          <p className="text-xs text-gray-400 font-medium">โปรไฟล์</p>
          <h1 className="text-xl font-extrabold text-gray-800">โปรไฟล์ & ประวัติการทำงาน</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-5 space-y-5">

        {/* ── Profile Card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-20 bg-gradient-to-r from-sky-400 to-blue-500 relative">
            <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
            <div className="absolute right-8 -bottom-2 w-14 h-14 rounded-full bg-white/10" />
          </div>
          <div className="px-5 pb-5 -mt-8">
            <div className="flex items-end justify-between">
             <div className="relative">
  <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg border-4 border-white">
    {avatarUrl ? (
      <img
        src={avatarUrl}
        alt="profile"
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover"
      />
    ) : (
      <div className="w-full h-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white text-2xl font-extrabold">
        {profileForm.firstName ? profileForm.firstName.charAt(0).toUpperCase() : "U"}
      </div>
    )}
  </div>
  <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white" />
  {/* ❌ ลบ <input type="file" ...> ออกด้วย */}
</div >

              <div className="mt-10">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-500 hover:border-sky-300 hover:text-sky-600 hover:bg-sky-50 transition-all"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  แก้ไข
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="px-3 py-1.5 rounded-xl bg-sky-500 text-white text-xs font-bold hover:bg-sky-600 transition-all disabled:opacity-60 shadow-sm"
                  >
                    {isSaving ? "กำลังบันทึก..." : "บันทึก"}
                  </button>
                </div>
              )}
            </div>
              </div>
              
            <div className="mt-4">
              {profileLoading ? (
                <div className="animate-pulse space-y-2 mt-2">
                  <div className="h-5 w-40 bg-gray-100 rounded-lg" />
                  <div className="h-3 w-24 bg-gray-100 rounded-lg" />
                </div>
              ) : isEditing ? (
                <div className="space-y-3 mt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">ชื่อ</label>
                      <input
                        type="text"
                        value={profileForm.firstName}
                        onChange={e => setProfileForm(p => ({ ...p, firstName: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-400 transition-all"
                        placeholder="ชื่อ"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">นามสกุล</label>
                      <input
                        type="text"
                        value={profileForm.lastName}
                        onChange={e => setProfileForm(p => ({ ...p, lastName: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-400 transition-all"
                        placeholder="นามสกุล"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">แผนก</label>
                    <select
                      value={profileForm.department}
                      onChange={e => setProfileForm(p => ({ ...p, department: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-400 transition-all"
                    >
                      <option value="">เลือกแผนก</option>
                      {DEPARTMENTS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="mt-2">
                  <h2 className="text-xl font-extrabold text-gray-800">
                    {profileForm.firstName || profileForm.lastName
                      ? `${profileForm.firstName} ${profileForm.lastName}`.trim()
                      : "ยังไม่ได้ตั้งชื่อ"}
                  </h2>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {profileForm.department || "ยังไม่ได้ระบุแผนก"} · {userEmail}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Quick Stats Strip ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="grid grid-cols-4 divide-x divide-gray-100">
            <div className="text-center px-2">
              <p className="text-lg font-extrabold text-emerald-500">
                {logsLoading ? "..." : String(presentDays.length)}
              </p>
              <p className="text-[10px] text-gray-400 font-medium">วันที่มา</p>
            </div>
            <div className="text-center px-2">
  <p className={`text-lg font-extrabold ${lateCount === 0 ? "text-emerald-500" : "text-amber-500"}`}>
    {logsLoading ? "..." : String(lateCount)}
  </p>
  <p className="text-[10px] text-gray-400 font-medium">มาสาย (วัน)</p>
</div>
            <div className="text-center px-2">
              {/* OT total รวมจาก ot_requests ที่อนุมัติ + daily_time_logs */}
              <p className="text-lg font-extrabold text-amber-600">
                {logsLoading ? "..." : otTotal.toFixed(1)}
              </p>
              <p className="text-[10px] text-gray-400 font-medium">OT เดือนนี้ (ชม.)</p>
            </div>
            <div className="text-center px-2">
              <p className="text-lg font-extrabold text-sky-500">
                {logsLoading ? "..." : `${reportRate}%`}
              </p>
              <p className="text-[10px] text-gray-400 font-medium">ส่งรายงาน</p>
            </div>
          </div>
        </div>

        {/* ── 2-column layout on PC ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* LEFT: Month Nav + Stats + Calendar/List */}
          <div className="space-y-5">

            {/* Month Navigator */}
            <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
              <button
                onClick={prevMonth}
                className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <div className="text-center">
                <h3 className="text-base font-extrabold text-gray-800">
                  {MONTHS_TH[viewMonth]} {viewYear + 543}
                </h3>
                <p className="text-xs text-gray-400">
                  {logsLoading
                    ? "กำลังโหลด..."
                    : `${workdays.filter(l => l.status !== "leave").length} วันทำงาน · ${presentDays.length} วันมา`}
                </p>
              </div>
              <button
                onClick={nextMonth}
                disabled={viewYear === today.getFullYear() && viewMonth === today.getMonth()}
                className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-30"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            {/* Calendar / List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex border-b border-gray-50">
                {(["calendar", "list"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3.5 text-xs font-bold border-b-2 transition-all ${
                      activeTab === tab
                        ? "text-sky-600 border-sky-400 bg-sky-50/50"
                        : "text-gray-400 border-transparent hover:bg-gray-50"
                    }`}
                  >
                    {tab === "calendar" ? "📅 ปฏิทินเข้างาน" : "📋 ประวัติเข้างาน"}
                  </button>
                ))}
              </div>
              <div className="p-5">
                {logsLoading
                  ? <CalendarSkeleton />
                  : activeTab === "calendar"
                  ? <AttendanceCalendar year={viewYear} month={viewMonth} logs={logs} />
                  : <ListView logs={logs} />
                }
              </div>
            </div>
          </div>

          {/* RIGHT: Report Calendar + Leave Quota */}
          <div className="space-y-5">

            {/* Report Calendar */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <h3 className="text-sm font-bold text-gray-700">📝 ปฏิทินส่งรายงาน</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {logsLoading
                    ? "กำลังโหลด..."
                    : `ส่งแล้ว ${reportSent.length} / ${reportTotal.length} วัน (เดือนนี้)`}
                </p>
              </div>
              <div className="p-5">
                {logsLoading
                  ? <CalendarSkeleton />
                  : <ReportCalendar year={viewYear} month={viewMonth} logs={logs} />
                }
              </div>
            </div>

            {/* Leave Quota */}
            <LeaveQuotaSection userId={userId ?? ""} />

          </div>
        </div>
      </div>
    </main>
  );
}