"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";

// ─── Supabase Client ──────────────────────────────────────────────────────────
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// ════════════════════════════════════════════════════════
//  TYPES
// ════════════════════════════════════════════════════════
interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  department: string;
  avatar_url?: string | null;
}

interface AttendanceStat {
  workdays: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  extraDays: number;
  totalRegHours: number;
  totalOT: number;
  avgIn: string;
  avgOut: string;
}

interface DayLog {
  day: number;
  dow: number;
  date: string;
  status: "present" | "late" | "absent" | "leave" | "holiday" | "weekend";
  checkIn: string;
  checkOut: string;
  isHoliday?: boolean;
  holidayName?: string;
  isWorkingSat?: boolean;
  otPeriods: { start: string; end: string }[];
  otTotal: number;
  regHours: number | null;
  otTimeline: { start: string; end: string } | null;
  otReqs: { start: string; end: string }[];
  workType: string | null;
  dailyAllowance: boolean;
  isDriverTo:   boolean;
  isDriverFrom: boolean;
}

interface TimeLogRow {
  user_id: string;
  log_date: string;
  status: string;
  first_check_in: string | null;
  last_check_out: string | null;
  ot_hours: number | null;
  timeline_events: { event: string; timestamp: string }[] | null;
  work_type: string;
  daily_allowance: boolean | null;
}

interface OTRequestRow {
  user_id: string;
  request_date: string;
  start_time: string;
  end_time: string;
  hours: number | null;
}

interface LeaveRequestRow {
  user_id: string;
  start_date: string;
  end_date: string;
  status: string;
}
// ════════════════════════════════════════════════════════
//  CONSTANTS
// ════════════════════════════════════════════════════════
const MONTHS_TH = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];
const DAYS_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const AVATAR_GRAD = [
  "from-sky-400 to-blue-500",
  "from-violet-400 to-purple-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
  "from-indigo-400 to-blue-600",
];

const STATUS_DOT: Record<string, string> = {
  present: "bg-emerald-400",
  late: "bg-amber-400",
  absent: "bg-rose-400",
  leave: "bg-violet-400",
  holiday: "bg-sky-200", // ← เพิ่ม
  weekend: "bg-gray-200", // ← เพิ่ม
};

const STATUS_CHIP: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-600 border-emerald-200",
  late: "bg-amber-50  text-amber-600  border-amber-200",
  absent: "bg-rose-50   text-rose-500   border-rose-200",
  leave: "bg-violet-50 text-violet-600 border-violet-200",
  holiday: "bg-sky-50    text-sky-500    border-sky-200", // ← เพิ่ม
  weekend: "bg-gray-50   text-gray-400   border-gray-200", // ← เพิ่ม
};

const STATUS_LABEL: Record<string, string> = {
  present: "มาปกติ",
  late: "มาสาย",
  absent: "ขาดงาน",
  leave: "ลา",
  holiday: "วันหยุด", // ← เพิ่ม
  weekend: "เสาร์-อา", // ← เพิ่ม
};

const WORK_TYPE_LABEL: Record<string, string> = {
  in_factory: "โรงงาน",
  on_site: "On-site",
  mixed:   "Factory + On-site",
  leave:      "ลา",
};

// ════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════
function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function fmtTime(iso: string | null): string {
  if (!iso) return "–";
  if (/^\d{2}:\d{2}/.test(iso)) return iso.slice(0, 5);
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 5);
  return d.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function fmtOTTime(t?: string | null): string | undefined {
  if (!t) return undefined;
  return t.slice(0, 5); // "HH:mm"
}

/** คำนวณชั่วโมง OT จาก time string "HH:mm:ss" */
function calcOTHours(startTime: string, endTime: string): number {
  const parseMin = (t: string) => {
    const p = t.split(":").map(Number);
    return p[0] * 60 + (p[1] ?? 0);
  };
  const diff = parseMin(endTime) - parseMin(startTime);
  return diff > 0 ? Math.round((diff / 60) * 100) / 100 : 0;
}

/** รวม OT หลายช่วง โดย merge overlap แล้วนับ hours จริง */
function calcTotalOT(periods: { start: string; end: string }[]): number {
  if (!periods.length) return 0;
  const toMins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const sorted = [...periods].sort((a, b) => toMins(a.start) - toMins(b.start));
  let total = 0;
  let curStart = toMins(sorted[0].start);
  let curEnd = toMins(sorted[0].end);
  for (let i = 1; i < sorted.length; i++) {
    const s = toMins(sorted[i].start);
    const e = toMins(sorted[i].end);
    if (s <= curEnd) {
      curEnd = Math.max(curEnd, e); // merge overlap
    } else {
      total += curEnd - curStart; // นับช่วงที่แยกกัน
      curStart = s;
      curEnd = e;
    }
  }
  total += curEnd - curStart;
  return Math.round((total / 60) * 100) / 100;
}

/** คำนวณชม.ทำงานจริง (หักพัก cap ที่ 8) */
function calcRegHours(checkIn: string, checkOut: string | null): number | null {
  if (!checkIn || checkIn === "–") return null;
  if (!checkOut || checkOut === "–") return null;

  const [ih, im] = checkIn.split(":").map(Number);
  const [oh, om] = checkOut.split(":").map(Number);

  const inMin = ih * 60 + im;
  const outMin = oh * 60 + om;
  const diffMin = outMin - inMin;

  if (diffMin <= 0) return null;

  const lunchDeduct = diffMin > 300 ? 60 : 0;
  const regMin = Math.min(diffMin - lunchDeduct, 480);

  return Math.round((regMin / 60) * 10) / 10;
}

function calcAvgTime(times: string[]): string {
  if (!times.length) return "–";
  const converted = times.map((t) => fmtTime(t)).filter((v) => v !== "–");
  if (!converted.length) return "–";
  const total = converted.reduce((s, t) => {
    const [h, m] = t.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return s;
    return s + h * 60 + m;
  }, 0);
  const avg = Math.round(total / converted.length);
  return `${String(Math.floor(avg / 60)).padStart(2, "0")}:${String(avg % 60).padStart(2, "0")}`;
}

