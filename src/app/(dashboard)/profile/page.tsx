"use client";

import { useState, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DayLog {
  date: string; // "YYYY-MM-DD"
  checkIn: string | null;
  checkOut: string | null;
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

// ─── Mock Data Generator ──────────────────────────────────────────────────────
function generateMonthLogs(year: number, month: number): DayLog[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const logs: DayLog[] = [];

  const leavedays = new Set([9, 10]); // วันลา
  const holidays  = new Set([1]);      // วันหยุด

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    if (isWeekend || holidays.has(d)) {
      logs.push({ date: dateStr, checkIn: null, checkOut: null, workType: isWeekend ? null : "in_factory", status: "holiday", isReportSent: false, otHours: 0 });
      continue;
    }
    if (leavedays.has(d)) {
      logs.push({ date: dateStr, checkIn: null, checkOut: null, workType: "leave", status: "leave", isReportSent: false, otHours: 0 });
      continue;
    }

    // Random working day
    const isLate = Math.random() < 0.1;
    const hasOT  = Math.random() < 0.2;
    const noShow = d > new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();

    const inHour  = isLate ? 8 + Math.floor(Math.random() * 1) : 7 + Math.floor(Math.random() * 1 + 1);
    const inMin   = isLate ? 16 + Math.floor(Math.random() * 30) : Math.floor(Math.random() * 59);
    const outHour = hasOT ? 18 + Math.floor(Math.random() * 2) : 17;
    const outMin  = Math.floor(Math.random() * 59);

    if (noShow) {
      logs.push({ date: dateStr, checkIn: null, checkOut: null, workType: null, status: "absent", isReportSent: false, otHours: 0 });
    } else {
      logs.push({
        date: dateStr,
        checkIn:  `${String(inHour).padStart(2, "0")}:${String(inMin).padStart(2, "0")}`,
        checkOut: `${String(outHour).padStart(2, "0")}:${String(outMin).padStart(2, "0")}`,
        workType: Math.random() > 0.3 ? "in_factory" : "on_site",
        status: isLate ? "late" : "on_time",
        isReportSent: Math.random() > 0.15,
        otHours: hasOT ? Math.round((outHour - 17 + outMin / 60) * 2) / 2 : 0,
      });
    }
  }
  return logs;
}

const MOCK_OT: OTRecord[] = [
  { id: "ot1", date: "2026-02-04", hours: 2, reason: "งานด่วนลูกค้า Toyota", project: "Toyota Line A", status: "approved" },
  { id: "ot2", date: "2026-02-11", hours: 3, reason: "ทดสอบระบบไฟฟ้า", project: "Honda Factory", status: "approved" },
  { id: "ot3", date: "2026-02-18", hours: 1.5, reason: "เร่งส่งมอบงาน Phase 2", project: "SCG Plant", status: "pending" },
  { id: "ot4", date: "2026-01-22", hours: 4, reason: "ซ่อมฉุกเฉิน Panel Room", project: "Toyota Line B", status: "approved" },
  { id: "ot5", date: "2026-01-15", hours: 2, reason: "Commissioning test", project: "Honda Office", status: "rejected" },
];

const MOCK_LEAVE: LeaveRecord[] = [
  { id: "lv1", startDate: "2026-02-09", endDate: "2026-02-10", days: 2, type: "personal", reason: "ธุระส่วนตัว", status: "approved" },
  { id: "lv2", startDate: "2026-01-08", endDate: "2026-01-08", days: 1, type: "sick", reason: "ไม่สบาย มีไข้", status: "approved" },
  { id: "lv3", startDate: "2025-12-26", endDate: "2025-12-27", days: 2, type: "annual", reason: "พักผ่อนช่วงปีใหม่", status: "approved" },
  { id: "lv4", startDate: "2026-03-05", endDate: "2026-03-05", days: 1, type: "sick", reason: "นัดหมอ", status: "pending" },
];

// ─── Helper ───────────────────────────────────────────────────────────────────
const fmt = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${d} ${MONTHS_TH[m - 1].slice(0, 3)} ${y + 543}`;
};

const fmtShort = (dateStr: string) => {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${d} ${MONTHS_TH[m - 1].slice(0, 3)}`;
};

