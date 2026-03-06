"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

// ─── Supabase Client ──────────────────────────────────────────────────────────
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Types ────────────────────────────────────────────────────────────────────
type FormType  = "ot" | "leave";
type LeaveType = "sick" | "personal" | "vacation" | "maternity";
// เพิ่มต่อจาก type LeaveType
type LeavePeriod = "full" | "morning" | "afternoon" | "custom";

const PERIOD_OPTIONS: { id: LeavePeriod; label: string; sub: string }[] = [
  { id: "full",      label: "ทั้งวัน",    sub: "08:30 – 17:30" },
  { id: "morning",   label: "ครึ่งเช้า",  sub: "08:30 – 12:00" },
  { id: "afternoon", label: "ครึ่งบ่าย", sub: "13:00 – 17:30" },
  { id: "custom",    label: "ระบุเวลาเอง", sub: "กำหนดเอง"      },
];

// ประเภทที่ต้องการช่วงเวลา
const PERIOD_LEAVE_TYPES: LeaveType[] = ["sick", "personal"];

interface Project { id: string; project_no: string; name: string | null; end_user_id: string; }


interface EndUser { id: string; name: string; color: string; }


// ─── Leave Type Icons ─────────────────────────────────────────────────────────
const LeaveIcons: Record<string, React.ReactNode> = {
  sick: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  personal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <line x1="12" y1="12" x2="12" y2="16" />
      <line x1="10" y1="14" x2="14" y2="14" />
    </svg>
  ),
  vacation: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
  maternity: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
};

