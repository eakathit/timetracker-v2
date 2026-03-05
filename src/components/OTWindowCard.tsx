// src/components/OTWindowCard.tsx
// ─────────────────────────────────────────────────────────────────────────────
// แสดงหลัง Auto-checkout 17:30 จนถึง 18:00
// มี 2 ปุ่ม: "ออกงานแล้ว" และ "รอทำ OT"
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface OTWindowCardProps {
  userId:    string;
  logDate:   string; // "YYYY-MM-DD"
  otIntent:  boolean;
  onOTReady: () => void;  // callback เมื่อถึง 18:00 หรือ user กด Start OT
  onDone:    () => void;  // callback เมื่อ user กด "ออกงานแล้ว"
}

// ─── Helper ──────────────────────────────────────────────────────────────────
function getSecondsUntil1800(): number {
  const now   = new Date();
  const ot    = new Date(now);
  ot.setHours(18, 0, 0, 0);
  return Math.max(0, Math.floor((ot.getTime() - now.getTime()) / 1000));
}

function formatCountdown(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function OTWindowCard({
  userId,
  logDate,
  otIntent: initialOtIntent,
  onOTReady,
  onDone,
}: OTWindowCardProps) {
  const [countdown,  setCountdown]  = useState(getSecondsUntil1800());
  const [otIntent,   setOtIntent]   = useState(initialOtIntent);
  const [submitting, setSubmitting] = useState(false);

  // ── Countdown timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) {
      onOTReady(); // ถึง 18:00 → แจ้ง parent ให้แสดง Start OT
      return;
    }
    const id = setInterval(() => {
      setCountdown((s) => {
        if (s <= 1) { clearInterval(id); onOTReady(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []); // run once on mount

  // ── กด "รอทำ OT" ─────────────────────────────────────────────────────────
  const handleOTIntent = useCallback(async () => {
    if (otIntent || submitting) return;
    setSubmitting(true);
    try {
      await supabase
        .from("daily_time_logs")
        .update({ ot_intent: true })
        .eq("user_id", userId)
        .eq("log_date", logDate);
      setOtIntent(true);
    } finally {
      setSubmitting(false);
    }
  }, [otIntent, submitting, userId, logDate]);

  // ── กด "ออกงานแล้ว" ──────────────────────────────────────────────────────
  const handleDone = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // ยกเลิก ot_intent ถ้าเคยกดไว้
      await supabase
        .from("daily_time_logs")
        .update({ ot_intent: false })
        .eq("user_id", userId)
        .eq("log_date", logDate);
      onDone();
    } finally {
      setSubmitting(false);
    }
  }, [submitting, userId, logDate, onDone]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in mx-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🕐</span>
        <div>
          <p className="font-bold text-amber-800 text-sm">OT เริ่มได้อีก</p>
          <p className="text-xs text-amber-600">ระบบพักงานให้แล้ว 17:30 น.</p>
        </div>
      </div>

      {/* Countdown */}
      <div className="text-center mb-5">
        <p className="text-5xl font-black text-amber-500 tabular-nums tracking-tight">
          {formatCountdown(countdown)}
        </p>
        <p className="text-xs text-amber-400 mt-1">นาที : วินาที</p>
      </div>

      {/* Status badge ถ้าเคยกด "รอทำ OT" แล้ว */}
      {otIntent && (
        <div className="flex items-center justify-center gap-1.5 mb-4 py-2 px-3 bg-amber-100 rounded-xl">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <p className="text-xs font-semibold text-amber-700">
            รอ Start OT เวลา 18:00 น.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {/* ออกงานแล้ว */}
        <button
          onClick={handleDone}
          disabled={submitting}
          className="flex-1 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm font-semibold text-gray-600
                     hover:border-gray-300 hover:bg-gray-50 active:scale-95 transition-all
                     disabled:opacity-50 disabled:cursor-wait"
        >
          ออกงานแล้ว
        </button>

        {/* รอทำ OT */}
        <button
          onClick={handleOTIntent}
          disabled={otIntent || submitting}
          className={`flex-1 py-3 rounded-xl text-sm font-bold active:scale-95 transition-all
            ${otIntent
              ? "bg-amber-200 text-amber-600 cursor-default"
              : "bg-amber-400 text-white hover:bg-amber-500 shadow-md shadow-amber-100 disabled:opacity-50"
            }`}
        >
          {otIntent ? "✓ รอ OT แล้ว" : "รอทำ OT"}
        </button>
      </div>
    </div>
  );
}