// ─── Sub Components ───────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, accent }: {
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
    on_time: "bg-emerald-400",
    late:    "bg-amber-400",
    absent:  "bg-rose-400",
    holiday: "bg-gray-200",
    leave:   "bg-violet-400",
  };
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${map[status]}`} />;
}

// ─── OT History ───────────────────────────────────────────────────────────────
function OTHistory({ records }: { records: OTRecord[] }) {
  const totalApproved = records
    .filter(r => r.status === "approved")
    .reduce((s, r) => s + r.hours, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4.5 h-4.5" style={{width:"18px",height:"18px"}}>
              <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
              <path d="M17 3.5L21 7" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-700">ประวัติ OT</h3>
            <p className="text-xs text-gray-400">รวมอนุมัติ {totalApproved} ชม.</p>
          </div>
        </div>
        <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
          {records.length} รายการ
        </span>
      </div>

      <div className="divide-y divide-gray-50">
        {records.map((r) => {
          const cfg = OT_STATUS_CONFIG[r.status];
          return (
            <div key={r.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
              <div className="flex-shrink-0 w-10 text-center">
                <p className="text-lg font-extrabold text-gray-700 leading-none">
                  {r.date.split("-")[2]}
                </p>
                <p className="text-[10px] font-medium text-gray-400">
                  {MONTHS_TH[Number(r.date.split("-")[1]) - 1].slice(0, 3)}
                </p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{r.reason}</p>
                <p className="text-xs text-gray-400 truncate">{r.project}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-sm font-extrabold text-amber-500">+{r.hours}h</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                  {cfg.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Leave History ────────────────────────────────────────────────────────────
function LeaveHistory({ records }: { records: LeaveRecord[] }) {
  const totalApproved = records.filter(r => r.status === "approved").reduce((s, r) => s + r.days, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-500 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4.5 h-4.5" style={{width:"18px",height:"18px"}}>
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-700">ประวัติการลา</h3>
            <p className="text-xs text-gray-400">ใช้สิทธิ์ไปแล้ว {totalApproved} วัน</p>
          </div>
        </div>
        <span className="text-xs font-bold text-violet-600 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-full">
          {records.length} รายการ
        </span>
      </div>

      <div className="divide-y divide-gray-50">
        {records.map((r) => {
          const typeCfg   = LEAVE_TYPE[r.type];
          const statusCfg = LEAVE_STATUS_CONFIG[r.status];
          const isSingle  = r.startDate === r.endDate;

          return (
            <div key={r.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
              {/* Date badge */}
              <div className={`flex-shrink-0 px-2.5 py-2 rounded-xl border text-center min-w-[52px] ${typeCfg.bg}`}>
                <p className={`text-sm font-extrabold leading-none ${typeCfg.color}`}>
                  {isSingle
                    ? r.startDate.split("-")[2]
                    : `${r.startDate.split("-")[2]}–${r.endDate.split("-")[2]}`}
                </p>
                <p className={`text-[9px] font-bold mt-0.5 ${typeCfg.color} opacity-70`}>
                  {MONTHS_TH[Number(r.startDate.split("-")[1]) - 1].slice(0, 3)}
                </p>
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeCfg.bg} ${typeCfg.color}`}>
                    {typeCfg.label}
                  </span>
                  <span className="text-xs font-bold text-gray-500">{r.days} วัน</span>
                </div>
                <p className="text-sm font-semibold text-gray-700 mt-0.5 truncate">{r.reason}</p>
              </div>
              {/* Status */}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Mini Attendance Calendar ─────────────────────────────────────────────────