const LEAVE_TYPES: { id: LeaveType; label: string; desc: string }[] = [
  { id: "sick",      label: "ลาป่วย",    desc: "ป่วย ต้องพบแพทย์" },
  { id: "personal",  label: "ลากิจ",    desc: "ธุระส่วนตัว" },
  { id: "vacation",  label: "ลาพักร้อน", desc: "วันหยุดพักผ่อน" },
  { id: "maternity", label: "ลาคลอด",   desc: "ลาคลอดบุตร" },
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
  const diff = eh * 60 + em - (sh * 60 + sm);
  return Math.max(0, Math.round((diff / 60) * 10) / 10);
}

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const diff = Math.floor(
    (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;
  return Math.max(0, diff);
}


// ─── Success State ────────────────────────────────────────────────────────────
function SuccessState({ type }: { type: "ot" | "leave" }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-3xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-6">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-10 h-10 text-emerald-500">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>
      <h2 className="text-xl font-black text-gray-900 mb-1">
        {type === "ot" ? "ส่งคำขอ OT แล้ว!" : "ส่งใบลาแล้ว!"}
      </h2>
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

// ─── Success Screen ───────────────────────────────────────────────────────────
function SuccessScreen({ type }: { type: FormType }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-20 h-20 rounded-3xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mb-5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-10 h-10 text-emerald-500">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h2 className="text-xl font-black text-gray-900 mb-2">
        {type === "ot" ? "ส่งคำขอ OT แล้ว!" : "ส่งใบลาแล้ว!"}
      </h2>
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

// ─── OT Form ──────────────────────────────────────────────────────────────────
function OTForm() {
  const today = getLocalToday();
  const [endUsers, setEndUsers] = useState<EndUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [userId,   setUserId]   = useState<string | null>(null);

  const [form, setForm] = useState({
    date:       today,
    startTime:  "18:00",
    endTime:    "",
    endUserId:  "",
    projectId:  "",
    reason:     "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const hours   = calcHours(form.startTime, form.endTime);
  const isValid = form.date && form.startTime && form.endTime && form.reason.trim() && hours > 0;

  // กรอง Project ตาม EndUser ที่เลือก
  const filteredProjects = form.endUserId
    ? projects.filter((p) => p.end_user_id === form.endUserId)
    : projects;

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

      const [euRes, pjRes] = await Promise.all([
        supabase.from("end_users").select("id, name, color").order("name"),
        supabase.from("projects").select("id, project_no, name, end_user_id").eq("is_active", true).order("project_no"),
      ]);
      if (euRes.data) setEndUsers(euRes.data);
      if (pjRes.data) setProjects(pjRes.data);
    };
    init();
  }, []);

  const handleSubmit = async () => {
    if (!isValid || !userId) return;
    setSubmitting(true);
    setError(null);

    const { error: dbError } = await supabase.from("ot_requests").insert({
  user_id:      userId,
  request_date: form.date,
  start_time:   form.startTime,
  end_time:     form.endTime,
  hours,
  project_id:   form.projectId || null,
  reason:       form.reason.trim(),
  status:       "pending",
});

    setSubmitting(false);
    if (dbError) { setError(dbError.message); return; }
    setSubmitted(true);
  };

  if (submitted) return <SuccessState type="ot" />;

  // shared input class
  const inputCls = "w-full px-4 py-3.5 rounded-2xl border-2 border-gray-200 bg-white text-sm font-semibold text-gray-900 focus:outline-none focus:border-sky-400 focus:bg-white transition-all placeholder-gray-300";

  return (
    <div className="space-y-4 pb-8">

      {/* ── วันที่ ── */}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          📅 วันที่ทำ OT
        </label>
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className={inputCls}
        />
      </div>

      {/* ── เวลา ── */}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          ⏰ ช่วงเวลา OT
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] text-gray-400 mb-1 font-medium">เริ่มต้น</p>
            <input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <p className="text-[11px] text-gray-400 mb-1 font-medium">สิ้นสุด</p>
            <input
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>

        {hours > 0 && (
          <div className="mt-2 flex items-center gap-2 px-4 py-2 bg-sky-50 border border-sky-100 rounded-xl">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-sky-500">
              <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" />
            </svg>
            <span className="text-sm font-black text-sky-600">{hours} ชั่วโมง OT</span>
          </div>
        )}
      </div>

      {/* ── End User ── */}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          🏢 End User{" "}
          <span className="text-gray-300 normal-case font-normal">(ไม่บังคับ)</span>
        </label>
        <select
          value={form.endUserId}
          onChange={(e) =>
            setForm({ ...form, endUserId: e.target.value, projectId: "" })
          }
          className={inputCls + " appearance-none"}
        >
          <option value="">-- ไม่ระบุลูกค้า --</option>
          {endUsers.map((eu) => (
            <option key={eu.id} value={eu.id}>{eu.name}</option>
          ))}
        </select>
      </div>

      {/* ── Project ── */}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          📁 Project No.{" "}
          <span className="text-gray-300 normal-case font-normal">(ไม่บังคับ)</span>
        </label>
        <select
          value={form.projectId}
          onChange={(e) => setForm({ ...form, projectId: e.target.value })}
          className={inputCls + " appearance-none"}
          disabled={filteredProjects.length === 0 && !form.endUserId}
        >
          <option value="">-- ไม่ระบุโปรเจกต์ --</option>
          {filteredProjects.map((p) => (
            <option key={p.id} value={p.id}>
              #{p.project_no}{p.name ? ` · ${p.name}` : ""}
            </option>
          ))}
        </select>
        {form.endUserId && filteredProjects.length === 0 && (
          <p className="text-xs text-gray-400 mt-1.5 px-1">ไม่มีโปรเจกต์ในลูกค้านี้</p>
        )}
      </div>

      {/* ── เหตุผล ── */}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          📝 เหตุผลการทำ OT <span className="text-rose-400">*</span>
        </label>
        <textarea
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          placeholder="เช่น ประกอบตู้คอนโทรล, เเก้ไขโปรเเกรม..."
          rows={3}
          className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-200 bg-white text-sm font-semibold text-gray-900 focus:outline-none focus:border-sky-400 transition-all resize-none placeholder-gray-300"
        />
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl">
          <span className="text-rose-500 text-sm">⚠️ {error}</span>
        </div>
      )}

      {/* ── Submit ── */}
      <button
        onClick={handleSubmit}
        disabled={!isValid || submitting}
        className={`w-full py-4 rounded-2xl text-sm font-black transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
          isValid && !submitting
            ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
            : "bg-gray-100 text-gray-300 cursor-not-allowed"
        }`}
      >
        {submitting ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            กำลังส่ง...
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
              <path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" />
            </svg>
            ยื่นคำขอ OT{hours > 0 ? ` (${hours} ชม.)` : ""}
          </>
        )}
      </button>
    </div>
  );
}

