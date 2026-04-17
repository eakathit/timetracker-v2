"use client";

// ============================================================
// app/(dashboard)/onsite/[sessionId]/page.tsx
// หน้าห้อง On-site — แสดงสมาชิก + ปุ่ม Check-in/out
// ============================================================

import { useState, useEffect, useTransition, useMemo  } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getOnsiteSession,
  groupCheckIn,
  groupCheckOut,
  earlyLeave,
  addMidSessionMember,    // ← เพิ่ม
  getAvailableEmployees,  // ← เพิ่ม
  setSessionDriver,
  returnToFactory,
} from "@/app/actions/onsite";
import { supabase } from "@/lib/supabase";
import type {
  OnsiteSessionWithMembers,
  OnsiteSessionMemberWithProfile,
  OnsiteSessionStatus,
  MemberProfile,
} from "@/types/onsite";
import SessionDetailLoading from "./loading";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getFullName = (m: OnsiteSessionMemberWithProfile) =>
  [m.profile?.first_name, m.profile?.last_name].filter(Boolean).join(" ") ||
  "ไม่ระบุชื่อ";

const fmtTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
    : "–";

const AVATAR_COLORS = [
  "bg-sky-500","bg-violet-500","bg-emerald-500",
  "bg-amber-500","bg-rose-500","bg-indigo-500",
];
const avatarColor = (uid: string) =>
  AVATAR_COLORS[uid.charCodeAt(0) % AVATAR_COLORS.length];

const getInitials = (m: OnsiteSessionMemberWithProfile) => {
  const name = getFullName(m);
  return name !== "ไม่ระบุชื่อ"
    ? name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";
};

// คำนวณ OT On-site เหมือนใน actions (นับจาก 17:30, floor nearest 0.5)
function calcOnsiteOTHoursPreview(checkoutIso: string): number {
  const checkout = new Date(checkoutIso);
  const otStart  = new Date(checkout);
  otStart.setHours(17, 30, 0, 0);
  if (checkout <= otStart) return 0;
  const diffHours = (checkout.getTime() - otStart.getTime()) / (1000 * 60 * 60);
  return Math.floor(diffHours * 2) / 2;
}

// ─── Status Badge Map ─────────────────────────────────────────────────────────
const STATUS_MAP: Record<OnsiteSessionStatus, { label: string; color: string; dot: string }> = {
  open:       { label: "รอ Check-in",       color: "text-amber-700 bg-amber-50 border-amber-200",   dot: "bg-amber-400" },
  checked_in: { label: "กำลังทำงาน",       color: "text-emerald-700 bg-emerald-50 border-emerald-200", dot: "bg-emerald-400 animate-pulse" },
  closed:     { label: "เสร็จสิ้น",         color: "text-gray-600 bg-gray-50 border-gray-200",      dot: "bg-gray-400" },
};