function AttendanceCalendar({ year, month, logs }: { year: number; month: number; logs: DayLog[] }) {
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

  const statusColor: Record<string, string> = {
    on_time: "bg-emerald-400",
    late:    "bg-amber-400",
    absent:  "bg-rose-400",
    holiday: "bg-gray-100",
    leave:   "bg-violet-400",
  };

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_SHORT.map((d, i) => (
          <div key={d} className={`text-center text-[10px] font-bold pb-1.5 ${i === 0 ? "text-rose-400" : i === 6 ? "text-sky-400" : "text-gray-400"}`}>
            {d}
          </div>
        ))}
      </div>
      {/* Cells */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />;
          const col = idx % 7;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const log = logMap[dateStr];
          const sc  = log ? statusColor[log.status] : "bg-gray-100";
          const isWeekend = col === 0 || col === 6;

          return (
            <div key={day} className="flex flex-col items-center gap-0.5">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold transition-all
                ${log?.status === "on_time" ? "bg-emerald-50 text-emerald-700" :
                  log?.status === "late"    ? "bg-amber-50 text-amber-700" :
                  log?.status === "absent"  ? "bg-rose-50 text-rose-500" :
                  log?.status === "leave"   ? "bg-violet-50 text-violet-500" :
                  isWeekend ? "text-gray-300" : "text-gray-200"}
              `}>
                {day}
              </div>
              {/* Indicator dot */}
              {log && log.status !== "holiday" && (
                <span className={`w-1 h-1 rounded-full ${sc}`} />
              )}
              {/* Report dot */}
              {log?.isReportSent && (
                <span className="w-1 h-1 rounded-full bg-sky-400" />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 pt-3 border-t border-gray-50">
        {[
          { color: "bg-emerald-400", label: "ตรงเวลา" },
          { color: "bg-amber-400",   label: "มาสาย" },
          { color: "bg-rose-400",    label: "ขาดงาน" },
          { color: "bg-violet-400",  label: "ลา" },
          { color: "bg-sky-400",     label: "ส่ง Report" },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${item.color}`} />
            <span className="text-[10px] text-gray-400 font-medium">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Attendance Detail List ───────────────────────────────────────────────────
function AttendanceList({ logs }: { logs: DayLog[] }) {
  const workdays = logs.filter(l => l.status !== "holiday" && !(l.status === "leave"));
  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="divide-y divide-gray-50">
      {workdays.slice().reverse().map((log) => {
        const [y, m, d] = log.date.split("-").map(Number);
        const dow = new Date(y, m - 1, d).getDay();
        const isPast = log.date <= todayStr;

        return (
          <div key={log.date} className={`flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors ${!isPast ? "opacity-40" : ""}`}>
            {/* Date */}
            <div className="flex-shrink-0 w-12 text-center">
              <p className="text-base font-extrabold text-gray-700 leading-none">{d}</p>
              <p className={`text-[10px] font-bold ${dow === 0 ? "text-rose-400" : dow === 6 ? "text-sky-400" : "text-gray-400"}`}>
                {DAYS_SHORT[dow]}
              </p>
            </div>

            {/* Status dot */}
            <StatusDot status={log.status} />

            {/* Times */}
            <div className="flex-1 min-w-0">
              {log.status === "leave" ? (
                <span className="text-xs font-bold text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">วันลา</span>
              ) : log.status === "absent" ? (
                isPast
                  ? <span className="text-xs font-bold text-rose-500">ไม่มีข้อมูล</span>
                  : <span className="text-xs text-gray-300">ยังไม่ถึงวัน</span>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-emerald-400">
                      <path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span className="text-xs font-bold text-gray-700">{log.checkIn}</span>
                  </div>
                  {log.checkOut && (
                    <>
                      <span className="text-gray-200 text-xs">→</span>
                      <div className="flex items-center gap-1">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-rose-400">
                          <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                        </svg>
                        <span className="text-xs font-bold text-gray-700">{log.checkOut}</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Badges */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {log.status === "late" && (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                  สาย
                </span>
              )}
              {log.otHours > 0 && (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                  OT +{log.otHours}h
                </span>
              )}
              {log.checkIn && (
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
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const today      = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [activeTab, setActiveTab] = useState<"calendar" | "list">("calendar");
  const [historyTab, setHistoryTab] = useState<"ot" | "leave">("ot");

  const logs = useMemo(() => generateMonthLogs(viewYear, viewMonth), [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  // ── Stats ────────────────────────────────────────────────────────────────
  const workdays     = logs.filter(l => !["holiday"].includes(l.status));
  const presentDays  = logs.filter(l => l.status === "on_time" || l.status === "late");
  const lateDays     = logs.filter(l => l.status === "late");
  const absentDays   = logs.filter(l => l.status === "absent");
  const leaveDays    = logs.filter(l => l.status === "leave");
  const reportSent   = logs.filter(l => l.isReportSent);
  const reportTotal  = logs.filter(l => l.checkIn !== null && l.status !== "leave");
  const otTotal      = logs.reduce((s, l) => s + l.otHours, 0);

  const avgCheckIn = (() => {
    const times = presentDays.map(l => l.checkIn!).filter(Boolean);
    if (!times.length) return "-";
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

  const leaveQuota = 10;
  const leaveUsed  = MOCK_LEAVE.filter(l => l.status === "approved").reduce((s, l) => s + l.days, 0);

  return (
    <main className="min-h-screen bg-gray-50 pb-28 md:pb-10">

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-gray-50/90 backdrop-blur-sm border-b border-gray-100">
        <div className="px-4 md:px-6 pt-5 pb-4">
          <p className="text-xs text-gray-400 font-medium">ช่างวิทย์ · #1055</p>
          <h1 className="text-xl font-extrabold text-gray-800">โปรไฟล์ & ประวัติการทำงาน</h1>
        </div>
      </div>

      <div className="px-4 md:px-6 pt-5 space-y-5">

        {/* ── Profile Card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-20 bg-gradient-to-r from-sky-400 to-blue-500 relative">
            {/* Decoration circles */}
            <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
            <div className="absolute right-8 -bottom-2 w-14 h-14 rounded-full bg-white/10" />
          </div>
          <div className="px-5 pb-5 -mt-8">
            <div className="flex items-end justify-between">
              {/* Avatar */}
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white text-2xl font-extrabold shadow-lg border-4 border-white">
                  ว
                </div>
                <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white" />
              </div>
              {/* Work type badges */}
              <div className="flex gap-1.5 pb-1">
                <span className="text-[10px] font-bold text-sky-600 bg-sky-50 border border-sky-200 px-2 py-1 rounded-full">
                  ช่างเทคนิค
                </span>
                <span className="text-[10px] font-bold text-gray-500 bg-gray-50 border border-gray-200 px-2 py-1 rounded-full">
                  #1055
                </span>
              </div>
            </div>
            <div className="mt-3">
              <h2 className="text-xl font-extrabold text-gray-800 leading-tight">ช่างวิทย์ สมบูรณ์</h2>
              <p className="text-sm text-gray-400 mt-0.5">Electrical Technician · แผนกช่างเทคนิค</p>
              <p className="text-xs text-gray-300 mt-0.5">witthawat@company.com</p>
            </div>

            {/* Quick stats strip */}
            <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-gray-50">
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
        </div>

        {/* ── Month Navigator ── */}
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
              {workdays.length} วันทำงาน · {presentDays.length} วันมา
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

        {/* ── Stat Cards Grid ── */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-emerald-600" style={{width:"20px",height:"20px"}}>
                <path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
            }
            label="วันมาทำงาน"
            value={`${presentDays.length} วัน`}
            sub={`ขาด ${absentDays.length} · ลา ${leaveDays.length}`}
            accent="bg-emerald-50"
          />
          <StatCard
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-sky-600" style={{width:"20px",height:"20px"}}>
                <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>
              </svg>
            }
            label="เวลาเข้าเฉลี่ย"
            value={avgCheckIn}
            sub={`มาสาย ${lateDays.length} วัน`}
            accent="bg-sky-50"
          />
          <StatCard
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-amber-600" style={{width:"20px",height:"20px"}}>
                <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/><path d="M17 3.5L21 7"/>
              </svg>
            }
            label="OT รวม"
            value={`${otTotal} h`}
            sub="เฉพาะเดือนนี้"
            accent="bg-amber-50"
          />
          <StatCard
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-violet-600" style={{width:"20px",height:"20px"}}>
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            }
            label="Daily Report"
            value={`${reportSent.length}/${reportTotal.length}`}
            sub={`${reportRate}% ส่งครบ`}
            accent="bg-violet-50"
          />
        </div>

        {/* ── Attendance Section ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Section Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-500 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4.5 h-4.5" style={{width:"18px",height:"18px"}}>
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <h3 className="text-sm font-bold text-gray-700">ประวัติเข้า-ออกงาน</h3>
            </div>

            {/* Tab Toggle */}
            <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
              <button
                onClick={() => setActiveTab("calendar")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === "calendar" ? "bg-white shadow-sm text-sky-600" : "text-gray-400 hover:text-gray-600"}`}
              >
                ปฏิทิน
              </button>
              <button
                onClick={() => setActiveTab("list")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === "list" ? "bg-white shadow-sm text-sky-600" : "text-gray-400 hover:text-gray-600"}`}
              >
                รายการ
              </button>
            </div>
          </div>

          {/* Content */}
          {activeTab === "calendar" ? (
            <div className="px-5 py-4">
              <AttendanceCalendar year={viewYear} month={viewMonth} logs={logs} />
            </div>
          ) : (
            <AttendanceList logs={logs} />
          )}
        </div>

        {/* ── Report Submission Heatmap ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-500 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4.5 h-4.5" style={{width:"18px",height:"18px"}}>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-700">Daily Report</h3>
                <p className="text-xs text-gray-400">ส่งแล้ว {reportSent.length}/{reportTotal.length} วัน</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-2xl font-extrabold text-violet-500 leading-none">{reportRate}%</p>
                <p className="text-[10px] text-gray-400">อัตราส่ง</p>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-violet-400 to-sky-400 rounded-full transition-all duration-500"
              style={{ width: `${reportRate}%` }}
            />
          </div>

          {/* Day-by-day grid */}
          <div className="grid grid-cols-7 gap-1">
            {logs.filter(l => l.status !== "holiday").map((log) => {
              const d = Number(log.date.split("-")[2]);
              const isWork = log.checkIn !== null;
              return (
                <div key={log.date} className="group relative">
                  <div className={`
                    h-7 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all
                    ${!isWork
                      ? "bg-gray-50 text-gray-300"
                      : log.isReportSent
                      ? "bg-violet-100 text-violet-600 hover:bg-violet-200"
                      : "bg-rose-50 text-rose-400 hover:bg-rose-100"
                    }
                  `}>
                    {d}
                  </div>
                  {/* Tooltip */}
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

        {/* ── OT & Leave History ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Tab Header */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setHistoryTab("ot")}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold transition-all border-b-2 ${
                historyTab === "ot"
                  ? "text-amber-600 border-amber-400 bg-amber-50/50"
                  : "text-gray-400 border-transparent hover:bg-gray-50"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/><path d="M17 3.5L21 7"/>
              </svg>
              ประวัติ OT
              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${historyTab === "ot" ? "bg-amber-100 text-amber-600" : "bg-gray-100 text-gray-400"}`}>
                {MOCK_OT.length}
              </span>
            </button>
            <button
              onClick={() => setHistoryTab("leave")}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold transition-all border-b-2 ${
                historyTab === "leave"
                  ? "text-violet-600 border-violet-400 bg-violet-50/50"
                  : "text-gray-400 border-transparent hover:bg-gray-50"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
              </svg>
              ประวัติการลา
              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${historyTab === "leave" ? "bg-violet-100 text-violet-600" : "bg-gray-100 text-gray-400"}`}>
                {MOCK_LEAVE.length}
              </span>
            </button>
          </div>

          {historyTab === "ot" ? (
            <OTHistory records={MOCK_OT} />
          ) : (
            <LeaveHistory records={MOCK_LEAVE} />
          )}
        </div>

        {/* ── Leave Quota Bar ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4.5 h-4.5" style={{width:"18px",height:"18px"}}>
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-700">โควต้าการลาประจำปี</h3>
              <p className="text-xs text-gray-400">ปี {today.getFullYear() + 543}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { type: "sick",     used: MOCK_LEAVE.filter(l => l.type === "sick"     && l.status === "approved").reduce((s, l) => s + l.days, 0), quota: 30 },
              { type: "annual",   used: MOCK_LEAVE.filter(l => l.type === "annual"   && l.status === "approved").reduce((s, l) => s + l.days, 0), quota: 10 },
              { type: "personal", used: MOCK_LEAVE.filter(l => l.type === "personal" && l.status === "approved").reduce((s, l) => s + l.days, 0), quota: 3 },
              { type: "emergency",used: 0, quota: 3 },
            ].map(item => {
              const cfg  = LEAVE_TYPE[item.type];
              const pct  = Math.round((item.used / item.quota) * 100);
              return (
                <div key={item.type} className={`p-3 rounded-xl border ${cfg.bg}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[10px] font-bold ${cfg.color}`}>{cfg.label}</span>
                    <span className={`text-xs font-extrabold ${cfg.color}`}>{item.used}/{item.quota}</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.type === "sick"      ? "bg-rose-400" :
                        item.type === "annual"    ? "bg-violet-400" :
                        item.type === "personal"  ? "bg-amber-400" : "bg-orange-400"
                      }`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <p className={`text-[9px] mt-1 font-medium ${cfg.color} opacity-70`}>
                    คงเหลือ {item.quota - item.used} วัน
                  </p>
                </div>
              );
            })}
          </div>
        </div>
 
      </div>
    </main>
  );
}