// ─── Leave Form ───────────────────────────────────────────────────────────────
function LeaveForm() {
  const today = getLocalToday();
  const [userId, setUserId] = useState<string | null>(null);

  const [form, setForm] = useState({
  leaveType:   "" as LeaveType | "",
  startDate:   today,
  endDate:     today,
  period:      "full" as LeavePeriod,
  customStart: "08:30",
  customEnd:   "17:30",
  reason:      "",
});
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const days    = calcDays(form.startDate, form.endDate);
  const isValid = form.leaveType && form.startDate && form.endDate && form.reason.trim() && days > 0;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const getPeriodLabel = () => {
    if (!PERIOD_LEAVE_TYPES.includes(form.leaveType as LeaveType)) return null;
    if (form.period === "custom") return `${form.customStart} – ${form.customEnd}`;
    return PERIOD_OPTIONS.find(p => p.id === form.period)?.sub ?? null;
  };
  
  const handleSubmit = async () => {
    if (!isValid || !userId) return;
    setSubmitting(true);
    setError(null);

    const { error: dbError } = await supabase.from("leave_requests").insert({
  user_id:      userId,
  leave_type:   form.leaveType,
  start_date:   form.startDate,
  end_date:     form.endDate,
  period_label: getPeriodLabel(),   // ← เพิ่ม (nullable column)
  reason:       form.reason.trim(),
  status:       "pending",
});

    if (dbError) {
      setError(dbError.message);
      setSubmitting(false);
    } else {
      setSubmitted(true);
    }
  };

  if (submitted) return <SuccessScreen type="leave" />;

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
              onClick={() => setForm({
  ...form,
  leaveType: lt.id,
  period: "full",
  customStart: "08:30",
  customEnd: "17:30",
})}
              className={`relative flex flex-col items-start p-4 rounded-2xl border-2 transition-all active:scale-95 text-left ${
                form.leaveType === lt.id
                  ? "border-slate-900 bg-slate-900 shadow-lg"
                  : "border-gray-100 bg-white hover:border-gray-300"
              }`}
            >
              <span className={`mb-2 ${form.leaveType === lt.id ? "text-white" : "text-gray-500"}`}>
  {LeaveIcons[lt.id]}
</span>
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
          <span className="text-gray-300 mt-5 font-bold text-lg">–</span>
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

        {/* Days Preview */}
        {days > 0 && (
          <div className="mt-2 flex items-center gap-2 px-4 py-2 bg-sky-50 border border-sky-100 rounded-xl">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-sky-500">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" />
            </svg>
            <span className="text-sm font-black text-sky-600">ลา {days} วัน</span>
          </div>
        )}
      </div>

        {/* ── ช่วงเวลา (เฉพาะลาป่วย/ลากิจ) ── */}
{PERIOD_LEAVE_TYPES.includes(form.leaveType as LeaveType) && (
  <div>
    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
      ⏱ ช่วงเวลา
    </label>
    <div className="grid grid-cols-2 gap-2">
      {PERIOD_OPTIONS.map((p) => (
        <button
          key={p.id}
          onClick={() => setForm({ ...form, period: p.id })}
          className={`flex flex-col items-start px-4 py-3 rounded-2xl border-2 transition-all active:scale-95 text-left ${
            form.period === p.id
              ? "border-sky-400 bg-sky-50"
              : "border-gray-100 bg-white hover:border-gray-200"
          }`}
        >
          <span className={`text-sm font-bold ${form.period === p.id ? "text-sky-700" : "text-gray-800"}`}>
            {p.label}
          </span>
          <span className={`text-[11px] mt-0.5 ${form.period === p.id ? "text-sky-500" : "text-gray-400"}`}>
            {p.sub}
          </span>
        </button>
      ))}
    </div>

    {/* custom time inputs */}
    {form.period === "custom" && (
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-[11px] text-gray-400 mb-1 font-medium">เริ่ม</p>
          <input
            type="time"
            value={form.customStart}
            onChange={(e) => setForm({ ...form, customStart: e.target.value })}
            className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 bg-white text-sm font-semibold text-gray-900 focus:outline-none focus:border-sky-400 transition-all"
          />
        </div>
        <span className="text-gray-300 mt-5 font-bold text-lg">–</span>
        <div className="flex-1">
          <p className="text-[11px] text-gray-400 mb-1 font-medium">สิ้นสุด</p>
          <input
            type="time"
            value={form.customEnd}
            onChange={(e) => setForm({ ...form, customEnd: e.target.value })}
            className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 bg-white text-sm font-semibold text-gray-900 focus:outline-none focus:border-sky-400 transition-all"
          />
        </div>
      </div>
    )}
  </div>
)}

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

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl">
          <span className="text-rose-500 text-sm">⚠️ {error}</span>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!isValid || submitting}
        className={`w-full py-4 rounded-2xl text-sm font-black transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
          isValid && !submitting
            ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
            : "bg-gray-100 text-gray-300 cursor-not-allowed"
        }`}
      >
        {submitting ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            กำลังส่ง...
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
              <path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" />
            </svg>
            ยื่นใบลา{days > 0 ? ` (${days} วัน)` : ""}
          </>
        )}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NewRequestPage() {
  const searchParams = useSearchParams();
  const typeParam    = searchParams.get("type") as FormType | null;
  const [activeForm, setActiveForm] = useState<FormType>(typeParam === "leave" ? "leave" : "ot");

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 sticky top-0 z-20">
        <div className="flex items-center gap-4 mb-4">
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

        {/* Segment */}
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
        {activeForm === "ot" ? <OTForm /> : <LeaveForm />}
      </div>
    </div>
  );
}