// ─── Member Card ──────────────────────────────────────────────────────────────
function MemberCard({
  member,
  isCurrentUser,
  sessionStatus,
  onEarlyLeave,
  isLeaderView,    // ← เพิ่ม
  isDriverTo,      // ← เพิ่ม
  isDriverFrom,    // ← เพิ่ม
  onPickDriver,    // ← เพิ่ม
}: {
  member:        OnsiteSessionMemberWithProfile;
  isCurrentUser: boolean;
  sessionStatus: OnsiteSessionStatus;
  onEarlyLeave:  () => void;
  isLeaderView:  boolean;
  isDriverTo:    boolean;
  isDriverFrom:  boolean;
  onPickDriver:  () => void;
}) {
  const isLeader      = member.role === "leader";
  const isEarlyLeft   = member.checkout_type === "early";
  const isGroupOut    = member.checkout_type === "group";
  const isPending     = member.checkout_type === "pending";
  const canEarlyLeave = isCurrentUser && !isLeader && isPending && sessionStatus === "checked_in";

  return (
  <div
    className={`flex items-center gap-3 px-4 py-3.5 transition-colors
      ${isEarlyLeft ? "opacity-60" : ""}
      ${isLeaderView ? "cursor-pointer active:bg-gray-50" : ""}
    `}
    onClick={isLeaderView ? onPickDriver : undefined}
  >

      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {member.profile?.avatar_url ? (
  <img
    src={member.profile.avatar_url}
    alt={getFullName(member)}
    referrerPolicy="no-referrer"
    className="w-10 h-10 rounded-xl object-cover"
  />
) : (
  <span className={`w-10 h-10 rounded-xl ${avatarColor(member.user_id)} text-white text-sm font-bold flex items-center justify-center`}>
    {getInitials(member)}
  </span>
)}
        {isLeader && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center text-[8px]">
            👑
          </span>
        )}
      </div>

      {/* Info */}
<div className="flex-1 min-w-0">
  <div className="flex items-center gap-1.5">
    <p className="text-sm font-semibold text-gray-800 truncate">{getFullName(member)}</p>
    {isCurrentUser && (
      <span className="text-[9px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded-full flex-shrink-0">คุณ</span>
    )}
  </div>
  <p className="text-xs text-gray-400">{member.profile?.department || "–"}</p>

  {member.checkin_at && sessionStatus !== "open" && (
    <div className="flex items-center gap-1 mt-0.5">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        className="w-3 h-3 text-gray-300">
        <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
      </svg>
      <span className="text-[10px] text-gray-400">
        เข้า {fmtTime(member.checkin_at)}
        {new Date(member.checkin_at).getHours() >= 9 && (
          <span className="ml-1 text-amber-500 font-bold">(มาระหว่างวัน)</span>
        )}
      </span>
    </div>
  )}

  {/* ✅ เพิ่มตรงนี้ — Driver badges */}
  {(isDriverTo || isDriverFrom) && (
    <div className="flex gap-1 mt-1 flex-wrap">
      {isDriverTo && (
        <span className="text-[10px] font-bold bg-sky-100 text-sky-600 px-1.5 py-0.5 rounded-full">
          🚗 ขาไป
        </span>
      )}
      {isDriverFrom && (
        <span className="text-[10px] font-bold bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full">
          🚙 ขากลับ
        </span>
      )}
    </div>
  )}

</div>

      {/* Status */}
      <div className="flex-shrink-0 text-right">
        {isGroupOut || (isEarlyLeft && isLeader) ? (
          <span className="text-xs text-gray-500 font-medium">ออกแล้ว</span>
        ) : member.checkout_type === "return_to_factory" ? (
          <div>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              🏭 กลับโรงงาน
            </span>
            <p className="text-[10px] text-gray-400 mt-0.5">Auto-checkout 17:30</p>
          </div>
        ) : isEarlyLeft ? (
          <div>
            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
              ออกก่อน
            </span>
            {member.early_checkout_at && (
              <p className="text-[10px] text-gray-400 mt-0.5">{fmtTime(member.early_checkout_at)}</p>
            )}
          </div>
        ) : sessionStatus === "checked_in" && canEarlyLeave ? (
          <button
            onClick={onEarlyLeave}
            className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl hover:bg-rose-100 transition-colors"
          >
            ออกก่อน
          </button>
        ) : sessionStatus === "checked_in" ? (
          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            กำลังทำงาน
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ─── Return to Factory Modal ──────────────────────────────────────────────────
function ReturnToFactoryModal({
  scope,
  onCheckoutNow,
  onReturnToFactory,
  onCancel,
  loading,
}: {
  scope:             "group" | "member";
  onCheckoutNow:     () => void;
  onReturnToFactory: () => void;
  onCancel:          () => void;
  loading:           boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-4">
        <div className="text-center">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🏭</span>
          </div>
          <h3 className="text-base font-extrabold text-gray-800">
            {scope === "group" ? "Check-out ทั้งกลุ่ม" : "ออกก่อนกลุ่ม"}
          </h3>
          <p className="text-sm text-gray-500 mt-1">ออก On-site แล้วจะทำอะไรต่อ?</p>
        </div>

        <div className="space-y-2">
          {/* Option A: Checkout On-site ทันที */}
          <button
            onClick={onCheckoutNow}
            disabled={loading}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 border-sky-200 bg-sky-50 hover:bg-sky-100 disabled:opacity-50 transition-all"
          >
            <span className="w-9 h-9 bg-sky-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-5 h-5">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </span>
            <div className="text-left">
              <p className="text-sm font-extrabold text-sky-700">Checkout On-site ทันที</p>
              <p className="text-xs text-sky-500">บันทึกเวลา Checkout ณ ตอนนี้</p>
            </div>
          </button>

          {/* Option B: กลับโรงงาน */}
          <button
            onClick={onReturnToFactory}
            disabled={loading}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 transition-all"
          >
            <span className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-lg">🏭</span>
            </span>
            <div className="text-left">
              <p className="text-sm font-extrabold text-indigo-700">กลับไปทำงานโรงงาน</p>
              <p className="text-xs text-indigo-400">ระบบจะ Auto-checkout ให้เวลา 17:30</p>
            </div>
          </button>
        </div>

        <button
          onClick={onCancel}
          className="w-full py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
        >
          ยกเลิก
        </button>
      </div>
    </div>
  );
}

// ─── Early Leave Modal ────────────────────────────────────────────────────────
function EarlyLeaveModal({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: (note: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-4">
        <div className="text-center">
          <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-rose-500">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </div>
          <h3 className="text-base font-extrabold text-gray-800">ออกก่อนกลุ่ม?</h3>
          <p className="text-sm text-gray-500 mt-1">เวลา Check-out จะถูกบันทึกเป็นเวลาปัจจุบัน</p>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
            หมายเหตุ (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="เช่น กลับไปทำงานต่อที่บริษัท"
            rows={2}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-rose-400 resize-none"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
          >
            ยกเลิก
          </button>
          <button
            onClick={() => onConfirm(note)}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-rose-500 text-white text-sm font-bold hover:bg-rose-600 disabled:opacity-50 transition"
          >
            {loading ? "กำลังบันทึก..." : "ยืนยัน ออกก่อน"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── OT Break Modal (ใช้แทน GroupCheckoutModal เมื่อมี OT) ──────────────────
// ─── Group Checkout Confirm Modal ─────────────────────────────────────────────
function GroupCheckoutModal({
  memberCount,
  pendingCount,
  onConfirm,
  onCancel,
  loading,
}: {
  memberCount:  number;
  pendingCount: number;
  onConfirm:   () => void;
  onCancel:    () => void;
  loading:     boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-4">
        <div className="text-center">
          <div className="w-12 h-12 bg-sky-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-sky-500">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <h3 className="text-base font-extrabold text-gray-800">Check-out ทั้งกลุ่ม</h3>
          <p className="text-sm text-gray-500 mt-1">
            จะ Check-out <strong className="text-gray-800">{pendingCount} คน</strong> ที่ยังอยู่ในห้อง
            {memberCount !== pendingCount && (
              <> (จากทั้งหมด {memberCount} คน)</>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-sky-500 text-white text-sm font-bold hover:bg-sky-600 disabled:opacity-50 transition"
          >
            {loading ? "กำลัง Check-out..." : "ยืนยัน Check-out"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OTBreakModal({
  pendingCount,
  memberCount,
  currentOTHours,
  onConfirm,
  onCancel,
  loading,
}: {
  pendingCount:   number;
  memberCount:    number;
  currentOTHours: number;
  onConfirm:      (breakMinutes: number) => void;
  onCancel:       () => void;
  loading:        boolean;
}) {
  const [hasBreak,   setHasBreak]   = useState(false);
  const [breakStart, setBreakStart] = useState("17:30"); // ✅ default 17:30
  const [breakEnd,   setBreakEnd]   = useState("");

  // คำนวณ break minutes
  const breakMinutes = useMemo(() => {
    if (!hasBreak || !breakStart || !breakEnd) return 0;
    const [sh, sm] = breakStart.split(":").map(Number);
    const [eh, em] = breakEnd.split(":").map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    return Math.max(0, diff);
  }, [hasBreak, breakStart, breakEnd]);

  // OT หลังหักเบรค (preview)
  const adjOT = useMemo(() => {
    const adj = Math.max(0, currentOTHours - breakMinutes / 60);
    return Math.floor(adj * 2) / 2;
  }, [currentOTHours, breakMinutes]);

  const isValid = !hasBreak || (breakEnd !== "" && breakMinutes >= 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-5">

        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 bg-sky-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-sky-500">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <h3 className="text-base font-extrabold text-gray-800">Check-out ทั้งกลุ่ม</h3>
          <p className="text-sm text-gray-500 mt-1">
            {pendingCount} คน
            {memberCount !== pendingCount && ` (จาก ${memberCount} คน)`}
          </p>
        </div>

        {/* OT Badge */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-bold text-amber-700">OT วันนี้</span>
          <span className="text-lg font-black text-amber-600">{currentOTHours} ชม.</span>
        </div>

        {/* Break toggle */}
        <div className="space-y-3">
          <p className="text-sm font-extrabold text-gray-700">มีพักเบรคช่วง OT ไหม?</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setHasBreak(false)}
              className={`py-3 rounded-xl text-sm font-bold border transition-all ${
                !hasBreak
                  ? "bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-100"
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
              }`}
            >
              ไม่มี
            </button>
            <button
              onClick={() => setHasBreak(true)}
              className={`py-3 rounded-xl text-sm font-bold border transition-all ${
                hasBreak
                  ? "bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-100"
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
              }`}
            >
              มีเบรค
            </button>
          </div>

          {/* Break time inputs */}
          {hasBreak && (
            <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1.5">
                    เริ่มเบรค
                  </label>
                  <input
                    type="time"
                    value={breakStart}
                    onChange={(e) => setBreakStart(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-800 outline-none focus:border-sky-400 text-center"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1.5">
                    หมดเบรค
                  </label>
                  <input
                    type="time"
                    value={breakEnd}
                    onChange={(e) => setBreakEnd(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-800 outline-none focus:border-sky-400 text-center"
                  />
                </div>
              </div>

              {/* OT preview หลังหักเบรค */}
              {breakMinutes > 0 && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-gray-500">
                    หัก {breakMinutes} นาที →
                  </span>
                  <span className="text-sm font-black text-emerald-600">
                    OT จริง {adjOT} ชม.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
          >
            ยกเลิก
          </button>
          <button
            onClick={() => onConfirm(breakMinutes)}
            disabled={loading || !isValid}
            className="flex-1 py-3 rounded-xl bg-sky-500 text-white text-sm font-bold hover:bg-sky-600 disabled:opacity-50 transition"
          >
            {loading ? "กำลัง Check-out..." : "ยืนยัน"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Member Modal ─────────────────────────────────────────────────────────
function AddMemberModal({
  sessionId,
  onAdded,
  onClose,
}: {
  sessionId: string;
  onAdded:   () => void;
  onClose:   () => void;
}) {
  const [employees, setEmployees] = useState<MemberProfile[]>([]);
  const [search, setSearch]       = useState("");
  const [loading, setLoading]     = useState(true);
  const [adding, setAdding]       = useState<string | null>(null); // user_id ที่กำลัง add
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    getAvailableEmployees(sessionId).then((res) => {
      if (res.success && res.data) setEmployees(res.data);
      setLoading(false);
    });
  }, [sessionId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        [e.first_name, e.last_name].filter(Boolean).join(" ").toLowerCase().includes(q) ||
        (e.department ?? "").toLowerCase().includes(q)
    );
  }, [employees, search]);

  const handleAdd = async (emp: MemberProfile) => {
    setAdding(emp.id);
    setError(null);
    const res = await addMidSessionMember(sessionId, emp.id);
    if (res.success) {
      setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
      onAdded();
    } else {
      setError(res.error ?? "เพิ่มไม่สำเร็จ");
    }
    setAdding(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-extrabold text-gray-800">เพิ่มสมาชิก</h3>
            <p className="text-xs text-gray-400 mt-0.5">Check-in เวลาปัจจุบัน · ไม่ได้เบี้ยเลี้ยงเช้า</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-50">
          <div className="relative">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อหรือแผนก..."
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-sky-400"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-3 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-medium">
            {error}
          </div>
        )}

        {/* List */}
        <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
          {loading ? (
            <div className="py-10 text-center text-sm text-gray-400 animate-pulse">กำลังโหลด...</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">ไม่พบพนักงาน</div>
          ) : (
            filtered.map((emp) => {
              const name = [emp.first_name, emp.last_name].filter(Boolean).join(" ") || "ไม่ระบุชื่อ";
              const initials = ((emp.first_name?.[0] ?? "") + (emp.last_name?.[0] ?? "")).toUpperCase() || "?";
              const isAdding = adding === emp.id;

              return (
                <div key={emp.id} className="flex items-center gap-3 px-4 py-3">
                  {emp.avatar_url ? (
                    <img src={emp.avatar_url} referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <span className={`w-9 h-9 rounded-xl ${avatarColor(emp.id)} text-white text-sm font-bold flex items-center justify-center flex-shrink-0`}>
                      {initials}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{name}</p>
                    <p className="text-xs text-gray-400">{emp.department || "–"}</p>
                  </div>
                  <button
                    onClick={() => handleAdd(emp)}
                    disabled={isAdding}
                    className="flex-shrink-0 px-3 py-1.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    {isAdding ? "..." : "+ เพิ่ม"}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-50">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}

function DriverPickerSheet({
  member,
  isDriverTo,
  isDriverFrom,
  onSet,
  onClose,
}: {
  member:       OnsiteSessionMemberWithProfile;
  isDriverTo:   boolean;
  isDriverFrom: boolean;
  onSet:        (trip: "to" | "from", userId: string | null) => void;
  onClose:      () => void;
}) {
  const name = [member.profile?.first_name, member.profile?.last_name]
    .filter(Boolean).join(" ") || "ไม่ระบุชื่อ";

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-3xl shadow-2xl px-4 pt-5 pb-10 space-y-2 animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

        {/* ชื่อ */}
        <p className="text-center text-sm font-extrabold text-gray-800 mb-4">{name}</p>

        {/* ขาไป */}
        <button
          onClick={() => onSet("to", isDriverTo ? null : member.user_id)}
          className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all ${
            isDriverTo
              ? "border-sky-400 bg-sky-50 text-sky-700"
              : "border-gray-100 bg-white text-gray-700 hover:border-gray-200"
          }`}
        >
          <span className="text-xl">🚗</span>
          <div className="text-left">
            <p className="text-sm font-bold">คนขับรถ ขาไป</p>
            <p className="text-xs text-gray-400">
              {isDriverTo ? "แตะเพื่อยกเลิก" : "ตั้งเป็นคนขับขาไป"}
            </p>
          </div>
          {isDriverTo && (
            <span className="ml-auto text-xs font-bold text-sky-600 bg-sky-100 px-2 py-0.5 rounded-full">
              ✓ ตั้งไว้
            </span>
          )}
        </button>

        {/* ขากลับ */}
        <button
          onClick={() => onSet("from", isDriverFrom ? null : member.user_id)}
          className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all ${
            isDriverFrom
              ? "border-violet-400 bg-violet-50 text-violet-700"
              : "border-gray-100 bg-white text-gray-700 hover:border-gray-200"
          }`}
        >
          <span className="text-xl">🚙</span>
          <div className="text-left">
            <p className="text-sm font-bold">คนขับรถ ขากลับ</p>
            <p className="text-xs text-gray-400">
              {isDriverFrom ? "แตะเพื่อยกเลิก" : "ตั้งเป็นคนขับขากลับ"}
            </p>
          </div>
          {isDriverFrom && (
            <span className="ml-auto text-xs font-bold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">
              ✓ ตั้งไว้
            </span>
          )}
        </button>

        <button
          onClick={onClose}
          className="w-full py-3 mt-2 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-500"
        >
          ปิด
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function OnsiteSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [session, setSession]       = useState<OnsiteSessionWithMembers | null>(null);
  const [loading, setLoading]       = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);

  // Modals
  const [showEarlyLeave, setShowEarlyLeave]               = useState(false);
  const [showGroupCheckout, setShowGroupCheckout]         = useState(false);
  const [showOTBreak, setShowOTBreak]                     = useState(false);
  const [showAddMember, setShowAddMember]                 = useState(false);
  const [showReturnToFactory, setShowReturnToFactory]     = useState(false);
  const [pendingReturnScope, setPendingReturnScope]       = useState<"group" | "member" | null>(null);

  const [driverPicker, setDriverPicker] = useState<{
  member: OnsiteSessionMemberWithProfile;
} | null>(null);

// Handler
const handleSetDriver = async (trip: "to" | "from", userId: string | null) => {
  const res = await setSessionDriver(sessionId, trip, userId);
  if (res.success) {
    setDriverPicker(null);
    await loadSession();
  } else {
    setError(res.error ?? "บันทึกไม่สำเร็จ");
  }
};

  // ─── Load current user ─────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  // ─── Load session ───────────────────────────────────────
  const loadSession = async () => {
    const res = await getOnsiteSession(sessionId);
    if (res.success && res.data) setSession(res.data);
    else setError(res.error ?? "ไม่พบ Session");
    setLoading(false);
  };

  useEffect(() => { loadSession(); }, [sessionId]);

  // ─── Derived state ─────────────────────────────────────
  const isLeader = session?.leader_id === currentUserId;
  const myMembership = session?.members.find((m) => m.user_id === currentUserId);
  const pendingMembers = session?.members.filter((m) => m.checkout_type === "pending") ?? [];
  const statusInfo = session ? STATUS_MAP[session.status] : null;

  // ─── Handlers ──────────────────────────────────────────
  const handleGroupCheckIn = () => {
    setError(null);
    startTransition(async () => {
      const res = await groupCheckIn(sessionId);
      if (res.success) await loadSession();
      else setError(res.error ?? "Check-in ไม่สำเร็จ");
    });
  };

  // ── helper: เวลาปัจจุบันก่อน 17:30 ไหม ──────────────────────────────────
  const isBeforeEOD = () => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setHours(17, 30, 0, 0);
    return now < cutoff;
  };

  const handleGroupCheckOut = (breakMinutes: number = 0) => {
  setShowGroupCheckout(false);
  setShowOTBreak(false);
  startTransition(async () => {
    const res = await groupCheckOut(sessionId, breakMinutes);
    if (res.success) await loadSession();
    else setError(res.error ?? "Check-out ไม่สำเร็จ");
  });
};

const handleCheckOutClick = () => {
  if (isBeforeEOD()) {
    setPendingReturnScope("group");
    setShowReturnToFactory(true);
    return;
  }
  const otHours = calcOnsiteOTHoursPreview(new Date().toISOString());
  if (otHours > 0) {
    setShowOTBreak(true);
  } else {
    setShowGroupCheckout(true);
  }
};

  const proceedGroupCheckout = () => {
    setShowReturnToFactory(false);
    const otHours = calcOnsiteOTHoursPreview(new Date().toISOString());
    if (otHours > 0) setShowOTBreak(true);
    else setShowGroupCheckout(true);
  };

  const handleEarlyLeaveClick = () => {
    if (isBeforeEOD()) {
      setPendingReturnScope("member");
      setShowReturnToFactory(true);
      return;
    }
    setShowEarlyLeave(true);
  };

  const proceedMemberEarlyLeave = () => {
    setShowReturnToFactory(false);
    setShowEarlyLeave(true);
  };

  const handleReturnToFactory = () => {
    setShowReturnToFactory(false);
    startTransition(async () => {
      const res = await returnToFactory(sessionId, pendingReturnScope ?? "group");
      if (res.success) await loadSession();
      else setError(res.error ?? "บันทึกไม่สำเร็จ");
    });
  };

  const handleEarlyLeave = (note: string) => {
    setShowEarlyLeave(false);
    startTransition(async () => {
      const res = await earlyLeave(sessionId, note);
      if (res.success) await loadSession();
      else setError(res.error ?? "บันทึกไม่สำเร็จ");
    });
  };

  // ─── Render ────────────────────────────────────────────
  if (loading) {
  return <SessionDetailLoading />;
}

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-gray-500 text-sm">{error ?? "ไม่พบ Session"}</p>
          <button onClick={() => router.push("/onsite")} className="mt-4 text-sky-500 text-sm font-medium">
            กลับหน้า On-site
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Modals ── */}
      {showReturnToFactory && pendingReturnScope && (
        <ReturnToFactoryModal
          scope={pendingReturnScope}
          onCheckoutNow={pendingReturnScope === "group" ? proceedGroupCheckout : proceedMemberEarlyLeave}
          onReturnToFactory={handleReturnToFactory}
          onCancel={() => setShowReturnToFactory(false)}
          loading={isPending}
        />
      )}
      {showEarlyLeave && (
        <EarlyLeaveModal
          onConfirm={handleEarlyLeave}
          onCancel={() => setShowEarlyLeave(false)}
          loading={isPending}
        />
      )}
      {showGroupCheckout && (
  <GroupCheckoutModal
    memberCount={session.members.length}
    pendingCount={pendingMembers.length}
    onConfirm={() => handleGroupCheckOut(0)}
    onCancel={() => setShowGroupCheckout(false)}
    loading={isPending}
  />
)}
{showOTBreak && (
  <OTBreakModal
    pendingCount={pendingMembers.length}
    memberCount={session.members.length}
    currentOTHours={calcOnsiteOTHoursPreview(new Date().toISOString())}
    onConfirm={(breakMins) => handleGroupCheckOut(breakMins)}
    onCancel={() => setShowOTBreak(false)}
    loading={isPending}
  />
)}
{showAddMember && (
  <AddMemberModal
    sessionId={sessionId}
    onAdded={loadSession}
    onClose={() => setShowAddMember(false)}
  />
)}
{driverPicker && session && (
  <DriverPickerSheet
    member={driverPicker.member}
    isDriverTo={session.driver_to_id === driverPicker.member.user_id}
    isDriverFrom={session.driver_from_id === driverPicker.member.user_id}
    onSet={handleSetDriver}
    onClose={() => setDriverPicker(null)}
  />
)}

      <div className="min-h-screen bg-gray-50 flex flex-col pb-52 md:pb-32">
        {/* ── Header ── */}
        <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
          <button
            onClick={() => router.push("/onsite")}
            className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-extrabold text-gray-800 truncate">{session.site_name}</h1>
            {session.project && (
              <p className="text-xs text-gray-400 truncate">
                Project {session.project.project_no} {session.project.name ? `· ${session.project.name}` : ""}
              </p>
            )}
          </div>
          {statusInfo && (
            <span className={`flex items-center gap-1.5 text-xs font-bold border px-2.5 py-1 rounded-full flex-shrink-0 ${statusInfo.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
              {statusInfo.label}
            </span>
          )}
        </header>

        <div className="flex-1 px-4 py-5 space-y-4">

          {/* ── Time Info Card ── */}
          {(session.group_check_in || session.group_check_out) && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4">
              <div className="flex gap-6">
                {session.group_check_in && (
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Check-in</p>
                    <p className="text-lg font-extrabold text-emerald-600">{fmtTime(session.group_check_in)}</p>
                  </div>
                )}
                {session.group_check_out && (
                  <>
                    <div className="w-px bg-gray-100" />
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Check-out</p>
                      <p className="text-lg font-extrabold text-sky-600">{fmtTime(session.group_check_out)}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
              <p className="text-sm text-rose-700 font-medium">{error}</p>
            </div>
          )}

          {/* ── Members List ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-sky-500">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                </svg>
                <h2 className="text-sm font-extrabold text-gray-700">สมาชิกในห้อง</h2>
              </div>
              <div className="flex items-center gap-2">
  {isLeader && session.status === "checked_in" && (
    <button
      onClick={() => setShowAddMember(true)}
      className="flex items-center gap-1 text-xs font-bold text-sky-600 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-xl hover:bg-sky-100 transition-colors"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      เพิ่มคน
    </button>
  )}
  <span className="text-xs text-gray-400">{session.members.length} คน</span>
</div>
            </div>
            <div className="divide-y divide-gray-50">
              {session.members.map((member) => (
                <MemberCard
  key={member.id}
  member={member}
  isCurrentUser={member.user_id === currentUserId}
  sessionStatus={session.status}
  onEarlyLeave={() => handleEarlyLeaveClick()}
  isLeaderView={isLeader && session.status !== "closed"}
  isDriverTo={session.driver_to_id === member.user_id}
  isDriverFrom={session.driver_from_id === member.user_id}
  onPickDriver={() => setDriverPicker({ member })}
/>
              ))}
            </div>
          </div>

          {/* ── Leader: Early-leave summary ── */}
          {isLeader && session.status === "checked_in" && (
            (() => {
              const earlyCount = session.members.filter((m) => m.checkout_type === "early").length;
              return earlyCount > 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-amber-500 flex-shrink-0">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p className="text-sm text-amber-800">
                    มี <strong>{earlyCount} คน</strong> ออกก่อนแล้ว · ยังเหลือ <strong>{pendingMembers.length} คน</strong> ในห้อง
                  </p>
                </div>
              ) : null;
            })()
          )}
        </div>

        {/* ── Bottom Action Panel ── */}
        <div className="fixed bottom-20 md:bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          {/* Leader Actions */}
          {isLeader && session.status === "open" && (
            <button
              onClick={handleGroupCheckIn}
              disabled={isPending}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              {isPending ? (
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                  <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                </svg>
              )}
              Check-in ทั้งกลุ่ม ({session.members.length} คน)
            </button>
          )}

          {isLeader && session.status === "checked_in" && (
            <button
              onClick={handleCheckOutClick}
              disabled={isPending}
              className="w-full bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Check-out ทั้งกลุ่ม ({pendingMembers.length} คน)
            </button>
          )}

          {/* Member: ออกก่อน (ถ้าตัวเองยัง pending) */}
          {!isLeader && session.status === "checked_in" && myMembership?.checkout_type === "pending" && (
            <button
              onClick={handleEarlyLeaveClick}
              disabled={isPending}
              className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl transition-colors"
            >
              ออกก่อนกลุ่ม
            </button>
          )}

          {session.status === "closed" && (
            <div className="text-center">
              <p className="text-sm font-bold text-gray-500 mb-3">Session นี้เสร็จสิ้นแล้ว</p>
              <button
                onClick={() => router.push("/onsite")}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 rounded-2xl transition-colors text-sm"
              >
                กลับหน้า On-site
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}