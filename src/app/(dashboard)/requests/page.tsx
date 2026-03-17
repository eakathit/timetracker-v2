"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import UserAvatar from "@/components/UserAvatar";
import { REFRESH_PENDING_EVENT } from "@/hooks/usePendingApprovals";

// ─── Supabase Client ──────────────────────────────────────────────────────────
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Types ────────────────────────────────────────────────────────────────────
type UserRole   = "user" | "manager" | "admin" | "viewer";
type RequestTab = "ot" | "leave";
type ManagerTab = "mine" | "pending";
type ReqStatus  = "pending" | "approved" | "rejected";
type LeaveType  = "sick" | "personal" | "vacation" | "maternity";

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
  reason: string;
  status: ReqStatus;
  approved_by: string | null;
  reject_reason: string | null;
  actioned_at: string | null;
  created_at: string;
  // จาก View (manager เห็น)
  full_name?: string;
  department?: string;
  avatar_url?: string | null;
  actioned_by_name?: string | null;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<ReqStatus, { label: string; bg: string; border: string; bar: string; text: string }> = {
  pending:  { label: "รออนุมัติ",  bg: "bg-amber-50",   border: "border-amber-200",  bar: "bg-amber-400",  text: "text-amber-600" },
  approved: { label: "อนุมัติแล้ว", bg: "bg-emerald-50", border: "border-emerald-200", bar: "bg-emerald-400", text: "text-emerald-600" },
  rejected: { label: "ไม่อนุมัติ",  bg: "bg-rose-50",   border: "border-rose-200",   bar: "bg-rose-400",   text: "text-rose-500" },
};

const LEAVE_CFG: Record<LeaveType, { label: string; icon: string; bg: string; text: string }> = {
  sick:      { label: "ลาป่วย",    icon: "🤒", bg: "bg-rose-50",  text: "text-rose-500" },
  personal:  { label: "ลากิจ",    icon: "📋", bg: "bg-blue-50",  text: "text-blue-500" },
  vacation:  { label: "ลาพักร้อน", icon: "🌴", bg: "bg-sky-50",   text: "text-sky-500" },
  maternity: { label: "ลาคลอด",   icon: "👶", bg: "bg-pink-50",  text: "text-pink-500" },
};

const TH_MONTHS = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// ── สร้าง array ของ date string ทุกวันระหว่าง start ถึง end ──────────────────
function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  while (current <= end) {
    // ข้ามเสาร์-อาทิตย์ (ลาเฉพาะวันทำงาน)
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) {
      dates.push(current.toISOString().slice(0, 10));
    }
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  personal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    </svg>
  ),
  vacation: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <circle cx="12" cy="12" r="4"/>
      <line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
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
          <span className={`text-xs font-black ${st.text}`}>{req.days} วัน</span>
        </div>

       
      </div>
    </div>
  );
}

