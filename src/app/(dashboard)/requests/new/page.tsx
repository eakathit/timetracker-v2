"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
type FormType = "ot" | "leave";
type LeaveType = "sick" | "personal" | "vacation" | "maternity";

// ─── Mock Projects ────────────────────────────────────────────────────────────
const PROJECTS = [
  { id: "p1", name: "Project Alpha" },
  { id: "p2", name: "Project Beta" },
  { id: "p3", name: "Project Gamma" },
  { id: "p4", name: "งานภายใน" },
];

const LEAVE_TYPES: { id: LeaveType; label: string; icon: string; desc: string }[] = [
  { id: "sick",      label: "ลาป่วย",     icon: "🤒", desc: "ป่วย ต้องพบแพทย์" },
  { id: "personal",  label: "ลากิจ",      icon: "📋", desc: "ธุระส่วนตัว" },
  { id: "vacation",  label: "ลาพักร้อน",  icon: "🌴", desc: "วันหยุดพักผ่อน" },
  { id: "maternity", label: "ลาคลอด",    icon: "👶", desc: "ลาคลอดบุตร" },
];

const OT_REASON_PRESETS = [
  "งานด่วน ต้องส่งลูกค้า",
  "ประชุม Online ต่างประเทศ",
  "Deploy ระบบ Production",
  "แก้ไข Bug ด่วน",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getLocalToday() {
  return new Date().toISOString().split("T")[0];
}

function calcHours(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return Math.max(0, Math.round(diff / 60 * 10) / 10);
}

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(0, diff);
}

