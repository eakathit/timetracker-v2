"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";

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
  otHours: number;
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

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS_TH = [
  "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน",
  "พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม",
  "กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม",
];
const DAYS_SHORT = ["อา","จ","อ","พ","พฤ","ศ","ส"];

const LEAVE_TYPE: Record<string, { label: string; color: string; bg: string }> = {
  sick:      { label: "ลาป่วย",     color: "text-rose-600",   bg: "bg-rose-50 border-rose-200" },
  annual:    { label: "ลาพักร้อน", color: "text-violet-600", bg: "bg-violet-50 border-violet-200" },
  personal:  { label: "ลากิจ",      color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
  emergency: { label: "ลาฉุกเฉิน", color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
};

// ── แผนกสำหรับ Dropdown ───────────────────────────────────────────────────────
const DEPARTMENTS = [
  "Mechanic",
  "HR",
  "Design",
  "Electrical",
  "Accounting",
];

// ── Mock Leave Quota (ยังไม่มีตาราง leave ใน DB) ─────────────────────────────
const LEAVE_QUOTA_MOCK = [
  { type: "sick",      used: 3, quota: 30, pending: 1 },
  { type: "annual",   used: 2, quota: 10, pending: 0 },
  { type: "personal", used: 2, quota: 3,  pending: 0 },
  { type: "emergency",used: 0, quota: 3,  pending: 0 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** แปลง ISO timestamp → "HH:mm" ตาม local timezone */
function toLocalHHMM(isoString: string | null): string | null {
  if (!isoString) return null;
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** หาช่วงวันแรก-วันสุดท้ายของเดือน */
function getMonthRange(year: number, month: number) {
  const start   = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end     = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

/** แปลง work_type จาก DB → DayLog.workType */
function mapWorkType(raw: string): DayLog["workType"] {
  if (raw === "on_site") return "on_site";
  if (raw === "mixed")   return "mixed";
  return "in_factory";
}

/** คำนวณ status จากเวลา check-in (>08:00 = สาย) */
function calcStatus(checkIn: string | null): "on_time" | "late" {
  if (!checkIn) return "on_time";
  const [h, m] = checkIn.split(":").map(Number);
  return h > 8 || (h === 8 && m > 0) ? "late" : "on_time";
}

function pct(used: number, quota: number) {
  return quota > 0 ? Math.min(Math.round((used / quota) * 100), 100) : 0;
}

// ─── Sub Components ───────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, sub, accent,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 font-medium truncate">{label}</p>
        <p className="text-2xl font-extrabold text-gray-800 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
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
          const isWeekend = col === 0 || col === 6;
          const isWork    = log && log.workType !== "holiday" && log.status !== "leave" && !isWeekend;

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
                    {log.isReportSent ? "✓ ส่งแล้ว" : "✗ ยังไม่ส่ง"}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-violet-100" />
          <span className="text-[10px] text-gray-400 font-medium">ส่งแล้ว</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-rose-50" />
          <span className="text-[10px] text-gray-400 font-medium">ยังไม่ส่ง</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gray-50" />
          <span className="text-[10px] text-gray-400 font-medium">วันหยุด/ลา</span>
        </div>
      </div>
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────
function ListView({ logs }: { logs: DayLog[] }) {
  const workLogs = logs.filter(l => l.checkIn).slice().reverse();
  if (!workLogs.length) {
    return <p className="text-sm text-gray-400 text-center py-8">ไม่มีข้อมูลการทำงานในเดือนนี้</p>;
  }
  return (
    <div className="divide-y divide-gray-50">
      {workLogs.map(log => (
        <div key={log.date} className="flex items-center gap-3 px-1 py-3 hover:bg-gray-50/50 transition-colors">
          <StatusDot status={log.status} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-800">
                {Number(log.date.split("-")[2])} {MONTHS_TH[Number(log.date.split("-")[1]) - 1].slice(0, 3)}
              </p>
              {log.otHours > 0 && (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                  OT +{log.otHours}h
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              {log.checkIn} – {log.checkOut ?? "ยังไม่ออก"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              log.isReportSent
                ? "text-sky-600 bg-sky-50 border-sky-200"
                : "text-gray-400 bg-gray-50 border-gray-200"
            }`}>
              {log.isReportSent ? "✓ Report" : "— Report"}
            </span>
            {(log.workType === "on_site" || log.workType === "mixed") && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                {log.workType === "mixed" ? "Mixed" : "On-site"}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Leave Quota Section ──────────────────────────────────────────────────────
function LeaveQuotaSection() {
  const today      = new Date();
  const totalUsed  = LEAVE_QUOTA_MOCK.reduce((s, i) => s + i.used, 0);
  const totalQuota = LEAVE_QUOTA_MOCK.reduce((s, i) => s + i.quota, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-700">โควต้าการลาประจำปี</h3>
            <p className="text-xs text-gray-400">ปี {today.getFullYear() + 543} · ใช้ไปแล้ว {totalUsed} / {totalQuota} วัน</p>
          </div>
        </div>
        <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
          เหลือ {totalQuota - totalUsed} วัน
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {LEAVE_QUOTA_MOCK.map((item, i) => {
          const cfg       = LEAVE_TYPE[item.type];
          const remaining = item.quota - item.used;
          const barColors = ["bg-rose-400", "bg-violet-400", "bg-amber-400", "bg-orange-400"];
          return (
            <div key={item.type} className={`p-4 rounded-xl border ${cfg.bg}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[11px] font-bold ${cfg.color}`}>{cfg.label}</span>
                <span className={`text-xs font-extrabold ${cfg.color}`}>{item.used}/{item.quota}</span>
              </div>
              <div className="w-full h-2 bg-white/60 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${barColors[i]}`}
                  style={{ width: `${pct(item.used, item.quota)}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-medium ${cfg.color} opacity-70`}>เหลือ {remaining} วัน</span>
                {item.pending > 0 && (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
                    รออนุมัติ {item.pending}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary bar */}
      <div className="mt-4 pt-4 border-t border-gray-50">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-gray-400">ภาพรวมการใช้วันลา</span>
          <span className="text-xs font-bold text-gray-600">{pct(totalUsed, totalQuota)}%</span>
        </div>
        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
          {LEAVE_QUOTA_MOCK.map((item, i) => {
            const w = (item.used / totalQuota) * 100;
            if (!w) return null;
            const colors = ["bg-rose-400", "bg-violet-400", "bg-amber-400", "bg-orange-400"];
            return <div key={item.type} className={`h-full ${colors[i]} transition-all duration-700`} style={{ width: `${w}%` }} />;
          })}
        </div>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {LEAVE_QUOTA_MOCK.map((item, i) => {
            const cfg    = LEAVE_TYPE[item.type];
            const colors = ["bg-rose-400", "bg-violet-400", "bg-amber-400", "bg-orange-400"];
            return (
              <div key={item.type} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${colors[i]}`} />
                <span className="text-[10px] text-gray-400">{cfg.label}</span>
              </div>
            );
          })}
        </div>
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
  const [isEditing,    setIsEditing]    = useState(false);
  const [profileForm,  setProfileForm]  = useState({ firstName: "", lastName: "", department: "" });
  const [userId,       setUserId]       = useState<string | null>(null);
  const [userEmail,    setUserEmail]    = useState<string>("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [isSaving,     setIsSaving]    = useState(false);

  // ── Calendar / logs state ─────────────────────────────────────────────────────
  const [logs,        setLogs]        = useState<DayLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // ─── 1. โหลด Profile ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setUserEmail(user.email ?? "");
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

  // ─── 2. โหลดข้อมูลประจำเดือน ───────────────────────────────────────────────
  // ดึง 3 ตารางพร้อมกัน: daily_time_logs, holidays, daily_reports
  const fetchMonthLogs = useCallback(async () => {
    if (!userId) return;
    setLogsLoading(true);

    const { start, end } = getMonthRange(viewYear, viewMonth);
    const todayStr = today.toISOString().split("T")[0];

    try {
      const [timeRes, holidayRes, reportRes] = await Promise.all([
        // ── time logs ของ user เดือนนี้
        supabase
          .from("daily_time_logs")
          .select("log_date, work_type, first_check_in, last_check_out, ot_hours, status")
          .eq("user_id", userId)
          .gte("log_date", start)
          .lte("log_date", end),

        // ── วันหยุดทั้งเดือน (เหมือน Calendar page)
        supabase
          .from("holidays")
          .select("holiday_date")
          .gte("holiday_date", start)
          .lte("holiday_date", end),

        // ── วันที่ส่ง daily report แล้ว
        supabase
          .from("daily_reports")
          .select("report_date")
          .eq("user_id", userId)
          .gte("report_date", start)
          .lte("report_date", end),
      ]);

      // Build lookup maps
      const timeLogMap: Record<string, TimeLogRow> = {};
      (timeRes.data ?? []).forEach(r => { timeLogMap[r.log_date] = r; });

      const holidaySet = new Set<string>((holidayRes.data ?? []).map(h => h.holiday_date));
      const reportSet  = new Set<string>((reportRes.data ?? []).map(r => r.report_date));

      // สร้าง DayLog ครบทุกวันในเดือน
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      const result: DayLog[] = [];

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr   = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const dow       = new Date(viewYear, viewMonth, d).getDay();
        const isWeekend = dow === 0 || dow === 6;
        const isHoliday = holidaySet.has(dateStr);
        const timeLog   = timeLogMap[dateStr];

        // วันหยุด / เสาร์-อาทิตย์
        if (isWeekend || isHoliday) {
          result.push({
            date: dateStr, checkIn: null, checkOut: null,
            workType: isHoliday ? "holiday" : null,
            status: "holiday", isReportSent: false, otHours: 0,
          });
          continue;
        }

        // มี time log = มาทำงาน
        if (timeLog) {
          const checkIn  = toLocalHHMM(timeLog.first_check_in);
          const checkOut = toLocalHHMM(timeLog.last_check_out);
          result.push({
            date: dateStr,
            checkIn,
            checkOut,
            workType:     mapWorkType(timeLog.work_type),
            status:       calcStatus(checkIn),
            isReportSent: reportSet.has(dateStr),
            otHours:      Number(timeLog.ot_hours) || 0,
          });
          continue;
        }

        // ไม่มี log: วันในอนาคตไม่ตัดสิน, วันที่ผ่านมา = ขาด
        result.push({
          date: dateStr, checkIn: null, checkOut: null,
          workType: null,
          status: dateStr <= todayStr ? "absent" : "absent",
          isReportSent: false, otHours: 0,
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
  const workdays    = useMemo(() =>
    logs.filter(l => l.status !== "holiday"),
  [logs]);
  const presentDays = useMemo(() =>
    logs.filter(l => l.status === "on_time" || l.status === "late"),
  [logs]);
  const reportSent  = useMemo(() => logs.filter(l => l.isReportSent), [logs]);
  const reportTotal = useMemo(() =>
    logs.filter(l => l.checkIn !== null && l.status !== "leave" && l.status !== "holiday"),
  [logs]);
  const otTotal = useMemo(() => logs.reduce((s, l) => s + l.otHours, 0), [logs]);

  const avgCheckIn = useMemo(() => {
    const times = presentDays.map(l => l.checkIn).filter(Boolean) as string[];
    if (!times.length) return "-";
    const total = times.reduce((s, t) => {
      const [h, m] = t.split(":").map(Number);
      return s + h * 60 + m;
    }, 0);
    const avg = Math.round(total / times.length);
    return `${String(Math.floor(avg / 60)).padStart(2, "0")}:${String(avg % 60).padStart(2, "0")}`;
  }, [presentDays]);

  const reportRate = reportTotal.length > 0
    ? Math.round((reportSent.length / reportTotal.length) * 100)
    : 0;

  const totalLeaveRemaining = LEAVE_QUOTA_MOCK.reduce((s, i) => s + (i.quota - i.used), 0);

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
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white text-2xl font-extrabold shadow-lg border-4 border-white">
                  {profileForm.firstName ? profileForm.firstName.charAt(0).toUpperCase() : "U"}
                </div>
                <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white" />
              </div>
            </div>

            <div className="mt-4">
              {profileLoading ? (
                <div className="animate-pulse space-y-2 mt-2">
                  <div className="h-5 w-40 bg-gray-100 rounded-lg" />
                  <div className="h-3 w-24 bg-gray-100 rounded-lg" />
                </div>
              ) : isEditing ? (
                // ── Edit Form ──────────────────────────────────────────────────
                <div className="space-y-3 mt-4 w-full md:w-2/3 lg:w-1/2">
                  <input
                    type="text"
                    placeholder="ชื่อจริง"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-sky-400"
                    value={profileForm.firstName}
                    onChange={e => setProfileForm({ ...profileForm, firstName: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="นามสกุล"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-sky-400"
                    value={profileForm.lastName}
                    onChange={e => setProfileForm({ ...profileForm, lastName: e.target.value })}
                  />
                  {/* Department Dropdown */}
                  <div className="relative">
                    <select
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-sky-400 bg-white appearance-none pr-9 text-gray-700"
                      value={profileForm.department}
                      onChange={e => setProfileForm({ ...profileForm, department: e.target.value })}
                    >
                      <option value="" disabled>-- เลือกแผนก --</option>
                      {DEPARTMENTS.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 14, height: 14 }}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="px-5 py-2 bg-sky-500 text-white text-sm font-bold rounded-xl hover:bg-sky-600 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSaving && (
                        <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      )}
                      บันทึกการแก้ไข
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      disabled={isSaving}
                      className="px-5 py-2 bg-gray-100 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              ) : (
                // ── View Mode ─────────────────────────────────────────────────
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-extrabold text-gray-800 leading-tight">
                      {(profileForm.firstName || profileForm.lastName)
                        ? `${profileForm.firstName} ${profileForm.lastName}`.trim()
                        : "ยังไม่ได้ตั้งชื่อ"}
                    </h2>
                    <p className="text-sm text-gray-400 mt-0.5">{profileForm.department || "ยังไม่ระบุแผนก"}</p>
                    <p className="text-xs text-gray-300 mt-0.5">{userEmail}</p>
                  </div>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-xs font-bold text-sky-600 bg-sky-50 px-4 py-2 rounded-xl border border-sky-100 hover:bg-sky-100 transition-colors"
                  >
                    แก้ไขโปรไฟล์
                  </button>
                </div>
              )}
            </div>

            {/* Quick stats strip */}
            <div className="mt-5 grid grid-cols-3 gap-3 pt-4 border-t border-gray-50">
              <div className="text-center">
                <p className="text-lg font-extrabold text-gray-800">{totalLeaveRemaining}</p>
                <p className="text-[10px] text-gray-400 font-medium">วันลาคงเหลือ</p>
              </div>
              <div className="text-center border-x border-gray-100">
                <p className="text-lg font-extrabold text-amber-500">
                  {logsLoading ? "..." : otTotal.toFixed(1)}
                </p>
                <p className="text-[10px] text-gray-400 font-medium">OT เดือนนี้ (h)</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-extrabold text-sky-500">
                  {logsLoading ? "..." : `${reportRate}%`}
                </p>
                <p className="text-[10px] text-gray-400 font-medium">ส่ง Report</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2-column layout on PC ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* LEFT: Month Nav + Stats + Calendar/List */}
          <div className="space-y-5">

            {/* Month Navigator */}
            <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
              <button onClick={prevMonth} className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors">
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

            {/* Stat Cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>}
                label="วันที่มาทำงาน"
                value={logsLoading ? "..." : String(presentDays.length)}
                sub={logsLoading ? undefined : `จาก ${workdays.filter(l => l.status !== "leave").length} วัน`}
                accent="bg-sky-50 text-sky-500"
              />
              <StatCard
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>}
                label="เฉลี่ย Check-in"
                value={logsLoading ? "..." : avgCheckIn}
                accent="bg-emerald-50 text-emerald-500"
              />
              <StatCard
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>}
                label="ส่ง Daily Report"
                value={logsLoading ? "..." : `${reportSent.length}/${reportTotal.length}`}
                sub={logsLoading ? undefined : `${reportRate}% ของเดือน`}
                accent="bg-violet-50 text-violet-500"
              />
              <StatCard
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/><path d="M17 3.5L21 7"/></svg>}
                label="OT เดือนนี้"
                value={logsLoading ? "..." : `${otTotal.toFixed(1)}h`}
                accent="bg-amber-50 text-amber-500"
              />
            </div>

            {/* Calendar / List Tabs */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex border-b border-gray-100">
                {(["calendar", "list"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3 text-sm font-bold transition-all border-b-2 ${
                      activeTab === tab
                        ? "text-sky-600 border-sky-400 bg-sky-50/50"
                        : "text-gray-400 border-transparent hover:bg-gray-50"
                    }`}
                  >
                    {tab === "calendar" ? "📅 ปฏิทินการมา" : "📋 รายการ"}
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
                <h3 className="text-sm font-bold text-gray-700">📝 ปฏิทินส่ง Report</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {logsLoading
                    ? "กำลังโหลด..."
                    : `ส่งแล้ว ${reportSent.length} / ${reportTotal.length} วัน`}
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
            <LeaveQuotaSection />

          </div>
        </div>
      </div>
    </main>
  );
}