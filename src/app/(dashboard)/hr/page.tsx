"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ════════════════════════════════════════════════════════
//  TYPES
// ════════════════════════════════════════════════════════
interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
  role: string | null;
}

interface TimeLog {
  user_id: string;
  log_date: string;
  first_check_in: string | null;
  last_check_out: string | null;
  ot_hours: number;
  regular_hours: number;
  status: string;
  work_type: string;
}

interface Holiday {
  id: string;
  holiday_date: string; // "YYYY-MM-DD"
  name: string;
  holiday_type: "national" | "company" | "special" | "working_sat";
}

interface AttendanceStat {
  userId: string;
  present: number;
  late: number;
  absent: number;
  totalOT: number;
  totalRegHours: number;
  avgCheckInMinutes: number;
  avgCheckOutMinutes: number;
  logs: TimeLog[];
}

// ════════════════════════════════════════════════════════
//  CONSTANTS & HELPERS
// ════════════════════════════════════════════════════════
const MONTHS_TH = [
  "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน",
  "พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม",
  "กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม",
];
const DAYS_SHORT = ["อา","จ","อ","พ","พฤ","ศ","ส"];
const LATE_THRESHOLD_MINUTES = 8 * 60 + 30; // 08:30

const STATUS_DOT: Record<string, string> = {
  present: "bg-emerald-500",
  late:    "bg-amber-400",
  absent:  "bg-rose-400",
};
const STATUS_CHIP: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700 border-emerald-200",
  late:    "bg-amber-50  text-amber-700  border-amber-200",
  absent:  "bg-rose-50   text-rose-600   border-rose-200",
};
const STATUS_LABEL: Record<string, string> = {
  present: "ปกติ", late: "สาย", absent: "ขาด",
};
const AVATAR_GRAD = [
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-violet-400 to-purple-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
  "from-cyan-400 to-sky-500",
];

