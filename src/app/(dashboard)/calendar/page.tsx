"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
// ─── Types ────────────────────────────────────────────────────────────────────
interface Holiday {
  id: string;
  date: string; // "YYYY-MM-DD"
  name: string;
  type: "national" | "company" | "special" | "working_sat";
}

interface Plan {
  id: string;
  date: string;
  time: string;
  title: string;
  category: "meeting" | "task" | "travel" | "training" | "other";
  note?: string;
  userId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS_TH = [
  "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน",
  "พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม",
  "กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม",
];
const DAYS_SHORT = ["อา","จ","อ","พ","พฤ","ศ","ส"];

const CATEGORY_CONFIG = {
  meeting:  { label: "Meeting",  color: "bg-sky-500",     light: "bg-sky-50   text-sky-600   border-sky-200",   dot: "bg-sky-500"   },
  task:     { label: "Task",     color: "bg-violet-500",  light: "bg-violet-50 text-violet-600 border-violet-200", dot: "bg-violet-500" },
  travel:   { label: "Travel",   color: "bg-amber-500",   light: "bg-amber-50  text-amber-600  border-amber-200",  dot: "bg-amber-500"  },
  training: { label: "Training", color: "bg-emerald-500", light: "bg-emerald-50 text-emerald-600 border-emerald-200", dot: "bg-emerald-500" },
  other:    { label: "อื่นๆ",    color: "bg-gray-400",   light: "bg-gray-50   text-gray-600   border-gray-200",   dot: "bg-gray-400"   },
};

const HOLIDAY_TYPE_CONFIG = {
  national:    { label: "วันหยุดนักขัตฤกษ์", color: "bg-rose-100 text-rose-600 border-rose-200",     dot: "bg-rose-500"   },
  company:     { label: "วันหยุดบริษัท",      color: "bg-orange-100 text-orange-600 border-orange-200",   dot: "bg-orange-500" },
  special:     { label: "วันพิเศษ",           color: "bg-purple-100 text-purple-600 border-purple-200",   dot: "bg-purple-500" },
  working_sat: { label: "เสาร์ทำงาน",         color: "bg-sky-100 text-sky-600 border-sky-200",         dot: "bg-sky-500"   },
};

// ─── Helper ───────────────────────────────────────────────────────────────────
const fmt = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const parseDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// ─── Day Detail Panel ─────────────────────────────────────────────────────────
function DayPanel({
  date,
  holidays,
  plans,
  onClose,
  onAddPlan,
  onDeletePlan,
}: {
  date: Date;
  holidays: Holiday[];
  plans: Plan[];
  onClose: () => void;
  onAddPlan: (plan: Omit<Plan, "id" | "userId">) => void;
  onDeletePlan: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    time: "09:00",
    category: "meeting" as Plan["category"],
    note: "",
  });
  const panelRef = useRef<HTMLDivElement>(null);

