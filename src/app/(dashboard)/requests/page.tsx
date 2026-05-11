"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import UserAvatar from "@/components/UserAvatar";
import { REFRESH_PENDING_EVENT } from "@/hooks/usePendingApprovals";
import { thresholdFromLeave, computeAttendanceStatus } from "@/lib/attendance";

// ─── Supabase Client ──────────────────────────────────────────────────────────
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Types ────────────────────────────────────────────────────────────────────
type UserRole   = "user" | "manager" | "admin" | "viewer";
type RequestTab = "ot" | "leave";
type ManagerTab = "mine" | "pending";
type ReqStatus  = "pending" | "approved" | "rejected" | "cancel_requested" | "cancelled";
type LeaveType  = "sick" | "personal" | "vacation" | "maternity";
type PeriodFilter = "this_month" | "last_month" | "all";

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  department: string;
  role: UserRole;
}

interface OTRequest {
  id: string;
  user_id: string;
  request_date: string;
  start_time: string;
  end_time: string;
  hours: number;
  project_id: string | null;
  reason: string;
  status: ReqStatus;
  approved_by: string | null;
  reject_reason: string | null;
  actioned_at: string | null;
  created_at: string;
  // จาก View (manager เห็น)
  full_name?: string;
  department?: string;
  project_no?: string;
  project_name?: string;
  avatar_url?: string | null;
  actioned_by_name?: string | null;
}

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days: number;
  hours: number | null;
  period_label: string | null;
  reason: string;
  status: ReqStatus;
  approved_by: string | null;
  reject_reason: string | null;
  actioned_at: string | null;
  created_at: string;
  cancel_reason: string | null;
  cancel_requested_at: string | null;
  cancel_actioned_by: string | null;
  cancel_actioned_at: string | null;
  cancel_reject_reason: string | null;
  // จาก View (manager เห็น)
  full_name?: string;
  department?: string;
  avatar_url?: string | null;
  actioned_by_name?: string | null;
  cancel_actioned_by_name?: string | null;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<ReqStatus, { label: string; bg: string; border: string; bar: string; text: string }> = {
  pending:  { label: "รออนุมัติ",  bg: "bg-amber-50",   border: "border-amber-200",  bar: "bg-amber-400",  text: "text-amber-600" },
  approved: { label: "อนุมัติแล้ว", bg: "bg-emerald-50", border: "border-emerald-200", bar: "bg-emerald-400", text: "text-emerald-600" },
  rejected: { label: "ไม่อนุมัติ",  bg: "bg-rose-50",   border: "border-rose-200",   bar: "bg-rose-400",   text: "text-rose-500" },
  cancel_requested: { label: "รอยกเลิก", bg: "bg-orange-50", border: "border-orange-200", bar: "bg-orange-400", text: "text-orange-600" },
  cancelled: { label: "ยกเลิกแล้ว", bg: "bg-gray-100", border: "border-gray-200", bar: "bg-gray-400", text: "text-gray-500" },
};

const LEAVE_CFG: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  sick:             { label: "ลาป่วย",     icon: "🤒", bg: "bg-rose-100",    text: "text-rose-500"   },
  personal:         { label: "ลากิจ",      icon: "📋", bg: "bg-amber-100",   text: "text-amber-600"  },
  vacation:         { label: "ลาพักร้อน",  icon: "🌴", bg: "bg-violet-100",  text: "text-violet-600" },
  special_personal: { label: "ลากิจพิเศษ", icon: "⭐", bg: "bg-sky-100",     text: "text-sky-600"    },
  holiday_swap:     { label: "แลกวันหยุด", icon: "🔄", bg: "bg-teal-100",    text: "text-teal-600"   },
  other:            { label: "ลาอื่นๆ",    icon: "📝", bg: "bg-gray-200",    text: "text-gray-500"   },
  maternity:        { label: "ลาคลอด",     icon: "👶", bg: "bg-pink-100",    text: "text-pink-500"   },
};

const TH_MONTHS = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// ── สร้าง array ของ date string ทุกวันระหว่าง start ถึง end ──────────────────
function getCalendarDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function fmtDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return `${day} ${TH_MONTHS[m]} ${y + 543}`;
}
function fmtTime(t: string) {
  return t?.slice(0, 5) ?? "-"; // "17:30:00" → "17:30"
}
function fmtDateTime(d: string) {
  const dt = new Date(d);
  return `${dt.getDate()} ${TH_MONTHS[dt.getMonth() + 1]} ${dt.getFullYear() + 543}  ${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")} น.`;
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonthKey(base: string, diff: number) {
  const [year, month] = base.split("-").map(Number);
  const d = new Date(year, month - 1 + diff, 1);
  return monthKey(d);
}

function formatMonthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return `${TH_MONTHS[month]} ${year + 543}`;
}

function getRequestMonth(item: OTRequest | LeaveRequest, type: RequestTab) {
  const date = type === "ot"
    ? (item as OTRequest).request_date
    : (item as LeaveRequest).start_date;
  return date?.slice(0, 7) ?? "";
}

