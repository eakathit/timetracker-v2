"use client";
// src/app/(dashboard)/time-sync/TimeSyncClient.tsx

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type {
  EmployeeSyncRecord,
  SyncPeriod,
  SyncStatus,
  SyncSummary,
  TimeGap,
} from "./types";

// ─── Constants ─────────────────────────────────────────────────────────────────

const TIMELINE_START = 7 * 60; // 07:00
const TIMELINE_END = 19 * 60; // 19:00
const TIMELINE_SPAN = TIMELINE_END - TIMELINE_START;

const STATUS_CONFIG: Record<
  SyncStatus,
  {
    label: string;
    labelTh: string;
    bg: string;
    text: string;
    border: string;
    dot: string;
    icon: string;
  }
> = {
  synced: {
    label: "Synced",
    labelTh: "ตรงกัน",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    icon: "✅",
  },
  partial: {
    label: "Partial",
    labelTh: "ไม่ครบ",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
    icon: "⚠️",
  },
  no_report: {
    label: "No Report",
    labelTh: "ไม่กรอก Report",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
    icon: "❌",
  },
  no_log: {
    label: "No Log",
    labelTh: "ไม่มีข้อมูลเวลา",
    bg: "bg-slate-50",
    text: "text-slate-500",
    border: "border-slate-200",
    dot: "bg-slate-400",
    icon: "⬜",
  },
};

type FilterTab = "all" | SyncStatus;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toMins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

function pct(mins: number): number {
  return Math.max(
    0,
    Math.min(100, ((mins - TIMELINE_START) / TIMELINE_SPAN) * 100),
  );
}