/** ISO timestamp → นาทีในวัน */
function toMinutes(iso: string | null): number {
  if (!iso) return 0;
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/** นาที → "HH:MM" */
function minsToStr(mins: number): string {
  if (!mins) return "–";
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

/**
 * สร้าง list วันทำงานในเดือน
 * - นับ จ–ศ ปกติ
 * - นับ เสาร์ทำงาน (working_sat) ด้วย
 * - ตัดวันหยุด (national / company / special) ออก
 */
function getWorkdays(year: number, month: number, holidays: Holiday[]): string[] {
  const days: string[] = [];
  const total = new Date(year, month + 1, 0).getDate();

  const holidayDates = new Set(
    holidays
      .filter(h => h.holiday_type !== "working_sat")
      .map(h => h.holiday_date),
  );
  const workingSats = new Set(
    holidays
      .filter(h => h.holiday_type === "working_sat")
      .map(h => h.holiday_date),
  );

  for (let d = 1; d <= total; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dow = new Date(year, month, d).getDay();

    if (holidayDates.has(dateStr)) continue;   // วันหยุด → ข้าม
    if (dow === 0) continue;                    // อาทิตย์ → ข้าม
    if (dow === 6 && !workingSats.has(dateStr)) continue; // เสาร์ปกติ → ข้าม
    // เสาร์ทำงาน หรือ จ–ศ ปกติ → นับ
    days.push(dateStr);
  }
  return days;
}

/** ช่วงวันที่ของเดือน */
function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end   = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

/** คำนวณสถิติรายบุคคลจาก raw logs + รายชื่อวันทำงาน */
function calcStats(userId: string, logs: TimeLog[], workdays: string[]): AttendanceStat {
  const logByDate = new Map(logs.map(l => [l.log_date, l]));
  const todayStr  = new Date().toISOString().split("T")[0];

  let present = 0, late = 0, absent = 0;
  let totalOT = 0, totalRegHours = 0;
  const checkInMins: number[]  = [];
  const checkOutMins: number[] = [];

  workdays.forEach(date => {
    if (date > todayStr) return; // อนาคต → ข้าม
    const log = logByDate.get(date);
    if (!log?.first_check_in) { absent++; return; }

    const inMins = toMinutes(log.first_check_in);
    if (inMins > LATE_THRESHOLD_MINUTES) late++;
    else present++;

    totalOT        += log.ot_hours      ?? 0;
    totalRegHours  += log.regular_hours ?? 0;
    checkInMins.push(inMins);
    if (log.last_check_out) checkOutMins.push(toMinutes(log.last_check_out));
  });

  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

  return {
    userId, present, late, absent,
    totalOT:        Math.round(totalOT       * 10) / 10,
    totalRegHours:  Math.round(totalRegHours * 10) / 10,
    avgCheckInMinutes:  avg(checkInMins),
    avgCheckOutMinutes: avg(checkOutMins),
    logs,
  };
}

function getFullName(p: Profile | undefined): string {
  if (!p) return "–";
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "–";
}

// ════════════════════════════════════════════════════════
//  EXPORT EXCEL
// ════════════════════════════════════════════════════════
async function exportExcel(
  profiles: Profile[],
  statsMap: Record<string, AttendanceStat>,
  workdays: string[],
  year: number,
  month: number,
) {
  const { utils, writeFile } = await import("xlsx");
  const title  = `HR ATTENDANCE — ${MONTHS_TH[month]} ${year + 543}`;
  const header = [
    [title], [],
    ["ชื่อ-นามสกุล","แผนก","วันทำงาน","มาปกติ","มาสาย","ขาดงาน",
     "ชม.ปกติ","OT (ชม.)","เวลาเข้าเฉลี่ย","เวลาออกเฉลี่ย"],
  ];
  const rows = profiles.map(p => {
    const s = statsMap[p.id];
    if (!s) return [getFullName(p), p.department ?? "–", workdays.length, 0, 0, 0, 0, 0, "–", "–"];
    return [
      getFullName(p), p.department ?? "–", workdays.length,
      s.present, s.late, s.absent,
      s.totalRegHours, s.totalOT,
      minsToStr(s.avgCheckInMinutes),
      minsToStr(s.avgCheckOutMinutes),
    ];
  });
  const ws = utils.aoa_to_sheet([...header, ...rows]);
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }];
  ws["!cols"]   = [20,14,10,10,10,10,10,10,14,14].map(w => ({ wch: w }));
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, `${MONTHS_TH[month].slice(0,3)}_${year+543}`);
  writeFile(wb, `hr_attendance_${year}_${String(month+1).padStart(2,"0")}.xlsx`);
}

