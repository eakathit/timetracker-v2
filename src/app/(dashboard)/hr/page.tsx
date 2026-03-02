"use client";

import { useState, useMemo } from "react";

// ════════════════════════════════════════════════════════
//  TYPES
// ════════════════════════════════════════════════════════
interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  department: string;
}

interface AttendanceStat {
  workdays: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  totalRegHours: number;
  totalOT: number;
  avgIn: string;
  avgOut: string;
}

interface DayLog {
  day: number;
  dow: number;
  date: string;
  status: "present" | "late" | "absent" | "leave";
  checkIn: string;
  checkOut: string;
}

// ════════════════════════════════════════════════════════
//  MOCK DATA  (แทนที่ด้วย Supabase query ทีหลัง)
// ════════════════════════════════════════════════════════
const MONTHS_TH = [
  "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน",
  "พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม",
  "กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม",
];
const DAYS_SHORT = ["อา","จ","อ","พ","พฤ","ศ","ส"];

const MOCK_EMPLOYEES: Employee[] = [
  { id: "1", first_name: "สมชาย",  last_name: "ใจดี",   department: "ช่างไฟฟ้า" },
  { id: "2", first_name: "วิชัย",  last_name: "มั่นคง",  department: "ช่างไฟฟ้า" },
  { id: "3", first_name: "อนุชา",  last_name: "สุขใส",   department: "ช่างกล" },
  { id: "4", first_name: "พิชัย",  last_name: "รักงาน",  department: "ช่างกล" },
  { id: "5", first_name: "ธนกร",   last_name: "เก่งมาก", department: "วิศวกรรม" },
  { id: "6", first_name: "สุภาพร", last_name: "ตั้งใจ",  department: "ธุรการ" },
];

function genAttendance(empId: string): AttendanceStat {
  const seed  = empId.charCodeAt(0);
  const workdays = 22;
  const present  = Math.min(workdays, Math.floor(workdays * 0.85 + (seed % 3)));
  const late     = seed % 4;
  const leave    = Math.floor(seed % 3);
  const absent   = workdays - present - leave;
  return {
    workdays,
    present,
    late,
    absent: Math.max(0, absent),
    leave,
    totalRegHours: present * 8 - late * 0.5,
    totalOT: (seed % 10) * 0.5,
    avgIn:  `0${7 + (seed % 2)}:${String(20 + (seed % 25)).padStart(2, "0")}`,
    avgOut: `17:${String(15 + (seed % 30)).padStart(2, "0")}`,
  };
}

function genDailyLogs(year: number, month: number): DayLog[] {
  const days = new Date(year, month + 1, 0).getDate();
  const logs: DayLog[] = [];
  // ใช้ seed ที่คงที่เพื่อให้ค่าไม่เปลี่ยนทุก render
  let rng = 42;
  const rand = () => { rng = (rng * 1664525 + 1013904223) & 0xffffffff; return (rng >>> 0) / 0xffffffff; };

  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month, d);
    const dow  = date.getDay();
    if (dow === 0 || dow === 6) continue;
    const r = rand();
    let status: DayLog["status"] = "present";
    let checkIn  = `08:${String(Math.floor(rand() * 20)).padStart(2,"0")}`;
    let checkOut = `17:${String(30 + Math.floor(rand() * 30)).padStart(2,"0")}`;
    if      (r < 0.06) { status = "absent"; checkIn = "–"; checkOut = "–"; }
    else if (r < 0.12) { status = "leave";  checkIn = "–"; checkOut = "–"; }
    else if (r < 0.25) { status = "late";   checkIn = `0${8 + Math.floor(rand())}:${String(30 + Math.floor(rand()*29)).padStart(2,"0")}`; }
    logs.push({
      day: d, dow,
      date: `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`,
      status, checkIn, checkOut,
    });
  }
  return logs;
}