async function revertApprovedLeaveAttendance(leaveReq: Pick<LeaveRequest, "user_id" | "start_date" | "end_date" | "period_label" | "hours">) {
  const leaveDates = getCalendarDatesInRange(leaveReq.start_date, leaveReq.end_date);
  if (leaveDates.length === 0) return;

  const wasFullDay = thresholdFromLeave(leaveReq) === null;

  if (wasFullDay) {
    const { count, error } = await supabase.from("daily_time_logs")
      .delete({ count: "exact" })
      .eq("user_id", leaveReq.user_id)
      .eq("status", "leave")
      .in("log_date", leaveDates);

    if (error || (count ?? 0) < leaveDates.length) {
      await supabase.from("daily_time_logs")
        .update({ work_type: null, status: "absent" })
        .eq("user_id", leaveReq.user_id)
        .eq("status", "leave")
        .is("first_check_in", null)
        .is("last_check_out", null)
        .in("log_date", leaveDates);
    }
    return;
  }

  for (const date of leaveDates) {
    const { data: log } = await supabase
      .from("daily_time_logs")
      .select("first_check_in, status")
      .eq("user_id", leaveReq.user_id)
      .eq("log_date", date)
      .maybeSingle();

    if (log?.first_check_in) {
      const newStatus = computeAttendanceStatus(log.first_check_in, 8 * 60 + 30);
      if (newStatus !== log.status) {
        await supabase
          .from("daily_time_logs")
          .update({ status: newStatus })
          .eq("user_id", leaveReq.user_id)
          .eq("log_date", date);
      }
    }
  }
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ["bg-violet-400", "bg-sky-400", "bg-rose-400", "bg-emerald-400", "bg-amber-400", "bg-indigo-400"];
function avatarColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function Avatar({ name, userId, avatarUrl, size = "sm" }: {
  name: string;
  userId: string;
  avatarUrl?: string | null; // ✅ เพิ่ม optional prop
  size?: "sm" | "md";
}) {
  const sizeClass = size === "md" ? "w-10 h-10 text-sm" : "w-7 h-7 text-xs";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        referrerPolicy="no-referrer"
        className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
      />
    );
  }

  return (
    <div className={`${sizeClass} ${avatarColor(userId)} rounded-full flex items-center justify-center text-white font-black flex-shrink-0`}>
      {name?.charAt(0) ?? "?"}
    </div>
  );
}

