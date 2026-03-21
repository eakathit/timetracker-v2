// src/components/QRScannerModal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";

interface Props {
  onSuccess: (checkInTime: string) => void;
  onClose:   () => void;
}

type ScanState = "scanning" | "loading" | "success" | "error";

export default function QRScannerModal({ onSuccess, onClose }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [state, setState]     = useState<ScanState>("scanning");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const reader = new BrowserQRCodeReader();
    let stopped = false;

    // ── กำหนด Camera Constraints ──────────────────────────────────────────────
    // สำคัญมาก: resolution สูง + กล้องหลัง + continuous autofocus
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: "environment" }, // บังคับกล้องหลัง
        width:  { ideal: 1920 },              // ขอ resolution สูงสุดที่กล้องรองรับ
        height: { ideal: 1080 },
        // Continuous autofocus — รองรับใน Chrome/Android, iOS Safari จะ ignore ถ้าไม่รองรับ
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        advanced: [{ focusMode: "continuous" } as any],
      },
    };

    reader
      .decodeFromConstraints(constraints, videoRef.current!, async (result, err, controls) => {
        controlsRef.current = controls;
        if (!result || stopped) return;

        stopped = true;
        controls.stop();
        setState("loading");

        try {
          const payload = JSON.parse(result.getText()) as {
            t: string;
            loc: string;
            exp: number;
          };

          if (payload.exp < Date.now()) {
            setState("error");
            setMessage("QR Code หมดอายุแล้ว กรุณาสแกนใหม่");
            return;
          }

          const res = await fetch("/api/factory-checkin", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ token: payload.t, loc: payload.loc }),
          });

          const data = await res.json();

          if (!res.ok) {
            setState("error");
            setMessage(data.error ?? "เกิดข้อผิดพลาด");
            return;
          }

          setState("success");
          const checkInTime = new Date(data.checkin_at).toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
          });
          setMessage(`Check-in สำเร็จ เวลา ${checkInTime}`);
          setTimeout(() => onSuccess(data.checkin_at), 1500);
        } catch {
          setState("error");
          setMessage("QR Code ไม่ถูกต้อง");
        }
      })
      .catch(() => {
        setState("error");
        setMessage("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตสิทธิ์กล้อง");
      });

    return () => {
      stopped = true;
      controlsRef.current?.stop();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 safe-area-top">
        <button
          onClick={onClose}
          className="text-white text-sm flex items-center gap-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          ยกเลิก
        </button>
        <span className="text-white text-sm font-medium">สแกน QR Check-in</span>
        <div className="w-14" />
      </div>

      {/* Camera */}
      <div className="relative flex-1">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          muted
        />

        {/* Viewfinder overlay */}
        {state === "scanning" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-64 h-64">
              {/* Corner brackets */}
              {[
                "top-0 left-0 border-t-4 border-l-4 rounded-tl-xl",
                "top-0 right-0 border-t-4 border-r-4 rounded-tr-xl",
                "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl",
                "bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl",
              ].map((cls, i) => (
                <div key={i} className={`absolute w-10 h-10 border-white ${cls}`} />
              ))}
              {/* Scan line animation */}
              <div className="absolute inset-x-0 h-0.5 bg-sky-400 opacity-80 animate-[scanline_2s_ease-in-out_infinite]"
                style={{ top: "50%", boxShadow: "0 0 8px #38bdf8" }} />
            </div>
            <p className="absolute bottom-24 text-white text-sm text-center px-8">
              วางกล้องให้ตรงกับ QR Code บนหน้าจอโรงงาน
            </p>
          </div>
        )}

        {/* Result overlay */}
        {(state === "loading" || state === "success" || state === "error") && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4 p-6">
            {state === "loading" && (
              <>
                <div className="w-16 h-16 border-4 border-slate-600 border-t-sky-400 rounded-full animate-spin" />
                <p className="text-white text-lg">กำลังบันทึก Check-in...</p>
              </>
            )}
            {state === "success" && (
              <>
                <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-white text-xl font-semibold">{message}</p>
              </>
            )}
            {state === "error" && (
              <>
                <div className="w-20 h-20 bg-rose-500 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-white text-lg text-center">{message}</p>
                <button
                  onClick={() => {
                    setState("scanning");
                    setMessage("");
                    // restart scanner โดย reload component
                    window.location.reload();
                  }}
                  className="mt-2 px-6 py-2 bg-white/10 text-white rounded-xl text-sm border border-white/20"
                >
                  ลองใหม่
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}