// ════════════════════════════════════════════════════════
//  CONSTANTS
// ════════════════════════════════════════════════════════
const STATUS_DOT: Record<string, string> = {
  present: "bg-emerald-500",
  late:    "bg-amber-400",
  absent:  "bg-rose-400",
  leave:   "bg-violet-400",
};
const STATUS_CHIP: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700 border-emerald-200",
  late:    "bg-amber-50  text-amber-700  border-amber-200",
  absent:  "bg-rose-50   text-rose-600   border-rose-200",
  leave:   "bg-violet-50 text-violet-600 border-violet-200",
};
const STATUS_LABEL: Record<string, string> = {
  present: "ปกติ", late: "สาย", absent: "ขาด", leave: "ลา",
};
const AVATAR_GRAD = [
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-violet-400 to-purple-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
  "from-cyan-400 to-sky-500",
];

// ════════════════════════════════════════════════════════
//  SMALL COMPONENTS
// ════════════════════════════════════════════════════════
function StatCard({
  icon, label, value, sub, colorBg,
}: {
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
//  DRILL-DOWN PANEL (รายละเอียดรายบุคคล)
// ════════════════════════════════════════════════════════
function DrillDownPanel({
  emp, empIdx, year, month, onClose,
}: {
  emp: Employee; empIdx: number; year: number; month: number; onClose: () => void;
}) {
  const logs = useMemo(() => genDailyLogs(year, month), [year, month]);
  const att  = useMemo(() => genAttendance(emp.id), [emp.id]);
  const counts = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-2xl border border-sky-100 shadow-md overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50 bg-sky-50/50">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold bg-gradient-to-br ${AVATAR_GRAD[empIdx % AVATAR_GRAD.length]} shadow-sm flex-shrink-0`}>
          {emp.first_name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-gray-800 truncate">{emp.first_name} {emp.last_name}</p>
          <p className="text-xs text-gray-400">{emp.department} · {MONTHS_TH[month]} {year + 543}</p>
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

      {/* ── Mini stats ── */}
      <div className="grid grid-cols-4 divide-x divide-gray-50 border-b border-gray-50">
        {[
          { label: "มาปกติ", val: counts.present ?? 0, color: "text-emerald-600" },
          { label: "มาสาย",  val: counts.late    ?? 0, color: "text-amber-600" },
          { label: "ขาดงาน", val: counts.absent  ?? 0, color: "text-rose-500" },
          { label: "OT รวม", val: `${att.totalOT}h`,   color: "text-sky-600" },
        ].map(s => (
          <div key={s.label} className="flex flex-col items-center py-3 gap-0.5">
            <p className={`text-lg font-extrabold ${s.color}`}>{s.val}</p>
            <p className="text-[10px] text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Avg time ── */}
      <div className="flex items-center justify-around px-4 py-2.5 bg-gray-50/50 border-b border-gray-50 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">เข้าเฉลี่ย</span>
          <span className="font-extrabold text-sky-600">{att.avgIn}</span>
        </div>
        <div className="w-px h-4 bg-gray-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">ออกเฉลี่ย</span>
          <span className="font-extrabold text-gray-700">{att.avgOut}</span>
        </div>
        <div className="w-px h-4 bg-gray-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">ชม.ปกติ</span>
          <span className="font-extrabold text-gray-700">{att.totalRegHours}h</span>
        </div>
      </div>

      {/* ── Daily log ── */}
      <div className="max-h-[340px] overflow-y-auto divide-y divide-gray-50">
        {logs.map(log => (
          <div key={log.day} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50/50 transition-colors">
            {/* Date */}
            <div className="w-10 text-center flex-shrink-0">
              <p className="text-sm font-extrabold text-gray-700 leading-none">{log.day}</p>
              <p className={`text-[10px] font-bold ${log.dow === 0 ? "text-rose-400" : log.dow === 6 ? "text-sky-400" : "text-gray-400"}`}>
                {DAYS_SHORT[log.dow]}
              </p>
            </div>
            {/* Status dot */}
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[log.status]}`} />
            {/* Chip */}
            <div className="flex-1">
              <span className={`inline-flex px-2 py-0.5 rounded-lg border text-[10px] font-bold ${STATUS_CHIP[log.status]}`}>
                {STATUS_LABEL[log.status]}
              </span>
            </div>
            {/* Time */}
            {log.checkIn !== "–" ? (
              <div className="flex items-center gap-1.5 text-xs flex-shrink-0">
                <span className="font-bold text-sky-600">{log.checkIn}</span>
                <span className="text-gray-300">→</span>
                <span className="font-bold text-gray-600">{log.checkOut}</span>
              </div>
            ) : (
              <span className="text-xs text-gray-300 flex-shrink-0">–</span>
            )}
          </div>
        ))}
      </div>

      {/* ── Footer export ── */}
      <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/50 flex justify-end">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold shadow-sm hover:bg-emerald-600 transition-colors">
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
  const [viewYear,   setViewYear]   = useState(today.getFullYear());
  const [viewMonth,  setViewMonth]  = useState(today.getMonth());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterDept, setFilterDept] = useState("all");

  // ── Derived data ──────────────────────────────────────
  const depts = useMemo(() => {
    const s = new Set(MOCK_EMPLOYEES.map(e => e.department));
    return ["all", ...Array.from(s)];
  }, []);

  const filtered = filterDept === "all"
    ? MOCK_EMPLOYEES
    : MOCK_EMPLOYEES.filter(e => e.department === filterDept);

  const attendances = useMemo(() =>
    Object.fromEntries(MOCK_EMPLOYEES.map(e => [e.id, genAttendance(e.id)])),
  []);

  // ── Aggregate stats ───────────────────────────────────
  const agg = useMemo(() => ({
    present: Object.values(attendances).reduce((s, a) => s + a.present, 0),
    late:    Object.values(attendances).reduce((s, a) => s + a.late,    0),
    absent:  Object.values(attendances).reduce((s, a) => s + a.absent,  0),
    ot:      Object.values(attendances).reduce((s, a) => s + a.totalOT, 0),
  }), [attendances]);

  // ── Month navigation ──────────────────────────────────
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const selectedEmp = selectedId ? MOCK_EMPLOYEES.find(e => e.id === selectedId) ?? null : null;
  const selectedIdx = MOCK_EMPLOYEES.findIndex(e => e.id === selectedId);

  // ════════════════════════════════════════════════════════
  return (
    <main className="min-h-screen bg-gray-50 pb-28 md:pb-10">

      {/* ╔══════════════════════════════════════════════╗
          ║  STICKY HEADER                               ║
          ╚══════════════════════════════════════════════╝ */}
      <div className="sticky top-0 z-20 bg-gray-50/90 backdrop-blur-sm border-b border-gray-100">

        {/* Title row */}
        <div className="flex items-center justify-between px-4 md:px-6 pt-4 pb-1 gap-3">
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Admin · HR</p>
            <h1 className="text-xl font-extrabold text-gray-800 leading-tight">Attendance Summary</h1>
          </div>
          {/* Export button */}
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold shadow-sm hover:bg-emerald-600 active:scale-95 transition-all">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span className="hidden sm:inline">Export Excel</span>
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

      <div className="px-4 md:px-6 pt-5 space-y-5">

        {/* ╔══════════════════════════════════════════════╗
            ║  STAT CARDS                                  ║
            ╚══════════════════════════════════════════════╝ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            colorBg="bg-emerald-50 text-emerald-500"
            label="วันมาทำงาน (รวม)"
            value={agg.present}
            sub={`${MOCK_EMPLOYEES.length} พนักงาน`}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            }
          />
          <StatCard
            colorBg="bg-amber-50 text-amber-500"
            label="มาสาย (ครั้งรวม)"
            value={agg.late}
            sub="ทุกพนักงาน"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            }
          />
          <StatCard
            colorBg="bg-rose-50 text-rose-500"
            label="ขาดงาน (ครั้งรวม)"
            value={agg.absent}
            sub="ทุกพนักงาน"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            }
          />
          <StatCard
            colorBg="bg-sky-50 text-sky-500"
            label="ชั่วโมง OT รวม"
            value={`${agg.ot}h`}
            sub="ทุกพนักงาน"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            }
          />
        </div>

        {/* ╔══════════════════════════════════════════════╗
            ║  EMPLOYEE TABLE  +  DRILL-DOWN               ║
            ╚══════════════════════════════════════════════╝ */}
        <div className={`grid gap-4 ${selectedEmp ? "grid-cols-1 lg:grid-cols-5" : "grid-cols-1"}`}>

          {/* Employee list */}
          <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${selectedEmp ? "lg:col-span-3" : ""}`}>

            {/* Table header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-500 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                    <path d="M16 3.13a4 4 0 010 7.75"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-gray-700">รายชื่อพนักงาน</h3>
                  <p className="text-xs text-gray-400">{filtered.length} คน · คลิกเพื่อดูรายละเอียด</p>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <span>มา / ทั้งหมด</span>
                <span>สถานะ</span>
                <span>OT</span>
              </div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-50">
              {filtered.map((emp, idx) => {
                const att = attendances[emp.id];
                const pct = Math.round((att.present / att.workdays) * 100);
                const isSelected = selectedId === emp.id;
                return (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedId(isSelected ? null : emp.id)}
                    className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all border-b border-gray-50 last:border-0 ${isSelected ? "bg-sky-50" : "hover:bg-sky-50/40"}`}
                  >
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-extrabold flex-shrink-0 bg-gradient-to-br ${AVATAR_GRAD[idx % AVATAR_GRAD.length]} shadow-sm`}>
                      {emp.first_name.charAt(0)}
                    </div>
                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-700 truncate">{emp.first_name} {emp.last_name}</p>
                      <p className="text-[11px] text-gray-400">{emp.department}</p>
                    </div>
                    {/* Presence bar */}
                    <div className="hidden sm:flex flex-col items-end gap-1 min-w-[64px]">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-gray-700">{att.present}</span>
                        <span className="text-[10px] text-gray-400">/{att.workdays}</span>
                      </div>
                      <div className="w-14 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    {/* Status chips */}
                    <div className="hidden md:flex items-center gap-1.5">
                      {att.late > 0 && (
                        <span className="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">สาย {att.late}</span>
                      )}
                      {att.absent > 0 && (
                        <span className="px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-bold">ขาด {att.absent}</span>
                      )}
                    </div>
                    {/* OT */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-extrabold text-sky-600">{att.totalOT > 0 ? `+${att.totalOT}h` : "–"}</p>
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
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-5 py-3 border-t border-gray-50 bg-gray-50/50">
              {[
                { c: "bg-emerald-400", l: "ปกติ" },
                { c: "bg-amber-400",   l: "สาย" },
                { c: "bg-rose-400",    l: "ขาด" },
                { c: "bg-violet-400",  l: "ลา" },
              ].map(i => (
                <div key={i.l} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${i.c}`} />
                  <span className="text-[10px] text-gray-400 font-medium">{i.l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Drill-down panel */}
          {selectedEmp && (
            <div className="lg:col-span-2">
              <DrillDownPanel
                emp={selectedEmp}
                empIdx={selectedIdx}
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
              <p className="text-xs text-gray-400">อัตราการมาทำงานรายแผนก</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {Array.from(new Set(MOCK_EMPLOYEES.map(e => e.department))).map(dept => {
              const emps  = MOCK_EMPLOYEES.filter(e => e.department === dept);
              const total = emps.reduce((s, e) => s + attendances[e.id].present,  0);
              const max   = emps.reduce((s, e) => s + attendances[e.id].workdays, 0);
              const late  = emps.reduce((s, e) => s + attendances[e.id].late,     0);
              const pct   = Math.round((total / max) * 100);
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

      </div>
    </main>
  );
}