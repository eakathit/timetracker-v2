// src/components/HolidayCheckoutModal.tsx
"use client";

import { useEffect, useState } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface HolidayCheckoutModalProps {
  isOpen:      boolean;
  checkInIso:  string;
  checkOutIso: string;
  holidayName: string | null;
  onClaim:     () => void;
  onSkip:      () => void;
  onClose:     () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function calcNetHours(checkInIso: string, checkOutIso: string): number {
  return Math.max(
    0,
    (new Date(checkOutIso).getTime() - new Date(checkInIso).getTime()) / 3_600_000 - 1
  );
}

function formatDuration(checkInIso: string, checkOutIso: string): string {
  const totalMs  = new Date(checkOutIso).getTime() - new Date(checkInIso).getTime();
  const totalMin = Math.floor(totalMs / 60_000);
  const h        = Math.floor(totalMin / 60);
  const m        = totalMin % 60;
  return m > 0 ? `${h} ชม. ${m} นาที` : `${h} ชม.`;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function HolidayCheckoutModal({
  isOpen,
  checkInIso,
  checkOutIso,
  holidayName,
  onClaim,
  onSkip,
  onClose,
}: HolidayCheckoutModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) requestAnimationFrame(() => setVisible(true));
    else setVisible(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const netHours     = calcNetHours(checkInIso, checkOutIso);
  const totalDisplay = formatDuration(checkInIso, checkOutIso);
  const netDisplay   = `${netHours.toFixed(1)} ชม.`;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center transition-all duration-300 ${
        visible ? "bg-black/40 backdrop-blur-sm" : "bg-transparent"
      }`}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md bg-white rounded-t-3xl transition-transform duration-300 ease-out ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="px-5 pb-8 pt-1 space-y-5">

          {/* ── Title ── */}
          <div className="text-center space-y-1">
            <h2 className="text-lg font-extrabold text-gray-800">
              ทำงานวันหยุดครบแล้ว
            </h2>
            <p className="text-sm text-gray-400">
              {holidayName ?? "วันหยุดพิเศษ"}
            </p>
          </div>

          {/* ── Summary ── */}
          <div className="bg-gray-50 rounded-2xl border border-gray-100 px-4 py-3">
            <div className="grid grid-cols-2 divide-x divide-gray-200">
              <div className="text-center pr-4">
                <p className="text-[11px] text-gray-400 mb-1">เวลาทำงานรวม</p>
                <p className="text-base font-extrabold text-gray-700">{totalDisplay}</p>
              </div>
              <div className="text-center pl-4">
                <p className="text-[11px] text-gray-400 mb-1">สุทธิ (หักพัก 1 ชม.)</p>
                <p className="text-base font-extrabold text-emerald-600">{netDisplay}</p>
              </div>
            </div>
          </div>

          {/* ── Question ── */}
          <p className="text-sm text-gray-600 text-center">
            ต้องการเก็บสิทธิ์วันหยุดชดเชยไว้หรือไม่?
          </p>

          {/* ── Buttons ── */}
          <div className="space-y-2.5">
            <button
              onClick={onClaim}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              เก็บสิทธิ์วันหยุดชดเชย
            </button>

            <button
              onClick={onSkip}
              className="w-full py-3 border border-gray-200 text-gray-500 font-semibold text-sm rounded-2xl active:scale-[0.98] transition-all hover:bg-gray-50"
            >
              ออกงานปกติ (ไม่เก็บสิทธิ์)
            </button>
          </div>

          {/* ── Fine print ── */}
          <p className="text-[11px] text-gray-400 text-center leading-relaxed">
            สิทธิ์วันหยุดชดเชยจะนำไปใช้ในระบบวันลาในภายหลัง
          </p>
        </div>
      </div>
    </div>
  );
}