// src/components/HolidayProgressCard.tsx
"use client";

import { useState, useEffect } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface HolidayProgressCardProps {
  checkInIso: string;
  holidayName: string | null;
  dayType?: string | null;
  payMultiplier?: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const TOTAL_SECONDS_REQUIRED = 9 * 3600; // 9 ชั่วโมง

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getElapsedSeconds(checkInIso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(checkInIso).getTime()) / 1000));
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "ครบแล้ว";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getTargetTime(checkInIso: string): string {
  const target = new Date(new Date(checkInIso).getTime() + TOTAL_SECONDS_REQUIRED * 1000);
  return target.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function resolveHolidayLabel(holidayName: string | null, dayType?: string | null): string {
  if (holidayName) return holidayName;
  if (dayType === "weekend") return "วันหยุดสุดสัปดาห์";
  return "วันหยุดพิเศษ";
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function HolidayProgressCard({
  checkInIso,
  holidayName,
  dayType,
  payMultiplier = 2.0,
}: HolidayProgressCardProps) {
  const [elapsed, setElapsed] = useState(() => getElapsedSeconds(checkInIso));

  useEffect(() => {
    const id = setInterval(() => setElapsed(getElapsedSeconds(checkInIso)), 1000);
    return () => clearInterval(id);
  }, [checkInIso]);

  const progressPercent = Math.min(100, (elapsed / TOTAL_SECONDS_REQUIRED) * 100);
  const remaining       = Math.max(0, TOTAL_SECONDS_REQUIRED - elapsed);
  const hasEarned       = elapsed >= TOTAL_SECONDS_REQUIRED;
  const targetTime      = getTargetTime(checkInIso);
  const label           = resolveHolidayLabel(holidayName, dayType);

  return (
    <div className={`mt-4 w-full rounded-2xl overflow-hidden border transition-all duration-500 ${
      hasEarned
        ? "border-emerald-200 bg-emerald-50"
        : "border-amber-200 bg-amber-50"
    }`}>

      {/* ── Header ── */}
      <div className={`px-4 py-2.5 flex items-center justify-between ${
        hasEarned ? "bg-emerald-500" : "bg-amber-500"
      }`}>
        <div className="flex items-center gap-2">
          
          <span className="text-white font-semibold text-sm truncate">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full bg-white ${hasEarned ? "" : "animate-pulse opacity-70"}`} />
          <span className="text-white/90 text-xs font-medium">
            {hasEarned ? "ครบแล้ว" : "กำลังทำงาน"}
          </span>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-4 pt-3 pb-4 space-y-3">

        {/* ── 2 Stats ── */}
        <div className="grid grid-cols-2 gap-3">
          {/* เหลืออีก */}
          <div className={`rounded-xl px-3 py-2.5 text-center ${
            hasEarned ? "bg-emerald-100" : "bg-white"
          }`}>
            <p className="text-[11px] font-medium text-gray-400 mb-1">
              {hasEarned ? "สถานะ" : "เหลืออีก"}
            </p>
            {hasEarned ? (
              <p className="text-base font-bold text-emerald-600">ครบเกณฑ์</p>
            ) : (
              <p className="text-base font-bold text-amber-600 tabular-nums">
                {formatCountdown(remaining)}
              </p>
            )}
          </div>

          {/* ครบเวลา */}
          <div className="rounded-xl px-3 py-2.5 text-center bg-white">
            <p className="text-[11px] font-medium text-gray-400 mb-1">ครบเวลา</p>
            <p className={`text-base font-bold tabular-nums ${
              hasEarned ? "text-emerald-600" : "text-gray-700"
            }`}>
              {targetTime} น.
            </p>
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <p className="text-[11px] text-gray-400 font-medium">
              {hasEarned ? "ทำงานครบ 9 ชั่วโมงแล้ว" : "ความคืบหน้า"}
            </p>
            <p className={`text-[11px] font-bold ${
              hasEarned ? "text-emerald-600" : "text-amber-600"
            }`}>
              {Math.round(progressPercent)}%
            </p>
          </div>
          <div className="h-2.5 bg-white rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${
                hasEarned
                  ? "bg-gradient-to-r from-emerald-400 to-teal-400"
                  : "bg-gradient-to-r from-amber-400 to-orange-400"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* ── Hint — เฉพาะตอนครบ ── */}
        {hasEarned && (
          <p className="text-[11px] text-emerald-700 text-center font-medium bg-emerald-100 rounded-xl py-2 px-3">
            กด <strong>Check Out</strong> เพื่อบันทึกสิทธิ์วันหยุดชดเชย
          </p>
        )}
      </div>
    </div>
  );
}