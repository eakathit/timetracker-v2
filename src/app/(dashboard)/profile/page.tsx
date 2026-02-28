"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DayLog {
  date: string; // "YYYY-MM-DD"
  checkIn: string | null;   // "HH:mm"
  checkOut: string | null;  // "HH:mm"
  workType: "in_factory" | "on_site" | "leave" | "holiday" | null;
  status: "on_time" | "late" | "absent" | "holiday" | "leave";
  isReportSent: boolean;
  otHours: number;
}

interface OTRecord {
  id: string;
  date: string;
  hours: number;
  reason: string;
  project: string;
  status: "approved" | "pending" | "rejected";
}

interface LeaveRecord {
  id: string;
  startDate: string;
  endDate: string;
  days: number;
  type: "sick" | "annual" | "personal" | "emergency";
  reason: string;
  status: "approved" | "pending" | "rejected";
}

// ─── Raw Supabase row types ───────────────────────────────────────────────────
interface RawTimeLog {
  log_date: string;
  first_check_in: string | null;
  last_check_out: string | null;
  work_type: string;
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
  sick:      { label: "ลาป่วย",      color: "text-rose-600",   bg: "bg-rose-50 border-rose-200" },
  annual:    { label: "ลาพักร้อน",  color: "text-violet-600", bg: "bg-violet-50 border-violet-200" },
  personal:  { label: "ลากิจ",       color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
  emergency: { label: "ลาฉุกเฉิน",  color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
};

const OT_STATUS_CONFIG = {
  approved: { label: "อนุมัติแล้ว", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  pending:  { label: "รอพิจารณา",  color: "text-amber-600 bg-amber-50 border-amber-200" },
  rejected: { label: "ไม่อนุมัติ", color: "text-rose-600 bg-rose-50 border-rose-200" },
};

const LEAVE_STATUS_CONFIG = {
  approved: { label: "อนุมัติแล้ว", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  pending:  { label: "รอพิจารณา",  color: "text-amber-600 bg-amber-50 border-amber-200" },
  rejected: { label: "ไม่อนุมัติ", color: "text-rose-600 bg-rose-50 border-rose-200" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toHHMM(isoString: string | null): string | null {
  if (!isoString) return null;
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function isLateCheckIn(isoString: string | null): boolean {
  if (!isoString) return false;
  const d = new Date(isoString);
  const mins = d.getHours() * 60 + d.getMinutes();
  return mins > 8 * 60 + 30; // หลัง 08:30
}

function mapWorkType(raw: string): DayLog["workType"] {
  if (raw === "on_site") return "on_site";
  return "in_factory"; // factory | mixed → in_factory
}

/** สร้าง skeleton ของทุกวันในเดือน แล้ว merge กับ real logs */
function buildMonthLogs(
  year: number,
  month: number,
  timeLogs: RawTimeLog[],
  reportDates: Set<string>,
): DayLog[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // map log_date → row for quick lookup
  const logMap = new Map<string, RawTimeLog>();
  timeLogs.forEach((l) => logMap.set(l.log_date, l));

  const result: DayLog[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dow = new Date(year, month, d).getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isFuture = dateStr > todayStr;

    if (isWeekend) {
      result.push({
        date: dateStr,
        checkIn: null, checkOut: null,
        workType: null,
        status: "holiday",
        isReportSent: false,
        otHours: 0,
      });
      continue;
    }

    const log = logMap.get(dateStr);

    if (!log) {
      // วันทำงานที่ไม่มี log → absent (ยกเว้นวันในอนาคต)
      result.push({
        date: dateStr,
        checkIn: null, checkOut: null,
        workType: null,
        status: isFuture ? "absent" : "absent",
        isReportSent: false,
        otHours: 0,
      });
      continue;
    }

    const checkIn = toHHMM(log.first_check_in);
    const checkOut = toHHMM(log.last_check_out);
    const workType = mapWorkType(log.work_type);
    const late = isLateCheckIn(log.first_check_in);

    result.push({
      date: dateStr,
      checkIn,
      checkOut,
      workType,
      status: late ? "late" : "on_time",
      isReportSent: reportDates.has(dateStr),
      otHours: log.ot_hours ?? 0,
    });
  }

  return result;
}

// ─── Mock Data (OT & Leave — ยังไม่มีตารางจริง) ──────────────────────────────
const MOCK_OT: OTRecord[] = [
  { id: "ot1", date: "2026-02-04", hours: 2,   reason: "งานด่วนลูกค้า Toyota",       project: "Toyota Line A", status: "approved" },
  { id: "ot2", date: "2026-02-11", hours: 3,   reason: "ทดสอบระบบไฟฟ้า",            project: "Honda Factory",  status: "approved" },
  { id: "ot3", date: "2026-02-18", hours: 1.5, reason: "เร่งส่งมอบงาน Phase 2",     project: "SCG Plant",      status: "pending"  },
  { id: "ot4", date: "2026-01-22", hours: 4,   reason: "ซ่อมฉุกเฉิน Panel Room",    project: "Toyota Line B",  status: "approved" },
  { id: "ot5", date: "2026-01-15", hours: 2,   reason: "Commissioning test",          project: "Honda Office",   status: "rejected" },
];

const MOCK_LEAVE: LeaveRecord[] = [
  { id: "lv1", startDate: "2026-02-09", endDate: "2026-02-10", days: 2, type: "personal",  reason: "ธุระส่วนตัว",       status: "approved" },
  { id: "lv2", startDate: "2026-01-08", endDate: "2026-01-08", days: 1, type: "sick",      reason: "ไม่สบาย มีไข้",      status: "approved" },
  { id: "lv3", startDate: "2025-12-26", endDate: "2025-12-27", days: 2, type: "annual",    reason: "พักผ่อนช่วงปีใหม่", status: "approved" },
  { id: "lv4", startDate: "2026-03-05", endDate: "2026-03-05", days: 1, type: "sick",      reason: "นัดหมอ",             status: "pending"  },
];

const leaveQuota = 10;
const leaveUsed  = MOCK_LEAVE.filter((l) => l.status === "approved").reduce((s, l) => s + l.days, 0);

// ─── Sub Components ───────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accent ?? "bg-sky-50 text-sky-500"}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 font-medium leading-tight">{label}</p>
        <p className="text-lg font-extrabold text-gray-800 leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-gray-300 font-medium">{sub}</p>}
      </div>
    </div>
  );
}

function DayCell({
  log,
  isSelected,
  onClick,
}: {
  log: DayLog | null;
  isSelected: boolean;
  onClick?: () => void;
}) {
  if (!log) return <div className="aspect-square" />;

  const [, , dayStr] = log.date.split("-");
  const day = parseInt(dayStr, 10);

  const styleMap: Record<DayLog["status"], string> = {
    on_time: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    late:    "bg-amber-50  text-amber-700  border border-amber-200",
    absent:  "bg-rose-50   text-rose-600   border border-rose-200",
    holiday: "bg-gray-50   text-gray-300   border border-gray-100",
    leave:   "bg-violet-50 text-violet-600 border border-violet-200",
  };

  const dotMap: Record<DayLog["status"], string> = {
    on_time: "bg-emerald-400",
    late:    "bg-amber-400",
    absent:  "bg-rose-400",
    holiday: "bg-gray-300",
    leave:   "bg-violet-400",
  };

  const isHoliday = log.status === "holiday";

  return (
    <button
      onClick={!isHoliday ? onClick : undefined}
      className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all
        ${isSelected ? "ring-2 ring-sky-400 ring-offset-1 scale-95" : ""}
        ${isHoliday ? "cursor-default" : "hover:scale-95 active:scale-90"}
        ${styleMap[log.status]}`}
    >
      <span className="text-xs font-bold leading-none">{day}</span>
      {log.otHours > 0 && (
        <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-sky-400" />
      )}
      {!isHoliday && (
        <span className={`absolute bottom-1 w-1 h-1 rounded-full ${dotMap[log.status]}`} />
      )}
    </button>
  );
}

function DayDetail({ log }: { log: DayLog }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-4 mt-3 transition-all">
      <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div>
          <span className="text-gray-400">เข้างาน</span>
          <p className="font-bold text-gray-800">{log.checkIn ?? "—"}</p>
        </div>
        <div>
          <span className="text-gray-400">ออกงาน</span>
          <p className="font-bold text-gray-800">{log.checkOut ?? "—"}</p>
        </div>
        <div>
          <span className="text-gray-400">ประเภท</span>
          <p className="font-bold text-gray-800">
            {log.workType === "on_site" ? "On-site" : log.workType === "in_factory" ? "In-factory" : "—"}
          </p>
        </div>
        <div>
          <span className="text-gray-400">OT</span>
          <p className="font-bold text-sky-500">{log.otHours > 0 ? `${log.otHours} ชม.` : "—"}</p>
        </div>
      </div>
      <div className="flex flex-col gap-1 items-end">
        {log.isReportSent && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border text-sky-600 bg-sky-50 border-sky-200">
            ✓ Report
          </span>
        )}
        {log.workType === "on_site" && (
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
            On-site
          </span>
        )}
      </div>
    </div>
  );
}

function LogListItem({ log }: { log: DayLog }) {
  const [, , dayStr] = log.date.split("-");
  const d = new Date(log.date + "T00:00:00");
  const dow = DAYS_SHORT[d.getDay()];

  const statusConfig = {
    on_time: { label: "ปกติ",       color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
    late:    { label: "สาย",         color: "text-amber-600 bg-amber-50 border-amber-200" },
    absent:  { label: "ขาด",         color: "text-rose-600 bg-rose-50 border-rose-200" },
    holiday: { label: "หยุด",        color: "text-gray-400 bg-gray-50 border-gray-200" },
    leave:   { label: "ลา",          color: "text-violet-600 bg-violet-50 border-violet-200" },
  };

  const cfg = statusConfig[log.status];

  return (
    <div className="flex items-center gap-3 px-1 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-10 text-center flex-shrink-0">
        <p className="text-base font-extrabold text-gray-700 leading-none">{dayStr}</p>
        <p className="text-[10px] text-gray-400 font-medium">{dow}</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>
            {cfg.label}
          </span>
          {log.otHours > 0 && (
            <span className="text-[10px] font-bold text-sky-600 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-full">
              OT {log.otHours}h
            </span>
          )}
        </div>
        {log.checkIn && (
          <p className="text-xs text-gray-500 mt-0.5">
            {log.checkIn} – {log.checkOut ?? "?"}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1 items-end">
        {log.isReportSent !== undefined && log.status !== "holiday" && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
            log.isReportSent
              ? "text-sky-600 bg-sky-50 border-sky-200"
              : "text-gray-400 bg-gray-50 border-gray-200"
          }`}>
            {log.isReportSent ? "✓ Report" : "— Report"}
          </span>
        )}
        {log.workType === "on_site" && (
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
            On-site
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const today     = new Date();
  const todayStr  = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [activeTab, setActiveTab] = useState<"calendar" | "list">("calendar");
  const [historyTab, setHistoryTab] = useState<"ot" | "leave">("ot");
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr);

  // ─── States Profile ──────────────────────────────────────────────────────────
  const [isEditing, setIsEditing]   = useState(false);
  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "", department: "" });
  const [userId, setUserId]         = useState<string | null>(null);
  const [userEmail, setUserEmail]   = useState<string>("");
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // ─── States Data ─────────────────────────────────────────────────────────────
  const [timeLogs, setTimeLogs]       = useState<RawTimeLog[]>([]);
  const [reportDates, setReportDates] = useState<Set<string>>(new Set());
  const [isDataLoading, setIsDataLoading] = useState(false);

  // ─── Supabase client (memo) ──────────────────────────────────────────────────
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  ), []);

  // ─── Load Profile ────────────────────────────────────────────────────────────
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
      setIsProfileLoading(false);
    })();
  }, [supabase]);

  // ─── Load Time Logs & Daily Reports (re-run เมื่อเดือน/ปีเปลี่ยน) ──────────
  const fetchMonthData = useCallback(async () => {
    if (!userId) return;
    setIsDataLoading(true);

    const monthStart = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;
    const lastDay    = new Date(viewYear, viewMonth + 1, 0).getDate();
    const monthEnd   = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const [logsRes, reportsRes] = await Promise.all([
      supabase
        .from("daily_time_logs")
        .select("log_date, first_check_in, last_check_out, work_type, ot_hours, status")
        .eq("user_id", userId)
        .gte("log_date", monthStart)
        .lte("log_date", monthEnd),
      supabase
        .from("daily_reports")
        .select("report_date")
        .eq("user_id", userId)
        .gte("report_date", monthStart)
        .lte("report_date", monthEnd),
    ]);

    setTimeLogs(logsRes.data ?? []);
    setReportDates(new Set((reportsRes.data ?? []).map((r: { report_date: string }) => r.report_date)));
    setIsDataLoading(false);
  }, [userId, viewYear, viewMonth, supabase]);

  useEffect(() => {
    fetchMonthData();
  }, [fetchMonthData]);

  // ─── Build DayLogs from real data ────────────────────────────────────────────
  const logs = useMemo(
    () => buildMonthLogs(viewYear, viewMonth, timeLogs, reportDates),
    [viewYear, viewMonth, timeLogs, reportDates],
  );

  // ─── Navigation ──────────────────────────────────────────────────────────────
  const prevMonth = () => {
    setSelectedDate(null);
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    setSelectedDate(null);
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  // ─── Save Profile ────────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!userId) return;
    setIsProfileLoading(true);
    const { error } = await supabase.from("profiles").upsert({
      id:         userId,
      first_name: profileForm.firstName,
      last_name:  profileForm.lastName,
      department: profileForm.department,
      updated_at: new Date().toISOString(),
    });
    setIsProfileLoading(false);
    if (error) {
      alert("บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่");
    } else {
      setIsEditing(false);
      alert("บันทึกข้อมูลเรียบร้อยแล้ว");
    }
  };

  // ─── Stats (computed from real data) ─────────────────────────────────────────
  const presentDays  = logs.filter((l) => l.status === "on_time" || l.status === "late");
  const lateDays     = logs.filter((l) => l.status === "late");
  const absentDays   = logs.filter((l) => l.status === "absent");
  const reportSent   = logs.filter((l) => l.isReportSent);
  const reportTotal  = logs.filter((l) => l.checkIn !== null);
  const otTotal      = logs.reduce((s, l) => s + (l.otHours ?? 0), 0);

  const avgCheckIn = (() => {
    const times = presentDays.map((l) => l.checkIn!).filter(Boolean);
    if (!times.length) return "—";
    const total = times.reduce((s, t) => {
      const [h, m] = t.split(":").map(Number);
      return s + h * 60 + m;
    }, 0);
    const avg = Math.round(total / times.length);
    return `${String(Math.floor(avg / 60)).padStart(2, "0")}:${String(avg % 60).padStart(2, "0")}`;
  })();

  const reportRate = reportTotal.length > 0
    ? Math.round((reportSent.length / reportTotal.length) * 100)
    : 0;

  // Calendar grid
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const logMap   = useMemo(() => new Map(logs.map((l) => [l.date, l])), [logs]);
  const selectedLog = selectedDate ? (logMap.get(selectedDate) ?? null) : null;

  // ─── Calendar Render ──────────────────────────────────────────────────────────
  const totalCells = firstDow + logs.length;
  const rows = Math.ceil(totalCells / 7);

  return (
    <main className="p-4 md:p-6 pb-28 space-y-5 max-w-2xl mx-auto">

      {/* ══ Profile Header ══════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
        {/* Avatar */}
        <div className="flex items-center justify-between">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-2xl font-extrabold text-white shadow-md shadow-sky-200">
              {profileForm.firstName ? profileForm.firstName.charAt(0).toUpperCase() : "?"}
            </div>
            <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white" />
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs font-bold text-sky-600 bg-sky-50 px-4 py-2 rounded-xl border border-sky-100 hover:bg-sky-100 transition-colors"
            >
              แก้ไขโปรไฟล์
            </button>
          )}
        </div>

        {/* Info / Edit Form */}
        <div className="mt-4">
          {isProfileLoading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-5 w-40 bg-gray-100 rounded-lg" />
              <div className="h-3 w-24 bg-gray-100 rounded-lg" />
            </div>
          ) : isEditing ? (
            <div className="space-y-3 mt-4">
              <input
                type="text"
                placeholder="ชื่อจริง"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-sky-400"
                value={profileForm.firstName}
                onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
              />
              <input
                type="text"
                placeholder="นามสกุล"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-sky-400"
                value={profileForm.lastName}
                onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
              />
              <input
                type="text"
                placeholder="แผนก"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-sky-400"
                value={profileForm.department}
                onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })}
              />
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSaveProfile}
                  className="px-5 py-2 bg-sky-500 text-white text-sm font-bold rounded-xl hover:bg-sky-600 transition-colors shadow-sm"
                >
                  บันทึก
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-5 py-2 bg-gray-100 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-extrabold text-gray-800 leading-tight">
                {profileForm.firstName || profileForm.lastName
                  ? `${profileForm.firstName} ${profileForm.lastName}`.trim()
                  : "ยังไม่ได้ตั้งชื่อ"}
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">{profileForm.department || "ยังไม่ระบุแผนก"}</p>
              <p className="text-xs text-gray-300 mt-0.5">{userEmail}</p>
            </div>
          )}
        </div>

        {/* Quick Stats Strip */}
        <div className="mt-5 grid grid-cols-3 gap-3 pt-4 border-t border-gray-50">
          <div className="text-center">
            <p className="text-lg font-extrabold text-gray-800">{leaveQuota - leaveUsed}</p>
            <p className="text-[10px] text-gray-400 font-medium">วันลาคงเหลือ</p>
          </div>
          <div className="text-center border-x border-gray-100">
            <p className="text-lg font-extrabold text-amber-500">{otTotal.toFixed(1)}</p>
            <p className="text-[10px] text-gray-400 font-medium">OT เดือนนี้ (h)</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-extrabold text-sky-500">{reportRate}%</p>
            <p className="text-[10px] text-gray-400 font-medium">ส่ง Report</p>
          </div>
        </div>
      </div>

      {/* ══ Stat Cards ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>}
          label="วันทำงานปกติ"
          value={`${presentDays.length} วัน`}
          accent="bg-emerald-50 text-emerald-500"
        />
        <StatCard
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>}
          label="มาสาย"
          value={`${lateDays.length} วัน`}
          accent="bg-amber-50 text-amber-500"
        />
        <StatCard
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><circle cx="12" cy="12" r="9"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
          label="ขาดงาน"
          value={`${absentDays.length} วัน`}
          accent="bg-rose-50 text-rose-500"
        />
        <StatCard
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M12 6v6l3 3"/><circle cx="12" cy="12" r="9"/></svg>}
          label="เฉลี่ยเข้างาน"
          value={avgCheckIn}
          accent="bg-indigo-50 text-indigo-500"
        />
      </div>

      {/* ══ Attendance Calendar ══════════════════════════════════════════════════ */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <button onClick={prevMonth} className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-gray-500">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="text-center">
            <p className="text-sm font-extrabold text-gray-800">
              {MONTHS_TH[viewMonth]} {viewYear + 543}
            </p>
            {isDataLoading && (
              <p className="text-[10px] text-sky-400 font-medium animate-pulse">กำลังโหลด...</p>
            )}
          </div>
          <button onClick={nextMonth} className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-gray-500">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Tab */}
        <div className="flex gap-1 px-5 pt-4 pb-2">
          {(["calendar", "list"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === t ? "bg-sky-500 text-white shadow-sm" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
              }`}
            >
              {t === "calendar" ? "📅 ปฏิทิน" : "📋 รายการ"}
            </button>
          ))}
        </div>

        {/* ── Calendar View ── */}
        {activeTab === "calendar" && (
          <div className="px-4 pb-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS_SHORT.map((d, i) => (
                <div key={d} className={`text-center text-[10px] font-bold py-1 ${i === 0 ? "text-rose-400" : i === 6 ? "text-sky-400" : "text-gray-400"}`}>
                  {d}
                </div>
              ))}
            </div>
            {/* Cells */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: rows * 7 }).map((_, idx) => {
                const logIdx = idx - firstDow;
                if (logIdx < 0 || logIdx >= logs.length) return <div key={idx} className="aspect-square" />;
                const log = logs[logIdx];
                return (
                  <DayCell
                    key={log.date}
                    log={log}
                    isSelected={selectedDate === log.date}
                    onClick={() => setSelectedDate(selectedDate === log.date ? null : log.date)}
                  />
                );
              })}
            </div>

            {/* Detail panel */}
            {selectedLog && selectedLog.status !== "holiday" && (
              <DayDetail log={selectedLog} />
            )}

            {/* Legend */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-4 pt-3 border-t border-gray-50">
              {[
                { label: "ปกติ",    color: "bg-emerald-400" },
                { label: "สาย",     color: "bg-amber-400" },
                { label: "ขาด",     color: "bg-rose-400" },
                { label: "ลา",      color: "bg-violet-400" },
                { label: "หยุด",    color: "bg-gray-300" },
                { label: "OT",      color: "bg-sky-400" },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${color}`} />
                  <span className="text-[10px] text-gray-400 font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── List View ── */}
        {activeTab === "list" && (
          <div className="px-4 pb-4 divide-y divide-gray-50">
            {isDataLoading ? (
              <div className="py-10 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-sky-300 border-t-sky-500 rounded-full animate-spin" />
              </div>
            ) : logs.filter((l) => l.status !== "holiday").length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-300">ไม่มีข้อมูล</p>
            ) : (
              logs.filter((l) => l.status !== "holiday").map((log) => (
                <LogListItem key={log.date} log={log} />
              ))
            )}
          </div>
        )}
      </div>

      {/* ══ OT & Leave History ══════════════════════════════════════════════════ */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <p className="text-sm font-extrabold text-gray-700">ประวัติ OT & การลา</p>
          <span className="text-[10px] text-amber-500 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            Mock Data
          </span>
        </div>

        {/* Tab */}
        <div className="flex gap-1 px-5 pt-4 pb-3">
          {(["ot", "leave"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setHistoryTab(t)}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                historyTab === t ? "bg-sky-500 text-white shadow-sm" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
              }`}
            >
              {t === "ot" ? "⏰ OT" : "📝 การลา"}
            </button>
          ))}
        </div>

        {/* OT List */}
        {historyTab === "ot" && (
          <div className="px-4 pb-4 space-y-2">
            {MOCK_OT.map((ot) => {
              const cfg = OT_STATUS_CONFIG[ot.status];
              return (
                <div key={ot.id} className="bg-gray-50 rounded-2xl p-3 flex items-start gap-3">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center flex-shrink-0 font-extrabold text-sm">
                    {ot.hours}h
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-700 truncate">{ot.reason}</p>
                    <p className="text-xs text-gray-400">{ot.project} · {ot.date}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Leave List */}
        {historyTab === "leave" && (
          <div className="px-4 pb-4 space-y-2">
            {MOCK_LEAVE.map((lv) => {
              const typeCfg   = LEAVE_TYPE[lv.type];
              const statusCfg = LEAVE_STATUS_CONFIG[lv.status];
              return (
                <div key={lv.id} className="bg-gray-50 rounded-2xl p-3 flex items-start gap-3">
                  <div className={`px-2 py-1 rounded-xl border flex-shrink-0 text-[10px] font-bold ${typeCfg.bg} ${typeCfg.color}`}>
                    {typeCfg.label}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-700 truncate">{lv.reason}</p>
                    <p className="text-xs text-gray-400">
                      {lv.startDate === lv.endDate ? lv.startDate : `${lv.startDate} – ${lv.endDate}`}
                      {" "}· {lv.days} วัน
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${statusCfg.color}`}>
                    {statusCfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </main>
  );
}