// ─── OT Form ──────────────────────────────────────────────────────────────────
function OTForm({ onSubmit }: { onSubmit: () => void }) {
  const today = getLocalToday();
  const [form, setForm] = useState({
    date: today,
    startTime: "17:30",
    endTime: "",
    projectId: "",
    reason: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const hours = calcHours(form.startTime, form.endTime);
  const isValid = form.date && form.startTime && form.endTime && form.projectId && form.reason.trim() && hours > 0;

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mb-5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-10 h-10 text-emerald-500">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-xl font-black text-gray-900 mb-2">ส่งคำขอ OT แล้ว!</h2>
        <p className="text-sm text-gray-400 mb-1">รอการอนุมัติจากผู้จัดการ</p>
        <p className="text-xs text-gray-300 mb-8">ระบบจะแจ้งเตือนเมื่อมีการอนุมัติหรือปฏิเสธ</p>
        <Link
          href="/requests"
          className="px-8 py-3 rounded-2xl bg-slate-900 text-white font-bold text-sm active:scale-95 transition-all"
        >
          กลับหน้า Requests
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Date */}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          📅 วันที่ทำ OT
        </label>
        <input
          type="date"
          value={form.date}
          min={today}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-100 bg-gray-50 text-sm font-semibold text-gray-800 focus:outline-none focus:border-sky-300 focus:bg-white transition-all"
        />
      </div>

      {/* Time Range */}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          ⏰ ช่วงเวลา OT
        </label>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-[11px] text-gray-400 mb-1 font-medium">เริ่ม</p>
            <input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-100 bg-gray-50 text-sm font-semibold text-gray-800 focus:outline-none focus:border-sky-300 focus:bg-white transition-all"
            />
          </div>
          <span className="text-gray-300 mt-5 font-bold">–</span>
          <div className="flex-1">
            <p className="text-[11px] text-gray-400 mb-1 font-medium">สิ้นสุด</p>
            <input
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-100 bg-gray-50 text-sm font-semibold text-gray-800 focus:outline-none focus:border-sky-300 focus:bg-white transition-all"
            />
          </div>
        </div>
        {/* Hours preview */}
        {hours > 0 && (
          <div className="mt-2 flex items-center gap-2 px-4 py-2 bg-sky-50 border border-sky-100 rounded-xl">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-sky-500">
              <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" />
            </svg>
            <span className="text-sm font-black text-sky-600">{hours} ชั่วโมง OT</span>
          </div>
        )}
      </div>

      {/* Project */}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          📁 โปรเจกต์
        </label>
        <select
          value={form.projectId}
          onChange={(e) => setForm({ ...form, projectId: e.target.value })}
          className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-100 bg-gray-50 text-sm font-semibold text-gray-800 focus:outline-none focus:border-sky-300 focus:bg-white transition-all appearance-none"
        >
          <option value="">-- เลือกโปรเจกต์ --</option>
          {PROJECTS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Reason Presets */}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          📝 เหตุผล
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {OT_REASON_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setForm({ ...form, reason: preset })}
              className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all active:scale-95 ${
                form.reason === preset
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
        <textarea
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          placeholder="หรือระบุเหตุผลเพิ่มเติม..."
          rows={3}
          className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-100 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-sky-300 focus:bg-white transition-all resize-none placeholder-gray-300"
        />
      </div>

      {/* Submit */}
      <button
        onClick={() => { if (isValid) setSubmitted(true); }}
        disabled={!isValid}
        className={`w-full py-4 rounded-2xl text-sm font-black transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
          isValid
            ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
            : "bg-gray-100 text-gray-300 cursor-not-allowed"
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
          <path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" />
        </svg>
        ยื่นคำขอ OT{hours > 0 ? ` (${hours} ชม.)` : ""}
      </button>
    </div>
  );
}

// ─── Leave Form ───────────────────────────────────────────────────────────────
function LeaveForm({ onSubmit }: { onSubmit: () => void }) {
  const today = getLocalToday();
  const [form, setForm] = useState({
    leaveType: "" as LeaveType | "",
    startDate: today,
    endDate: today,
    reason: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const days = calcDays(form.startDate, form.endDate);
  const isValid = form.leaveType && form.startDate && form.endDate && form.reason.trim() && days > 0;

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mb-5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-10 h-10 text-emerald-500">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-xl font-black text-gray-900 mb-2">ส่งใบลาแล้ว!</h2>
        <p className="text-sm text-gray-400 mb-1">รอการอนุมัติจากผู้จัดการ</p>
        <p className="text-xs text-gray-300 mb-8">ระบบจะแจ้งเตือนเมื่อมีการอนุมัติหรือปฏิเสธ</p>
        <Link
          href="/requests"
          className="px-8 py-3 rounded-2xl bg-slate-900 text-white font-bold text-sm active:scale-95 transition-all"
        >
          กลับหน้า Requests
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Leave Type */}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
          🗂 ประเภทการลา
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          {LEAVE_TYPES.map((lt) => (
            <button
              key={lt.id}
              onClick={() => setForm({ ...form, leaveType: lt.id })}
              className={`relative flex flex-col items-start p-4 rounded-2xl border-2 transition-all active:scale-95 text-left ${
                form.leaveType === lt.id
                  ? "border-slate-900 bg-slate-900 text-white shadow-lg"
                  : "border-gray-100 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              <span className="text-2xl mb-2 leading-none">{lt.icon}</span>
              <p className={`text-sm font-black ${form.leaveType === lt.id ? "text-white" : "text-gray-800"}`}>
                {lt.label}
              </p>
              <p className={`text-[11px] mt-0.5 ${form.leaveType === lt.id ? "text-gray-300" : "text-gray-400"}`}>
                {lt.desc}
              </p>
              {form.leaveType === lt.id && (
                <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3 text-slate-900">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Date Range */}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          📅 วันที่ลา
        </label>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-[11px] text-gray-400 mb-1 font-medium">วันเริ่มต้น</p>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: e.target.value })}
              className="w-full px-3 py-3.5 rounded-2xl border-2 border-gray-100 bg-gray-50 text-sm font-semibold text-gray-800 focus:outline-none focus:border-sky-300 focus:bg-white transition-all"
            />
          </div>
          <span className="text-gray-300 mt-5 font-bold">–</span>
          <div className="flex-1">
            <p className="text-[11px] text-gray-400 mb-1 font-medium">วันสิ้นสุด</p>
            <input
              type="date"
              value={form.endDate}
              min={form.startDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="w-full px-3 py-3.5 rounded-2xl border-2 border-gray-100 bg-gray-50 text-sm font-semibold text-gray-800 focus:outline-none focus:border-sky-300 focus:bg-white transition-all"
            />
          </div>
        </div>
        {days > 0 && (
          <div className="mt-2 flex items-center gap-2 px-4 py-2 bg-sky-50 border border-sky-100 rounded-xl">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-sky-500">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" />
            </svg>
            <span className="text-sm font-black text-sky-600">ลา {days} วัน</span>
          </div>
        )}
      </div>

      {/* Reason */}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          📝 เหตุผลการลา
        </label>
        <textarea
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          placeholder="ระบุเหตุผลการลา..."
          rows={3}
          className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-100 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-sky-300 focus:bg-white transition-all resize-none placeholder-gray-300"
        />
      </div>

      {/* Submit */}
      <button
        onClick={() => { if (isValid) setSubmitted(true); }}
        disabled={!isValid}
        className={`w-full py-4 rounded-2xl text-sm font-black transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
          isValid
            ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
            : "bg-gray-100 text-gray-300 cursor-not-allowed"
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
          <path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" />
        </svg>
        ยื่นใบลา{days > 0 ? ` (${days} วัน)` : ""}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NewRequestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type") as FormType | null;

  const [activeForm, setActiveForm] = useState<FormType>(typeParam === "leave" ? "leave" : "ot");

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 sticky top-0 z-20">
        <div className="flex items-center gap-4 mb-4">
          {/* Back button */}
          <Link
            href="/requests"
            className="w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center active:scale-95 transition-all"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-gray-600">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-black text-gray-900 tracking-tight">ยื่นคำขอใหม่</h1>
            <p className="text-xs text-gray-400">New Request</p>
          </div>
        </div>

        {/* Segment Control */}
        <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
          {(["ot", "leave"] as FormType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveForm(tab)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                activeForm === tab
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {tab === "ot" ? "⏰ OT Request" : "📋 ยื่นใบลา"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Form Body ── */}
      <div className="px-4 pt-6">
        {activeForm === "ot" ? (
          <OTForm onSubmit={() => router.push("/requests")} />
        ) : (
          <LeaveForm onSubmit={() => router.push("/requests")} />
        )}
      </div>
    </div>
  );
}