// ─── Bottom Sheet ─────────────────────────────────────────────────────────────
// ─── Bottom Sheet ─────────────────────────────────────────────────────────────
function BottomSheet({
  item, type, canAct, onClose, onApprove, onReject,
}: {
  item: OTRequest | LeaveRequest;
  type: "ot" | "leave";
  canAct: boolean;
  onClose: () => void;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
}) {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason]       = useState("");
  const [loading, setLoading]                 = useState(false);
  const st = STATUS_CFG[item.status];

  const name     = (item as OTRequest).full_name ?? "ฉัน";
  const dept     = (item as OTRequest).department ?? "";
  const avatarUrl = (item as OTRequest).avatar_url ?? null;
  const actionedByName = (item as OTRequest).actioned_by_name ?? null;

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
        { icon: DaysIcon,     label: "จำนวนวัน", value: `${leaveItem.days} วัน` },
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
          {(item.status === "approved" || item.status === "rejected") && (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border mb-4 ${
              item.status === "approved"
                ? "bg-emerald-50 border-emerald-100"
                : "bg-rose-50 border-rose-100"
            }`}>
              <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                item.status === "approved" ? "bg-emerald-100" : "bg-rose-100"
              }`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className={`w-4 h-4 ${item.status === "approved" ? "text-emerald-600" : "text-rose-500"}`}>
                  {item.status === "approved"
                    ? <polyline points="20 6 9 17 4 12" />
                    : <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                  }
                </svg>
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-semibold uppercase tracking-wide mb-0.5 ${
                  item.status === "approved" ? "text-emerald-500" : "text-rose-400"
                }`}>
                  {item.status === "approved" ? "อนุมัติโดย" : "ไม่อนุมัติโดย"}
                </p>
                <p className={`text-sm font-black ${
                  item.status === "approved" ? "text-emerald-700" : "text-rose-600"
                }`}>
                  {actionedByName ?? "—"}
                </p>
                {item.actioned_at && (
                  <p className={`text-[11px] mt-0.5 ${
                    item.status === "approved" ? "text-emerald-400" : "text-rose-300"
                  }`}>
                    {fmtDateTime(item.actioned_at)}
                  </p>
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
          {canAct && showRejectInput && (
            <div className="mb-4 space-y-2">
              <textarea
                autoFocus
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="ระบุเหตุผลที่ไม่อนุมัติ..."
                rows={3}
                className="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-50 placeholder-gray-300 resize-none transition-all"
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
function SummaryStrip({ items }: { items: { label: string; value: number; unit: string; c: string; bg: string; border: string }[] }) {
  return (
    <div className="grid grid-cols-3 gap-2 mb-5">
      {items.map((it) => (
        <div key={it.label} className={`${it.bg} rounded-2xl px-3 py-3.5 text-center`}>
          <p className={`text-2xl font-black leading-none ${it.c}`}>{it.value}</p>
          <p className="text-[10px] text-gray-400 font-semibold mt-1">{it.unit}</p>
          <p className="text-[10px] text-gray-500 font-medium">{it.label}</p>
        </div>
      ))}
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
        .from("leave_requests")
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
    .eq("status", "pending")
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

  // 2. หา leave request ที่เพิ่ง approve เพื่อดึง start_date, end_date, user_id
  const leaveReq = [...deptLeave, ...myLeave].find(r => r.id === id);
  if (leaveReq) {
    // สร้าง date range ทุกวันในช่วงลา
    const leaveDates: string[] = [];
    // ✅ ใช้ string แยก ไม่ผ่าน new Date() เพื่อหลีกเลี่ยง timezone bug
    const [sy, sm, sd] = leaveReq.start_date.split("-").map(Number);
    const [ey, em, ed] = leaveReq.end_date.split("-").map(Number);
    const start = new Date(sy, sm - 1, sd); // local time ✅
    const end   = new Date(ey, em - 1, ed);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      leaveDates.push(dateStr);
    }

    // 3. Upsert daily_time_logs สำหรับทุกวันลา
    await supabase.from("daily_time_logs").upsert(
      leaveDates.map(date => ({
        user_id:   leaveReq.user_id,
        log_date:  date,       // ✅ string โดยตรง ไม่ผ่าน UTC
        work_type: "leave",
        status:    "leave",
      })),
      { onConflict: "user_id,log_date" }
    );
  }

  await Promise.all([fetchMyRequests(), fetchDeptRequests()]);
  dispatchRefresh();
};

 // ✅ handleRejectLeave ที่ดีขึ้น
const handleRejectLeave = async (id: string, reason: string) => {
  // ดึงข้อมูลก่อน
  const { data: leaveReq } = await supabase
    .from("leave_requests")
    .select("user_id, start_date, end_date, status")
    .eq("id", id)
    .single();

  await supabase.from("leave_requests").update({
    status: "rejected",
    reject_reason: reason,
    approved_by: profile!.id,
    actioned_at: new Date().toISOString(),
  }).eq("id", id);

  // ถ้าเคย approve แล้ว (มี daily_time_logs status=leave) ให้ revert เป็น absent
  if (leaveReq && leaveReq.status === "approved") {
    const leaveDates = getDatesInRange(leaveReq.start_date, leaveReq.end_date);
    if (leaveDates.length > 0) {
      // ลบ rows ที่เป็น leave ออก (เพราะไม่มี check-in จริง)
      await supabase.from("daily_time_logs")
        .delete()
        .eq("user_id", leaveReq.user_id)
        .eq("status", "leave")
        .in("log_date", leaveDates);
    }
  }

  await Promise.all([fetchMyRequests(), fetchDeptRequests()]);
  dispatchRefresh();
};

  // ── Computed counts ───────────────────────────────────────────────────────────
  const totalDeptPending = deptOT.length + deptLeave.length;
  const myPendingOT      = myOT.filter((r) => r.status === "pending").length;
  const myPendingLeave   = myLeave.filter((r) => r.status === "pending").length;

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
            {requestTab === "ot"
              ? <SummaryStrip items={[
                  { label: "รออนุมัติ",  value: myPendingOT, unit: "รายการ", c: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-100" },
                  { label: "อนุมัติแล้ว", value: myOT.filter((r) => r.status === "approved").length, unit: "รายการ", c: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
                  { label: "ชั่วโมง OT", value: myOT.filter((r) => r.status === "approved").reduce((s, r) => s + Number(r.hours), 0), unit: "ชม.", c: "text-sky-600", bg: "bg-sky-50", border: "border-sky-100" },
                ]} />
              : <SummaryStrip items={[
                  { label: "รออนุมัติ",  value: myPendingLeave, unit: "รายการ", c: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-100" },
                  { label: "อนุมัติแล้ว", value: myLeave.filter((r) => r.status === "approved").length, unit: "รายการ", c: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
                  { label: "วันลาที่ใช้", value: myLeave.filter((r) => r.status === "approved").reduce((s, r) => s + r.days, 0), unit: "วัน", c: "text-sky-600", bg: "bg-sky-50", border: "border-sky-100" },
                ]} />
            }

            {loading ? <LoadingState /> : (
              <div className="space-y-3">
                {requestTab === "ot"
                  ? myOT.length === 0 ? <EmptyState text="ยังไม่มีคำขอ OT" />
                    : myOT.map((r) => <OTCard key={r.id} req={r} showUser={false} onClick={() => setSelectedOT(r)} />)
                  : myLeave.length === 0 ? <EmptyState text="ยังไม่มีใบลา" />
                    : myLeave.map((r) => <LeaveCard key={r.id} req={r} showUser={false} onClick={() => setSelectedLeave(r)} />)
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
          onClose={() => setSelectedLeave(null)}
          onApprove={handleApproveLeave}
          onReject={handleRejectLeave}
        />
      )}
    </div>
  );
}