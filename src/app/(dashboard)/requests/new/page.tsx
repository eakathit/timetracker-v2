"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { fmtLeaveBalance, fmtNum, leaveUnit, toLeaveDisplay } from "@/lib/leave-format";
import { createBrowserClient } from "@supabase/ssr";

// ─── Supabase Client ──────────────────────────────────────────────────────────
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// ─── Types ────────────────────────────────────────────────────────────────────
type FormType = "ot" | "leave";
type LeaveType =
  | "sick"
  | "personal"
  | "vacation"
  | "special_personal"
  | "other"
  | "holiday_swap";
const PERIOD_LEAVE_TYPES: LeaveType[] = [
  "sick",
  "personal",
  "special_personal",
  "vacation",
  "other",
  // holiday_swap ไม่อยู่ที่นี่ — ลาได้เฉพาะเต็มวัน ไม่มีรายชั่วโมง
];
// เพิ่มต่อจาก type LeaveType
type LeavePeriod = "full" | "morning" | "afternoon" | "hourly";

const HALF_DAY_HOURS: Record<"morning" | "afternoon", number> = {
  morning: 3.5,   // 08:30–12:00
  afternoon: 4.5, // 13:00–17:30
};

const PERIOD_OPTIONS: { id: Exclude<LeavePeriod, "hourly">; label: string; sub: string }[] = [
  { id: "full", label: "ทั้งวัน", sub: "08:30 – 17:30" },
  { id: "morning", label: "ครึ่งเช้า", sub: "08:30 – 12:00" },
  { id: "afternoon", label: "ครึ่งบ่าย", sub: "13:00 – 17:30" },
];

interface Project {
  id: string;
  project_no: string;
  name: string | null;
  end_user_id: string;
}

interface EndUser {
  id: string;
  name: string;
  color: string;
}

// ─── Leave Type Icons ─────────────────────────────────────────────────────────
const LeaveIcons: Record<string, React.ReactNode> = {
  sick: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="w-6 h-6"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  personal: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="w-6 h-6"
    >
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <line x1="12" y1="12" x2="12" y2="16" />
      <line x1="10" y1="14" x2="14" y2="14" />
    </svg>
  ),
  vacation: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="w-6 h-6"
    >
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
  special_personal: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="w-6 h-6"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  other: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="w-6 h-6"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
};

const LEAVE_TYPES: { id: LeaveType; label: string; desc: string; icon: string; bg: string }[] = [
  { id: "sick",             label: "ลาป่วย",      desc: "เจ็บป่วยหรือต้องพบแพทย์",    icon: "🤒", bg: "bg-rose-100"   },
  { id: "personal",         label: "ลากิจ",       desc: "ธุระส่วนตัว",                icon: "📋", bg: "bg-amber-100"  },
  { id: "vacation",         label: "ลาพักร้อน",   desc: "วันหยุดพักผ่อน",             icon: "🌴", bg: "bg-violet-100" },
  { id: "special_personal", label: "ลากิจพิเศษ",  desc: "กิจธุระพิเศษ",               icon: "⭐", bg: "bg-sky-100"    },
  { id: "holiday_swap",     label: "แลกวันหยุด",  desc: "สะสมจากทำงานในวันหยุด",      icon: "🔄", bg: "bg-teal-100"   },
  { id: "other",            label: "ลาอื่นๆ",     desc: "ระบุในเหตุผล",               icon: "📝", bg: "bg-gray-200"   },
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
  const diff =
    Math.floor(
      (new Date(end).getTime() - new Date(start).getTime()) /
        (1000 * 60 * 60 * 24),
    ) + 1;
  return Math.max(0, diff);
}