function OTCard({ req, showUser, onClick }: { req: OTRequest; showUser: boolean; onClick: () => void }) {
  const st  = STATUS_CFG[req.status];
  const day   = req.request_date?.split("-")[2];
  const month = TH_MONTHS[Number(req.request_date?.split("-")[1])];

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm active:scale-[0.99] transition-all cursor-pointer overflow-hidden"
    >
      {/* Top row */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        {/* Date badge */}
        <div className="flex-shrink-0 w-11 h-13 flex flex-col items-center justify-center bg-gray-50 rounded-xl px-2 py-2.5">
          <span className="text-base font-black text-gray-800 leading-none">{day}</span>
          <span className="text-[10px] font-semibold text-gray-400 mt-0.5">{month}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {showUser && req.full_name && (
            <div className="flex items-center gap-1.5 mb-2">
              <Avatar name={req.full_name} userId={req.user_id} avatarUrl={req.avatar_url} />
              <div>
                <p className="text-xs font-black text-gray-800 leading-none">{req.full_name}</p>
                <p className="text-[10px] text-gray-400">{req.department}</p>
              </div>
            </div>
          )}

          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-gray-900 truncate leading-snug">
              {req.project_no ? `#${req.project_no}${req.project_name ? ` – ${req.project_name}` : ""}` : "ไม่ระบุโปรเจกต์"}
            </p>
            <span className={`flex-shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}>
              {st.label}
            </span>
          </div>

          {req.reason && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{req.reason}</p>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className={`px-4 py-2.5 border-t ${st.border} ${st.bg}`}>
        {/* Row 1: เวลา OT */}
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-gray-400">
              <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
            </svg>
            {fmtTime(req.start_time)} – {fmtTime(req.end_time)}
          </span>
          <span className={`text-xs font-black ${st.text}`}>{req.hours} ชม.</span>
        </div>

      </div>
    </div>
  );
}

// SVG icons inline สำหรับ card (ใช้ซ้ำจาก LeaveIcons config)
const LeaveCardIcon: Record<string, React.ReactNode> = {
  sick: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M9 7V5a3 3 0 0 1 6 0v2" />
      <rect x="4" y="7" width="16" height="13" rx="3" />
      <path d="M12 11v5" />
      <path d="M9.5 13.5h5" />
    </svg>
  ),
  personal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M9 5h6" />
      <path d="M9 3h6a2 2 0 0 1 2 2v1H7V5a2 2 0 0 1 2-2Z" />
      <path d="M7 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
    </svg>
  ),
  vacation: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M4 13a8 8 0 0 1 16 0" />
      <path d="M4 13h16" />
      <path d="M12 13v7" />
      <path d="M12 20a2 2 0 0 0 4 0" />
      <path d="M8 6.5 6.5 5" />
      <path d="M16 6.5 17.5 5" />
      <path d="M12 5V3" />
    </svg>
  ),
  special_personal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M12 3 14.6 8.4 20.5 9.2 16.2 13.4 17.2 19.3 12 16.5 6.8 19.3 7.8 13.4 3.5 9.2 9.4 8.4 12 3Z" />
    </svg>
  ),
  holiday_swap: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a3 3 0 0 1 3-3h15" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a3 3 0 0 1-3 3H3" />
    </svg>
  ),
  other: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
  ),
  maternity: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
};

function LeaveCard({ req, showUser, onClick }: { req: LeaveRequest; showUser: boolean; onClick: () => void }) {
  const st = STATUS_CFG[req.status];
  const lt = LEAVE_CFG[req.leave_type];
  const isSameDay = req.start_date === req.end_date;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm active:scale-[0.99] transition-all cursor-pointer overflow-hidden"
    >
      {/* Top row */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        {/* Type icon badge */}
        <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${lt.bg} ${lt.text}`}>
          {LeaveCardIcon[req.leave_type]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {showUser && req.full_name && (
            <div className="flex items-center gap-1.5 mb-2">
              <Avatar name={req.full_name} userId={req.user_id} avatarUrl={req.avatar_url} />
              <div>
                <p className="text-xs font-black text-gray-800 leading-none">{req.full_name}</p>
                <p className="text-[10px] text-gray-400">{req.department}</p>
              </div>
            </div>
          )}

          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-gray-900">{lt.label}</p>
            <span className={`flex-shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}>
              {st.label}
            </span>
          </div>

          {req.reason && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{req.reason}</p>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className={`px-4 py-2.5 border-t ${st.border} ${st.bg}`}>
        {/* Row 1: วันที่ลา */}
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-gray-400">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>
            </svg>
            {isSameDay ? fmtDate(req.start_date) : `${fmtDate(req.start_date)} – ${fmtDate(req.end_date)}`}
          </span>
          <span className={`text-xs font-black ${st.text}`}>
            {req.hours != null ? `${req.hours} ชม.` : `${req.days} วัน`}
          </span>
        </div>

       
      </div>
    </div>
  );
}

// ─── Bottom Sheet ─────────────────────────────────────────────────────────────
// ─── Bottom Sheet ─────────────────────────────────────────────────────────────
function BottomSheet({
  item,
  type,
  canAct,
  canActCancel = false,
  canRequestCancel = false,
  onClose,
  onApprove,
  onReject,
  onApproveCancel,
  onRejectCancel,
  onRequestCancel,
}: {
  item: OTRequest | LeaveRequest;
  type: "ot" | "leave";
  canAct: boolean;
  canActCancel?: boolean;
  canRequestCancel?: boolean;
  onClose: () => void;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
  onApproveCancel?: (id: string) => Promise<void>;
  onRejectCancel?: (id: string, reason: string) => Promise<void>;
  onRequestCancel?: (id: string, reason: string) => Promise<void>;
}) {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason]       = useState("");
  const [showCancelInput, setShowCancelInput] = useState(false);
  const [cancelReason, setCancelReason]       = useState("");
  const [loading, setLoading]                 = useState(false);
  const st = STATUS_CFG[item.status];

  const name     = (item as OTRequest).full_name ?? "ฉัน";
  const dept     = (item as OTRequest).department ?? "";
  const avatarUrl = (item as OTRequest).avatar_url ?? null;
  const actionedByName = (item as OTRequest).actioned_by_name ?? null;
  const cancelActionedByName = (item as LeaveRequest).cancel_actioned_by_name ?? null;

  const handleApprove = async () => {
    setLoading(true);
    await onApprove(item.id);
    setLoading(false);
    onClose();
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setLoading(true);
    await onReject(item.id, rejectReason);
    setLoading(false);
    onClose();
  };

  const handleApproveCancel = async () => {
    if (!onApproveCancel) return;
    setLoading(true);
    await onApproveCancel(item.id);
    setLoading(false);
    onClose();
  };

  const handleRejectCancel = async () => {
    if (!rejectReason.trim() || !onRejectCancel) return;
    setLoading(true);
    await onRejectCancel(item.id, rejectReason);
    setLoading(false);
    onClose();
  };

  const handleRequestCancel = async () => {
    if (!cancelReason.trim() || !onRequestCancel) return;
    setLoading(true);
    await onRequestCancel(item.id, cancelReason);
    setLoading(false);
    onClose();
  };

  // ── Row definitions (SVG icons แทน emoji) ──────────────────────────────────
  type InfoRow = { icon: React.ReactNode; label: string; value: string };

  const CalendarIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>
    </svg>
  );
  const ClockIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
      <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>
    </svg>
  );
  const FolderIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
    </svg>
  );
  const NoteIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/>
    </svg>
  );
  const SubmitIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
      <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
    </svg>
  );
  const TagIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  );
  const DaysIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="8" y1="14" x2="16" y2="14"/>
    </svg>
  );

  const otItem    = item as OTRequest;
  const leaveItem = item as LeaveRequest;

  const rows: InfoRow[] = type === "ot"
    ? [
        { icon: CalendarIcon, label: "วันที่",    value: fmtDate(otItem.request_date) },
        { icon: ClockIcon,    label: "ช่วงเวลา",  value: `${fmtTime(otItem.start_time)} – ${fmtTime(otItem.end_time)}  (${otItem.hours} ชม.)` },
        { icon: FolderIcon,   label: "โปรเจกต์",  value: otItem.project_no ? `#${otItem.project_no}${otItem.project_name ? ` – ${otItem.project_name}` : ""}` : "ไม่ระบุ" },
        { icon: NoteIcon,     label: "เหตุผล",    value: item.reason },
        { icon: SubmitIcon,   label: "ยื่นเมื่อ",  value: fmtDateTime(item.created_at) },
      ]
    : [
        { icon: TagIcon,      label: "ประเภท",    value: LEAVE_CFG[leaveItem.leave_type].label },
        { icon: CalendarIcon, label: "วันที่ลา",  value: leaveItem.start_date === leaveItem.end_date ? fmtDate(leaveItem.start_date) : `${fmtDate(leaveItem.start_date)} – ${fmtDate(leaveItem.end_date)}` },
        { icon: DaysIcon,     label: leaveItem.hours != null ? "จำนวนชั่วโมง" : "จำนวนวัน",
                              value: leaveItem.hours != null ? `${leaveItem.hours} ชม.${leaveItem.period_label ? ` (${leaveItem.period_label})` : ""}` : `${leaveItem.days} วัน` },
        { icon: NoteIcon,     label: "เหตุผล",   value: item.reason },
        { icon: SubmitIcon,   label: "ยื่นเมื่อ", value: fmtDateTime(item.created_at) },
      ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh]">

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5">

          {/* ── Header: Avatar + Status badge ── */}
          <div className="flex items-center justify-between py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <Avatar name={name} userId={item.user_id} avatarUrl={avatarUrl} size="md" />
              <div>
                <p className="text-sm font-black text-gray-900">{name}</p>
                {dept && <p className="text-xs text-gray-400">{dept}</p>}
              </div>
            </div>
            <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full ${st.bg} ${st.text}`}>
              {st.label}
            </span>
          </div>

          {/* ── Info rows ── */}
          <div className="py-3 space-y-0 divide-y divide-gray-50">
            {rows.map((row, i) => (
              <div key={i} className="flex items-start gap-3 py-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 mt-0.5">
                  {row.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{row.label}</p>
                  <p className="text-sm font-semibold text-gray-800 break-words">{row.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Actioned by (อนุมัติ/ไม่อนุมัติโดยใคร) ── */}
          {(item.status === "approved" || item.status === "rejected" || item.status === "cancelled") && (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border mb-4 ${
              item.status === "approved"
                ? "bg-emerald-50 border-emerald-100"
                : item.status === "cancelled"
                  ? "bg-gray-50 border-gray-100"
                  : "bg-rose-50 border-rose-100"
            }`}>
              <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                item.status === "approved" ? "bg-emerald-100" : item.status === "cancelled" ? "bg-gray-100" : "bg-rose-100"
              }`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className={`w-4 h-4 ${item.status === "approved" ? "text-emerald-600" : item.status === "cancelled" ? "text-gray-500" : "text-rose-500"}`}>
                  {item.status === "approved"
                    ? <polyline points="20 6 9 17 4 12" />
                    : item.status === "cancelled"
                      ? <path d="M18 6 6 18M6 6l12 12" />
                    : <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                  }
                </svg>
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-semibold uppercase tracking-wide mb-0.5 ${
                  item.status === "approved" ? "text-emerald-500" : item.status === "cancelled" ? "text-gray-400" : "text-rose-400"
                }`}>
                  {item.status === "approved" ? "อนุมัติโดย" : item.status === "cancelled" ? "ยกเลิกโดย" : "ไม่อนุมัติโดย"}
                </p>
                <p className={`text-sm font-black ${
                  item.status === "approved" ? "text-emerald-700" : item.status === "cancelled" ? "text-gray-700" : "text-rose-600"
                }`}>
                  {item.status === "cancelled" ? (cancelActionedByName ?? "—") : (actionedByName ?? "—")}
                </p>
                {(item.status === "cancelled" ? (item as LeaveRequest).cancel_actioned_at : item.actioned_at) && (
                  <p className={`text-[11px] mt-0.5 ${
                    item.status === "approved" ? "text-emerald-400" : item.status === "cancelled" ? "text-gray-400" : "text-rose-300"
                  }`}>
                    {fmtDateTime((item.status === "cancelled" ? (item as LeaveRequest).cancel_actioned_at : item.actioned_at)!)}
                  </p>
                )}
              </div>
            </div>
          )}

          {type === "leave" && (leaveItem.status === "cancel_requested" || leaveItem.status === "cancelled") && leaveItem.cancel_reason && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-orange-50 border border-orange-100 mb-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-white flex items-center justify-center text-orange-500">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                  <path d="M12 5v7l4 2" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
              </span>
              <div>
                <p className="text-[11px] font-semibold text-orange-500 uppercase tracking-wide mb-0.5">เหตุผลขอยกเลิก</p>
                <p className="text-sm font-semibold text-gray-800">{leaveItem.cancel_reason}</p>
                {leaveItem.cancel_requested_at && (
                  <p className="text-[11px] text-orange-400 mt-1">{fmtDateTime(leaveItem.cancel_requested_at)}</p>
                )}
              </div>
            </div>
          )}

          {/* ── Reject reason (ถ้ามี) ── */}
          {item.status === "rejected" && item.reject_reason && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 mb-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-gray-500">
                  <circle cx="12" cy="12" r="9"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </span>
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">เหตุผลที่ไม่อนุมัติ</p>
                <p className="text-sm font-semibold text-gray-700">{item.reject_reason}</p>
              </div>
            </div>
          )}

          {/* ── Manager: Reject input ── */}
          {(canAct || canActCancel) && showRejectInput && (
            <div className="mb-4 space-y-2">
              <textarea
                autoFocus
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={canActCancel ? "ระบุเหตุผลที่ไม่อนุมัติการยกเลิก..." : "ระบุเหตุผลที่ไม่อนุมัติ..."}
                rows={3}
                className="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-50 placeholder-gray-300 resize-none transition-all"
              />
            </div>
          )}

          {canRequestCancel && showCancelInput && (
            <div className="mb-4 space-y-2">
              <textarea
                autoFocus
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="ระบุเหตุผลที่ต้องการยกเลิกใบลานี้..."
                rows={3}
                className="w-full px-4 py-3 text-sm bg-orange-50 border border-orange-100 rounded-2xl outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-50 placeholder-orange-300 resize-none transition-all"
              />
            </div>
          )}
        </div>

        {/* ── Action buttons ── */}
        <div className="px-5 pb-8 pt-3 flex-shrink-0 border-t border-gray-50 space-y-2.5">
          {canAct && !showRejectInput && (
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowRejectInput(true)}
                className="flex-1 py-3.5 rounded-2xl border-2 border-rose-200 text-rose-500 font-bold text-sm hover:bg-rose-50 transition-all flex items-center justify-center gap-2"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                ไม่อนุมัติ
              </button>
              <button
                onClick={handleApprove}
                disabled={loading}
                className="flex-1 py-3.5 rounded-2xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 disabled:opacity-60 transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
                อนุมัติ
              </button>
            </div>
          )}
          {canAct && showRejectInput && (
            <div className="flex gap-2.5">
              <button
                onClick={() => { setShowRejectInput(false); setRejectReason(""); }}
                className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-500 font-bold text-sm hover:bg-gray-50 transition-all"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || loading}
                className="flex-1 py-3.5 rounded-2xl bg-rose-500 text-white font-bold text-sm hover:bg-rose-600 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
              >
                ยืนยันไม่อนุมัติ
              </button>
            </div>
          )}
          {canActCancel && !showRejectInput && (
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowRejectInput(true)}
                className="flex-1 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-500 font-bold text-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
              >
                ไม่อนุมัติยกเลิก
              </button>
              <button
                onClick={handleApproveCancel}
                disabled={loading}
                className="flex-1 py-3.5 rounded-2xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 disabled:opacity-60 transition-all shadow-lg shadow-orange-200 flex items-center justify-center gap-2"
              >
                อนุมัติยกเลิก
              </button>
            </div>
          )}
          {canActCancel && showRejectInput && (
            <div className="flex gap-2.5">
              <button
                onClick={() => { setShowRejectInput(false); setRejectReason(""); }}
                className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-500 font-bold text-sm hover:bg-gray-50 transition-all"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleRejectCancel}
                disabled={!rejectReason.trim() || loading}
                className="flex-1 py-3.5 rounded-2xl bg-gray-800 text-white font-bold text-sm hover:bg-gray-900 disabled:opacity-40 transition-all"
              >
                ยืนยันไม่อนุมัติยกเลิก
              </button>
            </div>
          )}
          {canRequestCancel && !showCancelInput && (
            <button
              onClick={() => setShowCancelInput(true)}
              className="w-full py-3.5 rounded-2xl border-2 border-orange-200 bg-orange-50 text-orange-600 font-bold text-sm hover:bg-orange-100 transition-all"
            >
              ขอยกเลิกใบลา
            </button>
          )}
          {canRequestCancel && showCancelInput && (
            <div className="flex gap-2.5">
              <button
                onClick={() => { setShowCancelInput(false); setCancelReason(""); }}
                className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-500 font-bold text-sm hover:bg-gray-50 transition-all"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleRequestCancel}
                disabled={!cancelReason.trim() || loading}
                className="flex-1 py-3.5 rounded-2xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 disabled:opacity-40 transition-all"
              >
                ส่งคำขอยกเลิก
              </button>
            </div>
          )}
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl bg-gray-100 text-gray-600 font-bold text-sm hover:bg-gray-200 transition-all"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Summary Strip ────────────────────────────────────────────────────────────
function SummaryIcon({ type }: { type: "pending" | "approved" | "hours" | "leave" }) {
  const iconClass = "h-4 w-4";
  if (type === "pending") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  if (type === "approved") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={iconClass}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  if (type === "leave") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass}>
        <rect x="3" y="4" width="18" height="17" rx="3" />
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <path d="M3 10h18" />
        <path d="M9 15h6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function SummaryStrip({
  items,
  caption,
}: {
  items: {
    label: string;
    value: number;
    unit: string;
    c: string;
    bg: string;
    border: string;
    icon: "pending" | "approved" | "hours" | "leave";
  }[];
  caption: string;
}) {
  return (
    <div className="mb-5">
      <p className="mb-3 text-[11px] font-medium text-gray-400">
        แสดงข้อมูล: <span className="font-semibold text-gray-500">{caption}</span>
      </p>
      <div className="grid grid-cols-3 gap-2">
        {items.map((it) => (
          <div
            key={it.label}
            className="flex flex-col rounded-2xl bg-white p-3.5 shadow-[0_1px_6px_rgba(0,0,0,0.06)] border border-gray-100"
          >
            {/* Icon circle */}
            <span className={`mb-3 flex h-8 w-8 items-center justify-center rounded-xl ${it.bg} ${it.c}`}>
              <SummaryIcon type={it.icon} />
            </span>

            {/* Value */}
            <p className={`text-[26px] font-black leading-none tabular-nums ${it.c}`}>
              {Number.isInteger(it.value) ? it.value : it.value.toFixed(1)}
            </p>

            {/* Label */}
            <p className="mt-1.5 text-[11px] font-semibold leading-snug text-gray-600">
              {it.label}
            </p>

            {/* Unit */}
            <p className="mt-0.5 text-[10px] font-medium text-gray-400">{it.unit}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PeriodFilterBar({
  value,
  onChange,
}: {
  value: PeriodFilter;
  onChange: (value: PeriodFilter) => void;
}) {
  const options: { id: PeriodFilter; label: string }[] = [
    { id: "this_month", label: "เดือนนี้" },
    { id: "last_month", label: "เดือนก่อน" },
    { id: "all", label: "ทั้งหมด" },
  ];

  return (
    <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max rounded-2xl bg-gray-100 p-1">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            className={`rounded-xl px-3 py-2 text-xs font-bold transition-all ${
              value === option.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-400"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-gray-300">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
          <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
        </svg>
      </div>
      <p className="text-sm font-bold text-gray-400">{text}</p>
      <p className="text-xs text-gray-300 mt-1">กดปุ่มด้านล่างเพื่อยื่นคำขอ</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
          <div className="flex gap-3">
            <div className="w-12 h-14 rounded-xl bg-gray-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-100 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RequestsPage() {
  const [profile,     setProfile]     = useState<Profile | null>(null);
  const [loading,     setLoading]     = useState(true);

  const [managerTab,       setManagerTab]       = useState<ManagerTab>("mine");
  const [requestTab,       setRequestTab]       = useState<RequestTab>("ot");
  const [managerPendingTab, setManagerPendingTab] = useState<RequestTab>("ot");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("this_month");

  // My requests
  const [myOT,    setMyOT]    = useState<OTRequest[]>([]);
  const [myLeave, setMyLeave] = useState<LeaveRequest[]>([]);

  // Dept requests (manager only) — from views
  const [deptOT,    setDeptOT]    = useState<OTRequest[]>([]);
  const [deptLeave, setDeptLeave] = useState<LeaveRequest[]>([]);

  // Bottom sheet
  const [selectedOT,    setSelectedOT]    = useState<OTRequest | null>(null);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);

  const isManager = profile?.role === "manager" || profile?.role === "admin";

  const dispatchRefresh = () =>
    window.dispatchEvent(new Event(REFRESH_PENDING_EVENT));

  // ── Load profile ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, department, role")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data as Profile);
    };
    init();
  }, []);

  // ── Fetch my requests ─────────────────────────────────────────────────────────
  const fetchMyRequests = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    const [otRes, lvRes] = await Promise.all([
      supabase
        .from("ot_requests_with_profile") 
        .select("*")
        .eq("user_id", profile.id)
        .order("request_date", { ascending: false }),
      supabase
        .from("leave_requests_with_profile")
        .select("*")
        .eq("user_id", profile.id)
        .order("start_date", { ascending: false }),
    ]);

    if (otRes.data) setMyOT(otRes.data as OTRequest[]);
    if (lvRes.data) setMyLeave(lvRes.data as LeaveRequest[]);
    setLoading(false);
  }, [profile]);

  // ── Fetch dept requests (manager) ─────────────────────────────────────────────
  const fetchDeptRequests = useCallback(async () => {
  if (!profile || !isManager) return;

  const isAdmin = profile.role === "admin";

  // Base query
  let otQuery = supabase
    .from("ot_requests_with_profile")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  let lvQuery = supabase
    .from("leave_requests_with_profile")
    .select("*")
    .in("status", ["pending", "cancel_requested"])
    .order("created_at", { ascending: true });

  // Manager เห็นแค่แผนกตัวเอง, Admin เห็นทั้งหมด
  if (!isAdmin) {
    otQuery = otQuery.eq("department", profile.department);
    lvQuery = lvQuery.eq("department", profile.department);
  }

  const [otRes, lvRes] = await Promise.all([otQuery, lvQuery]);

  if (otRes.data) setDeptOT(otRes.data as OTRequest[]);
  if (lvRes.data) setDeptLeave(lvRes.data as LeaveRequest[]);
}, [profile, isManager]);

  useEffect(() => { fetchMyRequests(); },   [fetchMyRequests]);
  useEffect(() => { fetchDeptRequests(); }, [fetchDeptRequests]);

  // ── Approve / Reject handlers ─────────────────────────────────────────────────
  const handleApproveOT = async (id: string) => {
    await supabase.from("ot_requests").update({
      status: "approved",
      approved_by: profile!.id,
      actioned_at: new Date().toISOString(),
    }).eq("id", id);
    await Promise.all([fetchMyRequests(), fetchDeptRequests()]);
    dispatchRefresh();
  };

  const handleRejectOT = async (id: string, reason: string) => {
    await supabase.from("ot_requests").update({
      status: "rejected",
      reject_reason: reason,
      approved_by: profile!.id,
      actioned_at: new Date().toISOString(),
    }).eq("id", id);
    await Promise.all([fetchMyRequests(), fetchDeptRequests()]);
    dispatchRefresh();
  };

  // ✅ โค้ดใหม่
const handleApproveLeave = async (id: string) => {
  // 1. Approve leave request
  await supabase.from("leave_requests").update({
    status: "approved",
    approved_by: profile!.id,
    actioned_at: new Date().toISOString(),
  }).eq("id", id);

  // 2. หา leave request ที่เพิ่ง approve
  const leaveReq = [...deptLeave, ...myLeave].find(r => r.id === id);
  if (leaveReq) {
    // สร้าง date range ทุกวันในช่วงลา
    const leaveDates: string[] = [];
    const [sy, sm, sd] = leaveReq.start_date.split("-").map(Number);
    const [ey, em, ed] = leaveReq.end_date.split("-").map(Number);
    const start = new Date(sy, sm - 1, sd);
    const end   = new Date(ey, em - 1, ed);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      leaveDates.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      );
    }

    const threshold = thresholdFromLeave(leaveReq);
    const isFullDay = threshold === null;

    if (isFullDay) {
      // 3a. ลาทั้งวัน → upsert status = "leave"
      await supabase.from("daily_time_logs").upsert(
        leaveDates.map(date => ({
          user_id:   leaveReq.user_id,
          log_date:  date,
          work_type: "leave",
          status:    "leave",
        })),
        { onConflict: "user_id,log_date" }
      );
    } else {
      // 3b. ลาครึ่งวัน / รายชั่วโมง → recalculate status ของวันที่ check-in แล้ว
      for (const date of leaveDates) {
        const { data: log } = await supabase
          .from("daily_time_logs")
          .select("first_check_in, status")
          .eq("user_id", leaveReq.user_id)
          .eq("log_date", date)
          .maybeSingle();

        if (log?.first_check_in) {
          const newStatus = computeAttendanceStatus(log.first_check_in, threshold);
          if (newStatus !== log.status) {
            await supabase
              .from("daily_time_logs")
              .update({ status: newStatus })
              .eq("user_id", leaveReq.user_id)
              .eq("log_date", date);
          }
        }
      }
    }
  }

  await Promise.all([fetchMyRequests(), fetchDeptRequests()]);
  dispatchRefresh();
};