// ════════════════════════════════════════════════════════
//  STAT CARD
// ════════════════════════════════════════════════════════
function StatCard({ icon, label, value, sub, colorBg }: {
  icon: React.ReactNode; label: string;
  value: string | number; sub?: string; colorBg: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorBg}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-extrabold text-gray-800 leading-none">{value}</p>
        <p className="text-[11px] text-gray-400 font-medium mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-gray-300">{sub}</p>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
//  DRILL-DOWN PANEL
// ════════════════════════════════════════════════════════
function DrillDownPanel({ profile, empIdx, stat, workdays, holidays, year, month, onClose }: {
  profile: Profile;
  empIdx: number;
  stat: AttendanceStat;
  workdays: string[];
  holidays: Holiday[];
  year: number;
  month: number;
  onClose: () => void;
}) {
  const logByDate  = new Map(stat.logs.map(l => [l.log_date, l]));
  const todayStr   = new Date().toISOString().split("T")[0];

  // วันหยุดในเดือนนี้ (ไม่รวม working_sat)
  const holidayDates = new Map(
    holidays
      .filter(h => h.holiday_type !== "working_sat")
      .map(h => [h.holiday_date, h]),
  );
  const workingSatDates = new Set(
    holidays
      .filter(h => h.holiday_type === "working_sat")
      .map(h => h.holiday_date),
  );

  // สร้าง row ทุกวันในเดือน (ไม่ใช่แค่วันทำงาน เพื่อแสดง context ครบ)
  const total = new Date(year, month + 1, 0).getDate();
  const dayRows = Array.from({ length: total }, (_, i) => {
    const d       = i + 1;
    const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const dow     = new Date(year, month, d).getDay();
    const isSun   = dow === 0;
    const isSat   = dow === 6;
    const isWorkingSat  = workingSatDates.has(dateStr);
    const holidayInfo   = holidayDates.get(dateStr);
    const isHoliday     = !!holidayInfo;
    const isFuture      = dateStr > todayStr;

    // วันเสาร์ปกติ / อาทิตย์ / วันหยุด → แสดงแต่ไม่นับ
    if ((isSun || (isSat && !isWorkingSat) || isHoliday)) {
      let label = isSun ? "อาทิตย์" : isSat ? "เสาร์" : holidayInfo!.name;
      let chipStyle = isSun || isSat
        ? "bg-gray-50 text-gray-400 border-gray-200"
        : "bg-rose-50 text-rose-500 border-rose-200";
      return { dateStr, day: d, dow, type: "off" as const, label, chipStyle, checkIn: "–", checkOut: "–", isFuture };
    }

    if (isFuture) {
      return { dateStr, day: d, dow, type: "future" as const, label: "–", chipStyle: "", checkIn: "–", checkOut: "–", isFuture: true };
    }

    const log = logByDate.get(dateStr);
    if (!log?.first_check_in) {
      return { dateStr, day: d, dow, type: "absent" as const, label: "ขาด", chipStyle: STATUS_CHIP.absent, checkIn: "–", checkOut: "–", isFuture: false };
    }
    const inMins = toMinutes(log.first_check_in);
    const status = inMins > LATE_THRESHOLD_MINUTES ? "late" : "present";
    return {
      dateStr, day: d, dow, type: status as "present" | "late",
      label: STATUS_LABEL[status], chipStyle: STATUS_CHIP[status],
      checkIn:  new Date(log.first_check_in).toLocaleTimeString("th-TH",  { hour: "2-digit", minute: "2-digit" }),
      checkOut: log.last_check_out
        ? new Date(log.last_check_out).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
        : "–",
      isFuture: false,
    };
  });

  return (
    <div className="bg-white rounded-2xl border border-sky-100 shadow-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50 bg-sky-50/50">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold bg-gradient-to-br ${AVATAR_GRAD[empIdx % AVATAR_GRAD.length]} shadow-sm flex-shrink-0`}>
          {(profile.first_name ?? "?").charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-gray-800 truncate">{getFullName(profile)}</p>
          <p className="text-xs text-gray-400">{profile.department ?? "–"} · {MONTHS_TH[month]} {year + 543}</p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-4 divide-x divide-gray-50 border-b border-gray-50">
        {[
          { label: "มาปกติ", val: stat.present,       color: "text-emerald-600" },
          { label: "มาสาย",  val: stat.late,           color: "text-amber-600" },
          { label: "ขาดงาน", val: stat.absent,         color: "text-rose-500" },
          { label: "OT รวม", val: `${stat.totalOT}h`,  color: "text-sky-600" },
        ].map(s => (
          <div key={s.label} className="flex flex-col items-center py-3 gap-0.5">
            <p className={`text-lg font-extrabold ${s.color}`}>{s.val}</p>
            <p className="text-[10px] text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Avg time */}
      <div className="flex items-center justify-around px-4 py-2.5 bg-gray-50/50 border-b border-gray-50 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">เข้าเฉลี่ย</span>
          <span className="font-extrabold text-sky-600">{minsToStr(stat.avgCheckInMinutes)}</span>
        </div>
        <div className="w-px h-4 bg-gray-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">ออกเฉลี่ย</span>
          <span className="font-extrabold text-gray-700">{minsToStr(stat.avgCheckOutMinutes)}</span>
        </div>
        <div className="w-px h-4 bg-gray-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">ชม.ปกติ</span>
          <span className="font-extrabold text-gray-700">{stat.totalRegHours}h</span>
        </div>
      </div>

      {/* Daily log */}
      <div className="max-h-[340px] overflow-y-auto divide-y divide-gray-50">
        {dayRows.map(row => (
          <div
            key={row.dateStr}
            className={`flex items-center gap-3 px-5 py-2.5 transition-colors
              ${row.type === "off" ? "bg-gray-50/60" : row.isFuture ? "opacity-35" : "hover:bg-gray-50/50"}`}
          >
            {/* Date */}
            <div className="w-10 text-center flex-shrink-0">
              <p className={`text-sm font-extrabold leading-none ${
                row.dow === 0 ? "text-rose-400" : row.dow === 6 ? "text-sky-500" : "text-gray-700"
              }`}>{row.day}</p>
              <p className={`text-[10px] font-bold ${
                row.dow === 0 ? "text-rose-400" : row.dow === 6 ? "text-sky-400" : "text-gray-400"
              }`}>
                {DAYS_SHORT[row.dow]}
              </p>
            </div>

            {/* Status dot */}
            {row.type !== "off" && row.type !== "future" ? (
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[row.type]}`} />
            ) : (
              <div className="w-1.5 h-1.5 flex-shrink-0" />
            )}

            {/* Chip */}
            <div className="flex-1">
              {row.type !== "future" && (
                <span className={`inline-flex px-2 py-0.5 rounded-lg border text-[10px] font-bold ${row.chipStyle}`}>
                  {row.label}
                </span>
              )}
            </div>

            {/* Time */}
            {row.checkIn !== "–" ? (
              <div className="flex items-center gap-1.5 text-xs flex-shrink-0">
                <span className="font-bold text-sky-600">{row.checkIn}</span>
                <span className="text-gray-300">→</span>
                <span className="font-bold text-gray-600">{row.checkOut}</span>
              </div>
            ) : (
              <span className="text-xs text-gray-300 flex-shrink-0">–</span>
            )}
          </div>
        ))}
      </div>

      {/* Export individual */}
      <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/50 flex justify-end">
        <button
          onClick={async () => {
            const { utils, writeFile } = await import("xlsx");
            const name = getFullName(profile);
            const rows = dayRows
              .filter(r => r.type !== "future")
              .map(r => [r.dateStr, DAYS_SHORT[r.dow], r.label, r.checkIn, r.checkOut]);
            const ws = utils.aoa_to_sheet([
              [`${name} · ${MONTHS_TH[month]} ${year + 543}`], [],
              ["วันที่","วัน","สถานะ","เวลาเข้า","เวลาออก"],
              ...rows,
            ]);
            ws["!cols"] = [14,6,12,10,10].map(w => ({ wch: w }));
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, name.slice(0,20));
            writeFile(wb, `hr_${profile.first_name}_${year}_${String(month+1).padStart(2,"0")}.xlsx`);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold shadow-sm hover:bg-emerald-600 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export รายบุคคล
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
//  MAIN PAGE
// ════════════════════════════════════════════════════════
export default function HRAttendancePage() {
  const today = new Date();

  // ── State ──────────────────────────────────────────────
  const [viewYear,   setViewYear]   = useState(today.getFullYear());
  const [viewMonth,  setViewMonth]  = useState(today.getMonth());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterDept, setFilterDept] = useState("all");
  const [exporting,  setExporting]  = useState(false);

  // ── Data ───────────────────────────────────────────────
  const [profiles,    setProfiles]    = useState<Profile[]>([]);
  const [allLogs,     setAllLogs]     = useState<TimeLog[]>([]);
  const [holidays,    setHolidays]    = useState<Holiday[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  // ── โหลด profiles + holidays ครั้งเดียว ──────────────
  useEffect(() => {
    Promise.all([
      supabase
        .from("profiles")
        .select("id, first_name, last_name, department, role")
        .order("first_name"),
      supabase
        .from("holidays")
        .select("id, holiday_date, name, holiday_type"),
    ]).then(([profileRes, holidayRes]) => {
      if (profileRes.error) setError(profileRes.error.message);
      else setProfiles(profileRes.data ?? []);

      if (!holidayRes.error) setHolidays(holidayRes.data ?? []);
    });
  }, []);

  // ── วันทำงานจริงในเดือน (คำนึงถึง holidays + working_sat) ──
  const workdays = useMemo(
    () => getWorkdays(viewYear, viewMonth, holidays),
    [viewYear, viewMonth, holidays],
  );

  // ── วันทำงานที่ผ่านมาแล้ว (ใช้เป็นตัวส่วน) ─────────────
  const pastWorkdays = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    return workdays.filter(d => d <= todayStr);
  }, [workdays]);

  // ── โหลด daily_time_logs ตามเดือน ────────────────────
  const fetchLogs = useCallback(async () => {
    setLoadingData(true);
    setError(null);
    const { start, end } = getMonthRange(viewYear, viewMonth);
    const { data, error } = await supabase
      .from("daily_time_logs")
      .select("user_id, log_date, first_check_in, last_check_out, ot_hours, regular_hours, status, work_type")
      .gte("log_date", start)
      .lte("log_date", end)
      .order("log_date");

    if (error) setError(error.message);
    else setAllLogs((data ?? []) as TimeLog[]);
    setLoadingData(false);
  }, [viewYear, viewMonth]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // ── คำนวณสถิติรายบุคคล ───────────────────────────────
  const statsMap = useMemo<Record<string, AttendanceStat>>(() => {
    const byUser: Record<string, TimeLog[]> = {};
    allLogs.forEach(l => {
      if (!byUser[l.user_id]) byUser[l.user_id] = [];
      byUser[l.user_id].push(l);
    });
    return Object.fromEntries(
      profiles.map(p => [p.id, calcStats(p.id, byUser[p.id] ?? [], workdays)])
    );
  }, [allLogs, profiles, workdays]);

  // ── Filter ────────────────────────────────────────────
  const depts = useMemo(() => {
    const s = new Set(profiles.map(p => p.department ?? "–"));
    return ["all", ...Array.from(s).sort()];
  }, [profiles]);

  const filteredProfiles = filterDept === "all"
    ? profiles
    : profiles.filter(p => p.department === filterDept);

  // ── Aggregate stats ───────────────────────────────────
  const agg = useMemo(() => ({
    present: Object.values(statsMap).reduce((s, a) => s + a.present, 0),
    late:    Object.values(statsMap).reduce((s, a) => s + a.late,    0),
    absent:  Object.values(statsMap).reduce((s, a) => s + a.absent,  0),
    ot:      Object.values(statsMap).reduce((s, a) => s + a.totalOT, 0),
  }), [statsMap]);

  // ── Month nav ─────────────────────────────────────────
  const prevMonth = () => {
    setSelectedId(null);
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    setSelectedId(null);
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const selectedProfile = selectedId ? profiles.find(p => p.id === selectedId) ?? null : null;
  const selectedIdx     = profiles.findIndex(p => p.id === selectedId);

  // ════════════════════════════════════════════════════════
  return (
    <main className="min-h-screen bg-gray-50 pb-28 md:pb-10">

      {/* ╔══════════════════════════════════════════════╗
          ║  STICKY HEADER                               ║
          ╚══════════════════════════════════════════════╝ */}
      <div className="sticky top-0 z-20 bg-gray-50/90 backdrop-blur-sm border-b border-gray-100">

        <div className="flex items-center justify-between px-4 md:px-6 pt-4 pb-1 gap-3">
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Admin · HR</p>
            <h1 className="text-xl font-extrabold text-gray-800 leading-tight flex items-center gap-2">
              Attendance Summary
              {loadingData && (
                <span className="w-3.5 h-3.5 border-2 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
              )}
            </h1>
          </div>

          <button
            onClick={async () => {
              setExporting(true);
              await exportExcel(filteredProfiles, statsMap, workdays, viewYear, viewMonth);
              setExporting(false);
            }}
            disabled={exporting || loadingData}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold shadow-sm hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-60"
          >
            {exporting
              ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              )
            }
            <span className="hidden sm:inline">{exporting ? "กำลัง Export..." : "Export Excel"}</span>
          </button>
        </div>

        {/* Month nav + dept filter */}
        <div className="flex items-center gap-3 px-4 md:px-6 pb-3 flex-wrap">
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
            <button onClick={prevMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span className="text-sm font-extrabold text-gray-700 px-2 min-w-[128px] text-center">
              {MONTHS_TH[viewMonth]} {viewYear + 543}
            </span>
            <button onClick={nextMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          {depts.map(d => (
            <button
              key={d}
              onClick={() => { setFilterDept(d); setSelectedId(null); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                filterDept === d
                  ? "bg-sky-500 text-white border-sky-500 shadow-sm"
                  : "bg-white text-gray-500 border-gray-200 hover:border-sky-300 hover:text-sky-600"
              }`}
            >
              {d === "all" ? "ทั้งหมด" : d}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 md:mx-6 mt-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm font-medium">
          ⚠️ {error} — ตรวจสอบ RLS Policy ใน Supabase
        </div>
      )}

      <div className="px-4 md:px-6 pt-5 space-y-5">

        {/* ╔══════════════════════════════════════════════╗
            ║  STAT CARDS                                  ║
            ╚══════════════════════════════════════════════╝ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            colorBg="bg-emerald-50 text-emerald-500"
            label="วันมาทำงาน (รวม)" value={agg.present} sub={`${profiles.length} พนักงาน`}
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
          />
          <StatCard
            colorBg="bg-amber-50 text-amber-500"
            label="มาสาย (ครั้งรวม)" value={agg.late} sub="ทุกพนักงาน"
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          />
          <StatCard
            colorBg="bg-rose-50 text-rose-500"
            label="ขาดงาน (ครั้งรวม)" value={agg.absent} sub="ทุกพนักงาน"
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
          />
          <StatCard
            colorBg="bg-sky-50 text-sky-500"
            label="ชั่วโมง OT รวม" value={`${agg.ot}h`} sub="ทุกพนักงาน"
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
          />
        </div>

        {/* ╔══════════════════════════════════════════════╗
            ║  EMPLOYEE TABLE  +  DRILL-DOWN               ║
            ╚══════════════════════════════════════════════╝ */}
        <div className={`grid gap-4 ${selectedProfile ? "grid-cols-1 lg:grid-cols-5" : "grid-cols-1"}`}>

          {/* Employee list */}
          <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${selectedProfile ? "lg:col-span-3" : ""}`}>

            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-500 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-gray-700">รายชื่อพนักงาน</h3>
                  <p className="text-xs text-gray-400">
                    {filteredProfiles.length} คน · วันทำงาน {pastWorkdays.length}/{workdays.length} วัน
                  </p>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <span>มา / วันทำงาน</span>
                <span>สถานะ</span>
                <span>OT</span>
              </div>
            </div>

            {/* Loading skeleton */}
            {loadingData && profiles.length === 0 ? (
              <div className="divide-y divide-gray-50">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
                    <div className="w-9 h-9 rounded-xl bg-gray-100 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-100 rounded w-32" />
                      <div className="h-2 bg-gray-100 rounded w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filteredProfiles.map((profile, idx) => {
                  const stat = statsMap[profile.id];
                  const presentDays = (stat?.present ?? 0) + (stat?.late ?? 0);
                  const pct = pastWorkdays.length > 0
                    ? Math.round((presentDays / pastWorkdays.length) * 100)
                    : 0;
                  const isSelected = selectedId === profile.id;

                  return (
                    <div
                      key={profile.id}
                      onClick={() => setSelectedId(isSelected ? null : profile.id)}
                      className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all border-b border-gray-50 last:border-0 ${isSelected ? "bg-sky-50" : "hover:bg-sky-50/40"}`}
                    >
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-extrabold flex-shrink-0 bg-gradient-to-br ${AVATAR_GRAD[idx % AVATAR_GRAD.length]} shadow-sm`}>
                        {(profile.first_name ?? "?").charAt(0)}
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-700 truncate">{getFullName(profile)}</p>
                        <p className="text-[11px] text-gray-400">{profile.department ?? "–"}</p>
                      </div>

                      {/* Presence bar — ตัวส่วนใช้ pastWorkdays */}
                      <div className="hidden sm:flex flex-col items-end gap-1 min-w-[72px]">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-gray-700">{presentDays}</span>
                          <span className="text-[10px] text-gray-400">/{pastWorkdays.length} วัน</span>
                        </div>
                        <div className="w-14 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      {/* Status chips */}
                      <div className="hidden md:flex items-center gap-1.5">
                        {(stat?.late ?? 0) > 0 && (
                          <span className="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">
                            สาย {stat.late}
                          </span>
                        )}
                        {(stat?.absent ?? 0) > 0 && (
                          <span className="px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-bold">
                            ขาด {stat.absent}
                          </span>
                        )}
                      </div>

                      {/* OT */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-extrabold text-sky-600">
                          {(stat?.totalOT ?? 0) > 0 ? `+${stat.totalOT}h` : "–"}
                        </p>
                        <p className="text-[10px] text-gray-400">OT</p>
                      </div>

                      {/* Chevron */}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        className={`w-4 h-4 flex-shrink-0 transition-colors ${isSelected ? "text-sky-400" : "text-gray-300"}`}>
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                  );
                })}

                {filteredProfiles.length === 0 && !loadingData && (
                  <div className="flex flex-col items-center py-12 gap-2">
                    <p className="text-sm font-bold text-gray-400">ไม่พบข้อมูลพนักงาน</p>
                    <p className="text-xs text-gray-300">ลองเปลี่ยน filter แผนก</p>
                  </div>
                )}
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 px-5 py-3 border-t border-gray-50 bg-gray-50/50 flex-wrap">
              {[
                { c: "bg-emerald-400", l: "ปกติ" },
                { c: "bg-amber-400",   l: "สาย (หลัง 08:30)" },
                { c: "bg-rose-400",    l: "ขาด" },
              ].map(i => (
                <div key={i.l} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${i.c}`} />
                  <span className="text-[10px] text-gray-400 font-medium">{i.l}</span>
                </div>
              ))}
              {/* แสดงวันหยุดเดือนนี้ */}
              {holidays.filter(h =>
                h.holiday_type !== "working_sat" &&
                h.holiday_date.startsWith(`${viewYear}-${String(viewMonth+1).padStart(2,"0")}`)
              ).length > 0 && (
                <span className="text-[10px] text-rose-400 font-medium ml-auto">
                  🎌 วันหยุด {holidays.filter(h =>
                    h.holiday_type !== "working_sat" &&
                    h.holiday_date.startsWith(`${viewYear}-${String(viewMonth+1).padStart(2,"0")}`)
                  ).length} วัน ถูกตัดออกแล้ว
                </span>
              )}
            </div>
          </div>

          {/* Drill-down panel */}
          {selectedProfile && statsMap[selectedProfile.id] && (
            <div className="lg:col-span-2">
              <DrillDownPanel
                profile={selectedProfile}
                empIdx={selectedIdx}
                stat={statsMap[selectedProfile.id]}
                workdays={workdays}
                holidays={holidays}
                year={viewYear}
                month={viewMonth}
                onClose={() => setSelectedId(null)}
              />
            </div>
          )}
        </div>

        {/* ╔══════════════════════════════════════════════╗
            ║  DEPT BREAKDOWN                              ║
            ╚══════════════════════════════════════════════╝ */}
        {!loadingData && profiles.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-50">
              <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-500 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-gray-700">เปรียบเทียบตามแผนก</h3>
                <p className="text-xs text-gray-400">
                  อัตราการมาทำงาน · {pastWorkdays.length} วันที่ผ่านมา
                </p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {depts.filter(d => d !== "all").map(dept => {
                const emps  = profiles.filter(p => (p.department ?? "–") === dept);
                const total = emps.reduce((s, p) =>
                  s + (statsMap[p.id]?.present ?? 0) + (statsMap[p.id]?.late ?? 0), 0);
                const max   = emps.length * pastWorkdays.length; // ← ใช้ pastWorkdays
                const late  = emps.reduce((s, p) => s + (statsMap[p.id]?.late ?? 0), 0);
                const pct   = max > 0 ? Math.round((total / max) * 100) : 0;
                return (
                  <div key={dept} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-700">{dept}</span>
                        <span className="text-[10px] text-gray-400">{emps.length} คน</span>
                        {late > 0 && (
                          <span className="text-[10px] text-amber-600 font-bold">สาย {late} ครั้ง</span>
                        )}
                      </div>
                      <span className={`text-sm font-extrabold ${pct >= 90 ? "text-emerald-600" : pct >= 75 ? "text-amber-600" : "text-rose-500"}`}>
                        {pct}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-emerald-400" : pct >= 75 ? "bg-amber-400" : "bg-rose-400"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}