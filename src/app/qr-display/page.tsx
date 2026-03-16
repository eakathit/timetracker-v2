// src/app/qr-display/page.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import QRCode from "qrcode";

interface QRPayload {
  t: string;
  loc: string;
  exp: number;
}

export default function QRDisplayPage() {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const [timeLeft, setTimeLeft]   = useState(60);
  const [locLabel, setLocLabel]   = useState("HARU SYSTEM DEVELOPMENT (THAILAND) CO.,LTD.");
  const [currentTime, setCurrentTime] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // ── ดึง token ใหม่และวาด QR ─────────────────────────────────────────────
  const refreshQR = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/qr-token", { cache: "no-store" });
      const payload: QRPayload = await res.json();

      if (canvasRef.current) {
        await QRCode.toCanvas(canvasRef.current, JSON.stringify(payload), {
          width:            400,
          margin:           2,
          errorCorrectionLevel: "M",
          color: { dark: "#1a1a2e", light: "#ffffff" },
        });
      }

      // คำนวณ seconds เหลือจนถึง exp
      const secondsLeft = Math.max(0, Math.ceil((payload.exp - Date.now()) / 1000));
      setTimeLeft(secondsLeft);
    } catch (e) {
      console.error("QR refresh error:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── โหลด QR ครั้งแรก ────────────────────────────────────────────────────
  useEffect(() => {
    refreshQR();
  }, [refreshQR]);

  // ── Countdown และ auto-refresh ──────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          refreshQR();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [refreshQR]);

  // ── Clock ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () =>
      setCurrentTime(
        new Date().toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "Asia/Bangkok",
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const progressPct = (timeLeft / 60) * 100;
  const isExpiringSoon = timeLeft <= 10;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 select-none">
      {/* Header */}
      <div className="mb-6 text-center">
        <p className="text-slate-400 text-sm tracking-widest uppercase mb-1">
          สแกนเพื่อ Check-in
        </p>
        <p className="text-white text-5xl font-mono font-bold">{currentTime}</p>
        <p className="text-slate-300 text-lg mt-1">{locLabel}</p>
      </div>

      {/* QR Card */}
      <div className="bg-white rounded-3xl p-6 shadow-2xl relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white rounded-3xl z-10">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-sky-500 rounded-full animate-spin" />
          </div>
        )}
        <canvas ref={canvasRef} className="block" style={{ width: 280, height: 280 }} />
      </div>

      {/* Progress bar + countdown */}
      <div className="mt-6 w-72">
        <div className="flex justify-between text-xs mb-1">
          <span className={isExpiringSoon ? "text-rose-400 font-bold" : "text-slate-400"}>
            {isExpiringSoon ? "⚠ กำลังหมดอายุ!" : "QR อัปเดตอัตโนมัติ"}
          </span>
          <span className={isExpiringSoon ? "text-rose-400 font-bold" : "text-slate-300"}>
            {timeLeft}s
          </span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              isExpiringSoon ? "bg-rose-500" : "bg-sky-500"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-slate-600 text-xs text-center">
        QR Code จะเปลี่ยนทุก 1 นาที
      </p>
    </div>
  );
}