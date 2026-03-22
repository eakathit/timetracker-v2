"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";

interface Props {
  onSuccess: (checkInTime: string) => void;
  onClose:   () => void;
}

type ScanState = "idle" | "scanning" | "loading" | "success" | "error";

export default function QRScannerModal({ onSuccess, onClose }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const stoppedRef  = useRef(false);
  const [state, setState]     = useState<ScanState>("idle");
  const [message, setMessage] = useState("");

  const [debugLog, setDebugLog] = useState<string[]>([]);
  const log = (msg: string) => {
    console.log(msg);
    setDebugLog(prev => [...prev, msg]);
  };

  // ── Cleanup เมื่อ unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      controlsRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      controlsRef.current = null;
      streamRef.current   = null;
    };
  }, []);

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    controlsRef.current = null;
    streamRef.current   = null;
  }, []);

  const startCamera = useCallback(async () => {
    stoppedRef.current = false;
    setState("scanning");

    const video  = videoRef.current!;
    const reader = new BrowserQRCodeReader();

    try {
      // ✅ getUserMedia เป็น async operation แรกสุด ไม่มีอะไรนำหน้า
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });

      log("got stream");
      if (stoppedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

      streamRef.current = stream;
      video.srcObject   = stream;
      // ✅ ไม่เรียก play() เอง — ให้ autoPlay จัดการ

      log("starting decode...");
      await reader.decodeFromVideoElement(video, async (result, _err, controls) => {
        controlsRef.current = controls;
        if (!result || stoppedRef.current) return;

        log("scanned!");
        stoppedRef.current = true;
        controls.stop();
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const v = videoRef.current;
        if (v) { v.pause(); v.srcObject = null; }

        setState("loading");

        try {
          const payload = JSON.parse(result.getText()) as {
            t:     string;
            loc:   string;
            exp:   number;
            nonce: string;
          };

          if (payload.exp < Date.now()) {
            setState("error");
            setMessage("QR Code หมดอายุแล้ว กรุณาสแกนใหม่");
            return;
          }

          const res = await fetch("/api/factory-checkin", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: payload.t, loc: payload.loc, nonce: payload.nonce }),
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
      });

    } catch (e) {
      log("error: " + e);
      setState("error");
      setMessage("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตสิทธิ์กล้อง");
    }
  }, [onSuccess]);

  const handleClose = useCallback(() => {
    stoppedRef.current = true;
    stopCamera();
    onClose();
  }, [onClose, stopCamera]);

  const handleRetry = useCallback(() => {
    stopCamera();
    stoppedRef.current = false;
    setState("idle");
    setMessage("");
  }, [stopCamera]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 safe-area-top">
        <button onClick={handleClose} className="text-white text-sm flex items-center gap-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          ยกเลิก
        </button>
        <span className="text-white text-sm font-medium">สแกน QR Check-in</span>
        <div className="w-14" />
      </div>

      {/* ── Camera area ─────────────────────────────────────────────────── */}
      <div className="relative flex-1">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          muted
        />

        {/* ── IDLE ─────────────────────────────────────────────────────── */}
        {state === "idle" && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center gap-6">
            <div className="w-24 h-24 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="text-center px-8">
              <p className="text-white text-lg font-semibold mb-1">แตะเพื่อเปิดกล้อง</p>
              <p className="text-white/60 text-sm">กดปุ่มด้านล่างเพื่อเริ่มสแกน QR Code</p>
            </div>
            <button
              onClick={startCamera}
              className="px-8 py-3.5 bg-sky-500 active:bg-sky-600 text-white font-semibold rounded-2xl text-base"
            >
              เปิดกล้องสแกน
            </button>
          </div>
        )}

        {/* ── SCANNING ─────────────────────────────────────────────────── */}
        {state === "scanning" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-64 h-64">
              {[
                "top-0 left-0 border-t-4 border-l-4 rounded-tl-xl",
                "top-0 right-0 border-t-4 border-r-4 rounded-tr-xl",
                "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl",
                "bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl",
              ].map((cls, i) => (
                <div key={i} className={`absolute w-10 h-10 border-white ${cls}`} />
              ))}
              <div
                className="absolute inset-x-0 h-0.5 bg-sky-400 opacity-80 animate-[scanline_2s_ease-in-out_infinite]"
                style={{ top: "50%", boxShadow: "0 0 8px #38bdf8" }}
              />
            </div>
            <p className="absolute bottom-24 text-white text-sm text-center px-8">
              วางกล้องให้ตรงกับ QR Code บนหน้าจอโรงงาน
            </p>
          </div>
        )}

        {/* ── LOADING / SUCCESS / ERROR ────────────────────────────────── */}
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
                  onClick={handleRetry}
                  className="mt-2 px-6 py-2 bg-white/10 text-white rounded-xl text-sm border border-white/20"
                >
                  ลองใหม่
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Debug panel — ลบออกหลังเทสเสร็จ */}
      {debugLog.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/90 p-3 max-h-48 overflow-y-auto z-50">
          {debugLog.map((l, i) => (
            <p key={i} className="text-green-400 text-xs font-mono">{l}</p>
          ))}
        </div>
      )}
    </div>
  );
}