// ─── Success State ────────────────────────────────────────────────────────────
function SuccessState({ type }: { type: "ot" | "leave" }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-3xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-6">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-10 h-10 text-emerald-500"
        >
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>
      <h2 className="text-xl font-black text-gray-900 mb-1">
        {type === "ot" ? "ส่งคำขอ OT แล้ว!" : "ส่งใบลาแล้ว!"}
      </h2>
      <p className="text-sm text-gray-400 mb-1">รอการอนุมัติจากผู้จัดการ</p>
      <p className="text-xs text-gray-300 mb-8">
        ระบบจะแจ้งเตือนเมื่อมีการอนุมัติหรือปฏิเสธ
      </p>
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
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="w-10 h-10 text-emerald-500"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h2 className="text-xl font-black text-gray-900 mb-2">
        {type === "ot" ? "ส่งคำขอ OT แล้ว!" : "ส่งใบลาแล้ว!"}
      </h2>
      <p className="text-sm text-gray-400 mb-1">รอการอนุมัติจากผู้จัดการ</p>
      <p className="text-xs text-gray-300 mb-8">
        ระบบจะแจ้งเตือนเมื่อมีการอนุมัติหรือปฏิเสธ
      </p>
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
  const [userId, setUserId] = useState<string | null>(null);

  const [form, setForm] = useState({
    date: today,
    startTime: "18:00",
    endTime: "",
    endUserId: "",
    projectId: "",
    reason: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hours = calcHours(form.startTime, form.endTime);
  const isValid =
    form.date &&
    form.startTime &&
    form.endTime &&
    form.reason.trim() &&
    hours > 0;

  // กรอง Project ตาม EndUser ที่เลือก
  const filteredProjects = form.endUserId
    ? projects.filter((p) => p.end_user_id === form.endUserId)
    : projects;

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

      const [euRes, pjRes] = await Promise.all([
        supabase.from("end_users").select("id, name, color").order("name"),
        supabase
          .from("projects")
          .select("id, project_no, name, end_user_id")
          .eq("is_active", true)
          .order("project_no"),
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
      user_id: userId,
      request_date: form.date,
      start_time: form.startTime,
      end_time: form.endTime,
      hours,
      project_id: form.projectId || null,
      reason: form.reason.trim(),
      status: "pending",
    });

    setSubmitting(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setSubmitted(true);
  };

  if (submitted) return <SuccessState type="ot" />;

  // ─── Shared class helpers ──────────────────────────────────────────────────
  // label เล็ก สีเทา น้ำหนัก 500
  const labelCls =
    "block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5";

  // input / select หลัก: ไม่มี border หนัก, bg ขาว, text ปกติ
  const inputCls =
    "w-full px-3.5 py-3 rounded-xl border border-gray-200 bg-white text-[15px] font-normal text-gray-900 " +
    "focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all placeholder-gray-300 appearance-none";

  // select wrapper (เพื่อใส่ chevron icon ข้างขวา)
  const selectWrapCls = "relative";
  const selectCls =
    "w-full pl-3.5 pr-9 py-3 rounded-xl border border-gray-200 bg-white text-[15px] font-normal text-gray-900 " +
    "focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all appearance-none cursor-pointer";

  // Chevron icon สำหรับ select
  const ChevronDown = () => (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
    >
      <polyline points="5 8 10 13 15 8" />
    </svg>
  );

  return (
    <div className="space-y-3 pb-8">
      {/* ── Card 1: วัน & เวลา ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Section header */}
        <div className="px-4 pt-3.5 pb-0">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
            Date & Time
          </p>
        </div>

        {/* วันที่ */}
        <div className="px-4 pt-3 pb-1">
          <label className={labelCls}>วันที่ทำ OT</label>
          <div className="relative">
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 border-t border-gray-50 mt-3" />

        {/* ช่วงเวลา */}
        <div className="px-4 pt-3 pb-4">
          <label className={labelCls}>ช่วงเวลา OT</label>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <p className="text-[11px] text-gray-400 mb-1.5">เริ่มต้น</p>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) =>
                  setForm({ ...form, startTime: e.target.value })
                }
                className={inputCls}
              />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 mb-1.5">สิ้นสุด</p>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── OT Duration Badge (แสดงเมื่อกรอกเวลาครบ) ──────────────────────── */}
      <div
        className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl border transition-all duration-200 ${
          hours > 0
            ? "bg-indigo-50 border-indigo-100 opacity-100"
            : "bg-gray-50 border-gray-100 opacity-60"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`w-4 h-4 flex-shrink-0 ${hours > 0 ? "text-indigo-400" : "text-gray-300"}`}
        >
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15 14" />
        </svg>
        <span
          className={`text-[13px] font-medium flex-1 ${
            hours > 0 ? "text-indigo-600" : "text-gray-400"
          }`}
        >
          ระยะเวลา OT โดยประมาณ
        </span>
        <span
          className={`text-[18px] font-semibold tabular-nums ${
            hours > 0 ? "text-indigo-700" : "text-gray-300"
          }`}
        >
          {hours > 0 ? (
            <>
              {hours}{" "}
              <span className="text-[12px] font-normal text-indigo-400">
                ชม.
              </span>
            </>
          ) : (
            <span className="text-[13px]">--</span>
          )}
        </span>
      </div>

      {/* ── Card 2: โปรเจกต์ ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 pt-3.5 pb-0">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
            Project
          </p>
        </div>

        {/* End User */}
        <div className="px-4 pt-3 pb-1">
          <label className={labelCls}>
            End User{" "}
            <span className="normal-case text-[10px] text-gray-300 font-normal">
              (ไม่บังคับ)
            </span>
          </label>
          <div className={selectWrapCls}>
            <select
              value={form.endUserId}
              onChange={(e) => {
                setForm({ ...form, endUserId: e.target.value, projectId: "" });
              }}
              className={`${selectCls} ${!form.endUserId ? "text-gray-400" : "text-gray-900"}`}
            >
              <option value="">-- ไม่ระบุลูกค้า --</option>
              {endUsers.map((eu) => (
                <option key={eu.id} value={eu.id}>
                  {eu.name}
                </option>
              ))}
            </select>
            <ChevronDown />
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 border-t border-gray-50 mt-3" />

        {/* Project */}
        <div className="px-4 pt-3 pb-4">
          <label className={labelCls}>
            Project No.{" "}
            <span className="normal-case text-[10px] text-gray-300 font-normal">
              (ไม่บังคับ)
            </span>
          </label>
          <div className={selectWrapCls}>
            <select
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
              disabled={filteredProjects.length === 0 && !form.endUserId}
              className={`${selectCls} ${
                !form.projectId ? "text-gray-400" : "text-gray-900"
              } disabled:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed`}
            >
              <option value="">-- ไม่ระบุโปรเจกต์ --</option>
              {filteredProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_no}
                  {p.name ? ` – ${p.name}` : ""}
                </option>
              ))}
            </select>
            <ChevronDown />
          </div>
        </div>
      </div>

      {/* ── Card 3: เหตุผลการทำ OT ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 pt-3.5 pb-0 flex items-center gap-1.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
            เหตุผลการทำ OT
          </p>
          {/* dot บังคับกรอก */}
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 mb-px" />
        </div>
        <div className="px-4 pt-3 pb-4">
          <textarea
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="อธิบายเหตุผลหรืองานที่ต้องทำ เช่น ประกอบตู้คอนโทรล, แก้ไขโปรแกรม..."
            rows={3}
            className={
              "w-full px-3.5 py-3 rounded-xl border border-gray-200 bg-white text-[15px] font-normal text-gray-900 " +
              "focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all resize-none placeholder-gray-300 leading-relaxed"
            }
          />
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-4 h-4 text-red-400 flex-shrink-0"
          >
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="text-[13px] text-red-500">{error}</span>
        </div>
      )}

      {/* ── Submit Button ──────────────────────────────────────────────────── */}
      <button
        onClick={handleSubmit}
        disabled={!isValid || submitting}
        className={`w-full py-4 rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
          isValid && !submitting
            ? "bg-gray-900 text-white shadow-md shadow-gray-900/15 hover:bg-gray-800"
            : "bg-gray-100 text-gray-300 cursor-not-allowed"
        }`}
      >
        {submitting ? (
          <>
            <svg
              className="w-4 h-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            กำลังส่ง...
          </>
        ) : (
          <>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-4 h-4"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
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
    leaveType: "" as LeaveType | "",
    startDate: today,
    endDate: today,
    period: "full" as LeavePeriod,
    hourlyStart: "09:00",
    hourlyEnd: "10:00",
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Leave balance & policy ──
  const [balanceMap, setBalanceMap] = useState<
    Record<
      string,
      {
        remaining: number;
        total: number;
        used: number;
        pending: number;
        allowHourly: boolean;
      }
    >
  >({});
  const [allowHourlySet, setAllowHourlySet] = useState<Set<string>>(new Set());
  const [balanceLoading, setBalanceLoading] = useState(false);

  // ── Computed ──────────────────────────────────────────────────────────────
  const days = calcDays(form.startDate, form.endDate);
  const hourlyCount = form.period === "hourly" ? calcHours(form.hourlyStart, form.hourlyEnd) : 0;

  // effective days used for balance comparison (mirrors DB trigger: hours/8)
  const effectiveDays = (() => {
    if (form.period === "morning") return HALF_DAY_HOURS.morning / 8;
    if (form.period === "afternoon") return HALF_DAY_HOURS.afternoon / 8;
    if (form.period === "hourly") return hourlyCount / 8;
    return days;
  })();

  const showHourly =
    form.leaveType === "personal" && allowHourlySet.has("personal");

  const isValid =
    form.leaveType &&
    form.startDate &&
    form.reason.trim() &&
    (form.period === "hourly" ? hourlyCount > 0 : effectiveDays > 0);

  const currentBalance = form.leaveType ? balanceMap[form.leaveType] : null;
  const allowHourly    = currentBalance?.allowHourly ?? false;
  const unit           = leaveUnit(allowHourly);
  const isOverBalance  =
    currentBalance != null && effectiveDays > 0 && effectiveDays > currentBalance.remaining;

  useEffect(() => {
    // ดึง policies ก่อน (ไม่ขึ้นกับ user balance)
    supabase
      .from("leave_policies")
      .select("leave_type, allow_hourly")
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) {
          const hourlySet = new Set(
            data.filter((p) => p.allow_hourly).map((p) => p.leave_type as string),
          );
          setAllowHourlySet(hourlySet);
        }
      });

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      setBalanceLoading(true);
      const year = new Date().getFullYear();
      supabase
        .from("leave_balances_with_policy")
        .select(
          "leave_type, remaining_days, total_days, used_days, pending_days, allow_hourly",
        )
        .eq("user_id", user.id)
        .eq("year", year)
        .then(({ data, error }) => {
          console.log("balance data:", data);
          console.log("balance error:", error);
          if (data) {
            const map: Record<
              string,
              {
                remaining: number;
                total: number;
                used: number;
                pending: number;
                allowHourly: boolean;
              }
            > = {};
            data.forEach((b) => {
              map[b.leave_type] = {
                remaining: Number(b.remaining_days),
                total: Number(b.total_days),
                used: Number(b.used_days),
                pending: Number(b.pending_days),
                allowHourly: Boolean(b.allow_hourly),
              };
            });
            setBalanceMap(map);
          }
          setBalanceLoading(false);
        });
    });
  }, []);
  const getPeriodLabel = (): string | null => {
    if (!PERIOD_LEAVE_TYPES.includes(form.leaveType as LeaveType)) return null;
    switch (form.period) {
      case "full":      return "ทั้งวัน";
      case "morning":   return "ครึ่งเช้า";
      case "afternoon": return "ครึ่งบ่าย";
      case "hourly":    return `${form.hourlyStart} – ${form.hourlyEnd}`;
    }
  };

  const getSubmitHours = (): number | null => {
    if (form.period === "morning") return HALF_DAY_HOURS.morning;
    if (form.period === "afternoon") return HALF_DAY_HOURS.afternoon;
    if (form.period === "hourly") return calcHours(form.hourlyStart, form.hourlyEnd);
    return null;
  };

  const handleSubmit = async () => {
    if (!isValid || !userId) return;
    setSubmitting(true);
    setError(null);

    const { error: dbError } = await supabase.from("leave_requests").insert({
      user_id: userId,
      leave_type: form.leaveType,
      start_date: form.startDate,
      end_date: form.endDate,
      hours: getSubmitHours(),
      period_label: getPeriodLabel(),
      reason: form.reason.trim(),
      status: "pending",
    });

    if (dbError) {
      setError(dbError.message);
      setSubmitting(false);
    } else {
      setSubmitted(true);
    }
  };

  if (submitted) return <SuccessScreen type="leave" />;

  // ── Shared style tokens ──────────────────────────────────────────────────────
  const inputCls =
    "w-full px-3.5 py-3 rounded-xl border border-gray-200 bg-white text-[15px] font-normal text-gray-900 " +
    "focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all placeholder-gray-300 appearance-none";

  const labelCls = "text-xs font-semibold text-gray-500 mb-1.5 block";

  const showPeriod = PERIOD_LEAVE_TYPES.includes(form.leaveType as LeaveType);

  return (
    <div className="space-y-3 pb-8">
      {/* ── Card 1: ประเภทการลา ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 pt-3.5 pb-0 flex items-center gap-1.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
            ประเภทการลา
          </p>
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 mb-px" />
        </div>
        <div className="px-4 pt-3 pb-4">
          <div className="grid grid-cols-2 gap-2.5">
            {LEAVE_TYPES.map((lt, i) => (
              <button
                key={lt.id}
                onClick={() =>
                  setForm({
                    ...form,
                    leaveType: lt.id,
                    period: "full",
                    hourlyStart: "09:00",
                    hourlyEnd: "10:00",
                  })
                }
                className={`relative flex flex-col items-start p-4 rounded-2xl border-2 transition-all active:scale-95 text-left ${
                  i === LEAVE_TYPES.length - 1 && LEAVE_TYPES.length % 2 !== 0
                    ? "col-span-2"
                    : ""
                } ${
                  form.leaveType === lt.id
                    ? "border-slate-900 bg-slate-900 shadow-lg"
                    : "border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-white"
                }`}
              >
                {/* Icon badge */}
                <span className={`mb-2.5 w-9 h-9 rounded-xl flex items-center justify-center text-lg ${
                  form.leaveType === lt.id ? "bg-white/15" : lt.bg
                }`}>
                  {lt.icon}
                </span>

                <p className={`text-sm font-black ${form.leaveType === lt.id ? "text-white" : "text-gray-800"}`}>
                  {lt.label}
                </p>
                <p className={`text-[11px] mt-0.5 ${form.leaveType === lt.id ? "text-gray-400" : "text-gray-400"}`}>
                  {lt.desc}
                </p>

                {/* Checkmark */}
                {form.leaveType === lt.id && (
                  <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3 text-slate-900">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Balance Card ───────────────────────────────────────────────────────── */}
      {form.leaveType && form.leaveType !== "other" && (
        <div
          className={`rounded-2xl border px-4 py-3.5 transition-all duration-300 ${
            isOverBalance
              ? "bg-rose-50 border-rose-200"
              : "bg-white border-gray-100"
          }`}
        >
          {balanceLoading ? (
            <div className="flex items-center gap-3">
              <div className="h-3 w-24 bg-gray-100 rounded-full animate-pulse" />
              <div className="h-3 w-16 bg-gray-100 rounded-full animate-pulse" />
            </div>
          ) : currentBalance ? (
            <div className="space-y-2.5">
              {/* top row */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500">
                  สิทธิ์คงเหลือ —{" "}
                  {LEAVE_TYPES.find((l) => l.id === form.leaveType)?.label}
                </p>
                {isOverBalance && (
                  <span className="text-[10px] font-bold bg-rose-100 text-rose-600 border border-rose-200 px-2 py-0.5 rounded-full">
                    เกินสิทธิ์
                  </span>
                )}
              </div>

              {/* numbers */}
              <div className="flex items-end gap-1">
                <span
                  className={`text-2xl font-black leading-none ${
                    isOverBalance ? "text-rose-500" : "text-gray-900"
                  }`}
                >
                  {fmtNum(toLeaveDisplay(currentBalance.remaining, allowHourly))}
                </span>
                <span className="text-sm text-gray-400 mb-0.5">
                  / {fmtNum(toLeaveDisplay(currentBalance.total, allowHourly))} {unit}
                </span>
                {effectiveDays > 0 && (
                  <span
                    className={`ml-auto text-sm font-bold ${
                      isOverBalance ? "text-rose-500" : "text-indigo-500"
                    }`}
                  >
                    จะใช้{" "}
                    {form.period === "morning"
                      ? "ครึ่งเช้า (3.5 ชม.)"
                      : form.period === "afternoon"
                        ? "ครึ่งบ่าย (4.5 ชม.)"
                        : form.period === "hourly"
                          ? `${hourlyCount} ชม.`
                          : `${days} วัน`}
                  </span>
                )}
              </div>

              {/* progress bar */}
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isOverBalance
                      ? "bg-rose-400"
                      : currentBalance.used / currentBalance.total > 0.8
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                  }`}
                  style={{
                    width: `${Math.min(
                      ((currentBalance.used + effectiveDays) /
                        currentBalance.total) *
                        100,
                      100,
                    )}%`,
                  }}
                />
              </div>

              {/* detail row */}
              <div className="flex items-center gap-3 text-[11px] text-gray-400">
                <span>
                  ใช้ไปเเล้ว{" "}
                  <strong className="text-gray-600">
                    {fmtNum(toLeaveDisplay(currentBalance.used, allowHourly))}
                  </strong>{" "}
                  {unit}
                </span>
                {currentBalance.pending > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    รออนุมัติ{" "}
                    <strong className="text-amber-600">
                      {fmtNum(toLeaveDisplay(currentBalance.pending, allowHourly))}
                    </strong>{" "}
                    {unit}
                  </span>
                )}
                {isOverBalance && (
                  <span className="text-rose-500 font-semibold ml-auto">
                    เกิน {fmtLeaveBalance(effectiveDays - currentBalance.remaining, allowHourly)}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">ไม่พบข้อมูลสิทธิ์วันลา</p>
          )}
        </div>
      )}

      {/* ── Card 2: วันที่ลา ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 pt-3.5 pb-0 flex items-center gap-1.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
            วันที่ลา
          </p>
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 mb-px" />
        </div>

        {/* วันเริ่มต้น */}
        <div className="px-4 pt-3 pb-1">
          <label className={labelCls}>วันเริ่มต้น</label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) =>
              setForm({
                ...form,
                startDate: e.target.value,
                endDate: e.target.value,
              })
            }
            className={inputCls}
          />
        </div>

        <div className="mx-4 border-t border-gray-50 mt-3" />

        {/* วันสิ้นสุด — ซ่อนเมื่อ period ≠ full */}
        {form.period === "full" && (
          <div className="px-4 pt-3 pb-4">
            <label className={labelCls}>วันสิ้นสุด</label>
            <input
              type="date"
              value={form.endDate}
              min={form.startDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className={inputCls}
            />
          </div>
        )}

        {/* Days / Hours summary badge */}
        {(() => {
          const isHourly = form.period === "hourly";
          const isHalfDay = form.period === "morning" || form.period === "afternoon";
          const badgeActive = isHourly ? hourlyCount > 0 : effectiveDays > 0;
          const badgeLabel = isHourly
            ? `${hourlyCount > 0 ? hourlyCount : "--"}`
            : form.period === "morning"
              ? "ครึ่งเช้า"
              : form.period === "afternoon"
                ? "ครึ่งบ่าย"
                : days > 0 ? `${days}` : "--";
          const badgeUnit = isHourly ? "ชั่วโมง" : isHalfDay ? "" : "วัน";
          return (
            <div
              className={`mx-4 mb-4 flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all duration-200 ${
                badgeActive
                  ? "bg-indigo-50 border-indigo-100"
                  : "bg-gray-50 border-gray-100 opacity-50"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`w-4 h-4 flex-shrink-0 ${badgeActive ? "text-indigo-400" : "text-gray-300"}`}
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
              </svg>
              <span
                className={`text-[13px] font-medium flex-1 ${badgeActive ? "text-indigo-600" : "text-gray-400"}`}
              >
                ระยะเวลาการลา
              </span>
              <span
                className={`text-[18px] font-semibold tabular-nums ${badgeActive ? "text-indigo-700" : "text-gray-300"}`}
              >
                {badgeLabel}
                {badgeUnit && (
                  <span className="text-[12px] font-normal text-indigo-400 ml-1">
                    {badgeUnit}
                  </span>
                )}
              </span>
            </div>
          );
        })()}
      </div>

      {/* ── Card 3: ช่วงเวลา (เฉพาะ sick / personal / special_personal) ──────── */}
      {showPeriod && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 pt-3.5 pb-0">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
              ช่วงเวลา
            </p>
          </div>
          <div className="px-4 pt-3 pb-4 space-y-2.5">
            {/* ทั้งวัน / ครึ่งเช้า / ครึ่งบ่าย */}
            <div className="grid grid-cols-3 gap-2">
              {PERIOD_OPTIONS.map((p) => (
                <button
                  key={p.id}
                  onClick={() =>
                    setForm({ ...form, period: p.id, endDate: form.startDate })
                  }
                  className={`flex flex-col items-start px-3 py-3 rounded-xl border-2 transition-all active:scale-95 text-left ${
                    form.period === p.id
                      ? "border-indigo-400 bg-indigo-50"
                      : "border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-white"
                  }`}
                >
                  <span
                    className={`text-[13px] font-bold ${form.period === p.id ? "text-indigo-700" : "text-gray-800"}`}
                  >
                    {p.label}
                  </span>
                  <span
                    className={`text-[10px] mt-0.5 leading-tight ${form.period === p.id ? "text-indigo-400" : "text-gray-400"}`}
                  >
                    {p.sub}
                  </span>
                </button>
              ))}
            </div>

            {/* ลาเป็นชั่วโมง — เฉพาะลากิจ + allow_hourly */}
            {showHourly && (
              <button
                onClick={() =>
                  setForm({ ...form, period: "hourly", endDate: form.startDate })
                }
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all active:scale-95 text-left ${
                  form.period === "hourly"
                    ? "border-indigo-400 bg-indigo-50"
                    : "border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-white"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className={`w-4 h-4 flex-shrink-0 ${form.period === "hourly" ? "text-indigo-500" : "text-gray-400"}`}
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <div>
                  <span
                    className={`text-[13px] font-bold ${form.period === "hourly" ? "text-indigo-700" : "text-gray-800"}`}
                  >
                    ลาเป็นชั่วโมง
                  </span>
                  <span
                    className={`block text-[10px] mt-0.5 ${form.period === "hourly" ? "text-indigo-400" : "text-gray-400"}`}
                  >
                    ระบุเวลาเริ่ม–สิ้นสุด
                  </span>
                </div>
                {form.period === "hourly" && hourlyCount > 0 && (
                  <span className="ml-auto text-sm font-black text-indigo-600">
                    {hourlyCount} ชม.
                  </span>
                )}
              </button>
            )}

            {/* Time pickers เมื่อเลือก ลาเป็นชั่วโมง */}
            {form.period === "hourly" && (
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div>
                  <p className="text-[11px] text-gray-400 mb-1.5 font-medium">
                    เวลาเริ่ม
                  </p>
                  <input
                    type="time"
                    value={form.hourlyStart}
                    onChange={(e) =>
                      setForm({ ...form, hourlyStart: e.target.value })
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 mb-1.5 font-medium">
                    เวลาสิ้นสุด
                  </p>
                  <input
                    type="time"
                    value={form.hourlyEnd}
                    onChange={(e) =>
                      setForm({ ...form, hourlyEnd: e.target.value })
                    }
                    className={inputCls}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Card 4: เหตุผลการลา ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 pt-3.5 pb-0 flex items-center gap-1.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
            เหตุผลการลา
          </p>
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 mb-px" />
        </div>
        <div className="px-4 pt-3 pb-4">
          <textarea
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="ระบุเหตุผลในการลา เช่น เจ็บป่วย มีธุระจำเป็น"
            rows={3}
            className={
              "w-full px-3.5 py-3 rounded-xl border border-gray-200 bg-white text-[15px] font-normal text-gray-900 " +
              "focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all resize-none placeholder-gray-300 leading-relaxed"
            }
          />
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-4 h-4 text-red-400 flex-shrink-0"
          >
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="text-[13px] text-red-500">{error}</span>
        </div>
      )}

      {/* ── Over balance warning ── */}
      {isOverBalance && (
        <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="text-xs text-amber-700 leading-relaxed">
            วันลาที่ขอเกินสิทธิ์คงเหลือ — ยังสามารถยื่นได้
            แต่ต้องรอการอนุมัติจากหัวหน้าเเผนก
          </p>
        </div>
      )}

      {/* ── Submit Button ── */}
      <button
        onClick={handleSubmit}
        disabled={!isValid || submitting}
        className={`w-full py-4 rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
          isValid && !submitting
            ? isOverBalance
              ? "bg-amber-500 text-white shadow-md shadow-amber-500/20 hover:bg-amber-600"
              : "bg-slate-900 text-white shadow-md shadow-slate-900/15 hover:bg-slate-800"
            : "bg-gray-100 text-gray-300 cursor-not-allowed"
        }`}
      >
        {submitting ? (
          <>
            <svg
              className="w-4 h-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            กำลังส่ง...
          </>
        ) : (
          <>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="w-4 h-4"
            >
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22l-4-9-9-4 20-7z" />
            </svg>
            ยื่นใบลา
            {form.period === "morning"
              ? " (ครึ่งเช้า)"
              : form.period === "afternoon"
                ? " (ครึ่งบ่าย)"
                : form.period === "hourly" && hourlyCount > 0
                  ? ` (${hourlyCount} ชม.)`
                  : days > 0
                    ? ` (${days} วัน)`
                    : ""}
          </>
        )}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NewRequestPage() {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type") as FormType | null;
  const [activeForm, setActiveForm] = useState<FormType>(
    typeParam === "leave" ? "leave" : "ot",
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 sticky top-0 z-20">
        <div className="flex items-center gap-4 mb-4">
          <Link
            href="/requests"
            className="w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center active:scale-95 transition-all"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="w-4 h-4 text-gray-600"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-black text-gray-900 tracking-tight">
              ยื่นคำขอใหม่
            </h1>
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
              {tab === "ot" ? "OT Request" : "Leave Request"}
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