function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}น.`;
  if (m === 0) return `${h}ชม.`;
  return `${h}ชม. ${m}น.`;
}

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function formatDateTH(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const months = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];
  const dayNames = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  const dow = new Date(y, m - 1, d).getDay();
  return `${dayNames[dow]} ${d} ${months[m - 1]} ${y + 543}`;
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + delta);
  return d.toLocaleDateString("en-CA");
}

function todayBangkok(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

// ─── Sub-components ────────────────────────────────────────────────────────────

/** Visual timeline bar showing work period, covered zones, and gaps */
function TimelineBar({ record }: { record: EmployeeSyncRecord }) {
  if (!record.checkIn || !record.checkOut) {
    return (
      <div className="h-7 bg-slate-100 rounded-lg flex items-center justify-center">
        <span className="text-xs text-slate-400">ไม่มีข้อมูลเวลา</span>
      </div>
    );
  }

  const workStart = toMins(record.checkIn);
  const workEnd = toMins(record.checkOut);

  // Build segments: alternate between covered and gap
  // Collect all covered period intervals clamped to work window
  const intervals = record.reportPeriods
    .map((rp) => ({ start: toMins(rp.periodStart), end: toMins(rp.periodEnd) }))
    .map((p) => ({
      start: Math.max(p.start, workStart),
      end: Math.min(p.end, workEnd),
    }))
    .filter((p) => p.start < p.end)
    .sort((a, b) => a.start - b.start);

  // Merge overlapping
  const merged: Array<{ start: number; end: number }> = [];
  for (const p of intervals) {
    if (!merged.length || p.start > merged[merged.length - 1].end) {
      merged.push({ ...p });
    } else {
      merged[merged.length - 1].end = Math.max(
        merged[merged.length - 1].end,
        p.end,
      );
    }
  }

  const workStartPct = pct(workStart);
  const workEndPct = pct(workEnd);
  const workWidthPct = workEndPct - workStartPct;

  return (
    <div className="relative">
      {/* Hour ticks — หลัง (absolute position ตรงกับ pct() จริง) */}
      <div className="relative h-4 mb-1">
        {[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((h) => (
          <span
            key={h}
            className="absolute text-[9px] text-slate-300 font-mono -translate-x-1/2"
            style={{ left: `${pct(h * 60)}%` }}
          >
            {String(h).padStart(2, "0")}
          </span>
        ))}
      </div>

      {/* Main bar background */}
      <div className="relative h-7 bg-slate-100 rounded-lg overflow-hidden">
        {/* Work window background */}
        <div
          className="absolute top-0 h-full bg-slate-200 rounded"
          style={{ left: `${workStartPct}%`, width: `${workWidthPct}%` }}
        />

        {/* Gap zones (red) */}
        {record.gaps.map((gap, i) => {
          const gFrom = toMins(gap.from);
          const gTo = toMins(gap.to);
          const l = pct(gFrom);
          const w = pct(gTo) - l;
          return (
            <div
              key={i}
              className="absolute top-0 h-full bg-red-300/60"
              style={{ left: `${l}%`, width: `${w}%` }}
              title={`Gap: ${gap.from}–${gap.to} (${gap.minutes}น.)`}
            />
          );
        })}

        {/* Covered zones (green) */}
        {merged.map((seg, i) => {
          const l = pct(seg.start);
          const w = pct(seg.end) - l;
          return (
            <div
              key={i}
              className="absolute top-0 h-full bg-emerald-400/70"
              style={{ left: `${l}%`, width: `${w}%` }}
            />
          );
        })}

        {/* Over-claimed zones (purple) — report อ้างก่อน check-in / หลัง check-out */}
        {record.reportPeriods.map((rp, i) => {
          const rpStart = toMins(rp.periodStart);
          const rpEnd = toMins(rp.periodEnd);
          const wStart = toMins(record.checkIn!);
          const wEnd = toMins(record.checkOut!);
          const zones: { from: number; to: number }[] = [];
          if (rpStart < wStart) zones.push({ from: rpStart, to: wStart });
          if (rpEnd > wEnd) zones.push({ from: wEnd, to: rpEnd });
          return zones.map((z, j) => (
            <div
              key={`oc-${i}-${j}`}
              className="absolute top-0 h-full bg-violet-300/50 z-[4]"
              style={{
                left: `${pct(z.from)}%`,
                width: `${pct(z.to) - pct(z.from)}%`,
              }}
             title={`เวลาไม่ตรง: ${String(Math.floor(z.from / 60)).padStart(2, "0")}:${String(z.from % 60).padStart(2, "0")}–${String(Math.floor(z.to / 60)).padStart(2, "0")}:${String(z.to % 60).padStart(2, "0")}`}
            />
          ));
        })}

        {/* ──────────────────────────────────────────────────────── */}
        {/* Lunch break overlay — แสดงเฉพาะถ้าเวลาทำงานคร่อมช่วงพัก */}
        {(() => {
          const LUNCH_START = 12 * 60; // 720
          const LUNCH_END = 13 * 60; // 780
          const spansLunch = workStart < LUNCH_END && workEnd > LUNCH_START;
          if (!spansLunch) return null;
          const clampedStart = Math.max(LUNCH_START, workStart);
          const clampedEnd = Math.min(LUNCH_END, workEnd);
          const l = pct(clampedStart);
          const w = pct(clampedEnd) - l;
          return (
            <div
              className="absolute top-0 h-full z-[5]"
              style={{
                left: `${l}%`,
                width: `${w}%`,
                background:
                  "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(148,163,184,0.35) 3px, rgba(148,163,184,0.35) 6px)",
              }}
              title="พักเที่ยง 12:00–13:00 (ไม่นับในการคำนวณ)"
            />
          );
        })()}

        {/* Pre-OT break 17:30–18:00 — แสดงเฉพาะวันที่มี OT */}
{record.otStart && record.otEnd && (() => {
  const PRE_OT_START = 17 * 60 + 30; // 17:30
  const PRE_OT_END   = 18 * 60;      // 18:00
  const spansBreak   = workEnd > PRE_OT_START;
  if (!spansBreak) return null;
  const l = pct(PRE_OT_START);
  const w = pct(PRE_OT_END) - l;
  return (
    <div
      className="absolute top-0 h-full z-[5]"
      style={{
        left: `${l}%`,
        width: `${w}%`,
        background: "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(148,163,184,0.35) 3px, rgba(148,163,184,0.35) 6px)",
      }}
      title="พักก่อน OT 17:30–18:00 (ไม่นับในการคำนวณ)"
    />
  );
})()}

        {/* ── OT window (amber) — เพิ่มตรงนี้ ────────────────────────── */}
        {record.otStart && record.otEnd && (() => {
          const otS = toMins(record.otStart);
          const otE = toMins(record.otEnd);
          const l = pct(otS);
          const w = pct(otE) - l;
          return (
            <div
              className="absolute top-0 h-full bg-amber-300/60 z-[3]"
              style={{ left: `${l}%`, width: `${w}%` }}
              title={`OT: ${record.otStart}–${record.otEnd} (ไม่นับในการตรวจสอบ)`}
            />
          );
        })()}

        {/* ──────────────────────────────────────────────────────── */}

        {/* Check-in marker */}
        {workStart >= TIMELINE_START && workStart <= TIMELINE_END && (
          <div
            className="absolute top-0 h-full w-0.5 bg-sky-500 z-10"
            style={{ left: `${workStartPct}%` }}
          />
        )}

        {/* Check-out marker */}
        {workEnd >= TIMELINE_START && workEnd <= TIMELINE_END && (
          <div
            className={`absolute top-0 h-full w-0.5 z-10 ${record.isAutoCheckout ? "bg-orange-400" : "bg-sky-500"}`}
            style={{ left: `${workEndPct}%` }}
          />
        )}
      </div>

      {/* Legend */}
      {/* Legend */}
      <div className="flex items-center gap-3 mt-1.5">
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm bg-emerald-400/70" />
          <span className="text-[10px] text-slate-500">มี Report</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm bg-red-300/60" />
          <span className="text-[10px] text-slate-500">ช่วงขาด</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm bg-slate-200" />
          <span className="text-[10px] text-slate-500">ทำงาน</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-3 h-2 rounded-sm"
            style={{
              background:
                "repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(148,163,184,0.35) 3px,rgba(148,163,184,0.35) 6px)",
            }}
          />
          <span className="text-[10px] text-slate-500">พักเที่ยง</span>
        </div>
        
        {/* ── เพิ่มตรงนี้ ──────────────────────────────────────────────── */}
        {record.otStart && record.otEnd && (
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-amber-300/60" />
            <span className="text-[10px] text-slate-500">OT</span>
          </div>
        )}

        {/* ── เพิ่มตรงนี้ ──────────────────────────────────────── */}
        {record.overclaimedMinutes > 15 && (
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-violet-300/50" />
            <span className="text-[10px] text-slate-500">เวลาไม่ตรง</span>
          </div>
        )}
        {/* ──────────────────────────────────────────────────────── */}

        {record.isAutoCheckout && (
          <div className="flex items-center gap-1 ml-auto">
            <div className="w-0.5 h-3 bg-orange-400" />
            <span className="text-[10px] text-orange-500">Auto Checkout</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Small gap badge with tooltip */
function GapBadge({ gap }: { gap: TimeGap }) {
  return (
    <div className="inline-flex items-center gap-1 bg-red-50 border border-red-200 text-red-600 px-2 py-0.5 rounded-full text-[11px] font-medium">
      <span className="text-red-400">⏱</span>
      {gap.from}–{gap.to}
      <span className="text-red-400 font-semibold">
        ({fmtDuration(gap.minutes)})
      </span>
    </div>
  );
}

/** Report period row */
function PeriodRow({ period }: { period: SyncPeriod }) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-3 bg-slate-50 rounded-lg text-xs">
      <div className="w-1 h-6 rounded-full bg-emerald-400 flex-shrink-0" />
      <div className="font-mono font-semibold text-slate-700 flex-shrink-0">
        {period.periodStart}–{period.periodEnd}
      </div>
      <div className="text-slate-400 truncate">
        {period.endUserName && (
          <span className="text-sky-600">{period.endUserName}</span>
        )}
        {period.projectNo && (
          <span className="text-slate-400"> · #{period.projectNo}</span>
        )}
        {period.workDetail && (
          <span className="text-slate-500"> · {period.workDetail}</span>
        )}
      </div>
      {period.periodLabel && (
        <div className="ml-auto flex-shrink-0">
          <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-medium">
            {period.periodLabel.split(" (")[0]}
          </span>
        </div>
      )}
    </div>
  );
}

/** Coverage donut */
function CoverageRing({ pct, status }: { pct: number; status: SyncStatus }) {
  const r = 18;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - pct / 100);
  const color =
    status === "synced"
      ? "#10b981"
      : status === "partial"
        ? "#f59e0b"
        : "#ef4444";

  return (
    <div className="relative w-12 h-12 flex-shrink-0">
      <svg viewBox="0 0 44 44" className="w-12 h-12 -rotate-90">
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="4"
        />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-bold text-slate-700">{pct}%</span>
      </div>
    </div>
  );
}

/** Employee card */
function EmployeeCard({ record }: { record: EmployeeSyncRecord }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[record.syncStatus];

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${cfg.border}`}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50/50 transition-colors"
      >
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {record.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={record.avatarUrl}
              alt=""
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            getInitials(record.firstName, record.lastName)
          )}
        </div>

        {/* Name & dept */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm leading-tight truncate">
            {record.firstName} {record.lastName}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{record.department}</p>
        </div>

        {/* Time badge */}
        <div className="text-center flex-shrink-0 hidden sm:block">
          <p className="text-xs font-mono font-semibold text-slate-700">
            {record.checkIn ?? "—"} → {record.checkOut ?? "—"}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {record.workMinutes > 0 ? fmtDuration(record.workMinutes) : "—"}
          </p>
        </div>

        {/* Coverage ring */}
        {record.syncStatus !== "no_log" && (
          <CoverageRing
            pct={record.coveragePercent}
            status={record.syncStatus}
          />
        )}

        {/* Status badge */}
        <div
          className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 flex-shrink-0 ${cfg.bg} ${cfg.text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.labelTh}
        </div>

        {/* Chevron */}
        <svg
          viewBox="0 0 24 24"
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Gap tags (collapsed preview) */}
      {!expanded && record.gaps.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {record.gaps.map((gap, i) => (
            <GapBadge key={i} gap={gap} />
          ))}
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-4 space-y-4">
          {/* Mobile time row */}
          <div className="flex sm:hidden items-center justify-between text-xs">
            <span className="font-mono font-semibold text-slate-700">
              {record.checkIn ?? "—"} → {record.checkOut ?? "—"}
            </span>
            <span className="text-slate-400">
              {record.workMinutes > 0 ? fmtDuration(record.workMinutes) : "—"}
            </span>
          </div>

          {/* Timeline visualization */}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Timeline (07:00 – 19:00)
            </p>
            <TimelineBar record={record} />
          </div>

          {/* ── Over-claimed warning ── เพิ่มตรงนี้ ────────────────── */}
          {record.overclaimedMinutes > 15 && (
  <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-xl">
    <span className="text-violet-500 text-sm flex-shrink-0">⚠️</span>
    <p className="text-xs text-violet-700">
      {(() => {
        const wStart = toMins(record.checkIn!);
        const wEnd   = toMins(record.checkOut!);
        const earlyMins = record.reportPeriods.reduce((acc, rp) => {
          const diff = wStart - toMins(rp.periodStart);
          return acc + (diff > 0 ? diff : 0);
        }, 0);
        const lateMins = record.reportPeriods.reduce((acc, rp) => {
          const diff = toMins(rp.periodEnd) - wEnd;
          return acc + (diff > 0 ? diff : 0);
        }, 0);

        if (earlyMins > 15 && lateMins > 15) return (
          <span>
            <span className="font-bold">เวลาใน Report ไม่ตรงกับเวลาจริง </span>
            <span className="text-violet-500">— ระบุเริ่มงานเร็วกว่า Check-in {fmtDuration(earlyMins)} และสิ้นสุดหลัง Check-out {fmtDuration(lateMins)}</span>
          </span>
        );
        if (earlyMins > 15) return (
          <span>
            <span className="font-bold">เวลาใน Report เร็วกว่า Check-in จริง {fmtDuration(earlyMins)} </span>
            <span className="text-violet-500">— Check-in จริงคือ {record.checkIn}</span>
          </span>
        );
        return (
          <span>
            <span className="font-bold">เวลาใน Report เลยหลัง Check-out จริง {fmtDuration(lateMins)} </span>
            <span className="text-violet-500">— Check-out จริงคือ {record.checkOut}</span>
          </span>
        );
      })()}
    </p>
  </div>
)}

          {/* Gaps */}
          {record.gaps.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                ⚠ ช่วงที่ขาด Report ({record.gaps.length} ช่วง ·{" "}
                {fmtDuration(record.uncoveredMinutes)})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {record.gaps.map((gap, i) => (
                  <GapBadge key={i} gap={gap} />
                ))}
              </div>
            </div>
          )}

          {/* Report items */}
          {record.reportPeriods.length > 0 ? (
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                📋 รายการ Report ({record.reportPeriods.length} รายการ)
              </p>
              <div className="space-y-1">
                {record.reportPeriods.map((rp) => (
                  <PeriodRow key={rp.id} period={rp} />
                ))}
              </div>
            </div>
          ) : (
            record.hasLog && (
              <div className="text-center py-6 bg-red-50 rounded-xl border border-red-100">
                <p className="text-3xl mb-1">📝</p>
                <p className="text-sm font-semibold text-red-600">
                  ไม่พบรายการ Report
                </p>
                <p className="text-xs text-red-400 mt-0.5">
                  มีการ Check-in แต่ยังไม่กรอก Daily Report
                </p>
              </div>
            )
          )}

          {/* Coverage stats row */}
          {record.hasLog && record.hasReport && (
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                  เวลาทำงาน
                </p>
                <p className="font-bold text-slate-700 text-sm mt-0.5">
                  {fmtDuration(record.workMinutes)}
                </p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <p className="text-[10px] text-emerald-600 uppercase tracking-wide">
                  ครอบคลุม
                </p>
                <p className="font-bold text-emerald-700 text-sm mt-0.5">
                  {fmtDuration(record.coveredMinutes)}
                </p>
              </div>
              <div
                className={`rounded-xl p-3 text-center ${record.uncoveredMinutes > 0 ? "bg-red-50" : "bg-emerald-50"}`}
              >
                <p
                  className={`text-[10px] uppercase tracking-wide ${record.uncoveredMinutes > 0 ? "text-red-500" : "text-emerald-600"}`}
                >
                  ขาด
                </p>
                <p
                  className={`font-bold text-sm mt-0.5 ${record.uncoveredMinutes > 0 ? "text-red-600" : "text-emerald-700"}`}
                >
                  {record.uncoveredMinutes > 0
                    ? fmtDuration(record.uncoveredMinutes)
                    : "ไม่มี"}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Summary Card ──────────────────────────────────────────────────────────────
function SummaryCard({
  label,
  value,
  subLabel,
  color,
  bg,
  ring,
  active,
  onClick,
}: {
  label: string;
  value: number;
  subLabel?: string;
  color: string;
  bg: string;
  ring: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-2xl border p-3 text-left transition-all ${
        active
          ? `${bg} border-transparent ${color} ring-2 ${ring} ring-offset-2 shadow-md`
          : "bg-white border-slate-100 hover:bg-slate-50 shadow-sm"
      }`}
    >
      <p className={`text-2xl font-black ${active ? color : "text-slate-800"}`}>
        {value}
      </p>
      <p
        className={`text-[11px] font-semibold mt-0.5 ${active ? color : "text-slate-500"}`}
      >
        {label}
      </p>
      {subLabel && (
        <p
          className={`text-[10px] mt-0.5 ${active ? "opacity-70" : "text-slate-400"}`}
        >
          {subLabel}
        </p>
      )}
    </button>
  );
}

// ─── Main Client Component ─────────────────────────────────────────────────────
export default function TimeSyncClient({
  records,
  summary,
  syncDate,
}: {
  records: EmployeeSyncRecord[];
  summary: SyncSummary;
  syncDate: string;
}) {
  const router = useRouter();
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState<string>("all"); 

  // departments list (derive จาก records)
const departments = useMemo(() => {
  const depts = Array.from(new Set(records.map((r) => r.department)))
    .filter(Boolean)
    .sort();
  return ["all", ...depts];
}, [records]);

  const today = todayBangkok(); 
  const isToday = syncDate === today;

  // ── Filtered list ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
  return records.filter((r) => {
    const matchSearch =
      !search ||
      `${r.firstName} ${r.lastName} ${r.department}`
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchTab =
      filterTab === "all" || r.syncStatus === filterTab;
    const matchDept =                                    // ← เพิ่ม
      filterDept === "all" || r.department === filterDept;
    return matchSearch && matchTab && matchDept;
  });
}, [records, search, filterTab, filterDept]);

  // Sort: issues first (partial, no_report), then synced
  const sorted = useMemo(() => {
    const order: Record<SyncStatus, number> = {
      no_report: 0,
      partial: 1,
      no_log: 2,
      synced: 3,
    };
    return [...filtered].sort(
      (a, b) => order[a.syncStatus] - order[b.syncStatus],
    );
  }, [filtered]);

  function navigate(date: string) {
    router.push(`/time-sync?date=${date}`);
  }

  const issueCount = summary.partial + summary.noReport;

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      {/* ── Sticky Header ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-100 shadow-sm">
        <div className="px-4 pt-4 pb-0">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                Management · Report Sync
              </p>
              <h1 className="text-xl font-black text-slate-900 leading-tight mt-0.5">
                ตรวจสอบ Report
              </h1>
            </div>
            {issueCount > 0 && (
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-600 px-3 py-1.5 rounded-full text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                {issueCount} ปัญหา
              </div>
            )}
          </div>

          {/* Date navigator */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => navigate(addDays(syncDate, -1))}
              className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors flex-shrink-0"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 text-slate-600"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div className="flex-1 text-center">
              <p className="font-semibold text-slate-800 text-sm">
                {formatDateTH(syncDate)}
              </p>
              {isToday && (
                <span className="text-[10px] text-sky-500 font-bold">
                  วันนี้
                </span>
              )}
            </div>

            <button
              onClick={() => navigate(addDays(syncDate, 1))}
              disabled={syncDate >= today}
              className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 text-slate-600"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            <input
              type="date"
              value={syncDate}
              max={today}
              onChange={(e) => navigate(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 bg-white flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
        </div>

        {/* Summary cards */}
        <div className="flex gap-2 px-4 pt-3 pb-4 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          <SummaryCard
            label="ทั้งหมด"
            value={summary.total}
            color="text-slate-700"
            bg="bg-slate-100"
            ring="ring-slate-400"
            active={filterTab === "all"}
            onClick={() => setFilterTab("all")}
          />
          <SummaryCard
            label="ตรงกัน"
            value={summary.synced}
            subLabel="≥90%"
            color="text-emerald-700"
            bg="bg-emerald-50"
            ring="ring-emerald-400"
            active={filterTab === "synced"}
            onClick={() => setFilterTab("synced")}
          />
          <SummaryCard
            label="ไม่ครบ"
            value={summary.partial}
            color="text-amber-700"
            bg="bg-amber-50"
            ring="ring-amber-400"
            active={filterTab === "partial"}
            onClick={() => setFilterTab("partial")}
          />
          <SummaryCard
            label="ไม่กรอก"
            value={summary.noReport}
            color="text-red-700"
            bg="bg-red-50"
            ring="ring-red-400"
            active={filterTab === "no_report"}
            onClick={() => setFilterTab("no_report")}
          />
        </div>
      </div>

      {/* ── Search ────────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="ค้นหาพนักงาน..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300"
          />
        </div>
      </div>
      
      {/* ── Department filter ─────────────────────────────────────────────────── */}
      {departments.length > 1 && (  // แสดงเฉพาะถ้ามีมากกว่า 1 แผนก
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {departments.map((dept) => {
            const isActive = filterDept === dept;
            const count = dept === "all"
              ? records.length
              : records.filter((r) => r.department === dept).length;
            return (
              <button
                key={dept}
                onClick={() => setFilterDept(dept)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  isActive
                    ? "bg-sky-600 text-white border-sky-600 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
              >
                {dept === "all" ? "ทุกแผนก" : dept}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Legend bar ────────────────────────────────────────────────────────── */}
      <div className="px-4 mb-2">
        <div className="bg-white border border-slate-100 rounded-xl px-4 py-2.5 flex items-center gap-4 flex-wrap text-[11px] text-slate-500">
          <span className="font-semibold text-slate-600">สัญลักษณ์:</span>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <span key={key} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              {cfg.labelTh}
            </span>
          ))}
        </div>
      </div>

      {/* ── Employee list ─────────────────────────────────────────────────────── */}
      <div className="px-4 space-y-3">
        {sorted.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-slate-500 font-semibold">ไม่พบข้อมูลพนักงาน</p>
            <p className="text-slate-400 text-sm mt-1">
              {records.length === 0
                ? "ยังไม่มีพนักงาน Check-in ในวันนี้"
                : "ลองเปลี่ยน filter หรือค้นหาใหม่"}
            </p>
          </div>
        ) : (
          sorted.map((record) => (
            <EmployeeCard key={record.id} record={record} />
          ))
        )}
      </div>

      {/* ── Footer info ───────────────────────────────────────────────────────── */}
      {sorted.length > 0 && (
        <div className="px-4 pt-4">
          <p className="text-center text-[11px] text-slate-400">
            แสดง {sorted.length} จาก {records.length} คนที่ Check-in · Report
            ตรงกันเมื่อครอบคลุม ≥90% ของเวลาทำงาน
          </p>
        </div>
      )}
    </div>
  );
}
