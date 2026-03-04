"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

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

function Avatar({ name, userId, size = "sm" }: { name: string; userId: string; size?: "sm" | "md" }) {
  return (
    <div className={`${size === "md" ? "w-10 h-10 text-sm" : "w-7 h-7 text-xs"} ${avatarColor(userId)} rounded-full flex items-center justify-center text-white font-black flex-shrink-0`}>
      {name?.charAt(0) ?? "?"}
    </div>
  );
}

// ─── OT Card ──────────────────────────────────────────────────────────────────
function OTCard({ req, showUser, onClick }: { req: OTRequest; showUser: boolean; onClick: () => void }) {
  const st = STATUS_CFG[req.status];
  const month = TH_MONTHS[Number(req.request_date?.split("-")[1])];
  const day   = req.request_date?.split("-")[2];
  return (
    <div onClick={onClick} className={`relative bg-white rounded-2xl border-2 overflow-hidden active:scale-[0.99] transition-all cursor-pointer ${st.border}`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${st.bar}`} />
      <div className="pl-5 pr-4 py-4 flex items-start gap-3">
        <div className={`flex-shrink-0 w-12 h-14 rounded-xl flex flex-col items-center justify-center border ${st.border} ${st.bg}`}>
          <span className={`text-lg font-black leading-none ${st.text}`}>{day}</span>
          <span className={`text-[10px] font-semibold ${st.text}`}>{month}</span>
        </div>
        <div className="flex-1 min-w-0">
          {showUser && req.full_name && (
            <div className="flex items-center gap-2 mb-2">
              <Avatar name={req.full_name} userId={req.user_id} />
              <div>
                <p className="text-xs font-black text-gray-800 leading-none">{req.full_name}</p>
                <p className="text-[10px] text-gray-400">{req.department}</p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-bold text-gray-800 truncate">
              {req.project_no ? `#${req.project_no}` : "ไม่ระบุโปรเจกต์"}
              {req.project_name ? ` · ${req.project_name}` : ""}
            </span>
            <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
          </div>
          <p className="text-xs text-gray-400 mb-2 truncate">{req.reason}</p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs font-semibold text-gray-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>
              {fmtTime(req.start_time)} – {fmtTime(req.end_time)}
            </span>
            <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${st.bg} ${st.text}`}>{req.hours} ชม.</span>
          </div>
          {req.reject_reason && <p className="text-[11px] text-rose-400 mt-1.5 truncate">✗ {req.reject_reason}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Leave Card ───────────────────────────────────────────────────────────────
function LeaveCard({ req, showUser, onClick }: { req: LeaveRequest; showUser: boolean; onClick: () => void }) {
  const st = STATUS_CFG[req.status];
  const lt = LEAVE_CFG[req.leave_type];
  return (
    <div onClick={onClick} className={`relative bg-white rounded-2xl border-2 overflow-hidden active:scale-[0.99] transition-all cursor-pointer ${st.border}`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${st.bar}`} />
      <div className="pl-5 pr-4 py-4 flex items-start gap-3">
        <div className={`flex-shrink-0 w-12 h-14 rounded-xl flex flex-col items-center justify-center ${lt.bg}`}>
          <span className="text-xl leading-none">{lt.icon}</span>
          <span className={`text-[9px] font-bold mt-1 ${lt.text}`}>{lt.label}</span>
        </div>
        <div className="flex-1 min-w-0">
          {showUser && req.full_name && (
            <div className="flex items-center gap-2 mb-2">
              <Avatar name={req.full_name} userId={req.user_id} />
              <div>
                <p className="text-xs font-black text-gray-800 leading-none">{req.full_name}</p>
                <p className="text-[10px] text-gray-400">{req.department}</p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-bold text-gray-800">{lt.label}</span>
            <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
          </div>
          <p className="text-xs text-gray-400 mb-2 truncate">{req.reason}</p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs font-semibold text-gray-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
              {req.start_date === req.end_date ? fmtDate(req.start_date) : `${fmtDate(req.start_date)} – ${fmtDate(req.end_date)}`}
            </span>
            <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${st.bg} ${st.text}`}>{req.days} วัน</span>
          </div>
          {req.reject_reason && <p className="text-[11px] text-rose-400 mt-1.5 truncate">✗ {req.reject_reason}</p>}
        </div>
      </div>
    </div>
  );
}

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

  const name = (item as OTRequest).full_name ?? "ฉัน";
  const dept = (item as OTRequest).department ?? "";

  const rows = type === "ot"
    ? [
        { icon: "📅", label: "วันที่",    value: fmtDate((item as OTRequest).request_date) },
        { icon: "⏰", label: "ช่วงเวลา",  value: `${fmtTime((item as OTRequest).start_time)} – ${fmtTime((item as OTRequest).end_time)}  (${(item as OTRequest).hours} ชม.)` },
        { icon: "📁", label: "โปรเจกต์",  value: (item as OTRequest).project_no ? `#${(item as OTRequest).project_no} ${(item as OTRequest).project_name ?? ""}` : "ไม่ระบุ" },
        { icon: "📝", label: "เหตุผล",    value: item.reason },
        { icon: "🕐", label: "ยื่นเมื่อ",  value: fmtDateTime(item.created_at) },
      ]
    : [
        { icon: LEAVE_CFG[(item as LeaveRequest).leave_type].icon, label: "ประเภท", value: LEAVE_CFG[(item as LeaveRequest).leave_type].label },
        { icon: "📅", label: "วันที่ลา", value: (item as LeaveRequest).start_date === (item as LeaveRequest).end_date ? fmtDate((item as LeaveRequest).start_date) : `${fmtDate((item as LeaveRequest).start_date)} – ${fmtDate((item as LeaveRequest).end_date)}` },
        { icon: "🗓", label: "จำนวนวัน", value: `${(item as LeaveRequest).days} วัน` },
        { icon: "📝", label: "เหตุผล",   value: item.reason },
        { icon: "🕐", label: "ยื่นเมื่อ",  value: fmtDateTime(item.created_at) },
      ];

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
          <div className="flex items-center justify-between py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <Avatar name={name} userId={item.user_id} size="md" />
              <div>
                <p className="text-base font-black text-gray-900">{name}</p>
                {dept && <p className="text-xs text-gray-400">{dept}</p>}
              </div>
            </div>
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${st.bg} ${st.text} ${st.border}`}>
              {st.label}
            </span>
          </div>

          <div className="py-4 space-y-4">
            {rows.map((row) => (
              <div key={row.label} className="flex gap-3">
                <span className="text-base w-6 flex-shrink-0">{row.icon}</span>
                <div>
                  <p className="text-[11px] text-gray-400 font-semibold">{row.label}</p>
                  <p className="text-sm font-semibold text-gray-800">{row.value}</p>
                </div>
              </div>
            ))}
            {item.reject_reason && (
              <div className="flex gap-3 pt-3 border-t border-gray-100">
                <span className="text-base w-6">❌</span>
                <div>
                  <p className="text-[11px] text-gray-400 font-semibold">เหตุผลที่ไม่อนุมัติ</p>
                  <p className="text-sm font-semibold text-rose-500">{item.reject_reason}</p>
                </div>
              </div>
            )}
          </div>

          {/* Reject input */}
          {showRejectInput && (
            <div className="pb-4">
              <p className="text-xs font-bold text-gray-500 mb-2">ระบุเหตุผลที่ไม่อนุมัติ</p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="เช่น วันนั้นมีงานสำคัญ, ไม่แจ้งล่วงหน้า..."
                rows={3}
                autoFocus
                className="w-full px-4 py-3 rounded-2xl border-2 border-rose-200 bg-rose-50 text-sm text-gray-800 focus:outline-none focus:border-rose-400 resize-none placeholder-rose-300"
              />
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setShowRejectInput(false); setRejectReason(""); }}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500">
                  ยกเลิก
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim() || loading}
                  className={`flex-1 py-3 rounded-xl text-sm font-black transition-all active:scale-95 ${rejectReason.trim() && !loading ? "bg-rose-500 text-white" : "bg-gray-100 text-gray-300"}`}
                >
                  {loading ? "กำลังบันทึก..." : "ยืนยัน"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 pt-3 pb-[env(safe-area-inset-bottom,16px)] border-t border-gray-100">
          {canAct && item.status === "pending" && !showRejectInput ? (
            <div className="flex gap-3">
              <button onClick={() => setShowRejectInput(true)}
                className="flex-1 py-4 rounded-2xl border-2 border-rose-200 text-rose-500 font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-rose-50">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                ไม่อนุมัติ
              </button>
              <button onClick={handleApprove} disabled={loading}
                className={`flex-1 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all ${loading ? "bg-gray-100 text-gray-400" : "bg-emerald-500 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-600"}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><polyline points="20 6 9 17 4 12"/></svg>
                {loading ? "กำลังบันทึก..." : "อนุมัติ"}
              </button>
            </div>
          ) : !showRejectInput && (
            <button onClick={onClose}
              className="w-full py-4 rounded-2xl border-2 border-gray-200 text-sm font-bold text-gray-500 active:scale-95 transition-all">
              ปิด
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Summary Strip ────────────────────────────────────────────────────────────
function SummaryStrip({ items }: { items: { label: string; value: number; unit: string; c: string; bg: string; border: string }[] }) {
  return (
    <div className="grid grid-cols-3 gap-2 mb-5">
      {items.map((s) => (
        <div key={s.label} className={`rounded-2xl border p-3 text-center ${s.bg} ${s.border}`}>
          <p className={`text-xl font-black ${s.c}`}>{s.value}</p>
          <p className="text-[10px] text-gray-400 leading-tight">{s.unit}</p>
          <p className="text-[10px] font-semibold text-gray-500 leading-tight mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center mb-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-gray-300">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <p className="text-sm font-semibold text-gray-400">{text}</p>
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
        .from("ot_requests")
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

    const [otRes, lvRes] = await Promise.all([
      supabase
        .from("ot_requests_with_profile")           // ← ใช้ View ที่สร้างใน migration
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
      supabase
        .from("leave_requests_with_profile")        // ← ใช้ View ที่สร้างใน migration
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
    ]);

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
  };

  const handleRejectOT = async (id: string, reason: string) => {
    await supabase.from("ot_requests").update({
      status: "rejected",
      reject_reason: reason,
      approved_by: profile!.id,
      actioned_at: new Date().toISOString(),
    }).eq("id", id);
    await Promise.all([fetchMyRequests(), fetchDeptRequests()]);
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
              {dept ? `แผนก ${dept}` : "กำลังโหลด..."}
              {isManager && <span className="ml-2 text-indigo-400 font-semibold">· Manager</span>}
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
                {t.badge && t.badge > 0 && (
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
                    ? <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>OT</>
                    : <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>ใบลา</>
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
                    {t === "ot" ? "⏰ OT" : "📋 ใบลา"}
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
              className="fixed bottom-24 right-4 z-30 flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-slate-900 text-white text-sm font-bold shadow-xl shadow-slate-900/20 active:scale-95 transition-all"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              {requestTab === "ot" ? "ยื่นคำขอ OT" : "ยื่นใบลา"}
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