// ════════════════════════════════════════════════════════
//  STAT CARD
// ════════════════════════════════════════════════════════
function StatCard({
  value,
  label,
  sub,
  icon,
  colorBg,
}: {
  value: number | string;
  label: string;
  sub?: string;
  icon: React.ReactNode;
  colorBg: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorBg}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-2xl font-extrabold text-gray-800 leading-none">
          {value}
        </p>
        <p className="text-[11px] text-gray-400 font-medium mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-gray-300">{sub}</p>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
//  SKELETON
// ════════════════════════════════════════════════════════
function TableSkeleton() {
  return (
    <div className="divide-y divide-gray-50">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-5 py-3.5 animate-pulse"
        >
          <div className="w-9 h-9 rounded-xl bg-gray-100 flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-gray-100 rounded w-1/2" />
            <div className="h-2.5 bg-gray-100 rounded w-1/3" />
          </div>
          <div className="w-16 h-4 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════
//  DRILL-DOWN PANEL (รายละเอียดรายบุคคล)
// ════════════════════════════════════════════════════════
function DrillDownPanel({
  emp,
  empIdx,
  startDate,
  endDate,
  dailyLogs,
  att,
  onClose,
}: {
  emp: Employee;
  empIdx: number;
  startDate: string;
  endDate: string;
  dailyLogs: DayLog[];
  att: AttendanceStat;
  onClose: () => void;
}) {
  const [exporting, setExporting] = useState(false);

  const handleExportIndividual = async () => {
    setExporting(true);
    try {
      const { utils, writeFile } = await import("xlsx");
      const title = `${emp.first_name} ${emp.last_name} — ${startDate} ถึง ${endDate}`;

      const header = [
        [title],
        [],
        [
          "วันที่",
          "วัน",
          "ประเภทวัน",
          "สถานะ",
          "ประเภทงาน",
          "เบี้ยเลี้ยง",
          "เข้างาน",
          "ออกงาน",
          "Start OT",
          "End OT",
          "Req. Start OT",
          "Req. End OT",
          "OT รวม (ชม.)",
          "คนขับ",
        ],
      ];

      // ── helper: กำหนด label ประเภทวัน ──────────────────────
      const getDayTypeLabel = (log: DayLog): string => {
        if (log.isWorkingSat) return "เสาร์ทำงาน"; // ← ไม่ใช่ "วันหยุด"
        if (log.dow === 0 || log.dow === 6) return "วันหยุดประจำสัปดาห์";
        if (log.status === "holiday") return "วันหยุด";
        return "วันปกติ";
      };

      const STATUS_TEXT: Record<string, string> = {
        present: "มาปกติ",
        late: "มาสาย",
        absent: "ขาดงาน",
        leave: "ลา",
        holiday: "วันหยุด",
        weekend: "เสาร์-อา",
      };

      const data = dailyLogs.map((log) => {
        const workOT = log.otTimeline;
        return [
          log.date,
          DAYS_SHORT[log.dow],
          getDayTypeLabel(log),
          STATUS_TEXT[log.status] ?? log.status,
          log.workType ? (WORK_TYPE_LABEL[log.workType] ?? log.workType) : "–", // ← ประเภทงาน
          log.dailyAllowance ? "50" : "–", // ← เบี้ยเลี้ยง
          log.checkIn,
          log.checkOut,
          workOT?.start ?? "–",
          workOT?.end ?? "–",
          log.otReqs.map((r) => r.start).join(" / ") || "–",
          log.otReqs.map((r) => r.end).join(" / ") || "–",
          log.otTotal > 0 ? log.otTotal : "–",
          log.isDriverTo && log.isDriverFrom ? "ขาไป+ขากลับ"
      : log.isDriverTo   ? "ขาไป"
      : log.isDriverFrom ? "ขากลับ"
      : "–",
        ];
      });
      // ── Summary แยก วันปกติ vs วันหยุดจริง ──────────────────
      // working_sat = นับเป็นวันปกติ ✅
      const workdayLogs = dailyLogs.filter(
        (l) =>
          (l.status === "present" || l.status === "late") &&
          l.dow !== 0 &&
          (l.dow !== 6 || l.isWorkingSat), // จ-ศ + เสาร์ทำงาน
      );

      const holidayLogs = dailyLogs.filter(
        (l) =>
          (l.status === "present" || l.status === "late") &&
          !l.isWorkingSat &&
          (l.dow === 0 || l.dow === 6),
      );

      const workdayRegHours =
        Math.round(
          workdayLogs.reduce((s, l) => s + (l.regHours ?? 0), 0) * 10,
        ) / 10;
      const holidayRegHours =
        Math.round(
          holidayLogs.reduce((s, l) => s + (l.regHours ?? 0), 0) * 10,
        ) / 10;
      const workdayOT =
        Math.round(workdayLogs.reduce((s, l) => s + l.otTotal, 0) * 100) / 100;
      const holidayOT =
        Math.round(holidayLogs.reduce((s, l) => s + l.otTotal, 0) * 10) / 10;
      
      const allowanceDays  = dailyLogs.filter(l => l.dailyAllowance).length;
      const allowanceTotal = allowanceDays * 50;

      const summary = [
  [],
  ["สรุป"],
  ["วันมาทำงาน",  "", att.present],
  ["มาสาย",       "", att.late],
  ["ขาดงาน",      "", att.absent],
  ["ลา",          "", att.leave],
  [],
  ["—— วันปกติ ——"],
  ["ชั่วโมงทำงาน (วันปกติ)",  "", workdayRegHours, "ชม."],
  ["OT รวม (วันปกติ)",        "", workdayOT,        "ชม."],
  [],
  ["—— วันหยุด ——"],
  ["ชั่วโมงทำงาน (วันหยุด)", "", holidayRegHours, "ชม."],
  ["OT รวม (วันหยุด)",       "", holidayOT,        "ชม."],
  [],                                                
  ["—— เบี้ยเลี้ยง ——"],                               
  ["เบี้ยเลี้ยง On-site", "", allowanceDays,  "วัน"], 
  ["รวมเบี้ยเลี้ยง",      "", allowanceTotal, "บาท"],  
];

      const ws = utils.aoa_to_sheet([...header, ...data, ...summary]);
      ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
      ws["!cols"] = [12, 6, 16, 10, 10, 10, 10, 10, 10, 10, 12, 12, 10, 10].map(
  (w) => ({ wch: w }),
);

      const wb = utils.book_new();
      const sheetName = `${emp.first_name}_${startDate}`;
      utils.book_append_sheet(wb, ws, sheetName);
      writeFile(wb, `attendance_${emp.first_name}_${emp.last_name}_${startDate}_${endDate}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  const counts = useMemo(
    () =>
      dailyLogs.reduce<Record<string, number>>((acc, l) => {
        acc[l.status] = (acc[l.status] || 0) + 1;
        return acc;
      }, {}),
    [dailyLogs],
  );

  return (
    <div className="bg-white rounded-2xl border border-sky-100 shadow-md overflow-hidden flex flex-col max-h-[calc(100vh-320px)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50 bg-sky-50/50">
        {emp.avatar_url ? (
          <img
            src={emp.avatar_url}
            alt={`${emp.first_name} ${emp.last_name}`}
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-xl object-cover flex-shrink-0 shadow-sm"
          />
        ) : (
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold bg-gradient-to-br ${AVATAR_GRAD[empIdx % AVATAR_GRAD.length]} shadow-sm flex-shrink-0`}
          >
            {emp.first_name.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-gray-800 truncate">
            {emp.first_name} {emp.last_name}
          </p>
          <p className="text-xs text-gray-400">
            {emp.department} · {fmtDateTH(startDate)} – {fmtDateTH(endDate)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="w-4 h-4"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-5 divide-x divide-gray-50 border-b border-gray-50">
        {[
          {
            label: "มาปกติ",
            val: counts.present ?? 0,
            color: "text-emerald-600",
          },
          { label: "สาย", val: counts.late ?? 0, color: "text-amber-600" },
          { label: "ขาด", val: counts.absent ?? 0, color: "text-rose-500" },
          { label: "ลา", val: counts.leave ?? 0, color: "text-violet-600" },
          { label: "วันหยุด", val: counts.holiday ?? 0, color: "text-sky-500" },
        ].map(({ label, val, color }) => (
          <div key={label} className="text-center py-3">
            <p className={`text-lg font-extrabold leading-none ${color}`}>
              {val}
            </p>
            <p className="text-[9px] text-gray-400 mt-0.5 font-medium">
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Summary row */}
      <div className="flex items-center gap-4 px-5 py-3 bg-gray-50/50 border-b border-gray-50 text-xs text-gray-500">
        <span>
          เข้าเฉลี่ย <strong className="text-sky-600">{att.avgIn}</strong>
        </span>
        <span className="text-gray-200">|</span>
        <span>
          ออกเฉลี่ย <strong className="text-gray-600">{att.avgOut}</strong>
        </span>
        <span className="text-gray-200">|</span>
        <span>
          OT รวม <strong className="text-amber-600">{att.totalOT}h</strong>
        </span>
      </div>

      {/* Daily log list */}
      <div className="overflow-y-auto flex-1 scrollbar-thin">
        {dailyLogs.length === 0 ? (
          <div className="text-center py-10 text-gray-300">
            <p className="text-sm">ไม่มีข้อมูลการมาทำงาน</p>
          </div>
        ) : (
          dailyLogs.map((log) => (
            <div
              key={log.date}
              className={`flex items-center gap-3 px-5 py-2.5 border-b border-gray-50 last:border-0 transition-colors ${
                log.status === "holiday" || log.status === "weekend"
                  ? "opacity-40 bg-gray-50/30"
                  : "hover:bg-gray-50/50"
              }`}
            >
              {/* Day */}
              <div className="w-10 text-center flex-shrink-0">
                <p className="text-sm font-extrabold text-gray-700">
                  {log.day}
                </p>
                <p
                  className={`text-[10px] font-bold ${
                    log.dow === 0
                      ? "text-rose-400"
                      : log.dow === 6
                        ? "text-sky-400"
                        : "text-gray-400"
                  }`}
                >
                  {DAYS_SHORT[log.dow]}
                </p>
              </div>
              {/* Status dot */}
              <div
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[log.status]}`}
              />
              {/* Chip */}
              <div className="flex-1">
                <span
                  className={`inline-flex px-2 py-0.5 rounded-lg border text-[10px] font-bold ${STATUS_CHIP[log.status]}`}
                >
                  {STATUS_LABEL[log.status]}
                </span>
              </div>
              {/* Time */}
              {log.checkIn !== "–" ? (
                <div className="flex items-center gap-1.5 text-xs flex-shrink-0">
                  <span className="font-bold text-sky-600">{log.checkIn}</span>
                  <span className="text-gray-300">→</span>
                  <span className="font-bold text-gray-600">
                    {log.checkOut}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-gray-300 flex-shrink-0">–</span>
              )}

              {(log.isDriverTo || log.isDriverFrom) && (
  <div className="flex gap-1 flex-shrink-0">
    {log.isDriverTo && (
      <span className="text-[10px] bg-sky-100 text-sky-600 font-bold px-1.5 py-0.5 rounded-full">
        🚗↗
      </span>
    )}
    {log.isDriverFrom && (
      <span className="text-[10px] bg-violet-100 text-violet-600 font-bold px-1.5 py-0.5 rounded-full">
        🚗↙
      </span>
    )}
  </div>
)}

            </div>
          ))
        )}
      </div>

      {/* Footer export */}
      <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/50 flex justify-end flex-shrink-0">
        <button
          onClick={handleExportIndividual}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold shadow-sm hover:bg-emerald-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {exporting ? (
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-3.5 h-3.5"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
          {exporting ? "กำลัง Export..." : "Export รายบุคคล"}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
//  MAIN PAGE
// ════════════════════════════════════════════════════════
// ─── Export Excel (HR Attendance) ────────────────────────────────────────────
async function exportHRExcel(
  employees: Employee[],
  attendances: Record<string, AttendanceStat>,
  dailyLogsPerUser: Record<string, DayLog[]>,
  startDate: string,
  endDate: string,
) {
  const { utils, writeFile } = await import("xlsx");
  const title = `HR ATTENDANCE SUMMARY — ${startDate} ถึง ${endDate}`;

  const header = [
    [title],
    [],
    [
  "ชื่อ-นามสกุล", "แผนก",
  "วันทำงาน", "มาทำงาน", "มาสาย", "ขาดงาน", "ลา", "มาวันหยุด/นอกเวลา",
  "ชม.ปกติ", "ชม.วันหยุด", "OT ปกติ (ชม.)", "OT วันหยุด (ชม.)",
  "เบี้ยเลี้ยง On-site (บาท)",
]
  ];

  // ↓ วางตรงนี้ แทนที่ const data เดิม
  const data = employees.map((emp) => {
    const att = attendances[emp.id];
    const dayLogs = dailyLogsPerUser[emp.id] ?? [];

    const workedLogs = dayLogs.filter((l) => l.checkIn !== "–");
    const holidayWorkedLogs = workedLogs.filter(
      (l) =>
        !l.isWorkingSat &&
        (l.dow === 0 || l.dow === 6 || l.status === "holiday"),
    );
    const normalWorkedLogs = workedLogs.filter(
      (l) =>
        l.isWorkingSat ||
        (l.dow !== 0 && l.dow !== 6 && l.status !== "holiday"),
    );

    const normalWorkHours =
      Math.round(
        normalWorkedLogs.reduce((s, l) => s + (l.regHours ?? 0), 0) * 10,
      ) / 10;

    const normalOT =
      Math.round(normalWorkedLogs.reduce((s, l) => s + l.otTotal, 0) * 100) /
      100;
    const holidayWorkHours =
      Math.round(
        holidayWorkedLogs.reduce((s, l) => s + (l.regHours ?? 0), 0) * 10,
      ) / 10;
    const holidayOT =
      Math.round(holidayWorkedLogs.reduce((s, l) => s + l.otTotal, 0) * 100) /
      100;

    const allowanceTotal = dayLogs.filter(l => l.dailyAllowance).length * 50;

    if (!att) return [
    `${emp.first_name} ${emp.last_name}`, emp.department,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0,
  ];

    return [
      `${emp.first_name} ${emp.last_name}`,
      emp.department,
      att.workdays,
      att.present,
      att.late,
      att.absent,
      att.leave,
      att.extraDays ?? 0,
      normalWorkHours,
      holidayWorkHours,
      normalOT,
      holidayOT,
      allowanceTotal,
    ];
  });

  const ws = utils.aoa_to_sheet([...header, ...data]);

  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }];
  ws["!cols"] = [20, 14, 9, 9, 9, 9, 6, 14, 9, 10, 13, 14].map((w) => ({ wch: w }));

  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, `${startDate}_${endDate}`);
  writeFile(wb, `hr_attendance_${startDate}_${endDate}.xlsx`);
}

// ── Export Multi-sheet Individual Excel ──────────────────────────────────────
async function exportMultiSheetIndividual(
  employees: Employee[],
  attendances: Record<string, AttendanceStat>,
  dailyLogsPerUser: Record<string, DayLog[]>,
  startDate: string,
  endDate: string,
) {
  const { utils, writeFile } = await import("xlsx");
  const wb = utils.book_new();

  const getDayTypeLabel = (log: DayLog): string => {
    if (log.isWorkingSat) return "เสาร์ทำงาน";
    if (log.dow === 0 || log.dow === 6) return "วันหยุดประจำสัปดาห์";
    if (log.status === "holiday") return "วันหยุด";
    return "วันปกติ";
  };
  const STATUS_TEXT: Record<string, string> = {
    present: "มาปกติ", late: "มาสาย", absent: "ขาดงาน",
    leave: "ลา", holiday: "วันหยุด", weekend: "เสาร์-อา",
  };

  employees.forEach((emp) => {
    const att = attendances[emp.id];
    const dailyLogs = dailyLogsPerUser[emp.id] ?? [];

    const title = `${emp.first_name} ${emp.last_name} — ${startDate} ถึง ${endDate}`;
    const header = [
      [title], [],
      ["วันที่","วัน","ประเภทวัน","สถานะ","ประเภทงาน","เบี้ยเลี้ยง",
       "เข้างาน","ออกงาน","Start OT","End OT",
       "Req. Start OT","Req. End OT","OT รวม (ชม.)","คนขับ"],
    ];

    const data = dailyLogs.map((log) => {
      const workOT = log.otTimeline;
      return [
        log.date, DAYS_SHORT[log.dow], getDayTypeLabel(log),
        STATUS_TEXT[log.status] ?? log.status,
        log.workType ? (WORK_TYPE_LABEL[log.workType] ?? log.workType) : "–",
        log.dailyAllowance ? "50" : "–",
        log.checkIn, log.checkOut,
        workOT?.start ?? "–", workOT?.end ?? "–",
        log.otReqs.map((r) => r.start).join(" / ") || "–",
        log.otReqs.map((r) => r.end).join(" / ") || "–",
        log.otTotal > 0 ? log.otTotal : "–",
        log.isDriverTo && log.isDriverFrom ? "ขาไป+ขากลับ"
          : log.isDriverTo   ? "ขาไป"
          : log.isDriverFrom ? "ขากลับ"
          : "–",
      ];
    });

    const workdayLogs = dailyLogs.filter(
      (l) => (l.status === "present" || l.status === "late") && l.dow !== 0 && (l.dow !== 6 || l.isWorkingSat),
    );
    const holidayLogs = dailyLogs.filter(
      (l) => (l.status === "present" || l.status === "late") && !l.isWorkingSat && (l.dow === 0 || l.dow === 6),
    );
    const workdayRegHours = Math.round(workdayLogs.reduce((s, l) => s + (l.regHours ?? 0), 0) * 10) / 10;
    const holidayRegHours = Math.round(holidayLogs.reduce((s, l) => s + (l.regHours ?? 0), 0) * 10) / 10;
    const workdayOT = Math.round(workdayLogs.reduce((s, l) => s + l.otTotal, 0) * 100) / 100;
    const holidayOT = Math.round(holidayLogs.reduce((s, l) => s + l.otTotal, 0) * 10) / 10;
    const allowanceDays = dailyLogs.filter((l) => l.dailyAllowance).length;
    const allowanceTotal = allowanceDays * 50;

    const summary = [
      [], ["สรุป"],
      ["วันมาทำงาน", "", att?.present ?? 0],
      ["มาสาย",      "", att?.late    ?? 0],
      ["ขาดงาน",     "", att?.absent  ?? 0],
      ["ลา",         "", att?.leave   ?? 0],
      [],
      ["—— วันปกติ ——"],
      ["ชั่วโมงทำงาน (วันปกติ)", "", workdayRegHours, "ชม."],
      ["OT รวม (วันปกติ)",       "", workdayOT,       "ชม."],
      [],
      ["—— วันหยุด ——"],
      ["ชั่วโมงทำงาน (วันหยุด)", "", holidayRegHours, "ชม."],
      ["OT รวม (วันหยุด)",       "", holidayOT,       "ชม."],
      [],
      ["—— เบี้ยเลี้ยง ——"],
      ["เบี้ยเลี้ยง On-site", "", allowanceDays,  "วัน"],
      ["รวมเบี้ยเลี้ยง",      "", allowanceTotal, "บาท"],
    ];

    const ws = utils.aoa_to_sheet([...header, ...data, ...summary]);
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
    ws["!cols"] = [12, 6, 16, 10, 10, 10, 10, 10, 10, 10, 12, 12, 10, 10].map((w) => ({ wch: w }));

    // Sheet name: ชื่อจริง truncated to 31 chars (Excel limit)
    const sheetName = `${emp.first_name} ${emp.last_name}`.slice(0, 28).replace(/[\\/*?[\]:]/g, "_");
    utils.book_append_sheet(wb, ws, sheetName);
  });

  writeFile(wb, `hr_detail_${startDate}_${endDate}.xlsx`);
}

// ── helper: format ISO date to Thai display ──────────────────────────────
function fmtDateTH(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_TH[m - 1]} ${y + 543}`;
}

export default function HRAttendancePage() {
  const today = new Date();
  const todayISO = today.toISOString().split("T")[0];
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(todayISO);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterDept, setFilterDept] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [multiSelectMode, setMultiSelectMode] = useState(false);

  // ── Real data state ───────────────────────────────────
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLogRow[]>([]);
  const [otRequests, setOtRequests] = useState<OTRequestRow[]>([]);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [workingSats, setWorkingSats] = useState<Set<string>>(new Set());
  const [holidayNames, setHolidayNames] = useState<Map<string, string>>(
    new Map(),
  );
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestRow[]>([]);

  const [driverSessions, setDriverSessions] = useState<{
  session_date:   string;
  driver_to_id:   string | null;
  driver_from_id: string | null;
}[]>([]);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportingDetail, setExportingDetail] = useState(false);

  // ── Date range as query bounds ────────────────────────
  const start = startDate;
  const end = endDate;

  // ── Fetch all data ────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Profiles
      const { data: profileData, error: profileError } = await supabase
        .from("profiles_with_avatar")
        .select("id, first_name, last_name, department, avatar_url")
        .order("first_name");

      if (profileError) {
        console.error("profiles error:", profileError);
        return;
      }
      setEmployees(
        (profileData ?? []).map((p) => ({
          id: p.id,
          first_name: p.first_name ?? "ไม่ระบุชื่อ",
          last_name: p.last_name ?? "",
          department: p.department ?? "ไม่ระบุแผนก",
          avatar_url: p.avatar_url ?? null,
        })),
      );

      if (!profileData?.length) {
        setLoading(false);
        return;
      }

      const userIds = profileData.map((p) => p.id);

      // 2. Time logs + holidays + OT requests พร้อมกัน
      const [logRes, holidayRes, otRes, leaveRes, driverRes] = await Promise.all([
        supabase
          .from("daily_time_logs")
          .select(
            "user_id, log_date, status, first_check_in, last_check_out, ot_hours, timeline_events, work_type, daily_allowance",
          )

          .in("user_id", userIds)
          .gte("log_date", start)
          .lte("log_date", end),

        supabase
          .from("holidays")
          .select("holiday_date, holiday_type, name")
          .gte("holiday_date", start)
          .lte("holiday_date", end),

        supabase
          .from("ot_requests")
          .select("user_id, request_date, start_time, end_time, hours")
          .in("user_id", userIds)
          .eq("status", "approved")
          .gte("request_date", start)
          .lte("request_date", end),

        // ✅ เพิ่ม query นี้
        supabase
          .from("leave_requests")
          .select("user_id, start_date, end_date")
          .in("user_id", userIds)
          .eq("status", "approved")
          .lte("start_date", end)
          .gte("end_date", start),

          supabase
    .from("onsite_sessions")
    .select("session_date, driver_to_id, driver_from_id, leader_id")
    .or(
      userIds.map((id) =>
        `driver_to_id.eq.${id},driver_from_id.eq.${id}`
      ).join(",")
    )
    .gte("session_date", start)
    .lte("session_date", end),
      ]);

      setTimeLogs((logRes.data ?? []) as TimeLogRow[]);
      // ✅ แยก holidays ออกเป็น 2 set
      type HolidayRow = {
        holiday_date: string;
        holiday_type: string;
        name: string;
      };
      const hData = (holidayRes.data ?? []) as HolidayRow[];
      setHolidays(
        new Set(
          hData
            .filter((h) => h.holiday_type !== "working_sat")
            .map((h) => h.holiday_date),
        ),
      );
      setWorkingSats(
        new Set(
          hData
            .filter((h) => h.holiday_type === "working_sat")
            .map((h) => h.holiday_date),
        ),
      );
      setHolidayNames(new Map(hData.map((h) => [h.holiday_date, h.name])));

      setOtRequests((otRes.data ?? []) as OTRequestRow[]);
      setLeaveRequests((leaveRes.data ?? []) as LeaveRequestRow[]);
      setDriverSessions(driverRes.data ?? []);
    } catch (err) {
      console.error("HR fetchData error:", err);
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── คำนวณ OT hours ต่อ user จาก ot_requests ────────
  const otReqMap = useMemo(() => {
    const map: Record<string, number> = {};
    otRequests.forEach((r) => {
      const h =
        r.hours != null && r.hours > 0
          ? r.hours
          : calcOTHours(r.start_time, r.end_time);
      map[r.user_id] = (map[r.user_id] ?? 0) + h;
    });
    return map;
  }, [otRequests]);

  // ── สร้าง leaveMap จาก leave_requests ──────────────
  const leaveMap = useMemo(() => {
    const map = new Set<string>();
    leaveRequests.forEach((r) => {
      const [sy, sm, sd] = r.start_date.split("-").map(Number);
      const [ey, em, ed] = r.end_date.split("-").map(Number);
      const s = new Date(sy, sm - 1, sd);
      const e = new Date(ey, em - 1, ed);
      for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        map.add(`${r.user_id}_${ds}`);
      }
    });
    return map;
  }, [leaveRequests]);

  const workdayEnded = new Date().getHours() >= 18;

  // ── สร้าง AttendanceStat ต่อ user ───────────────────
  const attendances = useMemo(() => {
    const result: Record<string, AttendanceStat> = {};
    const todayStr = new Date().toISOString().split("T")[0];

    // ── คำนวณ expectedWorkdays จากช่วงวันที่ที่เลือก ──────────
    const [sy, sm, sd] = startDate.split("-").map(Number);
    const [ey, em, ed] = endDate.split("-").map(Number);
    const rangeStart = new Date(sy, sm - 1, sd);
    const rangeEnd = new Date(ey, em - 1, ed);
    let expectedWorkdays = 0;
    for (
      let cur = new Date(rangeStart);
      cur <= rangeEnd;
      cur.setDate(cur.getDate() + 1)
    ) {
      const dateStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
      if (workdayEnded ? dateStr > todayStr : dateStr >= todayStr) break;
      const dow = cur.getDay();
      if (dow === 0) continue;
      if (dow === 6 && !workingSats.has(dateStr)) continue;
      if (holidays.has(dateStr)) continue;
      expectedWorkdays++;
    }

    // ✅ สร้าง map: user_id → date → OT hours (จาก ot_requests)
    const otByUserDate: Record<
      string,
      Record<string, { start: string; end: string }[]>
    > = {};
    otRequests.forEach((r) => {
      if (!otByUserDate[r.user_id]) otByUserDate[r.user_id] = {};
      if (!otByUserDate[r.user_id][r.request_date])
        otByUserDate[r.user_id][r.request_date] = [];
      otByUserDate[r.user_id][r.request_date].push({
        start: r.start_time.slice(0, 5),
        end: r.end_time.slice(0, 5),
      });
    });

    employees.forEach((emp) => {
      const logs = timeLogs.filter((l) => l.user_id === emp.id);

      const isRegularWorkday = (logDate: string) => {
        const dow = new Date(logDate).getDay();
        if (dow === 0) return false;
        if (dow === 6 && !workingSats.has(logDate)) return false;
        if (holidays.has(logDate)) return false;
        return true;
      };
      const present = logs.filter((l) => l.status === "on_time" && isRegularWorkday(l.log_date)).length;
      const late = logs.filter((l) => l.status === "late" && isRegularWorkday(l.log_date)).length;
      const leave = logs.filter((l) => {
        if (l.status !== "leave") return false;
        return isRegularWorkday(l.log_date);
      }).length;
      const extraDays = logs.filter(
        (l) =>
          (l.status === "on_time" || l.status === "late") &&
          !isRegularWorkday(l.log_date),
      ).length;

      const absent = Math.max(0, expectedWorkdays - present - late - leave);

      // คำนวณ totalOT แบบ sum ต่อวัน + fallback จาก timeline_events
      const logMap: Record<string, number> = {};
      logs.forEach((l) => {
        if (l.ot_hours != null && l.ot_hours > 0) {
          // มี ot_hours ใน DB → ใช้เลย
          logMap[l.log_date] = l.ot_hours;
        } else if (l.timeline_events) {
          // ไม่มี ot_hours → คำนวณจาก ot_start / ot_end ใน timeline
          const events = l.timeline_events as {
            event: string;
            timestamp: string;
          }[];
          const otStart = events.find((e) => e.event === "ot_start");
          const otEnd = events.find((e) => e.event === "ot_end");
          if (otStart && otEnd) {
            const mins =
              (new Date(otEnd.timestamp).getTime() -
                new Date(otStart.timestamp).getTime()) /
              60_000;
            logMap[l.log_date] = Math.round((mins / 60) * 100) / 100;
          } else {
            logMap[l.log_date] = 0;
          }
        } else {
          logMap[l.log_date] = 0;
        }
      });

      const reqPeriodsMap = otByUserDate[emp.id] ?? {};
      const allDates = new Set([
        ...Object.keys(logMap),
        ...Object.keys(reqPeriodsMap),
      ]);
      let otSum = 0;
      allDates.forEach((date) => {
        const log = logs.find((l) => l.log_date === date);
        // ดึง timeline period
        const events = log?.timeline_events ?? [];
        const otStart = events.find((e) => e.event === "ot_start");
        const otEnd = events.find((e) => e.event === "ot_end");
        const timelinePeriod =
          otStart && otEnd
            ? [
                {
                  start: fmtTime(otStart.timestamp),
                  end: fmtTime(otEnd.timestamp),
                },
              ]
            : [];
        const reqPeriods = reqPeriodsMap[date] ?? [];
        const allPeriods = [...timelinePeriod, ...reqPeriods];
        
        const hasTimelineOT = !!(otStart && otEnd);
otSum += (() => {
  if (allPeriods.length === 0) return logMap[date] ?? 0;
  const fromPeriods = calcTotalOT(allPeriods);
  if (!hasTimelineOT && (logMap[date] ?? 0) > 0) {
    return Math.round((fromPeriods + logMap[date]) * 100) / 100;
  }
  return fromPeriods;
})();      // ← ต้องมี ); ปิด IIFE
});

      const totalOT = Math.round(otSum * 100) / 100;

      const inTimes = logs
        .map((l) => l.first_check_in)
        .filter(Boolean) as string[];
      const outTimes = logs
        .map((l) => l.last_check_out)
        .filter(Boolean) as string[];

      result[emp.id] = {
        workdays: expectedWorkdays,
        present: present + late,
        late,
        absent,
        leave,
        extraDays,
        totalRegHours:
          Math.round(
            logs
              .filter((l) => l.status === "on_time" || l.status === "late")
              .reduce((sum, l) => {
                if (!l.first_check_in || !l.last_check_out) return sum;
                const checkIn = fmtTime(l.first_check_in);
                const checkOut = fmtTime(l.last_check_out);
                return sum + (calcRegHours(checkIn, checkOut) ?? 0);
              }, 0) * 10,
          ) / 10,
        totalOT,
        avgIn: calcAvgTime(inTimes),
        avgOut: calcAvgTime(outTimes),
      };
    });

    return result;
  }, [
    employees,
    timeLogs,
    otRequests,
    startDate,
    endDate,
    holidays,
    workingSats,
    driverSessions,
  ]);

  // ── สร้าง DayLog รายวัน ต่อ user (สำหรับ DrillDownPanel) ──
  const dailyLogsPerUser = useMemo(() => {
    const result: Record<string, DayLog[]> = {};
    const todayStr = new Date().toISOString().split("T")[0];

    const otByUserDate: Record<
      string,
      Record<string, { start_time: string; end_time: string }[]>
    > = {};
    otRequests.forEach((r) => {
      if (!otByUserDate[r.user_id]) otByUserDate[r.user_id] = {};
      if (!otByUserDate[r.user_id][r.request_date])
        otByUserDate[r.user_id][r.request_date] = [];
      otByUserDate[r.user_id][r.request_date].push({
        start_time: r.start_time,
        end_time: r.end_time,
      });
    });

    employees.forEach((emp) => {
      const userLogs = timeLogs.filter((l) => l.user_id === emp.id);
      const logMap: Record<string, TimeLogRow> = {};
      userLogs.forEach((l) => {
        logMap[l.log_date] = l;
      });

      const driverMap = new Map<string, { to: boolean; from: boolean }>();
  driverSessions.forEach((s) => {
    driverMap.set(s.session_date, {
      to:   s.driver_to_id   === emp.id,
      from: s.driver_from_id === emp.id,
    });
  });

      const [rsy, rsm, rsd] = startDate.split("-").map(Number);
      const [rey, rem, red] = endDate.split("-").map(Number);
      const loopStart = new Date(rsy, rsm - 1, rsd);
      const loopEnd = new Date(rey, rem - 1, red);
      const days: DayLog[] = [];

      for (
        let cur = new Date(loopStart);
        cur <= loopEnd;
        cur.setDate(cur.getDate() + 1)
      ) {
        const d = cur.getDate();
        const dow = cur.getDay();
        const dateStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

        if (dateStr > todayStr) break;
        const isWorkingSat = workingSats.has(dateStr);
        const isWeekend = dow === 0 || (dow === 6 && !isWorkingSat);
        const isHoliday = holidays.has(dateStr);
        const log = logMap[dateStr];

        if (dateStr === todayStr && !log && !workdayEnded) continue;

        if (log?.status === "leave") {
          days.push({
            day: d,
            dow,
            date: dateStr,
            status: "leave",
            checkIn: "–",
            checkOut: "–",
            isWorkingSat: false,
            regHours: null,
            otPeriods: [],
            otTotal: 0,
            otTimeline: null,
            otReqs: [],
            workType: null,
            dailyAllowance: false,
            isDriverTo:   false,
            isDriverFrom: false,
          });
          continue;
        }

        if (isHoliday && !log) {
          days.push({
            day: d,
            dow,
            date: dateStr,
            status: "holiday",
            holidayName: holidayNames.get(dateStr),
            checkIn: "–",
            checkOut: "–",
            isWorkingSat: false,
            regHours: null,
            otPeriods: [],
            otTotal: 0,
            otTimeline: null,
            otReqs: [],
            workType: null,
            dailyAllowance: false,
            isDriverTo:   false,
            isDriverFrom: false,
          });
          continue;
        }

        if (isWeekend && !log) {
          days.push({
            day: d,
            dow,
            date: dateStr,
            status: "weekend",
            checkIn: "–",
            checkOut: "–",
            isWorkingSat: false,
            regHours: null,
            otPeriods: [],
            otTotal: 0,
            otTimeline: null,
            otReqs: [],
            workType: null,
            dailyAllowance: false,
            isDriverTo:   false,
            isDriverFrom: false,
          });
          continue;
        }

        // working_sat จะไหลมาถึงตรงนี้ได้แล้ว ✅
        if (log) {
          let status: DayLog["status"] = "absent";
          if (log.status === "on_time") status = "present";
          else if (log.status === "late") status = "late";

          // ── Timeline OT (จาก ot_start / ot_end) ──
          const timelineOT = (() => {
            const events = log.timeline_events as
              | { event: string; timestamp: string }[]
              | null;
            if (!events) return null;
            const otStart = events.find((e) => e.event === "ot_start");
            const otEnd = events.find((e) => e.event === "ot_end");
            if (!otStart || !otEnd) return null;
            return {
              start: fmtTime(otStart.timestamp),
              end: fmtTime(otEnd.timestamp),
            };
          })();

          // ── OT Request (approved) ──
          const otReqs = otByUserDate[emp.id]?.[dateStr] ?? [];

          // สำหรับ display column "Req. Start OT / End OT" → ใช้ชุดแรก (เหมือนเดิม)
          const reqOT =
            otReqs.length > 0
              ? {
                  start: otReqs[0].start_time.slice(0, 5),
                  end: otReqs[0].end_time.slice(0, 5),
                }
              : null;

          // สำหรับคำนวณ otTotal → ใส่ทุกชุด
          const reqPeriods = otReqs.map((r) => ({
            start: r.start_time.slice(0, 5),
            end: r.end_time.slice(0, 5),
          }));

          const periods: { start: string; end: string }[] = [
            ...(timelineOT ? [timelineOT] : []),
            ...reqPeriods,
          ];

          const validPeriods = periods.filter(
            (p): p is { start: string; end: string } => !!p,
          );
          // — on_site ไม่มี timeline OT ต้องบวก ot_hours เข้าไปด้วย
          const hasTimelineOT = !!timelineOT;
          const otTotal = (() => {
            if (validPeriods.length === 0)
              return log.ot_hours ? Number(log.ot_hours) : 0;
            const fromPeriods = calcTotalOT(validPeriods);
            // ถ้าไม่มี timeline OT (on_site) แต่มี ot_hours → บวกเพิ่ม
            if (!hasTimelineOT && log.ot_hours && log.ot_hours > 0) {
              return (
                Math.round((fromPeriods + Number(log.ot_hours)) * 100) / 100
              );
            }
            return fromPeriods;
          })();

          days.push({
            day: d,
            dow,
            date: dateStr,
            status,
            isWorkingSat,
            holidayName: holidayNames.get(dateStr),
            checkIn: fmtTime(log.first_check_in),
            checkOut: fmtTime(log.last_check_out),
            regHours: calcRegHours(
              fmtTime(log.first_check_in),
              fmtTime(log.last_check_out),
            ),
            otPeriods: periods.filter(
              (p): p is { start: string; end: string } => p !== undefined,
            ),
            otTotal,
            otTimeline: timelineOT,
            otReqs: reqPeriods,
            workType: log.work_type ?? null,
            dailyAllowance: log.daily_allowance ?? false,
            isDriverTo:   driverMap.get(dateStr)?.to   ?? false,
            isDriverFrom: driverMap.get(dateStr)?.from ?? false,
          });
        } else {
          days.push({
            day: d,
            dow,
            date: dateStr,
            status: "absent",
            checkIn: "–",
            checkOut: "–",
            isWorkingSat,
            regHours: null,
            otPeriods: [],
            otTotal: 0,
            otTimeline: null,
            otReqs: [],
            workType: null,
            dailyAllowance: false,
            isDriverTo:   false, 
            isDriverFrom: false,
          });
        }
      }
      result[emp.id] = days;
    });
    return result;
  }, [
    employees,
    timeLogs,
    startDate,
    endDate,
    holidays,
    leaveMap,
    workingSats,
    otRequests,
    driverSessions,
    holidayNames,
  ]);

  // ── Employee filter dropdown state ──────────────────
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false);
  const [empSearch, setEmpSearch] = useState("");
  const [filterEmpIds, setFilterEmpIds] = useState<Set<string>>(new Set());

  const toggleFilterEmp = (id: string) => {
    setFilterEmpIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearFilterEmp = () => setFilterEmpIds(new Set());

  // ── Derived: depts, filtered, agg ────────────────────
  const depts = useMemo(() => {
    const s = new Set(employees.map((e) => e.department));
    return ["all", ...Array.from(s).sort()];
  }, [employees]);

  const filtered = useMemo(() => {
    let base = filterDept === "all" ? employees : employees.filter((e) => e.department === filterDept);
    if (filterEmpIds.size > 0) base = base.filter((e) => filterEmpIds.has(e.id));
    return base;
  }, [employees, filterDept, filterEmpIds]);

  const agg = useMemo(() => {
    const vals = employees.map((e) => attendances[e.id]).filter(Boolean);
    return {
      present: vals.reduce((s, a) => s + a.present, 0),
      late: vals.reduce((s, a) => s + a.late, 0),
      absent: vals.reduce((s, a) => s + a.absent, 0),
      ot: Math.round(vals.reduce((s, a) => s + a.totalOT, 0) * 100) / 100,
    };
  }, [employees, attendances]);

  // ── Dept breakdown ────────────────────────────────────
  const deptStats = useMemo(() => {
    const map: Record<string, { present: number; total: number }> = {};
    employees.forEach((emp) => {
      const att = attendances[emp.id];
      if (!att) return;
      if (!map[emp.department]) map[emp.department] = { present: 0, total: 0 };
      map[emp.department].present += att.present;
      map[emp.department].total += att.workdays || 1;
    });
    return Object.entries(map)
      .map(([dept, { present, total }]) => ({
        dept,
        pct: Math.round((present / total) * 100),
        present,
        total,
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [employees, attendances]);

  // ── Multi-select helpers ──────────────────────────────
  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((e) => e.id)));
    }
  };

  const handleExport = async () => {
    if (employees.length === 0) return;
    setExporting(true);
    const exportList = selectedIds.size > 0 ? filtered.filter((e) => selectedIds.has(e.id)) : filtered;
    try {
      await exportHRExcel(exportList, attendances, dailyLogsPerUser, startDate, endDate);
    } finally {
      setExporting(false);
    }
  };

  const handleExportDetail = async () => {
    if (employees.length === 0) return;
    setExportingDetail(true);
    const exportList = selectedIds.size > 0 ? filtered.filter((e) => selectedIds.has(e.id)) : filtered;
    try {
      await exportMultiSheetIndividual(exportList, attendances, dailyLogsPerUser, startDate, endDate);
    } finally {
      setExportingDetail(false);
    }
  };
  const selectedEmp = selectedId
    ? (employees.find((e) => e.id === selectedId) ?? null)
    : null;
  const selectedIdx = employees.findIndex((e) => e.id === selectedId);

  // ════════════════════════════════════════════════════════
  return (
    <main className="min-h-screen bg-gray-50 pb-28 md:pb-10">
      {/* ╔═══════════════════════════════════╗
          ║  STICKY HEADER                    ║
          ╚═══════════════════════════════════╝ */}
      <div className="sticky top-0 z-20 bg-gray-50/90 backdrop-blur-sm border-b border-gray-100">
        {/* Title row */}
        <div className="flex items-center justify-between px-4 md:px-6 pt-4 pb-2 gap-3">
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              Admin · HR
            </p>
            <h1 className="text-xl font-extrabold text-gray-800 leading-tight">
              Attendance Summary
            </h1>
          </div>
          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={exporting || loading || employees.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold shadow-sm hover:bg-emerald-600 active:scale-95 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
            <span className="hidden sm:inline">
              {exporting ? "กำลัง Export..." : selectedIds.size > 0 ? `Export (${selectedIds.size})` : "Export Excel"}
            </span>
          </button>
        </div>

        {/* ── Date range picker row ── */}
        <div className="px-4 md:px-6 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Start date */}
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-sky-400 flex-shrink-0">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span className="text-[10px] font-bold text-gray-400 uppercase">From</span>
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => {
                  if (e.target.value) setStartDate(e.target.value);
                }}
                className="font-medium text-xs text-gray-500 bg-transparent border-none outline-none cursor-pointer"
              />
            </div>

            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-gray-300 flex-shrink-0">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>

            {/* End date */}
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-violet-400 flex-shrink-0">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span className="text-[10px] font-bold text-gray-400 uppercase">To</span>
              <input
                type="date"
                value={endDate}
                min={startDate}
                max={todayISO}
                onChange={(e) => {
                  if (e.target.value) setEndDate(e.target.value);
                }}
                className="font-medium text-xs text-gray-500 bg-transparent border-none outline-none cursor-pointer"
              />
            </div>


          </div>
        </div>

        {/* ── Dept filter + Employee picker row ── */}
        <div className="flex items-center gap-2 px-4 md:px-6 pb-3 flex-wrap">
          {depts.map((d) => (
            <button
              key={d}
              onClick={() => {
                setFilterDept(d);
                setSelectedId(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                filterDept === d
                  ? "bg-sky-500 text-white border-sky-500 shadow-sm"
                  : "bg-white text-gray-500 border-gray-200 hover:border-sky-300 hover:text-sky-600"
              }`}
            >
              {d === "all" ? "ทั้งหมด" : d}
            </button>
          ))}

          {/* ── Employee multi-select dropdown ── */}
          <div className="relative">
            <button
              onClick={() => setEmpDropdownOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                filterEmpIds.size > 0
                  ? "bg-sky-500 text-white border-sky-500 shadow-sm"
                  : "bg-white text-gray-500 border-gray-200 hover:border-sky-300 hover:text-sky-600"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              {filterEmpIds.size > 0 ? `พนักงาน (${filterEmpIds.size})` : "เลือกพนักงาน"}
              {filterEmpIds.size > 0 && (
                <span
                  onClick={(e) => { e.stopPropagation(); clearFilterEmp(); }}
                  className="ml-1 w-4 h-4 rounded-full bg-white/30 hover:bg-white/50 flex items-center justify-center transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-2.5 h-2.5">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </span>
              )}
            </button>

            {empDropdownOpen && (
              <>
                {/* Backdrop */}
                <div className="fixed inset-0 z-30" onClick={() => setEmpDropdownOpen(false)} />
                {/* Panel */}
                <div className="absolute top-full left-0 mt-1.5 w-64 bg-white border border-gray-200 rounded-2xl shadow-xl z-40 overflow-hidden">
                  {/* Search */}
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-gray-400 flex-shrink-0">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      type="text"
                      placeholder="ค้นหาพนักงาน..."
                      value={empSearch}
                      onChange={(e) => setEmpSearch(e.target.value)}
                      autoFocus
                      className="flex-1 text-xs text-gray-700 placeholder-gray-400 bg-transparent border-none outline-none"
                    />
                    {empSearch && (
                      <button onClick={() => setEmpSearch("")} className="text-gray-300 hover:text-gray-500">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Select all / clear */}
                  {(() => {
                    const searchFiltered = employees.filter(
                      (e) =>
                        `${e.first_name} ${e.last_name}`.toLowerCase().includes(empSearch.toLowerCase()) ||
                        e.department.toLowerCase().includes(empSearch.toLowerCase()),
                    );
                    const allChecked = searchFiltered.length > 0 && searchFiltered.every((e) => filterEmpIds.has(e.id));
                    return (
                      <>
                        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-50">
                          <button
                            onClick={() => {
                              if (allChecked) {
                                setFilterEmpIds((prev) => {
                                  const next = new Set(prev);
                                  searchFiltered.forEach((e) => next.delete(e.id));
                                  return next;
                                });
                              } else {
                                setFilterEmpIds((prev) => {
                                  const next = new Set(prev);
                                  searchFiltered.forEach((e) => next.add(e.id));
                                  return next;
                                });
                              }
                            }}
                            className="text-[11px] font-bold text-sky-500 hover:text-sky-600 transition-colors"
                          >
                            {allChecked ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
                          </button>
                          {filterEmpIds.size > 0 && (
                            <span className="text-[11px] text-gray-400">เลือกแล้ว {filterEmpIds.size} คน</span>
                          )}
                        </div>

                        {/* Employee list */}
                        <div className="max-h-52 overflow-y-auto">
                          {searchFiltered.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-4">ไม่พบพนักงาน</p>
                          ) : (
                            searchFiltered.map((e, i) => {
                              const checked = filterEmpIds.has(e.id);
                              return (
                                <button
                                  key={e.id}
                                  onClick={() => toggleFilterEmp(e.id)}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-gray-50 ${
                                    checked ? "bg-sky-50/40" : ""
                                  }`}
                                >
                                  {/* Checkbox */}
                                  <div
                                    className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                                      checked ? "bg-sky-500 border-sky-500" : "border-gray-300"
                                    }`}
                                  >
                                    {checked && (
                                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" className="w-2.5 h-2.5">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                    )}
                                  </div>
                                  {/* Avatar */}
                                  {e.avatar_url ? (
                                    <img src={e.avatar_url} referrerPolicy="no-referrer" className="w-6 h-6 rounded-lg object-cover flex-shrink-0" />
                                  ) : (
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-extrabold flex-shrink-0 bg-gradient-to-br ${AVATAR_GRAD[i % AVATAR_GRAD.length]}`}>
                                      {e.first_name.charAt(0)}
                                    </div>
                                  )}
                                  {/* Name */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-gray-700 truncate">{e.first_name} {e.last_name}</p>
                                    <p className="text-[10px] text-gray-400 truncate">{e.department}</p>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>

                        {/* Done button */}
                        <div className="px-3 py-2.5 border-t border-gray-100">
                          <button
                            onClick={() => { setEmpDropdownOpen(false); setEmpSearch(""); }}
                            className="w-full py-1.5 rounded-xl bg-sky-500 text-white text-xs font-bold hover:bg-sky-600 transition-colors"
                          >
                            {filterEmpIds.size > 0 ? `แสดง ${filterEmpIds.size} คน` : "ปิด"}
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 pt-5 space-y-5">
        {/* ╔═══════════════════════════════════╗
            ║  STAT CARDS                       ║
            ╚═══════════════════════════════════╝ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            colorBg="bg-emerald-50 text-emerald-500"
            label="วันมาทำงาน (รวม)"
            value={loading ? "..." : agg.present}
            sub={`${employees.length} พนักงาน`}
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-5 h-5"
              >
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            }
          />
          <StatCard
            colorBg="bg-amber-50 text-amber-500"
            label="มาสาย (ครั้งรวม)"
            value={loading ? "..." : agg.late}
            sub="ทุกพนักงาน"
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-5 h-5"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
          />
          <StatCard
            colorBg="bg-rose-50 text-rose-500"
            label="ขาดงาน (ครั้งรวม)"
            value={loading ? "..." : agg.absent}
            sub="ทุกพนักงาน"
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-5 h-5"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            }
          />
          <StatCard
            colorBg="bg-sky-50 text-sky-500"
            label="ชั่วโมง OT รวม"
            value={loading ? "..." : `${agg.ot}h`}
            sub="รวม ot_requests ที่อนุมัติ"
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-5 h-5"
              >
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            }
          />
        </div>

        {/* ╔═══════════════════════════════════╗
            ║  EMPLOYEE TABLE + DRILL-DOWN      ║
            ╚═══════════════════════════════════╝ */}
        <div
          className={`grid gap-4 ${selectedEmp ? "grid-cols-1 lg:grid-cols-5" : "grid-cols-1"}`}
        >
          {/* Employee list */}
          <div
            className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${selectedEmp ? "lg:col-span-3" : ""}`}
          >
            {/* Table header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-500 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-gray-700">
                    รายชื่อพนักงาน
                  </h3>
                  <p className="text-xs text-gray-400">
                    {filtered.length} คน ·{" "}
                    {multiSelectMode
                      ? `เลือกแล้ว ${selectedIds.size} คน`
                      : "คลิกเพื่อดูรายละเอียด"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Multi-select toggle */}
                <button
                  onClick={() => {
                    setMultiSelectMode((v) => !v);
                    if (multiSelectMode) setSelectedIds(new Set());
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    multiSelectMode
                      ? "bg-sky-500 text-white border-sky-500 shadow-sm"
                      : "bg-white text-gray-500 border-gray-200 hover:border-sky-300 hover:text-sky-600"
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                  </svg>
                  {multiSelectMode ? "เสร็จสิ้น" : "เลือกหลายคน"}
                </button>
                {multiSelectMode && (
                  <button
                    onClick={toggleSelectAll}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-500 hover:border-sky-300 hover:text-sky-600 transition-all"
                  >
                    {selectedIds.size === filtered.length ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
                  </button>
                )}
                {!multiSelectMode && (
                  <div className="hidden md:flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <span>มา / ทั้งหมด</span>
                    <span>สถานะ</span>
                    <span>OT</span>
                  </div>
                )}
              </div>
            </div>

            {/* Rows */}
            {loading ? (
              <TableSkeleton />
            ) : filtered.length === 0 ? (
              <div className="text-center py-14 text-gray-300">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="w-12 h-12 mx-auto mb-2 opacity-40"
                >
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                <p className="text-sm font-medium">ไม่พบพนักงาน</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 overflow-y-auto max-h-[calc(100vh-320px)] scrollbar-thin">
                {filtered.map((emp, idx) => {
                  const att = attendances[emp.id] ?? {
                    workdays: 0,
                    present: 0,
                    late: 0,
                    absent: 0,
                    leave: 0,
                    totalRegHours: 0,
                    totalOT: 0,
                    avgIn: "–",
                    avgOut: "–",
                  };
                  const pct =
                    att.workdays > 0
                      ? Math.round((att.present / att.workdays) * 100)
                      : 0;
                  const isSelected = selectedId === emp.id;
                  const isChecked = selectedIds.has(emp.id);

                  return (
                    <div
                      key={emp.id}
                      onClick={() => {
                        if (multiSelectMode) {
                          toggleSelectId(emp.id);
                        } else {
                          setSelectedId(isSelected ? null : emp.id);
                        }
                      }}
                      className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all border-b border-gray-50 last:border-0 ${
                        multiSelectMode && isChecked
                          ? "bg-sky-50/60 border-l-2 border-l-sky-400"
                          : !multiSelectMode && isSelected
                            ? "bg-sky-50/60 border-l-2 border-l-sky-400"
                            : "hover:bg-gray-50/50"
                      }`}
                    >
                      {/* Checkbox (multi-select mode) */}
                      {multiSelectMode && (
                        <div
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            isChecked
                              ? "bg-sky-500 border-sky-500"
                              : "border-gray-300 bg-white"
                          }`}
                        >
                          {isChecked && (
                            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3 h-3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                      )}

                      {/* Avatar */}
                      {emp.avatar_url ? (
                        <img
                          src={emp.avatar_url}
                          alt={`${emp.first_name} ${emp.last_name}`}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-xl object-cover flex-shrink-0 shadow-sm"
                        />
                      ) : (
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-extrabold flex-shrink-0 bg-gradient-to-br ${AVATAR_GRAD[idx % AVATAR_GRAD.length]} shadow-sm`}
                        >
                          {emp.first_name.charAt(0)}
                        </div>
                      )}

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">
                          {emp.first_name} {emp.last_name}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {emp.department}
                        </p>
                      </div>

                      {/* Present / workdays */}
                      <div className="hidden md:block text-right flex-shrink-0">
                        <p className="text-xs font-bold text-gray-700">
                          {att.present}
                          <span className="text-gray-300 font-normal">
                            {" "}
                            / {att.workdays}
                          </span>
                        </p>
                        {att.extraDays > 0 && (
                          <p className="text-[9px] font-bold text-indigo-400 mt-0.5">
                            +{att.extraDays} วันหยุด
                          </p>
                        )}
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              pct >= 90
                                ? "bg-emerald-400"
                                : pct >= 70
                                  ? "bg-amber-400"
                                  : "bg-rose-400"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Status pills */}
                      <div className="hidden md:flex items-center gap-1 flex-shrink-0">
                        {att.late > 0 && (
                          <span className="text-[9px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-lg border border-amber-200">
                            สาย {att.late}
                          </span>
                        )}
                        {att.absent > 0 && (
                          <span className="text-[9px] font-bold bg-rose-50 text-rose-500 px-1.5 py-0.5 rounded-lg border border-rose-200">
                            ขาด {att.absent}
                          </span>
                        )}
                        {att.leave > 0 && (
                          <span className="text-[9px] font-bold bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded-lg border border-violet-200">
                            ลา {att.leave}
                          </span>
                        )}
                      </div>

                      {/* OT */}
                      <div className="text-right flex-shrink-0">
                        <p
                          className={`text-xs font-extrabold ${att.totalOT > 0 ? "text-amber-500" : "text-gray-300"}`}
                        >
                          {att.totalOT > 0 ? `+${att.totalOT}h` : "–"}
                        </p>
                        <p className="text-[10px] text-gray-400">OT</p>
                      </div>

                      {/* Chevron */}
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className={`w-4 h-4 flex-shrink-0 transition-colors ${isSelected ? "text-sky-400" : "text-gray-300"}`}
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 px-5 py-3 border-t border-gray-50 bg-gray-50/50">
              {[
                { c: "bg-emerald-400", l: "ปกติ" },
                { c: "bg-amber-400", l: "สาย" },
                { c: "bg-rose-400", l: "ขาด" },
                { c: "bg-violet-400", l: "ลา" },
                { c: "bg-sky-200", l: "หยุด" },
              ].map((i) => (
                <div key={i.l} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${i.c}`} />
                  <span className="text-[10px] text-gray-400 font-medium">
                    {i.l}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Drill-down panel */}
          {selectedEmp && (
            <div className="lg:col-span-2 lg:sticky lg:top-[132px]">
              <DrillDownPanel
                emp={selectedEmp}
                empIdx={selectedIdx}
                startDate={startDate}
                endDate={endDate}
                dailyLogs={dailyLogsPerUser[selectedEmp.id] ?? []}
                att={
                  attendances[selectedEmp.id] ?? {
                    workdays: 0,
                    present: 0,
                    late: 0,
                    absent: 0,
                    leave: 0,
                    totalRegHours: 0,
                    totalOT: 0,
                    avgIn: "–",
                    avgOut: "–",
                  }
                }
                onClose={() => setSelectedId(null)}
              />
            </div>
          )}
        </div>

        {/* ╔═══════════════════════════════════╗
            ║  DEPT BREAKDOWN                   ║
            ╚═══════════════════════════════════╝ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-500 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-4 h-4"
              >
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
                <line x1="2" y1="20" x2="22" y2="20" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-gray-700">
                เปรียบเทียบตามแผนก
              </h3>
              <p className="text-xs text-gray-400">อัตราการมาทำงานรายแผนก</p>
            </div>
          </div>
          <div className="p-5 space-y-3">
            {loading ? (
              <div className="space-y-3 animate-pulse">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i}>
                    <div className="flex justify-between mb-1.5">
                      <div className="h-3 bg-gray-100 rounded w-1/4" />
                      <div className="h-3 bg-gray-100 rounded w-16" />
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full" />
                  </div>
                ))}
              </div>
            ) : deptStats.length === 0 ? (
              <p className="text-sm text-gray-300 text-center py-4">
                ไม่มีข้อมูล
              </p>
            ) : (
              deptStats.map(({ dept, pct, present, total }) => (
                <div key={dept}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-bold text-gray-700">
                      {dept}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400">
                        {present}/{total} วัน
                      </span>
                      <span
                        className={`text-xs font-extrabold ${
                          pct >= 90
                            ? "text-emerald-600"
                            : pct >= 70
                              ? "text-amber-600"
                              : "text-rose-500"
                        }`}
                      >
                        {pct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        pct >= 90
                          ? "bg-emerald-400"
                          : pct >= 70
                            ? "bg-amber-400"
                            : "bg-rose-400"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {/* ╔═══════════════════════════════════╗
          ║  FLOATING MULTI-SELECT BAR        ║
          ╚═══════════════════════════════════╝ */}
      {multiSelectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-30 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-3 bg-gray-900 text-white rounded-2xl shadow-xl px-4 py-3">
            {/* Avatars stack */}
            <div className="flex -space-x-2">
              {filtered
                .filter((e) => selectedIds.has(e.id))
                .slice(0, 4)
                .map((e, i) =>
                  e.avatar_url ? (
                    <img
                      key={e.id}
                      src={e.avatar_url}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full border-2 border-gray-900 object-cover"
                      style={{ zIndex: 4 - i }}
                    />
                  ) : (
                    <div
                      key={e.id}
                      className={`w-7 h-7 rounded-full border-2 border-gray-900 flex items-center justify-center text-[10px] font-extrabold bg-gradient-to-br ${AVATAR_GRAD[i % AVATAR_GRAD.length]}`}
                      style={{ zIndex: 4 - i }}
                    >
                      {e.first_name.charAt(0)}
                    </div>
                  ),
                )}
              {selectedIds.size > 4 && (
                <div className="w-7 h-7 rounded-full border-2 border-gray-900 bg-gray-700 flex items-center justify-center text-[9px] font-extrabold z-0">
                  +{selectedIds.size - 4}
                </div>
              )}
            </div>
            <span className="text-sm font-bold">เลือก {selectedIds.size} คน</span>
            <div className="w-px h-5 bg-white/20" />

            {/* ── Export สรุปรวม ── */}
            <button
              onClick={handleExport}
              disabled={exporting || exportingDetail}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-bold transition-colors disabled:opacity-50"
            >
              {exporting ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              )}
              สรุปรวม
            </button>

            {/* ── Export รายละเอียด (multi-sheet) ── */}
            <button
              onClick={handleExportDetail}
              disabled={exporting || exportingDetail}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-xs font-bold transition-colors disabled:opacity-50"
            >
              {exportingDetail ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              )}
              รายละเอียด
            </button>
            {/* Clear */}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