  const dateStr = fmt(date);
  const dayHolidays = holidays.filter((h) => h.date === dateStr);
  const dayPlans = plans
    .filter((p) => p.date === dateStr)
    .sort((a, b) => a.time.localeCompare(b.time));

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    onAddPlan({ date: dateStr, time: form.time, title: form.title, category: form.category, note: form.note });
    setForm({ title: "", time: "09:00", category: "meeting", note: "" });
    setShowForm(false);
  };

  const thDay = ["วันอาทิตย์","วันจันทร์","วันอังคาร","วันพุธ","วันพฤหัสบดี","วันศุกร์","วันเสาร์"];

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-full md:w-[440px] max-h-[85vh] bg-white rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 md:slide-in-from-bottom-0 md:fade-in duration-200"
      >
        {/* Handle (mobile) */}
        <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-3 pb-4 flex-shrink-0 border-b border-gray-50">
          <div>
            <p className="text-xs text-gray-400 font-medium">{thDay[date.getDay()]}</p>
            <h2 className="text-2xl font-extrabold text-gray-800 leading-none">
              {date.getDate()} {MONTHS_TH[date.getMonth()]}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{date.getFullYear() + 543}</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors mt-1"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Holidays */}
          {dayHolidays.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">วันหยุด / เสาร์ทำงาน</p>
              {dayHolidays.map((h) => (
                <div key={h.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm font-semibold ${HOLIDAY_TYPE_CONFIG[h.type].color}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 flex-shrink-0">
                    <circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 3" />
                  </svg>
                  <span>{h.name}</span>
                  <span className="ml-auto text-[10px] font-medium opacity-70">{HOLIDAY_TYPE_CONFIG[h.type].label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Plans */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                แผนงาน ({dayPlans.length})
              </p>
              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-1 text-xs font-bold text-sky-500 hover:text-sky-600 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                เพิ่มแผน
              </button>
            </div>

            {/* Add Plan Form */}
            {showForm && (
              <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-bold text-sky-700">เพิ่มแผนงานใหม่</p>

                {/* Title */}
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="ชื่อกิจกรรม เช่น Meeting ลูกค้า..."
                  className="w-full px-3 py-2.5 text-sm bg-white border border-sky-200 rounded-xl outline-none focus:border-sky-400 placeholder-gray-300 transition-colors"
                  autoFocus
                />

                {/* Time + Category */}
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                    className="flex-1 px-3 py-2.5 text-sm bg-white border border-sky-200 rounded-xl outline-none focus:border-sky-400 transition-colors"
                  />
                  <div className="relative flex-1">
                    <select
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Plan["category"] }))}
                      className="w-full appearance-none px-3 py-2.5 pr-8 text-sm bg-white border border-sky-200 rounded-xl outline-none focus:border-sky-400 transition-colors cursor-pointer"
                    >
                      {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </span>
                  </div>
                </div>

                {/* Note */}
                <input
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="หมายเหตุ (ไม่บังคับ)..."
                  className="w-full px-3 py-2.5 text-sm bg-white border border-sky-200 rounded-xl outline-none focus:border-sky-400 placeholder-gray-300 transition-colors"
                />

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!form.title.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-sky-500 text-white text-sm font-bold hover:bg-sky-600 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
                  >
                    บันทึก
                  </button>
                </div>
              </div>
            )}

            {/* Plan list */}
            {dayPlans.length === 0 && !showForm ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-gray-300">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-400">ยังไม่มีแผนงาน</p>
                <p className="text-xs text-gray-300 mt-1">กด "+ เพิ่มแผน" เพื่อเพิ่มกิจกรรม</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dayPlans.map((plan) => {
                  const cat = CATEGORY_CONFIG[plan.category];
                  return (
                    <div key={plan.id} className="group flex items-start gap-3 bg-white rounded-xl border border-gray-100 shadow-sm p-3 hover:shadow-md transition-all duration-200">
                      {/* Time column */}
                      <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                        <span className={`w-2 h-2 rounded-full mt-1 ${cat.dot}`} />
                        <span className="text-xs font-bold text-gray-500 mt-1 tabular-nums">{plan.time}</span>
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 leading-tight">{plan.title}</p>
                        {plan.note && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{plan.note}</p>
                        )}
                        <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cat.light}`}>
                          {cat.label}
                        </span>
                      </div>
                      {/* Delete */}
                      <button
                        onClick={() => onDeletePlan(plan.id)}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg hover:bg-rose-50 flex items-center justify-center text-gray-300 hover:text-rose-400 transition-all flex-shrink-0"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar Grid (Main) ─────────────────────────────────────────────────────
function CalendarGrid({
  year,
  month,
  holidays,
  plans,
  onSelectDay,
}: {
  year: number;
  month: number;
  holidays: Holiday[];
  plans: Plan[];
  onSelectDay: (d: Date) => void;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = fmt(today);

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {DAYS_SHORT.map((d, i) => (
          <div
            key={d}
            className={`
              text-center text-xs font-bold py-3
              ${i === 0 ? "text-rose-500" : i === 6 ? "text-sky-500" : "text-gray-500"}
              ${i < 6 ? "border-r border-gray-100" : ""}
            `}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid rows */}
      <div className="grid grid-cols-7 divide-x divide-gray-100"
        style={{ gridAutoRows: "1fr" }}
      >
        {cells.map((day, idx) => {
          const col = idx % 7;
          const isLastInRow = col === 6;
          const rowStart = Math.floor(idx / 7) * 7;
          const isLastRow = rowStart + 7 >= cells.length;

          if (!day) {
            return (
              <div
                key={`e-${idx}`}
                className={`
                  min-h-[90px] md:min-h-[110px] bg-gray-50/50
                  ${!isLastRow ? "border-b border-gray-100" : ""}
                `}
              />
            );
          }

          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = dateStr === todayStr;
          const dayHolidays = holidays.filter((h) => h.date === dateStr);
          const dayPlans = plans.filter((p) => p.date === dateStr).sort((a, b) => a.time.localeCompare(b.time));
          
          const isNationalHoliday = dayHolidays.some((h) => h.type === "national");
          const isCompanyHoliday = dayHolidays.some((h) => h.type === "company");
          const isSpecialHoliday = dayHolidays.some((h) => h.type === "special");
          const isWorkingSat = dayHolidays.some((h) => h.type === "working_sat");
          const isHoliday = dayHolidays.length > 0;
          const isSun = col === 0;
          const isSat = col === 6;

          return (
            <button
              key={day}
              onClick={() => onSelectDay(new Date(year, month, day))}
              className={`
                relative min-h-[90px] md:min-h-[110px] p-2 text-left
                flex flex-col gap-1
                transition-all duration-150 group
                ${!isLastRow ? "border-b border-gray-100" : ""}
                ${isToday
                  ? "bg-sky-50"
                  : isNationalHoliday || isSpecialHoliday
                  ? "bg-rose-50/60"
                  : isCompanyHoliday
                  ? "bg-orange-50/50"
                  : isSun
                  ? "bg-red-50/30 hover:bg-red-50/60"
                  : isSat && !isWorkingSat
                  ? "bg-sky-50/30 hover:bg-sky-50/60"
                  : "bg-white hover:bg-slate-50"
                }
                hover:z-10
              `}
            >
              {/* Today accent line */}
              {isToday && (
                <span className="absolute top-0 left-0 right-0 h-0.5 bg-sky-500 rounded-b" />
              )}

              {/* Day number */}
              <span className={`
                w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0
                transition-colors
                ${isToday
                  ? "bg-sky-500 text-white shadow-sm"
                  : isNationalHoliday || isSpecialHoliday ? "text-rose-500"
                  : isCompanyHoliday ? "text-orange-500"
                  : isSun ? "text-rose-400"
                  : isSat && !isWorkingSat ? "text-sky-500"
                  : "text-gray-800"
                }
                group-hover:ring-2 group-hover:ring-sky-200
              `}>
                {day}
              </span>

              {/* Holiday badge */}
              {isHoliday && (
                <span className={`
                  hidden md:block text-[9px] font-bold truncate leading-tight px-1.5 py-0.5 rounded-md w-full
                  ${isWorkingSat 
                    ? "text-sky-600 bg-sky-100" 
                    : isNationalHoliday || isSpecialHoliday
                    ? "text-rose-600 bg-rose-100"
                    : "text-orange-600 bg-orange-100"
                  }
                `}>
                  {dayHolidays[0].name}
                </span>
              )}

              {/* Plan pills */}
              <div className="flex flex-col gap-0.5 w-full">
                {dayPlans.slice(0, 2).map((plan) => (
                  <span
                    key={plan.id}
                    className={`
                      hidden md:flex items-center gap-1
                      text-[9px] font-semibold px-1.5 py-1 rounded-md truncate w-full leading-none
                      border ${CATEGORY_CONFIG[plan.category].light}
                    `}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${CATEGORY_CONFIG[plan.category].dot}`} />
                    <span className="truncate">{plan.time} {plan.title}</span>
                  </span>
                ))}
                {dayPlans.length > 2 && (
                  <span className="hidden md:block text-[9px] text-gray-400 font-semibold px-1.5">
                    +{dayPlans.length - 2} อื่นๆ
                  </span>
                )}
              </div>

              {/* Mobile dots */}
              {dayPlans.length > 0 && (
                <div className="md:hidden flex gap-0.5 mt-auto flex-wrap">
                  {dayPlans.slice(0, 4).map((plan) => (
                    <span key={plan.id} className={`w-1.5 h-1.5 rounded-full ${CATEGORY_CONFIG[plan.category].dot}`} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // ในสถานการณ์จริง ข้อมูล holidays ตรงนี้จะถูกดึงมาจาก Database (Supabase) เหมือนหน้า Settings
  const [holidays, setHolidays]   = useState<Holiday[]>([]);
  const [plans, setPlans]         = useState<Plan[]>([]); // Plans ก็สามารถทำแบบเดียวกันในอนาคต
  const [view, setView] = useState<"month" | "list">("month");

  useEffect(() => {
    const fetchHolidays = async () => {
      const { data, error } = await supabase.from("holidays").select("*");
      if (data && !error) {
        // Map ข้อมูล Database ให้ตรงกับ Interface Holiday ของ Calendar
        const mappedHolidays: Holiday[] = data.map((h: any) => ({
          id: h.id.toString(),
          date: h.holiday_date,
          name: h.name,
          type: h.holiday_type as "national" | "company" | "special" | "working_sat"
        }));
        setHolidays(mappedHolidays);
      }
    };

    fetchHolidays();
  }, []);
  
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };
  const goToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); };

  const addPlan = (plan: Omit<Plan, "id" | "userId">) => {
    setPlans((prev) => [...prev, { ...plan, id: Date.now().toString(), userId: "current" }]);
  };
  const deletePlan = (id: string) => setPlans((prev) => prev.filter((p) => p.id !== id));

  // Month stats
  const monthStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
  const monthHolidays = holidays.filter((h) => h.date.startsWith(monthStr));
  const monthPlans = plans.filter((p) => p.date.startsWith(monthStr));

  // List view: group plans by date
  const listDays = Array.from(new Set(monthPlans.map((p) => p.date))).sort();

  return (
    <main className="min-h-screen bg-gray-50 pb-28 md:pb-10">

      {/* ── Top Header ── */}
      <div className="sticky top-0 z-20 bg-gray-50/90 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center justify-between px-4 md:px-6 pt-4 pb-3 gap-3">
          {/* Left: title */}
          <div>
            <h1 className="text-xl font-extrabold text-gray-800 leading-tight">ปฏิทิน</h1>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
              <button
                onClick={() => setView("month")}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${view === "month" ? "bg-white shadow-sm text-sky-500" : "text-gray-400 hover:text-gray-600"}`}
                title="Month view"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </button>
              <button
                onClick={() => setView("list")}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${view === "list" ? "bg-white shadow-sm text-sky-500" : "text-gray-400 hover:text-gray-600"}`}
                title="List view"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between px-4 md:px-6 pb-3">
          <button
            onClick={prevMonth}
            className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <div className="text-center">
            <h2 className="text-lg font-extrabold text-gray-800 leading-tight">
              {MONTHS_TH[viewMonth]} {viewYear + 543}
            </h2>
            <div className="flex items-center justify-center gap-2 mt-0.5">
              <span className="text-xs text-gray-400">{monthHolidays.length} วันพิเศษ</span>
              <span className="text-gray-200">·</span>
              <span className="text-xs text-gray-400">{monthPlans.length} แผนงาน</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={goToday}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-sky-600 bg-sky-50 hover:bg-sky-100 transition-colors border border-sky-200"
            >
              วันนี้
            </button>
            <button
              onClick={nextMonth}
              className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Calendar / List ── */}
      <div className="px-3 md:px-4 pt-4">

        {view === "month" ? (
          <CalendarGrid
            year={viewYear}
            month={viewMonth}
            holidays={holidays}
            plans={plans}
            onSelectDay={setSelectedDate}
          />
          ) : (
            /* ── LIST VIEW ── */
            <div className="space-y-4">
              {listDays.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center mb-4">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-gray-300">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-400">ไม่มีแผนงานในเดือนนี้</p>
                  <p className="text-xs text-gray-300 mt-1">กลับไปหน้า Month เพื่อคลิกวันและเพิ่มแผน</p>
                </div>
              ) : (
                listDays.map((dateStr) => {
                  const d = parseDate(dateStr);
                  const dayPlans = plans
                    .filter((p) => p.date === dateStr)
                    .sort((a, b) => a.time.localeCompare(b.time));
                  const dayHolidays = holidays.filter((h) => h.date === dateStr);
                  const isToday = dateStr === fmt(today);

                  return (
                    <div key={dateStr}>
                      {/* Date header */}
                      <div className={`flex items-center gap-3 mb-2 ${isToday ? "" : ""}`}>
                        <div className={`
                          w-12 h-12 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 shadow-sm
                          ${isToday ? "bg-sky-500 text-white" : "bg-white text-gray-700 border border-gray-100"}
                        `}>
                          <span className="text-lg font-extrabold leading-none">{d.getDate()}</span>
                          <span className="text-[9px] font-bold leading-none mt-0.5 opacity-70">
                            {DAYS_SHORT[d.getDay()]}
                          </span>
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${isToday ? "text-sky-600" : "text-gray-700"}`}>
                            {d.getDate()} {MONTHS_TH[d.getMonth()]} {d.getFullYear() + 543}
                          </p>
                          {dayHolidays.map((h) => (
                            <span key={h.id} className={`inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-md border mr-1 ${HOLIDAY_TYPE_CONFIG[h.type].color}`}>
                              {h.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Plans */}
                      <div className="ml-15 space-y-2 ml-0 pl-15" style={{ paddingLeft: "60px" }}>
                        {dayPlans.map((plan) => {
                          const cat = CATEGORY_CONFIG[plan.category];
                          return (
                            <div key={plan.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
                              <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${cat.dot}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-gray-500 tabular-nums">{plan.time}</span>
                                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${cat.light}`}>{cat.label}</span>
                                </div>
                                <p className="text-sm font-semibold text-gray-800 mt-0.5">{plan.title}</p>
                                {plan.note && <p className="text-xs text-gray-400 mt-0.5">{plan.note}</p>}
                              </div>
                              <button
                                onClick={() => deletePlan(plan.id)}
                                className="w-8 h-8 rounded-lg hover:bg-rose-50 flex items-center justify-center text-gray-300 hover:text-rose-400 transition-colors flex-shrink-0"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                                </svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

      {/* ── Add Plan FAB ── */}
      <button
        onClick={() => setSelectedDate(today)}
        className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-30 w-14 h-14 rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-300/50 flex items-center justify-center hover:bg-sky-600 transition-all active:scale-90"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-6 h-6">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* ── Day Detail Panel ── */}
      {selectedDate && (
        <DayPanel
          date={selectedDate}
          holidays={holidays}
          plans={plans}
          onClose={() => setSelectedDate(null)}
          onAddPlan={addPlan}
          onDeletePlan={deletePlan}
        />
      )}
    </main>
  );
}