"use client";

import { useState, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type OTStatus = "pending" | "approved" | "rejected";
type UserRole = "user" | "manager";

interface OTRequest {
  id: string;
  userId: string;
  userName: string;
  userCode: string;
  dept: string;
  avatar: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  project: string;
  projectNo: string;
  reason: string;
  status: OTStatus;
  submittedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectReason?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS_TH = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

const PROJECT_OPTIONS = [
  { id: "p1", no: "1155", name: "Toyota Line A" },
  { id: "p2", no: "1160", name: "Honda Factory" },
  { id: "p3", no: "1172", name: "SCG Plant" },
  { id: "p4", no: "1180", name: "Toyota Line B" },
  { id: "p5", no: "1188", name: "PTT Refinery" },
];

const REASON_PRESETS = [
  "งานด่วนลูกค้า",
  "ทดสอบระบบ / Commissioning",
  "ซ่อมฉุกเฉิน",
  "เร่งส่งมอบงาน",
  "Startup ระบบ",
  "Training / อบรม",
];

const MOCK_REQUESTS: OTRequest[] = [
  {
    id: "ot001", userId: "1055", userName: "ช่างวิทย์ สมบูรณ์", userCode: "1055",
    dept: "ช่างเทคนิค", avatar: "ว",
    date: "2026-02-25", startTime: "17:30", endTime: "21:00", hours: 3.5,
    project: "Toyota Line A", projectNo: "1155",
    reason: "ทดสอบระบบ / Commissioning", status: "pending",
    submittedAt: "2026-02-24T10:30:00",
  },
  {
    id: "ot002", userId: "1055", userName: "ช่างวิทย์ สมบูรณ์", userCode: "1055",
    dept: "ช่างเทคนิค", avatar: "ว",
    date: "2026-02-18", startTime: "17:30", endTime: "19:00", hours: 1.5,
    project: "SCG Plant", projectNo: "1172",
    reason: "เร่งส่งมอบงาน Phase 2", status: "pending",
    submittedAt: "2026-02-17T14:00:00",
  },
  {
    id: "ot003", userId: "1060", userName: "ช่างสมชาย ดีใจ", userCode: "1060",
    dept: "ช่างเทคนิค", avatar: "ส",
    date: "2026-02-24", startTime: "17:30", endTime: "20:30", hours: 3,
    project: "Honda Factory", projectNo: "1160",
    reason: "งานด่วนลูกค้า", status: "pending",
    submittedAt: "2026-02-23T15:45:00",
  },
  {
    id: "ot004", userId: "1055", userName: "ช่างวิทย์ สมบูรณ์", userCode: "1055",
    dept: "ช่างเทคนิค", avatar: "ว",
    date: "2026-02-11", startTime: "17:30", endTime: "20:30", hours: 3,
    project: "Honda Factory", projectNo: "1160",
    reason: "งานด่วนลูกค้า", status: "approved",
    submittedAt: "2026-02-10T16:00:00",
    approvedBy: "นายสมชาย (Manager)", approvedAt: "2026-02-10T17:30:00",
  },
  {
    id: "ot005", userId: "1055", userName: "ช่างวิทย์ สมบูรณ์", userCode: "1055",
    dept: "ช่างเทคนิค", avatar: "ว",
    date: "2026-01-22", startTime: "17:30", endTime: "21:30", hours: 4,
    project: "Toyota Line B", projectNo: "1180",
    reason: "ซ่อมฉุกเฉิน", status: "approved",
    submittedAt: "2026-01-21T08:00:00",
    approvedBy: "นายสมชาย (Manager)", approvedAt: "2026-01-21T09:00:00",
  },
  {
    id: "ot006", userId: "1055", userName: "ช่างวิทย์ สมบูรณ์", userCode: "1055",
    dept: "ช่างเทคนิค", avatar: "ว",
    date: "2026-01-15", startTime: "17:30", endTime: "19:30", hours: 2,
    project: "Honda Factory", projectNo: "1160",
    reason: "Startup ระบบ", status: "rejected",
    submittedAt: "2026-01-14T13:00:00",
    approvedBy: "นายสมชาย (Manager)", approvedAt: "2026-01-14T14:00:00",
    rejectReason: "ไม่มีในแผนการทำงาน กรุณายื่นใหม่พร้อมแนบ PO",
  },
  {
    id: "ot007", userId: "1065", userName: "ช่างอนุชา ตั้งใจ", userCode: "1065",
    dept: "ไฟฟ้า", avatar: "อ",
    date: "2026-02-23", startTime: "17:30", endTime: "22:00", hours: 4.5,
    project: "PTT Refinery", projectNo: "1188",
    reason: "Startup ระบบ", status: "pending",
    submittedAt: "2026-02-22T11:00:00",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ${MONTHS_TH[m - 1]} ${y + 543}`;
};

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const calcHours = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 10) / 10);
};

const STATUS_CONFIG = {
  pending:  { label: "รอพิจารณา",  bg: "bg-amber-50",   text: "text-amber-600",   border: "border-amber-200",  dot: "bg-amber-400",  icon: "⏳" },
  approved: { label: "อนุมัติแล้ว", bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200", dot: "bg-emerald-400", icon: "✓" },
  rejected: { label: "ไม่อนุมัติ", bg: "bg-rose-50",    text: "text-rose-600",    border: "border-rose-200",   dot: "bg-rose-400",   icon: "✕" },
};

// ─── Reject Modal ─────────────────────────────────────────────────────────────
function RejectModal({
  request,
  onConfirm,
  onClose,
}: {
  request: OTRequest;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const presets = ["ไม่มีในแผนงาน", "งบประมาณไม่เพียงพอ", "กรุณายื่นล่วงหน้า 24 ชม.", "ข้อมูลไม่ครบถ้วน"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-150">
        {/* Header */}
        <div className="bg-gradient-to-br from-rose-500 to-rose-600 px-6 py-5 text-white">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h2 className="text-base font-bold">ไม่อนุมัติ OT</h2>
          </div>
          <p className="text-rose-100 text-xs">{request.userName} · {request.date && fmtDate(request.date)} · {request.hours} ชม.</p>
        </div>

        <div className="p-5 space-y-4">
          {/* Preset reasons */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">เหตุผลที่ใช้บ่อย</p>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p}
                  onClick={() => setReason(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${reason === p ? "bg-rose-500 text-white border-rose-500" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-rose-300 hover:text-rose-500"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Custom reason */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">หรือระบุเหตุผลเพิ่มเติม</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น กรุณายื่น OT Request ล่วงหน้าอย่างน้อย 1 วันทำการ..."
              rows={3}
              className="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-50 placeholder-gray-300 resize-none transition-all"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={() => onConfirm(reason)}
              disabled={!reason.trim()}
              className="flex-1 py-3 rounded-xl bg-rose-500 text-white text-sm font-bold hover:bg-rose-600 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
            >
              ยืนยันไม่อนุมัติ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── OT Detail Drawer ─────────────────────────────────────────────────────────
function OTDetailDrawer({
  request,
  role,
  onClose,
  onApprove,
  onReject,
}: {
  request: OTRequest;
  role: UserRole;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const st = STATUS_CONFIG[request.status];

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full md:w-[460px] bg-white rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] animate-in slide-in-from-bottom-4 md:slide-in-from-bottom-0 md:fade-in duration-200">

        {/* Mobile handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Status banner */}
        <div className={`mx-5 mt-4 mb-0 px-4 py-3 rounded-2xl flex items-center gap-3 border ${st.bg} ${st.border}`}>
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${st.dot}`} />
          <div className="flex-1">
            <p className={`text-sm font-bold ${st.text}`}>{st.label}</p>
            {request.approvedAt && (
              <p className={`text-xs opacity-70 ${st.text}`}>{fmtDateTime(request.approvedAt)}</p>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-black/5 flex items-center justify-center text-gray-400 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Employee info */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white text-xl font-extrabold shadow-sm">
              {request.avatar}
            </div>
            <div>
              <p className="text-base font-extrabold text-gray-800">{request.userName}</p>
              <p className="text-xs text-gray-400">#{request.userCode} · {request.dept}</p>
            </div>
          </div>

          {/* OT Details grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "วันที่", value: fmtDate(request.date), icon: "📅" },
              { label: "ชั่วโมง OT", value: `${request.hours} ชม.`, icon: "⏱" },
              { label: "เวลาเริ่ม", value: request.startTime, icon: "🟢" },
              { label: "เวลาสิ้นสุด", value: request.endTime, icon: "🔴" },
            ].map(item => (
              <div key={item.label} className="bg-gray-50 rounded-2xl p-3.5">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">{item.label}</p>
                <p className="text-base font-extrabold text-gray-800 flex items-center gap-1.5">
                  <span className="text-sm">{item.icon}</span> {item.value}
                </p>
              </div>
            ))}
          </div>

          {/* Project */}
          <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4">
            <p className="text-[10px] text-sky-500 font-bold uppercase tracking-wider mb-2">Project</p>
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-700 text-xs font-extrabold border border-sky-200">#{request.projectNo}</span>
              <span className="text-sm font-bold text-sky-800">{request.project}</span>
            </div>
          </div>

          {/* Reason */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">เหตุผล</p>
            <p className="text-sm font-semibold text-gray-700">{request.reason}</p>
          </div>

          {/* Rejection reason */}
          {request.status === "rejected" && request.rejectReason && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
              <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mb-2">เหตุผลที่ไม่อนุมัติ</p>
              <p className="text-sm font-semibold text-rose-700">{request.rejectReason}</p>
              {request.approvedBy && <p className="text-xs text-rose-400 mt-1.5">โดย: {request.approvedBy}</p>}
            </div>
          )}

          {request.status === "approved" && request.approvedBy && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider mb-1.5">อนุมัติโดย</p>
              <p className="text-sm font-bold text-emerald-700">{request.approvedBy}</p>
            </div>
          )}

          {/* Submitted at */}
          <p className="text-xs text-gray-300 text-center">ยื่นเมื่อ {fmtDateTime(request.submittedAt)}</p>
        </div>

        {/* Manager approve/reject actions */}
        {role === "manager" && request.status === "pending" && (
          <div className="px-5 pb-6 pt-2 flex gap-3 flex-shrink-0 border-t border-gray-50">
            <button
              onClick={() => { onReject(request.id); onClose(); }}
              className="flex-1 py-3.5 rounded-2xl border-2 border-rose-200 text-rose-500 font-bold text-sm hover:bg-rose-50 transition-all flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              ไม่อนุมัติ
            </button>
            <button
              onClick={() => { onApprove(request.id); onClose(); }}
              className="flex-1 py-3.5 rounded-2xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              อนุมัติ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── OT Request Card ──────────────────────────────────────────────────────────
function OTCard({
  req,
  role,
  onClick,
  onApprove,
  onReject,
}: {
  req: OTRequest;
  role: UserRole;
  onClick: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const st = STATUS_CONFIG[req.status];
  const [y, m, d] = req.date.split("-").map(Number);

  return (
    <div
      onClick={onClick}
      className={`group relative bg-white rounded-2xl border-2 transition-all duration-200 cursor-pointer hover:shadow-md hover:-translate-y-0.5 overflow-hidden
        ${req.status === "pending" ? "border-amber-200 hover:border-amber-300" :
          req.status === "approved" ? "border-emerald-100 hover:border-emerald-200" :
          "border-rose-100 hover:border-rose-200"}`}
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${st.dot}`} />

      <div className="pl-5 pr-4 py-4 flex items-start gap-4">

        {/* Date column */}
        <div className={`flex-shrink-0 w-12 h-14 rounded-2xl flex flex-col items-center justify-center border-2
          ${req.status === "pending" ? "bg-amber-50 border-amber-200" :
            req.status === "approved" ? "bg-emerald-50 border-emerald-200" :
            "bg-rose-50 border-rose-200"}`}>
          <span className={`text-lg font-extrabold leading-none
            ${req.status === "pending" ? "text-amber-600" :
              req.status === "approved" ? "text-emerald-600" : "text-rose-600"}`}>{d}</span>
          <span className={`text-[9px] font-bold mt-0.5
            ${req.status === "pending" ? "text-amber-400" :
              req.status === "approved" ? "text-emerald-400" : "text-rose-400"}`}>{MONTHS_TH[m - 1]}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Top row */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              {role === "manager" && (
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white text-[10px] font-bold">
                    {req.avatar}
                  </div>
                  <span className="text-xs font-semibold text-gray-500">{req.userName}</span>
                </div>
              )}
              <p className="text-sm font-bold text-gray-800 leading-tight truncate">{req.reason}</p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                <span className="font-semibold text-sky-500">#{req.projectNo}</span> · {req.project}
              </p>
            </div>
            <span className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${st.bg} ${st.text} ${st.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
              {st.label}
            </span>
          </div>

          {/* Bottom row */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-gray-400">
                <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
              </svg>
              {req.startTime} – {req.endTime}
            </span>
            <span className={`flex items-center gap-1 text-xs font-extrabold px-2 py-0.5 rounded-lg
              ${req.status === "approved" ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50"}`}>
              +{req.hours}h OT
            </span>
          </div>
        </div>
      </div>

      {/* Manager quick actions - visible on hover (desktop) */}
      {role === "manager" && req.status === "pending" && (
        <div className="hidden md:flex items-center gap-2 px-4 py-3 border-t border-amber-100 bg-amber-50/50 opacity-0 group-hover:opacity-100 transition-all duration-200">
          <span className="flex-1 text-xs text-amber-600 font-medium">รอการอนุมัติจากคุณ</span>
          <button
            onClick={(e) => { e.stopPropagation(); onReject(req.id); }}
            className="px-3.5 py-1.5 rounded-xl border border-rose-200 text-rose-500 text-xs font-bold hover:bg-rose-50 transition-colors flex items-center gap-1.5"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            ไม่อนุมัติ
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onApprove(req.id); }}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors shadow-sm flex items-center gap-1.5"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            อนุมัติ
          </button>
        </div>
      )}
    </div>
  );
}

// ─── New OT Form ──────────────────────────────────────────────────────────────
function NewOTForm({ onSubmit }: { onSubmit: (req: OTRequest) => void }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    date: today,
    startTime: "17:30",
    endTime: "",
    projectId: "",
    reason: "",
    customReason: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const selectedProject = PROJECT_OPTIONS.find((p) => p.id === form.projectId);
  const hours = calcHours(form.startTime, form.endTime);
  const finalReason = form.reason === "__custom__" ? form.customReason : form.reason;
  const isValid = form.date && form.startTime && form.endTime && form.projectId && finalReason.trim() && hours > 0;

  const handleSubmit = () => {
    if (!isValid || !selectedProject) return;
    const now = new Date().toISOString();
    onSubmit({
      id: `ot_${Date.now()}`,
      userId: "1055",
      userName: "ช่างวิทย์ สมบูรณ์",
      userCode: "1055",
      dept: "ช่างเทคนิค",
      avatar: "ว",
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      hours,
      project: selectedProject.name,
      projectNo: selectedProject.no,
      reason: finalReason,
      status: "pending",
      submittedAt: now,
    });
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setForm({ date: today, startTime: "17:30", endTime: "", projectId: "", reason: "", customReason: "" });
    }, 2500);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="w-20 h-20 rounded-3xl bg-emerald-100 flex items-center justify-center mb-4 shadow-lg shadow-emerald-100">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-10 h-10 text-emerald-500">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 className="text-xl font-extrabold text-gray-800 mb-1">ยื่นคำขอสำเร็จ!</h3>
        <p className="text-sm text-gray-400">รอการอนุมัติจาก Manager</p>
        <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-4 py-2.5 rounded-full border border-emerald-200 font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {hours} ชม. · {selectedProject?.name} #{selectedProject?.no}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Date + Time row */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">วันที่และเวลา</p>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500">วันที่ทำ OT</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-50 transition-all bg-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "เวลาเริ่ม OT", key: "startTime" as const, placeholder: "17:30" },
            { label: "เวลาสิ้นสุด OT", key: "endTime" as const, placeholder: "20:00" },
          ].map(item => (
            <div key={item.key} className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">{item.label}</label>
              <input
                type="time"
                value={form[item.key]}
                onChange={(e) => setForm(f => ({ ...f, [item.key]: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-50 transition-all"
              />
            </div>
          ))}
        </div>

        {/* Hours preview pill */}
        {hours > 0 && (
          <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-50 border border-sky-200 animate-in fade-in duration-200">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-sky-400">
              <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
            </svg>
            <span className="text-sm font-extrabold text-sky-600">รวม OT {hours} ชั่วโมง</span>
          </div>
        )}
      </div>

      {/* Project */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">โปรเจกต์</p>
        <div className="grid grid-cols-1 gap-2">
          {PROJECT_OPTIONS.map((proj) => (
            <button
              key={proj.id}
              onClick={() => setForm(f => ({ ...f, projectId: proj.id }))}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all duration-150
                ${form.projectId === proj.id
                  ? "border-sky-400 bg-sky-50"
                  : "border-gray-100 hover:border-gray-200 bg-white"}`}
            >
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-extrabold border-2 flex-shrink-0 transition-all
                ${form.projectId === proj.id ? "bg-sky-500 text-white border-sky-500" : "bg-gray-50 text-gray-400 border-gray-200"}`}>
                {proj.no}
              </span>
              <span className={`text-sm font-semibold transition-colors ${form.projectId === proj.id ? "text-sky-700" : "text-gray-700"}`}>
                {proj.name}
              </span>
              {form.projectId === proj.id && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-sky-500 ml-auto">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Reason */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">เหตุผลการทำ OT</p>

        <div className="grid grid-cols-2 gap-2">
          {REASON_PRESETS.map((r) => (
            <button
              key={r}
              onClick={() => setForm(f => ({ ...f, reason: r, customReason: "" }))}
              className={`py-2.5 px-3 rounded-xl border-2 text-xs font-semibold text-left transition-all duration-150
                ${form.reason === r
                  ? "border-violet-400 bg-violet-50 text-violet-700"
                  : "border-gray-100 bg-white text-gray-600 hover:border-gray-200"}`}
            >
              {r}
            </button>
          ))}
          <button
            onClick={() => setForm(f => ({ ...f, reason: "__custom__" }))}
            className={`py-2.5 px-3 rounded-xl border-2 text-xs font-semibold text-left transition-all duration-150 flex items-center gap-1.5 col-span-2
              ${form.reason === "__custom__"
                ? "border-violet-400 bg-violet-50 text-violet-700"
                : "border-dashed border-gray-200 bg-white text-gray-400 hover:border-gray-300"}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            ระบุเหตุผลเอง...
          </button>
        </div>

        {form.reason === "__custom__" && (
          <input
            autoFocus
            value={form.customReason}
            onChange={(e) => setForm(f => ({ ...f, customReason: e.target.value }))}
            placeholder="ระบุเหตุผล..."
            className="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-50 placeholder-gray-300 transition-all animate-in slide-in-from-top-2 duration-150"
          />
        )}
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!isValid}
        className={`w-full py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-2 transition-all duration-300
          ${isValid
            ? "bg-sky-500 text-white shadow-lg shadow-sky-200 hover:bg-sky-600 active:scale-[0.98]"
            : "bg-gray-100 text-gray-300 cursor-not-allowed"}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
          <path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" />
        </svg>
        ยื่นคำขอ OT {isValid ? `(${hours} ชม.)` : ""}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OTPage() {
  const [role, setRole] = useState<UserRole>("user");
  const [requests, setRequests] = useState<OTRequest[]>(MOCK_REQUESTS);
  const [activeTab, setActiveTab] = useState<"list" | "new">("list");
  const [filterStatus, setFilterStatus] = useState<OTStatus | "all">("all");
  const [selectedReq, setSelectedReq] = useState<OTRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  // Stats
  const myRequests = requests.filter((r) => r.userId === "1055");
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const myApprovedHours = myRequests.filter((r) => r.status === "approved").reduce((s, r) => s + r.hours, 0);
  const myPendingCount = myRequests.filter((r) => r.status === "pending").length;

  // Filter
  const displayRequests = useMemo(() => {
    const base = role === "manager" ? requests : myRequests;
    if (filterStatus === "all") return base;
    return base.filter((r) => r.status === filterStatus);
  }, [requests, role, filterStatus, myRequests]);

  const handleApprove = (id: string) => {
    setRequests((prev) => prev.map((r) =>
      r.id === id ? { ...r, status: "approved", approvedBy: "นายสมชาย (Manager)", approvedAt: new Date().toISOString() } : r
    ));
  };

  const handleReject = (id: string) => {
    setRejectTarget(id);
  };

  const handleRejectConfirm = (reason: string) => {
    if (!rejectTarget) return;
    setRequests((prev) => prev.map((r) =>
      r.id === rejectTarget ? { ...r, status: "rejected", approvedBy: "นายสมชาย (Manager)", approvedAt: new Date().toISOString(), rejectReason: reason } : r
    ));
    setRejectTarget(null);
  };

  const handleNewRequest = (req: OTRequest) => {
    setRequests((prev) => [req, ...prev]);
    setTimeout(() => setActiveTab("list"), 2600);
  };

  const pendingForApproval = requests.filter((r) => r.status === "pending");

  return (
    <main className="min-h-screen bg-gray-50 pb-28 md:pb-10">

      {/* ── Top Header ── */}
      <div className="sticky top-0 z-20 bg-gray-50/90 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center justify-between px-4 md:px-6 pt-4 pb-3 gap-3">
          <div>
            <p className="text-xs text-gray-400 font-medium leading-none">ช่างวิทย์ · #1055</p>
            <h1 className="text-xl font-extrabold text-gray-800 leading-tight flex items-center gap-2">
              OT Request
              {pendingCount > 0 && (
                <span className="text-xs font-bold bg-amber-400 text-white px-2 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </h1>
          </div>

          {/* Role toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
              <button
                onClick={() => setRole("user")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${role === "user" ? "bg-white shadow-sm text-sky-600" : "text-gray-400 hover:text-gray-600"}`}
              >
                พนักงาน
              </button>
              <button
                onClick={() => setRole("manager")}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${role === "manager" ? "bg-white shadow-sm text-sky-600" : "text-gray-400 hover:text-gray-600"}`}
              >
                Manager
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Tab bar (user mode) */}
        {role === "user" && (
          <div className="flex px-4 md:px-6 pb-0 gap-1">
            {[
              { key: "list" as const, label: "รายการ OT ของฉัน" },
              { key: "new" as const, label: "ยื่นคำขอ OT ใหม่" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex-1 py-3 text-sm font-bold transition-all border-b-2 ${
                  activeTab === tab.key
                    ? "text-sky-600 border-sky-500"
                    : "text-gray-400 border-transparent hover:text-gray-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 md:px-6 pt-5 space-y-4">

        {/* ── Stats Row ── */}
        {role === "user" ? (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "รอพิจารณา", value: myPendingCount, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
              { label: "อนุมัติแล้ว", value: myRequests.filter(r => r.status === "approved").length, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
              { label: "OT รวม (h)", value: myApprovedHours, color: "text-sky-600", bg: "bg-sky-50", border: "border-sky-200" },
            ].map((stat) => (
              <div key={stat.label} className={`${stat.bg} rounded-2xl border ${stat.border} p-3 text-center`}>
                <p className={`text-2xl font-extrabold ${stat.color} leading-none`}>{stat.value}</p>
                <p className="text-[10px] text-gray-400 font-semibold mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        ) : (
          /* Manager approval queue banner */
          pendingForApproval.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-amber-500">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-extrabold text-amber-800">มีคำขอ OT รอการอนุมัติ</p>
                <p className="text-xs text-amber-600 mt-0.5">{pendingForApproval.length} รายการ · รวม {pendingForApproval.reduce((s, r) => s + r.hours, 0)} ชม.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => {
                    pendingForApproval.forEach((r) => handleApprove(r.id));
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors shadow-sm whitespace-nowrap"
                >
                  อนุมัติทั้งหมด
                </button>
              </div>
            </div>
          )
        )}

        {/* ── Filter Pills (list view) ── */}
        {(role === "manager" || activeTab === "list") && (
          <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
            {[
              { key: "all" as const, label: `ทั้งหมด (${role === "manager" ? requests.length : myRequests.length})` },
              { key: "pending" as const, label: `รอพิจารณา (${(role === "manager" ? requests : myRequests).filter(r => r.status === "pending").length})` },
              { key: "approved" as const, label: "อนุมัติแล้ว" },
              { key: "rejected" as const, label: "ไม่อนุมัติ" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all
                  ${filterStatus === f.key
                    ? "bg-sky-500 text-white border-sky-500 shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Content ── */}
        {role === "user" && activeTab === "new" ? (
          <NewOTForm onSubmit={handleNewRequest} />
        ) : (
          <div className="space-y-3">
            {displayRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-3xl bg-white border border-gray-100 shadow-sm flex items-center justify-center mb-4">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-gray-300">
                    <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-400">ไม่มีรายการ OT</p>
                <p className="text-xs text-gray-300 mt-1">กดปุ่ม "ยื่นคำขอ OT ใหม่" เพื่อเริ่มต้น</p>
              </div>
            ) : (
              displayRequests.map((req) => (
                <OTCard
                  key={req.id}
                  req={req}
                  role={role}
                  onClick={() => setSelectedReq(req)}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))
            )}
          </div>
        )}

      </div>

      {/* ── FAB: New OT (user mode, list tab) ── */}
      {role === "user" && activeTab === "list" && (
        <button
          onClick={() => setActiveTab("new")}
          className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-30 w-14 h-14 rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-300/50 flex items-center justify-center hover:bg-sky-600 transition-all active:scale-90"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-6 h-6">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}

      {/* ── Detail Drawer ── */}
      {selectedReq && (
        <OTDetailDrawer
          request={selectedReq}
          role={role}
          onClose={() => setSelectedReq(null)}
          onApprove={(id) => { handleApprove(id); setSelectedReq(null); }}
          onReject={(id) => { setSelectedReq(null); handleReject(id); }}
        />
      )}

      {/* ── Reject Modal ── */}
      {rejectTarget && (
        <RejectModal
          request={requests.find((r) => r.id === rejectTarget)!}
          onConfirm={handleRejectConfirm}
          onClose={() => setRejectTarget(null)}
        />
      )}
    </main>
  );
}