const handleRejectLeave = async (id: string, reason: string) => {
  // ดึงข้อมูลก่อน (รวม period + hours เพื่อแยก full-day / half-day)
  const { data: leaveReq } = await supabase
    .from("leave_requests")
    .select("user_id, start_date, end_date, status, period_label, hours")
    .eq("id", id)
    .single();

  await supabase.from("leave_requests").update({
    status: "rejected",
    reject_reason: reason,
    approved_by: profile!.id,
    actioned_at: new Date().toISOString(),
  }).eq("id", id);

  // ถ้าเคย approve แล้ว → revert daily_time_logs
  if (leaveReq && leaveReq.status === "approved") {
    await revertApprovedLeaveAttendance(leaveReq);
  }

  await Promise.all([fetchMyRequests(), fetchDeptRequests()]);
  dispatchRefresh();
};

  // ── Computed counts ───────────────────────────────────────────────────────────
const handleRequestLeaveCancel = async (id: string, reason: string) => {
  await supabase.from("leave_requests").update({
    status: "cancel_requested",
    cancel_reason: reason,
    cancel_requested_at: new Date().toISOString(),
    cancel_actioned_by: null,
    cancel_actioned_at: null,
    cancel_reject_reason: null,
  }).eq("id", id).eq("status", "approved");

  await Promise.all([fetchMyRequests(), fetchDeptRequests()]);
  dispatchRefresh();
};

