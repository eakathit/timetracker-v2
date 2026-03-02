"use client";

import { useState } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
type RequestTab = "ot" | "leave";

type OTStatus = "pending" | "approved" | "rejected";
type LeaveStatus = "pending" | "approved" | "rejected";

type LeaveType = "sick" | "personal" | "vacation" | "maternity";

interface OTRequest {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  project: string;
  reason: string;
  status: OTStatus;
  submittedAt: string;
  approvedBy?: string;
}

interface LeaveRequest {
  id: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  submittedAt: string;
  approvedBy?: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_OT: OTRequest[] = [
  {
    id: "ot-001",
    date: "2026-03-05",
    startTime: "17:30",
    endTime: "21:00",
    hours: 3.5,
    project: "Project Alpha",
    reason: "งานด่วนลูกค้าต้องส่งวันพรุ่งนี้",
    status: "pending",
    submittedAt: "2026-03-04T10:30:00",
  },
  {
    id: "ot-002",
    date: "2026-02-28",
    startTime: "18:00",
    endTime: "20:00",
    hours: 2,
    project: "Project Beta",
    reason: "ประชุม Online กับ Client ต่างประเทศ",
    status: "approved",
    submittedAt: "2026-02-27T09:00:00",
    approvedBy: "สมชาย วงศ์ดี",
  },
  {
    id: "ot-003",
    date: "2026-02-20",
    startTime: "17:30",
    endTime: "22:00",
    hours: 4.5,
    project: "Project Alpha",
    reason: "Deploy ระบบ Production",
    status: "rejected",
    submittedAt: "2026-02-19T14:00:00",
  },
];

const MOCK_LEAVE: LeaveRequest[] = [
  {
    id: "lv-001",
    leaveType: "sick",
    startDate: "2026-03-10",
    endDate: "2026-03-10",
    days: 1,
    reason: "ไข้หวัด",
    status: "pending",
    submittedAt: "2026-03-09T20:00:00",
  },
  {
    id: "lv-002",
    leaveType: "vacation",
    startDate: "2026-04-13",
    endDate: "2026-04-15",
    days: 3,
    reason: "วันหยุดสงกรานต์",
    status: "approved",
    submittedAt: "2026-03-01T09:00:00",
    approvedBy: "สมชาย วงศ์ดี",
  },
  {
    id: "lv-003",
    leaveType: "personal",
    startDate: "2026-02-14",
    endDate: "2026-02-14",
    days: 1,
    reason: "ธุระส่วนตัว",
    status: "rejected",
    submittedAt: "2026-02-13T08:00:00",
  },
];

// ─── Config ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending: {
    label: "รออนุมัติ",
    bg: "bg-amber-50",
    border: "border-amber-200",
    bar: "bg-amber-400",
    text: "text-amber-600",
    dot: "bg-amber-400",
  },
  approved: {
    label: "อนุมัติแล้ว",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    bar: "bg-emerald-400",
    text: "text-emerald-600",
    dot: "bg-emerald-400",
  },
  rejected: {
    label: "ไม่อนุมัติ",
    bg: "bg-rose-50",
    border: "border-rose-200",
    bar: "bg-rose-400",
    text: "text-rose-500",
    dot: "bg-rose-400",
  },
};

