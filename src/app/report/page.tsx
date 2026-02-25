"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// ─── Data ─────────────────────────────────────────────────────────────────────
const PERIOD_OPTIONS = [
  { value: "08:30-17:30", label: "ALL (08:30 – 17:30)" },
  { value: "08:30-12:00", label: "HALF DAY (08:30 – 12:00)" },
  { value: "13:00-17:30", label: "HALF DAY (13:00 – 17:30)" },
  { value: "some_time", label: "SOME TIME" },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface ReportEntry {
  id: string;
  detailId: string;
  endUserId: string;
  projectId: string;
  period: string;
  startTime?: string;
  endTime?: string;
}

// ─── Calendar Popup ───────────────────────────────────────────────────────────
const DAYS_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTHS_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function CalendarPopup({
  selected,
  onSelect,
  onClose,
}: {
  selected: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
}) {
  const [viewing, setViewing] = useState(new Date(selected));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const year = viewing.getFullYear();
  const month = viewing.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const isSelected = (d: number) =>
    selected.getDate() === d && selected.getMonth() === month && selected.getFullYear() === year;

  const isToday = (d: number) =>
    today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;

  const handleSelect = (day: number) => {
    onSelect(new Date(year, month, day));
    onClose();
  };

  return (
    <div
      ref={ref}
      className="
        absolute top-full left-0 mt-2 z-50
        w-72 bg-white rounded-2xl shadow-2xl shadow-gray-200/80
        border border-gray-100 p-4
        animate-in fade-in slide-in-from-top-2 duration-150
      "
    >
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setViewing(new Date(year, month - 1, 1))} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <span className="font-bold text-gray-800 text-sm">{MONTHS_TH[month]} {year + 543}</span>
        <button onClick={() => setViewing(new Date(year, month + 1, 1))} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAYS_TH.map((d, i) => (
          <div key={d} className={`text-center text-[10px] font-bold pb-2 ${i === 0 ? "text-rose-400" : i === 6 ? "text-sky-400" : "text-gray-400"}`}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />;
          const col = idx % 7;
          return (
            <button
              key={day} onClick={() => handleSelect(day)}
              className={`
                relative mx-auto w-9 h-9 rounded-xl text-xs font-medium flex items-center justify-center transition-all duration-100
                ${isSelected(day) ? "bg-sky-500 text-white shadow-md shadow-sky-200 scale-105" : isToday(day) ? "bg-sky-50 text-sky-600 font-bold ring-1 ring-sky-200" : col === 0 ? "text-rose-400 hover:bg-rose-50" : col === 6 ? "text-sky-500 hover:bg-sky-50" : "text-gray-700 hover:bg-gray-100"}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <button onClick={() => setViewing(new Date())} className="text-xs text-gray-400 hover:text-sky-500 font-medium transition-colors">ล้าง</button>
        <button onClick={() => { onSelect(new Date()); onClose(); }} className="text-xs text-sky-500 hover:text-sky-600 font-bold transition-colors">วันนี้</button>
      </div>
    </div>
  );
}

// ─── Custom Select ────────────────────────────────────────────────────────────
function SelectField({
  label, icon, value, options, placeholder, onChange, disabled = false
}: {
  label: string; icon: React.ReactNode; value: string; options: { value: string; label: string }[]; placeholder: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {icon}
        {label}
      </label>
      <div className="relative">
        <select
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`
            w-full appearance-none px-4 py-3 pr-10 rounded-xl border text-sm font-medium
            transition-all duration-200 outline-none
            ${disabled ? "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed" : "cursor-pointer"}
            ${!disabled && value ? "border-sky-300 bg-sky-50/50 text-gray-800" : ""}
            ${!disabled && !value ? "border-gray-200 bg-white text-gray-400" : ""}
            ${!disabled ? "hover:border-sky-300 focus:border-sky-400 focus:ring-2 focus:ring-sky-100" : ""}
          `}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${value && !disabled ? "text-sky-400" : "text-gray-300"}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>
    </div>
  );
}

// ─── Entry Card ───────────────────────────────────────────────────────────────
function EntryCard({
  entry, index, total, dbEndUsers, dbProjects, dbDetails, onChange, onRemove,
}: {
  entry: ReportEntry; index: number; total: number;
  dbEndUsers: any[]; dbProjects: any[]; dbDetails: any[];
  onChange: (id: string, field: keyof ReportEntry, value: string) => void;
  onRemove: (id: string) => void;
}) {
  const detailLabel = dbDetails.find((o) => o.id === entry.detailId)?.title;
  let periodLabel = PERIOD_OPTIONS.find((o) => o.value === entry.period)?.label;
  if (entry.period === "some_time" && entry.startTime && entry.endTime) {
    periodLabel = `${entry.startTime} - ${entry.endTime} น.`;
  }
  
  const isComplete = entry.detailId && entry.endUserId && entry.projectId && entry.period && 
                     (entry.period !== "some_time" || (entry.startTime && entry.endTime));

  // Cascading Project Options
  const projectOptions = dbProjects
    .filter(p => p.end_user_id === entry.endUserId)
    .map(p => ({ value: p.id, label: `${p.project_no} · ${p.name || ''}` }));

  return (
    <div className={`
      relative bg-white rounded-2xl border-2 p-5 transition-all duration-300
      ${isComplete ? "border-sky-200 shadow-sm shadow-sky-100" : "border-gray-100"}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`
            w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold
            ${isComplete ? "bg-sky-500 text-white" : "bg-gray-100 text-gray-400"}
          `}>
            {index + 1}
          </span>
          <span className="text-sm font-semibold text-gray-600">
            {isComplete ? detailLabel : "งาน #" + (index + 1)}
          </span>
          {isComplete && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {periodLabel?.split(" (")[0]}
            </span>
          )}
        </div>
        {total > 1 && (
          <button onClick={() => onRemove(entry.id)} className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        )}
      </div>

      {/* Fields */}
      <div className="space-y-3">
        <SelectField
          label="Detail"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>}
          value={entry.detailId}
          options={dbDetails.map(d => ({ value: d.id, label: d.title }))}
          placeholder="เลือกประเภทงาน..."
          onChange={(v) => onChange(entry.id, "detailId", v)}
        />
        
        <SelectField
          label="End User"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M3 21h18"/><path d="M9 8h1"/><path d="M9 12h1"/><path d="M9 16h1"/><path d="M14 8h1"/><path d="M14 12h1"/><path d="M14 16h1"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/></svg>}
          value={entry.endUserId}
          options={dbEndUsers.map(u => ({ value: u.id, label: u.name }))}
          placeholder="เลือกลูกค้า..."
          onChange={(v) => {
            onChange(entry.id, "endUserId", v);
            onChange(entry.id, "projectId", ""); // Reset Project
          }}
        />

        <SelectField
          label="Project No."
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>}
          value={entry.projectId}
          options={projectOptions}
          placeholder="เลือกโปรเจค..."
          disabled={!entry.endUserId}
          onChange={(v) => onChange(entry.id, "projectId", v)}
        />

        <SelectField
          label="Working Period"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>}
          value={entry.period}
          options={PERIOD_OPTIONS}
          placeholder="เลือกช่วงเวลา..."
          onChange={(v) => onChange(entry.id, "period", v)}
        />

        {/* Some Time Inputs (UI กลมกลืนกับเดิม) */}
        {entry.period === "some_time" && (
          <div className="flex items-center gap-3 pt-1 animate-in slide-in-from-top-1 fade-in duration-200">
            <div className="flex-1 relative">
              <input
                type="time" value={entry.startTime || ""} onChange={(e) => onChange(entry.id, "startTime", e.target.value)}
                className="w-full appearance-none px-4 py-2.5 rounded-xl border border-sky-200 bg-sky-50/30 text-sm font-medium text-gray-700 outline-none hover:border-sky-300 focus:border-sky-400 transition-all"
              />
            </div>
            <span className="text-gray-300 font-bold">-</span>
            <div className="flex-1 relative">
              <input
                type="time" value={entry.endTime || ""} onChange={(e) => onChange(entry.id, "endTime", e.target.value)}
                className="w-full appearance-none px-4 py-2.5 rounded-xl border border-sky-200 bg-sky-50/30 text-sm font-medium text-gray-700 outline-none hover:border-sky-300 focus:border-sky-400 transition-all"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReportPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calOpen, setCalOpen] = useState(false);
  const [entries, setEntries] = useState<ReportEntry[]>([
    { id: "1", detailId: "", endUserId: "", projectId: "", period: "" },
  ]);
  const [submitted, setSubmitted] = useState(false);
  
  // Database States
  const [dbEndUsers, setDbEndUsers] = useState<any[]>([]);
  const [dbProjects, setDbProjects] = useState<any[]>([]);
  const [dbDetails, setDbDetails] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const [uRes, pRes, dRes] = await Promise.all([
        supabase.from('end_users').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('work_details').select('*')
      ]);
      if (uRes.data) setDbEndUsers(uRes.data);
      if (pRes.data) setDbProjects(pRes.data);
      if (dRes.data) setDbDetails(dRes.data);
      setIsLoading(false);
    };
    fetchData();
  }, []);

  const addEntry = () => {
    setEntries((prev) => [...prev, { id: Date.now().toString(), detailId: "", endUserId: "", projectId: "", period: "" }]);
  };

  const removeEntry = (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id));
  const updateEntry = (id: string, field: keyof ReportEntry, value: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const completedEntries = entries.filter((e) => 
    e.detailId && e.endUserId && e.projectId && e.period && (e.period !== "some_time" || (e.startTime && e.endTime))
  );
  const completedCount = completedEntries.length;
  const allComplete = completedCount === entries.length && entries.length > 0;

  const formatDateShort = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  };

  const formatDateFull = (d: Date) =>
    `${DAYS_TH[d.getDay()]} ${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543}`;

  const handleSubmit = async () => {
    if (!allComplete) return;
    
    try {
      // 1. บันทึก Report หลัก
      const { data: reportData, error: reportErr } = await supabase
        .from('daily_reports')
        .insert({
          user_id: 'ช่างวิทย์ #1055',
          report_date: selectedDate.toISOString().split('T')[0]
        })
        .select().single();

      if (reportErr) throw reportErr;

      // 2. บันทึก Report Items ย่อย
      const items = entries.map(e => ({
        report_id: reportData.id,
        end_user_id: e.endUserId,
        project_id: e.projectId,
        detail_id: e.detailId,
        period_type: e.period === 'some_time' ? 'some_time' : 'fixed',
        period_label: e.period === 'some_time' ? `${e.startTime} - ${e.endTime} น.` : PERIOD_OPTIONS.find(p => p.value === e.period)?.label,
        period_start: e.period === 'some_time' ? e.startTime : null,
        period_end: e.period === 'some_time' ? e.endTime : null
      }));

      const { error: itemsErr } = await supabase.from('daily_report_items').insert(items);
      if (itemsErr) throw itemsErr;

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setEntries([{ id: Date.now().toString(), detailId: "", endUserId: "", projectId: "", period: "" }]);
      }, 3000);

    } catch (error) {
      console.error("Error saving report:", error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center space-y-4">
        <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-gray-400 animate-pulse">กำลังโหลดข้อมูลระบบ...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-28 md:pb-10">

      {/* ── Top Header ── */}
      <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur-sm border-b border-gray-100 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800 leading-tight">Daily Report</h1>
          </div>
          <div className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300
            ${allComplete ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-500"}
          `}>
            <span className={`w-1.5 h-1.5 rounded-full ${allComplete ? "bg-emerald-400 animate-pulse" : "bg-gray-300"}`} />
            {completedCount}/{entries.length} รายการ
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">

        {/* ── Date Picker Field ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Report Date
          </p>
          <div className="relative">
            <button
              onClick={() => setCalOpen(!calOpen)}
              className={`
                w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 text-left transition-all duration-200
                ${calOpen ? "border-sky-400 bg-sky-50/50 shadow-sm shadow-sky-100" : "border-gray-200 hover:border-sky-300 bg-white"}
              `}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${calOpen ? "bg-sky-500" : "bg-sky-100"}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-4.5 h-4.5 ${calOpen ? "text-white" : "text-sky-500"}`} style={{width:'18px',height:'18px'}}>
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-800 leading-tight tracking-wide">{formatDateShort(selectedDate)}</p>
                  <p className="text-xs text-gray-400">{formatDateFull(selectedDate)}</p>
                </div>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${calOpen ? "rotate-180 text-sky-400" : ""}`}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {calOpen && (
              <CalendarPopup selected={selectedDate} onSelect={setSelectedDate} onClose={() => setCalOpen(false)} />
            )}
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="flex items-center gap-3 px-1">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">รายการงาน</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* ── Entry Cards ── */}
        <div className="space-y-3">
          {entries.map((entry, i) => (
            <EntryCard
              key={entry.id} entry={entry} index={i} total={entries.length}
              dbEndUsers={dbEndUsers} dbProjects={dbProjects} dbDetails={dbDetails}
              onChange={updateEntry} onRemove={removeEntry}
            />
          ))}
        </div>

        {/* ── Add Entry ── */}
        <button
          onClick={addEntry}
          className="w-full py-3.5 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center gap-2 text-sm font-semibold text-gray-400 hover:border-sky-300 hover:text-sky-500 hover:bg-sky-50/50 transition-all duration-200"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          เพิ่มรายการงาน
        </button>

        {/* ── Summary ── */}
        {completedCount > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">สรุปรายการวันนี้</p>
            <div className="space-y-2">
              {completedEntries.map((e, i) => (
                <div key={e.id} className="flex items-center gap-3 text-sm">
                  <span className="w-5 h-5 rounded-md bg-sky-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
                  <span className="flex-1 text-gray-700 font-medium truncate">
                    {dbDetails.find(d => d.id === e.detailId)?.title}
                  </span>
                  <span className="text-gray-400 text-xs font-medium flex-shrink-0">
                    {dbProjects.find(p => p.id === e.projectId)?.project_no}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Submit ── */}
        <button
          onClick={handleSubmit}
          disabled={!allComplete || submitted}
          className={`
            w-full py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-2 transition-all duration-300
            ${allComplete 
              ? submitted 
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" 
                : "bg-sky-500 text-white shadow-lg shadow-sky-200 hover:bg-sky-600 active:scale-[0.98]" 
              : "bg-gray-100 text-gray-300 cursor-not-allowed"
            }
          `}
        >
          {submitted ? (
            <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><polyline points="20 6 9 17 4 12" /></svg>บันทึกสำเร็จแล้ว!</>
          ) : (
            <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>บันทึก Daily Report</>
          )}
        </button>

        <p className="text-center text-xs text-gray-300 pb-2">
          {formatDateFull(selectedDate)} · {entries.length} รายการ
        </p>

      </div>
    </main>
  );
}