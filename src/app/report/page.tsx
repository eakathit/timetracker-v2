"use client";

import { useState, useRef, useEffect } from "react";

// ─── Data ─────────────────────────────────────────────────────────────────────
const DETAIL_OPTIONS = [
  { value: "wiring_hr", label: "Wiring" },
  { value: "panel_install", label: "Panel Installation" },
  { value: "conduit", label: "Conduit Work" },
  { value: "testing", label: "Testing & Commissioning" },
  { value: "cable_pull", label: "Cable Pulling" },
  { value: "termination", label: "Termination" },
  { value: "inspection", label: "Inspection" },
  { value: "maintenance", label: "Maintenance" },
  { value: "site_survey", label: "Site Survey" },
  { value: "other", label: "Other" },
];

const PROJECT_OPTIONS = [
  { value: "PRJ-2024-001", label: "PRJ-2024-001 · โรงงาน A" },
  { value: "PRJ-2024-002", label: "PRJ-2024-002 · อาคาร B" },
  { value: "PRJ-2024-003", label: "PRJ-2024-003 · โรงพยาบาล C" },
  { value: "PRJ-2025-001", label: "PRJ-2025-001 · ห้างสรรพสินค้า D" },
  { value: "PRJ-2025-002", label: "PRJ-2025-002 · โรงแรม E" },
  { value: "PRJ-2025-003", label: "PRJ-2025-003 · คลังสินค้า F" },
];