const LEAVE_TYPE_CONFIG: Record<LeaveType, { label: string; icon: string; color: string }> = {
  sick:      { label: "ลาป่วย",    icon: "🤒", color: "text-rose-500 bg-rose-50" },
  personal:  { label: "ลากิจ",    icon: "📋", color: "text-blue-500 bg-blue-50" },
  vacation:  { label: "ลาพักร้อน", icon: "🌴", color: "text-sky-500 bg-sky-50" },
  maternity: { label: "ลาคลอด",   icon: "👶", color: "text-pink-500 bg-pink-50" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d} ${months[m - 1]} ${y + 543}`;
}

// ─── OT Card ──────────────────────────────────────────────────────────────────
function OTCard({ req }: { req: OTRequest }) {
  const st = STATUS_CONFIG[req.status];
  return (
    <div className={`relative bg-white rounded-2xl border-2 overflow-hidden transition-all active:scale-[0.99] ${st.border}`}>
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${st.bar}`} />

      <div className="pl-5 pr-4 py-4 flex items-start gap-3">
        {/* Date badge */}
        <div className={`flex-shrink-0 w-12 h-14 rounded-xl flex flex-col items-center justify-center border ${st.border} ${st.bg}`}>
          <span className={`text-lg font-black leading-none ${st.text}`}>
            {req.date.split("-")[2]}
          </span>
          <span className={`text-[10px] font-semibold ${st.text}`}>
            {["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."][Number(req.date.split("-")[1])]}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-bold text-gray-800 truncate">{req.project}</span>
            <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>
              {st.label}
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-2 truncate">{req.reason}</p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs font-semibold text-gray-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" />
              </svg>
              {req.startTime} – {req.endTime}
            </span>
            <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${st.bg} ${st.text}`}>
              {req.hours} ชม.
            </span>
          </div>
          {req.approvedBy && (
            <p className="text-[11px] text-gray-400 mt-1.5">✓ โดย {req.approvedBy}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Leave Card ───────────────────────────────────────────────────────────────
function LeaveCard({ req }: { req: LeaveRequest }) {
  const st = STATUS_CONFIG[req.status];
  const lt = LEAVE_TYPE_CONFIG[req.leaveType];
  const isSameDay = req.startDate === req.endDate;

  return (
    <div className={`relative bg-white rounded-2xl border-2 overflow-hidden transition-all active:scale-[0.99] ${st.border}`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${st.bar}`} />

      <div className="pl-5 pr-4 py-4 flex items-start gap-3">
        {/* Leave type badge */}
        <div className={`flex-shrink-0 w-12 h-14 rounded-xl flex flex-col items-center justify-center ${lt.color}`}>
          <span className="text-xl leading-none">{lt.icon}</span>
          <span className={`text-[9px] font-bold mt-1 ${lt.color.split(" ")[0]}`}>{lt.label}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-bold text-gray-800">{lt.label}</span>
            <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>
              {st.label}
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-2 truncate">{req.reason}</p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs font-semibold text-gray-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="16" y1="2" x2="16" y2="6" />
              </svg>
              {isSameDay ? fmtDate(req.startDate) : `${fmtDate(req.startDate)} – ${fmtDate(req.endDate)}`}
            </span>
            <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${st.bg} ${st.text}`}>
              {req.days} วัน
            </span>
          </div>
          {req.approvedBy && (
            <p className="text-[11px] text-gray-400 mt-1.5">✓ โดย {req.approvedBy}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Summary Strip ────────────────────────────────────────────────────────────
function OTSummary() {
  const approved = MOCK_OT.filter((r) => r.status === "approved");
  const pending  = MOCK_OT.filter((r) => r.status === "pending");
  const totalHrs = approved.reduce((s, r) => s + r.hours, 0);

  return (
    <div className="grid grid-cols-3 gap-2 mb-5">
      {[
        { label: "OT รออนุมัติ", value: pending.length, unit: "รายการ", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
        { label: "อนุมัติแล้ว", value: approved.length, unit: "รายการ", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
        { label: "ชั่วโมง OT", value: totalHrs, unit: "ชม.", color: "text-sky-600", bg: "bg-sky-50", border: "border-sky-100" },
      ].map((s) => (
        <div key={s.label} className={`rounded-2xl border p-3 text-center ${s.bg} ${s.border}`}>
          <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
          <p className="text-[10px] text-gray-400 leading-tight">{s.unit}</p>
          <p className="text-[10px] font-semibold text-gray-500 leading-tight mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

function LeaveSummary() {
  const approved = MOCK_LEAVE.filter((r) => r.status === "approved");
  const pending  = MOCK_LEAVE.filter((r) => r.status === "pending");
  const totalDays = approved.reduce((s, r) => s + r.days, 0);

  return (
    <div className="grid grid-cols-3 gap-2 mb-5">
      {[
        { label: "รออนุมัติ", value: pending.length, unit: "รายการ", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
        { label: "อนุมัติแล้ว", value: approved.length, unit: "รายการ", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
        { label: "วันลาที่ใช้", value: totalDays, unit: "วัน", color: "text-sky-600", bg: "bg-sky-50", border: "border-sky-100" },
      ].map((s) => (
        <div key={s.label} className={`rounded-2xl border p-3 text-center ${s.bg} ${s.border}`}>
          <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
          <p className="text-[10px] text-gray-400 leading-tight">{s.unit}</p>
          <p className="text-[10px] font-semibold text-gray-500 leading-tight mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RequestsPage() {
  const [activeTab, setActiveTab] = useState<RequestTab>("ot");

  const pendingTotal =
    MOCK_OT.filter((r) => r.status === "pending").length +
    MOCK_LEAVE.filter((r) => r.status === "pending").length;

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">คำขอของฉัน</h1>
            <p className="text-xs text-gray-400 mt-0.5">Requests</p>
          </div>
          {pendingTotal > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              รออนุมัติ {pendingTotal} รายการ
            </span>
          )}
        </div>

        {/* Segment Control */}
        <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
          {(["ot", "leave"] as RequestTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                activeTab === tab
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {tab === "ot" ? (
                <span className="flex items-center justify-center gap-1.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" />
                  </svg>
                  OT Request
                  {MOCK_OT.filter((r) => r.status === "pending").length > 0 && (
                    <span className="w-4 h-4 rounded-full bg-amber-400 text-white text-[9px] font-black flex items-center justify-center">
                      {MOCK_OT.filter((r) => r.status === "pending").length}
                    </span>
                  )}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                  </svg>
                  ใบลา
                  {MOCK_LEAVE.filter((r) => r.status === "pending").length > 0 && (
                    <span className="w-4 h-4 rounded-full bg-amber-400 text-white text-[9px] font-black flex items-center justify-center">
                      {MOCK_LEAVE.filter((r) => r.status === "pending").length}
                    </span>
                  )}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4 pt-5">
        {activeTab === "ot" ? (
          <>
            <OTSummary />
            <div className="space-y-3">
              {MOCK_OT.map((req) => (
                <OTCard key={req.id} req={req} />
              ))}
            </div>
          </>
        ) : (
          <>
            <LeaveSummary />
            <div className="space-y-3">
              {MOCK_LEAVE.map((req) => (
                <LeaveCard key={req.id} req={req} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── FAB: New Request ── */}
      <Link
        href={`/requests/new?type=${activeTab}`}
        className="fixed bottom-24 right-4 z-30 flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-slate-900 text-white text-sm font-bold shadow-xl shadow-slate-900/20 active:scale-95 transition-all"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        {activeTab === "ot" ? "ยื่นคำขอ OT" : "ยื่นใบลา"}
      </Link>
    </div>
  );
}