const handleApproveLeaveCancel = async (id: string) => {
  const { error } = await supabase.rpc("cancel_leave_request", {
    p_request_id: id,
  });

  if (error) {
    console.error("cancel_leave_request error:", error);
    alert(error.message || "ไม่สามารถอนุมัติยกเลิกใบลาได้");
    return;
  }

  await Promise.all([fetchMyRequests(), fetchDeptRequests()]);
  dispatchRefresh();
};

const handleRejectLeaveCancel = async (id: string, reason: string) => {
  await supabase.from("leave_requests").update({
    status: "approved",
    cancel_actioned_by: profile!.id,
    cancel_actioned_at: new Date().toISOString(),
    cancel_reject_reason: reason,
  }).eq("id", id).eq("status", "cancel_requested");

  await Promise.all([fetchMyRequests(), fetchDeptRequests()]);
  dispatchRefresh();
};

  const totalDeptPending = deptOT.length + deptLeave.length;
  const myPendingOT      = myOT.filter((r) => r.status === "pending").length;
  const myPendingLeave   = myLeave.filter((r) => r.status === "pending" || r.status === "cancel_requested").length;

  const activeMonth = useMemo(() => {
    if (periodFilter === "last_month") return shiftMonthKey(monthKey(), -1);
    return monthKey();
  }, [periodFilter]);

  const periodCaption = useMemo(() => {
    if (periodFilter === "all") return "ทั้งหมด";
    if (periodFilter === "last_month") return formatMonthLabel(activeMonth);
    return formatMonthLabel(activeMonth);
  }, [periodFilter, activeMonth]);

  const filteredMyOT = useMemo(() => {
    if (periodFilter === "all") return myOT;
    return myOT.filter((r) => getRequestMonth(r, "ot") === activeMonth);
  }, [myOT, periodFilter, activeMonth]);

  const filteredMyLeave = useMemo(() => {
    if (periodFilter === "all") return myLeave;
    return myLeave.filter((r) => getRequestMonth(r, "leave") === activeMonth);
  }, [myLeave, periodFilter, activeMonth]);

  const activeList = requestTab === "ot" ? filteredMyOT : filteredMyLeave;
  const activeEmptyText =
    periodFilter === "all"
      ? requestTab === "ot"
        ? "ยังไม่มีคำขอ OT"
        : "ยังไม่มีใบลา"
      : requestTab === "ot"
        ? `ยังไม่มีคำขอ OT ใน ${periodCaption}`
        : `ยังไม่มีใบลาใน ${periodCaption}`;

  const dept = profile?.department ?? "";
  const fullName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "";

  return (
    <div className="min-h-screen bg-gray-50 pb-28">

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">Requests</h1>
            <p className="text-xs text-gray-400 mt-0.5">
  {profile?.role === "admin"
    ? "ทุกแผนก"
    : dept ? `แผนก ${dept}` : "กำลังโหลด..."}
  {isManager && (
    <span className={`ml-2 font-semibold ${
      profile?.role === "admin" ? "text-rose-400" : "text-indigo-400"
    }`}>
      · {profile?.role === "admin" ? "Admin" : "Manager"}
    </span>
  )}
</p>
          </div>
          {(isManager ? totalDeptPending : myPendingOT + myPendingLeave) > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {isManager ? totalDeptPending : myPendingOT + myPendingLeave}
            </span>
          )}
        </div>

        {/* Manager top-tab */}
        {isManager && (
          <div className="flex bg-gray-100 rounded-2xl p-1 gap-1 mb-2">
            {([
              { id: "mine" as ManagerTab,    label: "คำขอของฉัน" },
              { id: "pending" as ManagerTab, label: "รออนุมัติ", badge: totalDeptPending },
            ]).map((t) => (
              <button key={t.id} onClick={() => setManagerTab(t.id)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                  managerTab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"
                }`}>
                {t.label}
                {!!t.badge && t.badge > 0 && (
  <span className="w-5 h-5 rounded-full bg-amber-400 text-white text-[10px] font-black flex items-center justify-center">{t.badge}</span>
)}
              </button>
            ))}
          </div>
        )}

        {/* OT / Leave sub-tab (mine view) */}
        {(!isManager || managerTab === "mine") && (
          <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
            {(["ot", "leave"] as RequestTab[]).map((t) => {
              const badge = t === "ot" ? myPendingOT : myPendingLeave;
              return (
                <button key={t} onClick={() => setRequestTab(t)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                    requestTab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"
                  }`}>
                  {t === "ot"
                    ? <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>OT Request</>
                    : <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>Leave Request</>
                  }
                  {badge > 0 && (
                    <span className="w-4 h-4 rounded-full bg-amber-400 text-white text-[9px] font-black flex items-center justify-center">{badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="px-4 pt-5">

        {/* MANAGER: Pending tab */}
        {isManager && managerTab === "pending" && (
          <>
            {totalDeptPending > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl mb-5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                <p className="text-sm font-bold text-amber-700">
                  รอการอนุมัติ {totalDeptPending} รายการ — OT {deptOT.length} | ใบลา {deptLeave.length}
                </p>
              </div>
            )}

            <div className="flex bg-gray-100 rounded-2xl p-1 gap-1 mb-5">
              {(["ot", "leave"] as RequestTab[]).map((t) => {
                const cnt = t === "ot" ? deptOT.length : deptLeave.length;
                return (
                  <button key={t} onClick={() => setManagerPendingTab(t)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                      managerPendingTab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"
                    }`}>
                    {t === "ot" ? "OT Request" : "Leave Request"}
                    {cnt > 0 && (
                      <span className="w-5 h-5 rounded-full bg-amber-400 text-white text-[10px] font-black flex items-center justify-center">{cnt}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              {managerPendingTab === "ot"
                ? deptOT.length === 0 ? <EmptyState text="ไม่มีคำขอ OT ที่รออนุมัติ ✓" />
                  : deptOT.map((r) => <OTCard key={r.id} req={r} showUser={true} onClick={() => setSelectedOT(r)} />)
                : deptLeave.length === 0 ? <EmptyState text="ไม่มีใบลาที่รออนุมัติ ✓" />
                  : deptLeave.map((r) => <LeaveCard key={r.id} req={r} showUser={true} onClick={() => setSelectedLeave(r)} />)
              }
            </div>
          </>
        )}

        {/* MY REQUESTS */}
        {(!isManager || managerTab === "mine") && (
          <>
            <PeriodFilterBar
              value={periodFilter}
              onChange={setPeriodFilter}
            />

            {requestTab === "ot"
              ? <SummaryStrip items={[
                  { label: "รออนุมัติ",  value: filteredMyOT.filter((r) => r.status === "pending").length, unit: "รายการ", c: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-100", icon: "pending" },
                  { label: "อนุมัติแล้ว", value: filteredMyOT.filter((r) => r.status === "approved").length, unit: "รายการ", c: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100", icon: "approved" },
                  { label: "ชั่วโมง OT", value: filteredMyOT.filter((r) => r.status === "approved").reduce((s, r) => s + Number(r.hours), 0), unit: "ชม.", c: "text-sky-600", bg: "bg-sky-50", border: "border-sky-100", icon: "hours" },
                ]} caption={periodCaption} />
              : <SummaryStrip items={[
                  { label: "รออนุมัติ",  value: filteredMyLeave.filter((r) => r.status === "pending" || r.status === "cancel_requested").length, unit: "รายการ", c: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-100", icon: "pending" },
                  { label: "อนุมัติแล้ว", value: filteredMyLeave.filter((r) => r.status === "approved").length, unit: "รายการ", c: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100", icon: "approved" },
                  { label: "วันลาที่ใช้", value: filteredMyLeave.filter((r) => r.status === "approved").reduce((s, r) => s + r.days, 0), unit: "วัน", c: "text-sky-600", bg: "bg-sky-50", border: "border-sky-100", icon: "leave" },
                ]} caption={periodCaption} />
            }

            {loading ? <LoadingState /> : (
              <div className="space-y-3">
                {requestTab === "ot"
                  ? activeList.length === 0 ? <EmptyState text={activeEmptyText} />
                    : filteredMyOT.map((r) => <OTCard key={r.id} req={r} showUser={false} onClick={() => setSelectedOT(r)} />)
                  : activeList.length === 0 ? <EmptyState text={activeEmptyText} />
                    : filteredMyLeave.map((r) => <LeaveCard key={r.id} req={r} showUser={false} onClick={() => setSelectedLeave(r)} />)
                }
              </div>
            )}

           <Link
  href={`/requests/new?type=${requestTab}`}
  className="fixed bottom-24 right-4 z-30 flex items-center gap-2 pl-4 pr-5 py-3.5 rounded-full bg-slate-900 text-white text-sm font-bold shadow-2xl shadow-slate-900/30 active:scale-95 transition-all"
>
  <span className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  </span>
  {requestTab === "ot" ? "OT Request" : "Leave Request"}
</Link>
          </>
        )}
      </div>

      {/* ── Bottom Sheets ── */}
      {selectedOT && (
        <BottomSheet
          item={selectedOT} type="ot"
          canAct={isManager && selectedOT.status === "pending"}
          onClose={() => setSelectedOT(null)}
          onApprove={handleApproveOT}
          onReject={handleRejectOT}
        />
      )}
      {selectedLeave && (
        <BottomSheet
          item={selectedLeave} type="leave"
          canAct={isManager && selectedLeave.status === "pending"}
          canActCancel={isManager && selectedLeave.status === "cancel_requested"}
          canRequestCancel={selectedLeave.user_id === profile?.id && selectedLeave.status === "approved"}
          onClose={() => setSelectedLeave(null)}
          onApprove={handleApproveLeave}
          onReject={handleRejectLeave}
          onApproveCancel={handleApproveLeaveCancel}
          onRejectCancel={handleRejectLeaveCancel}
          onRequestCancel={handleRequestLeaveCancel}
        />
      )}
    </div>
  );
}