const PERIOD_OPTIONS = [
  { value: "08:00-10:00", label: "08:00 – 10:00 น." },
  { value: "10:00-12:00", label: "10:00 – 12:00 น." },
  { value: "13:00-15:00", label: "13:00 – 15:00 น." },
  { value: "15:00-17:00", label: "15:00 – 17:00 น." },
  { value: "08:00-12:00", label: "08:00 – 12:00 น. (ครึ่งเช้า)" },
  { value: "13:00-17:00", label: "13:00 – 17:00 น. (ครึ่งบ่าย)" },
  { value: "08:00-17:00", label: "08:00 – 17:00 น. (เต็มวัน)" },
  { value: "ot_17-20", label: "17:00 – 20:00 น. (OT)" },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface ReportEntry {
  id: string;
  detail: string;
  projectNo: string;
  period: string;
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

  // ปิด popup เมื่อคลิกข้างนอก
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
    selected.getDate() === d &&
    selected.getMonth() === month &&
    selected.getFullYear() === year;

  const isToday = (d: number) =>
    today.getDate() === d &&
    today.getMonth() === month &&
    today.getFullYear() === year;

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
      {/* Month Nav */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setViewing(new Date(year, month - 1, 1))}
          className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="font-bold text-gray-800 text-sm">
          {MONTHS_TH[month]} {year + 543}
        </span>
        <button
          onClick={() => setViewing(new Date(year, month + 1, 1))}
          className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_TH.map((d, i) => (
          <div
            key={d}
            className={`text-center text-[10px] font-bold pb-2 ${
              i === 0 ? "text-rose-400" : i === 6 ? "text-sky-400" : "text-gray-400"
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />;
          const col = idx % 7;
          return (
            <button
              key={day}
              onClick={() => handleSelect(day)}
              className={`
                relative mx-auto w-9 h-9 rounded-xl text-xs font-medium
                flex items-center justify-center transition-all duration-100
                ${isSelected(day)
                  ? "bg-sky-500 text-white shadow-md shadow-sky-200 scale-105"
                  : isToday(day)
                  ? "bg-sky-50 text-sky-600 font-bold ring-1 ring-sky-200"
                  : col === 0
                  ? "text-rose-400 hover:bg-rose-50"
                  : col === 6
                  ? "text-sky-500 hover:bg-sky-50"
                  : "text-gray-700 hover:bg-gray-100"
                }
              `}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <button
          onClick={() => setViewing(new Date())}
          className="text-xs text-gray-400 hover:text-sky-500 font-medium transition-colors"
        >
          ล้าง
        </button>
        <button
          onClick={() => { onSelect(new Date()); onClose(); }}
          className="text-xs text-sky-500 hover:text-sky-600 font-bold transition-colors"
        >
          วันนี้
        </button>
      </div>
    </div>
  );
}

// ─── Custom Select ────────────────────────────────────────────────────────────
function SelectField({
  label,
  icon,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  options: { value: string; label: string }[];
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {icon}
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`
            w-full appearance-none px-4 py-3 pr-10 rounded-xl border text-sm font-medium
            transition-all duration-200 outline-none cursor-pointer
            ${value
              ? "border-sky-300 bg-sky-50/50 text-gray-800"
              : "border-gray-200 bg-white text-gray-400"
            }
            hover:border-sky-300 focus:border-sky-400 focus:ring-2 focus:ring-sky-100
          `}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${value ? "text-sky-400" : "text-gray-300"}`}>
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
  entry,
  index,
  total,
  onChange,
  onRemove,
}: {
  entry: ReportEntry;
  index: number;
  total: number;
  onChange: (id: string, field: keyof ReportEntry, value: string) => void;
  onRemove: (id: string) => void;
}) {
  const detailLabel = DETAIL_OPTIONS.find((o) => o.value === entry.detail)?.label;
  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === entry.period)?.label;
  const isComplete = entry.detail && entry.projectNo && entry.period;

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
          <button
            onClick={() => onRemove(entry.id)}
            className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Fields */}
      <div className="space-y-3">
        <SelectField
          label="Detail"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>}
          value={entry.detail}
          options={DETAIL_OPTIONS}
          placeholder="เลือกประเภทงาน..."
          onChange={(v) => onChange(entry.id, "detail", v)}
        />
        <SelectField
          label="Project No."
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>}
          value={entry.projectNo}
          options={PROJECT_OPTIONS}
          placeholder="เลือกโปรเจค..."
          onChange={(v) => onChange(entry.id, "projectNo", v)}
        />
        <SelectField
          label="Working Period"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>}
          value={entry.period}
          options={PERIOD_OPTIONS}
          placeholder="เลือกช่วงเวลา..."
          onChange={(v) => onChange(entry.id, "period", v)}
        />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReportPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calOpen, setCalOpen] = useState(false);
  const [entries, setEntries] = useState<ReportEntry[]>([
    { id: "1", detail: "", projectNo: "", period: "" },
  ]);
  const [submitted, setSubmitted] = useState(false);

  const addEntry = () => {
    setEntries((prev) => [
      ...prev,
      { id: Date.now().toString(), detail: "", projectNo: "", period: "" },
    ]);
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const updateEntry = (id: string, field: keyof ReportEntry, value: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  };

  const completedCount = entries.filter(
    (e) => e.detail && e.projectNo && e.period
  ).length;
  const allComplete = completedCount === entries.length && entries.length > 0;

  const formatDateShort = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  };

  const formatDateFull = (d: Date) =>
    `${DAYS_TH[d.getDay()]} ${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543}`;

  const handleSubmit = () => {
    if (!allComplete) return;
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <main className="min-h-screen bg-gray-50 pb-28 md:pb-10">

      {/* ── Top Header ── */}
      <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur-sm border-b border-gray-100 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium">ช่างวิทย์ · #1055</p>
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
            {/* Trigger button */}
            <button
              onClick={() => setCalOpen(!calOpen)}
              className={`
                w-full flex items-center justify-between
                px-4 py-3.5 rounded-xl border-2 text-left
                transition-all duration-200
                ${calOpen
                  ? "border-sky-400 bg-sky-50/50 shadow-sm shadow-sky-100"
                  : "border-gray-200 hover:border-sky-300 bg-white"
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${calOpen ? "bg-sky-500" : "bg-sky-100"}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-4.5 h-4.5 ${calOpen ? "text-white" : "text-sky-500"}`} style={{width:'18px',height:'18px'}}>
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-800 leading-tight tracking-wide">
                    {formatDateShort(selectedDate)}
                  </p>
                  <p className="text-xs text-gray-400">{formatDateFull(selectedDate)}</p>
                </div>
              </div>
              <svg
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${calOpen ? "rotate-180 text-sky-400" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Calendar Popup */}
            {calOpen && (
              <CalendarPopup
                selected={selectedDate}
                onSelect={setSelectedDate}
                onClose={() => setCalOpen(false)}
              />
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
              key={entry.id}
              entry={entry}
              index={i}
              total={entries.length}
              onChange={updateEntry}
              onRemove={removeEntry}
            />
          ))}
        </div>

        {/* ── Add Entry ── */}
        <button
          onClick={addEntry}
          className="
            w-full py-3.5 rounded-2xl border-2 border-dashed border-gray-200
            flex items-center justify-center gap-2
            text-sm font-semibold text-gray-400
            hover:border-sky-300 hover:text-sky-500 hover:bg-sky-50/50
            transition-all duration-200
          "
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          เพิ่มรายการงาน
        </button>

        {/* ── Summary ── */}
        {completedCount > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">สรุปรายการวันนี้</p>
            <div className="space-y-2">
              {entries.filter((e) => e.detail && e.projectNo && e.period).map((e, i) => (
                <div key={e.id} className="flex items-center gap-3 text-sm">
                  <span className="w-5 h-5 rounded-md bg-sky-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-gray-700 font-medium truncate">
                    {DETAIL_OPTIONS.find((o) => o.value === e.detail)?.label}
                  </span>
                  <span className="text-gray-400 text-xs font-medium flex-shrink-0">
                    {e.projectNo.split("-").slice(0, 2).join("-")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Submit ── */}
        <button
          onClick={handleSubmit}
          disabled={!allComplete}
          className={`
            w-full py-4 rounded-2xl text-base font-bold
            flex items-center justify-center gap-2
            transition-all duration-300
            ${allComplete
              ? submitted
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200"
                : "bg-sky-500 text-white shadow-lg shadow-sky-200 hover:bg-sky-600 active:scale-[0.98]"
              : "bg-gray-100 text-gray-300 cursor-not-allowed"
            }
          `}
        >
          {submitted ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              บันทึกสำเร็จแล้ว!
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              บันทึก Daily Report
            </>
          )}
        </button>

        <p className="text-center text-xs text-gray-300 pb-2">
          {formatDateFull(selectedDate)} · {entries.length} รายการ
        </p>

      </div>
    </main>
  );
}