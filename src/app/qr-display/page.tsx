// src/app/qr-display/page.tsx
"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useCallback } from "react";
import QRCode from "qrcode";

// ─── Types ────────────────────────────────────────────────────────────────────
interface QRPayload { t: string; loc: string; exp: number; }

interface CheckinEntry {
  id: string;
  user_id: string;
  work_type: string;
  first_check_in: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
}

// ─── Viewport Hook ────────────────────────────────────────────────────────────
// ✅ KEY FIX: อ่าน viewport จริงจาก JS แทน CSS units
// ทำงานถูกต้องทุกสถานการณ์: fullscreen, non-fullscreen, TV zoom, browser zoom
function useViewport() {
  const [size, setSize] = useState({ w: 1920, h: 1080 });

  useEffect(() => {
    const update = () => {
      setSize({ w: window.innerWidth, h: window.innerHeight });
    };
    update();
    window.addEventListener("resize", update);
    // fullscreenchange → viewport เปลี่ยน → อ่านใหม่
    document.addEventListener("fullscreenchange", () => {
      // delay เล็กน้อยให้ browser จบ transition ก่อน
      setTimeout(update, 100);
    });
    return () => {
      window.removeEventListener("resize", update);
    };
  }, []);

  return size;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "bg-blue-600", "bg-emerald-600", "bg-sky-500", "bg-amber-500",
  "bg-rose-500",  "bg-indigo-500",  "bg-teal-600", "bg-orange-500",
];
const avatarColor = (id: string) =>
  AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];

const getFullName = (p: CheckinEntry["profiles"]) =>
  [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "ไม่ระบุชื่อ";

const getInitials = (p: CheckinEntry["profiles"]) =>
  ((p?.first_name?.[0] ?? "") + (p?.last_name?.[0] ?? "")).toUpperCase() || "?";

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("th-TH", {
    hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });

// ─── AvatarBubble ─────────────────────────────────────────────────────────────
function AvatarBubble({ entry }: { entry: CheckinEntry }) {
  if (entry.profiles?.avatar_url) {
    return (
      <img
        src={entry.profiles.avatar_url}
        referrerPolicy="no-referrer"
        alt={getFullName(entry.profiles)}
        className="w-9 h-9 rounded-xl object-cover flex-shrink-0 ring-2 ring-slate-200"
      />
    );
  }
  return (
    <span
      className={`w-9 h-9 rounded-xl ${avatarColor(entry.user_id)} text-white text-xs font-bold
        flex items-center justify-center flex-shrink-0 ring-2 ring-white shadow-sm`}
    >
      {getInitials(entry.profiles)}
    </span>
  );
}

// ─── CheckinRow ───────────────────────────────────────────────────────────────
function CheckinRow({ entry, isNew }: { entry: CheckinEntry; isNew: boolean }) {
  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all duration-500 ${
        isNew
          ? "bg-emerald-50 border-emerald-200 shadow-sm scale-[1.01]"
          : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <AvatarBubble entry={entry} />
      <div className="flex-1 min-w-0">
        <p className="text-slate-800 text-sm font-semibold truncate leading-tight">
          {getFullName(entry.profiles)}
        </p>
        <p className="text-slate-400 text-xs mt-0.5">
          เข้างาน {fmtTime(entry.first_check_in)} น.
        </p>
      </div>
      {isNew && (
        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded-md flex-shrink-0 animate-pulse">
          ✓ NEW
        </span>
      )}
    </div>
  );
}

// ─── CheckinColumn ────────────────────────────────────────────────────────────
function CheckinColumn({
  title, accentColor, accentBg, icon, entries, newIds,
}: {
  title: string;
  accentColor: string;
  accentBg: string;
  icon: React.ReactNode;
  entries: CheckinEntry[];
  newIds: Set<string>;
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg ${accentBg} flex items-center justify-center shadow-sm flex-shrink-0`}>
            {icon}
          </div>
          <div>
            <h2 className={`font-bold text-sm leading-tight ${accentColor}`}>{title}</h2>
            <p className="text-slate-400 text-xs">{entries.length} คน</p>
          </div>
        </div>
        <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border ${
          entries.length > 0
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-slate-100 text-slate-400 border-slate-200"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            entries.length > 0 ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
          }`} />
          LIVE
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-hide">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-slate-400 text-xs font-medium">ยังไม่มีการ Check-in</p>
            <p className="text-slate-300 text-xs mt-0.5">รอสแกน QR Code</p>
          </div>
        ) : (
          entries.map((e) => (
            <CheckinRow key={e.id} entry={e} isNew={newIds.has(e.id)} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── CheckinToast ─────────────────────────────────────────────────────────────
function CheckinToast({ entry, onDone }: { entry: CheckinEntry; onDone: () => void }) {
  const [visible, setVisible] = useState(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 50);
    const t2 = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDoneRef.current(), 400);
    }, 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const isFactory = entry.work_type === "in_factory";

  return (
    <div
      className={`fixed inset-0 flex items-end justify-center pb-10 z-50 pointer-events-none
        transition-all duration-400 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <div
        className={`flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl border
          transition-all duration-400
          ${visible ? "translate-y-0 scale-100" : "translate-y-6 scale-95"}
          ${isFactory ? "bg-blue-700 border-blue-500" : "bg-emerald-700 border-emerald-500"}`}
        style={{ minWidth: 340 }}
      >
        {entry.profiles?.avatar_url ? (
          <img
            src={entry.profiles.avatar_url}
            referrerPolicy="no-referrer"
            alt=""
            className="w-14 h-14 rounded-2xl object-cover ring-3 ring-white/30 flex-shrink-0"
          />
        ) : (
          <span
            className={`w-14 h-14 rounded-2xl ${avatarColor(entry.user_id)} text-white text-xl font-bold
              flex items-center justify-center flex-shrink-0 ring-3 ring-white/20`}
          >
            {getInitials(entry.profiles)}
          </span>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-white/70 text-sm font-medium">Check-in สำเร็จ</span>
          </div>
          <p className="text-white text-xl font-bold leading-tight">
            {getFullName(entry.profiles)}
          </p>
          <p className="text-white/60 text-sm mt-0.5">
            {isFactory ? "Factory" : "On-site"} · {fmtTime(entry.first_check_in)} น.
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
          {isFactory ? (
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function QRDisplayPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ✅ KEY FIX: อ่าน viewport จริงจาก JS — ไม่ใช้ CSS units ที่ TV browser อาจคำนวณผิด
  const { w: vpW, h: vpH } = useViewport();

  const [timeLeft, setTimeLeft]       = useState(15);
  const [isLoading, setIsLoading]     = useState(true);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [allEntries, setAllEntries]   = useState<CheckinEntry[]>([]);
  const [newIds, setNewIds]           = useState<Set<string>>(new Set());
  const prevIdsRef = useRef<Set<string>>(new Set());

  const [toastQueue, setToastQueue]   = useState<CheckinEntry[]>([]);
  const [activeToast, setActiveToast] = useState<CheckinEntry | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Layout calculations (JS-based, ไม่ใช้ CSS units) ─────────────────────────
  // คำนวณจาก viewport จริง ทำงานถูกต้องทั้ง fullscreen / non-fullscreen / TV zoom
  const HEADER_H   = 60;   // header approx height px
  const FOOTER_H   = 36;   // footer approx height px
  const mainH      = vpH - HEADER_H - FOOTER_H;

  // Side column: 22% ของ viewport width, min 220, max 340
  const colW       = Math.min(Math.max(Math.round(vpW * 0.22), 220), 340);

  // QR card: ขนาดไม่เกิน 62% ของ mainH และไม่เกิน centerW * 0.85
  const centerW    = vpW - colW * 2;
  const qrSize     = Math.min(
    Math.round(mainH * 0.62),   // ไม่เกิน 62% ของความสูง main
    Math.round(centerW * 0.85), // ไม่เกิน 85% ของความกว้าง center
    560,                         // max absolute size
  );

  // Clock font: สัดส่วนกับ mainH
  const clockFontSize = Math.min(Math.round(mainH * 0.09), 72);  // max 72px
  const dateFontSize  = Math.min(Math.round(mainH * 0.02), 16);  // max 16px

  // QR card padding
  const qrPadding = Math.round(qrSize * 0.045);

  // ── QR Refresh ────────────────────────────────────────────────────────────────
  const refreshQR = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/qr-token", { cache: "no-store" });

      if (!res.ok) {
      console.error("[refreshQR] API error:", res.status);
      return;
    }
    
      const payload: QRPayload = await res.json();

      if (!payload.exp || !payload.t) {
  console.error("[refreshQR] invalid payload:", payload);
  return;
}

      if (canvasRef.current) {
        await QRCode.toCanvas(canvasRef.current, JSON.stringify(payload), {
          width: 480,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#0c1a3d", light: "#ffffff" },
        });
      }
      const secondsLeft = Math.max(0, Math.ceil((payload.exp - Date.now()) / 1000));
      setTimeLeft(secondsLeft);
    } catch (e) {
      console.error("QR refresh error:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const isFirstFetchRef = useRef(true);

  // ── Fetch entries ─────────────────────────────────────────────────────────────
  const fetchEntries = useCallback(async () => {
  try {
    const res = await fetch("/api/recent-checkins", { cache: "no-store" });
    if (!res.ok) return;
    const data: CheckinEntry[] = await res.json();
    setAllEntries(data);

    const currentIds = new Set(data.map((e) => e.id));
    const newlyAdded = data.filter((e) => !prevIdsRef.current.has(e.id));

    if (isFirstFetchRef.current) {
      isFirstFetchRef.current = false;
      prevIdsRef.current = currentIds;
      return;
    }

    if (newlyAdded.length > 0) {
      // ✅ Fix: ใช้ Set ของเฉพาะ ID คนที่เพิ่งสแกนเข้ามาใหม่
      setNewIds(new Set(newlyAdded.map((e) => e.id)));
      setToastQueue((prev) => [...prev, ...newlyAdded]);
      setTimeout(() => setNewIds(new Set()), 5000);
    }

    prevIdsRef.current = currentIds;
  } catch (e) {
    console.error("fetchEntries error:", e);
  }
}, []);

  // ── Process toast queue ───────────────────────────────────────────────────────
  useEffect(() => {
    if (toastQueue.length > 0 && !activeToast) {
      setActiveToast(toastQueue[0]);
      setToastQueue((prev) => prev.slice(1));
    }
  }, [toastQueue, activeToast]);

  // ── Clock ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("th-TH", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        timeZone: "Asia/Bangkok",
      }));
      setCurrentDate(now.toLocaleDateString("th-TH", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
        timeZone: "Asia/Bangkok",
      }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── QR countdown & auto-refresh ───────────────────────────────────────────────
  useEffect(() => {
  refreshQR();
  const id = setInterval(() => {
    setTimeLeft((prev) => {
      if (prev <= 1) { refreshQR(); return 15; }  // ← 15
      return prev - 1;
    });
  }, 1000);
  return () => clearInterval(id);
}, [refreshQR]);

  // ── Poll entries every 5s ─────────────────────────────────────────────────────
  useEffect(() => {
    fetchEntries();
    const id = setInterval(fetchEntries, 5000);
    return () => clearInterval(id);
  }, [fetchEntries]);

  // ── Fullscreen ────────────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const factoryEntries = allEntries.filter((e) => e.work_type === "in_factory");
  const onsiteEntries  = allEntries.filter((e) => e.work_type !== "in_factory");
  const isExpiringSoon = timeLeft <= 5;           // เตือนเมื่อเหลือ 5 วิ (1/3 ของ 15วิ)
  const progressPct   = (timeLeft / 15) * 100;

  return (
    // ✅ h-dvh: dynamic viewport height
    // ร่วมกับ useViewport() Hook ที่ track ขนาดจริงใน JS
    <div className="h-dvh flex flex-col overflow-hidden bg-slate-50 select-none">

      {activeToast && (
        <CheckinToast entry={activeToast} onDone={() => setActiveToast(null)} />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          HEADER
      ═════════════════════════════════════════════════════════════════════ */}
      <header
        className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{
          background: "linear-gradient(135deg, #0c1a3d 0%, #1a3570 100%)",
          boxShadow: "0 2px 12px rgba(12,26,61,0.3)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white p-1 flex-shrink-0 shadow-md ring-2 ring-white/20">
            <Image
              src="/logo.jpg"
              alt="HSD Logo"
              width={44}
              height={44}
              className="w-full h-full object-contain rounded-lg"
              priority
            />
          </div>
          <div>
            <p className="text-white font-bold text-xs xl:text-sm tracking-wide leading-tight">
              HARU SYSTEM DEVELOPMENT (THAILAND) CO., LTD.
            </p>
            <p className="text-blue-300/70 text-[10px] tracking-widest uppercase mt-0.5">
              ระบบบันทึกเวลาเข้า-ออกงาน
            </p>
          </div>
        </div>

        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "ออกจาก Fullscreen" : "เปิด Fullscreen"}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20
                     text-white/70 hover:text-white text-xs font-medium transition-all duration-200
                     border border-white/10 hover:border-white/20"
        >
          {isFullscreen ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
              <span>ย่อหน้าจอ</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
              <span>เต็มหน้าจอ</span>
            </>
          )}
        </button>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN — 3 columns
          ✅ ทุก width/height ใช้ค่าจาก JS calculations ไม่ใช้ CSS units
      ═════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 flex overflow-hidden min-h-0">

        {/* ── LEFT: Factory ─────────────────────────────────────────────────── */}
        <div
          className="flex-shrink-0 flex flex-col bg-white border-r border-slate-200 overflow-hidden"
          style={{ width: colW }}
        >
          <div className="h-1 bg-gradient-to-r from-blue-800 to-blue-500 flex-shrink-0" />
          <div className="flex-1 flex flex-col p-4 min-h-0 overflow-hidden">
            <CheckinColumn
              title="Check-in Factory"
              accentColor="text-blue-800"
              accentBg="bg-blue-700"
              icon={
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
              entries={factoryEntries}
              newIds={newIds}
            />
          </div>
        </div>

        {/* ── CENTER: QR ────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-4 border-r border-slate-200 bg-slate-50 overflow-hidden min-h-0">

          {/* Clock — ขนาดคำนวณจาก JS mainH */}
          <div className="text-center flex-shrink-0 mx-auto">
            <p
              className="text-slate-800 font-mono font-bold leading-none tracking-tight"
              style={{ fontSize: clockFontSize }}
            >
              {currentTime}
            </p>
            <p
              className="text-slate-500 mt-1.5"
              style={{ fontSize: dateFontSize }}
            >
              {currentDate}
            </p>
          </div>

          {/* QR Card — ขนาดคำนวณจาก JS qrSize */}
          <div
            className="flex-shrink-0 relative bg-white rounded-3xl"
            style={{
              width: qrSize,
              padding: qrPadding,
              boxShadow:
                "0 0 0 1px rgba(12,26,61,0.07), 0 4px 8px rgba(12,26,61,0.07), 0 20px 40px rgba(12,26,61,0.1)",
            }}
          >
            {/* Accent top */}
            <div
              className="absolute top-0 left-8 right-8 h-0.5 rounded-full"
              style={{ background: "linear-gradient(90deg, #1d4ed8 0%, #16a34a 100%)" }}
            />

            {/* Loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white rounded-3xl z-10">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
              </div>
            )}

            {/* QR Canvas */}
            <canvas
              ref={canvasRef}
              className="block rounded-xl w-full h-auto"
            />

            {/* Progress bar */}
            <div className="mt-3">
              <div className="flex justify-between items-center mb-1.5">
                <span className={`text-xs font-medium ${isExpiringSoon ? "text-rose-500" : "text-slate-400"}`}>
                  {isExpiringSoon ? "⚠ กำลังหมดอายุ!" : "QR Code จะเปลี่ยนทุก 15 วินาที"}
                </span>
                <span className={`font-mono font-bold text-xs ${isExpiringSoon ? "text-rose-500" : "text-slate-400"}`}>
                  {timeLeft}s
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    isExpiringSoon ? "bg-rose-500" : "bg-gradient-to-r from-blue-700 to-blue-500"
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Factory / On-site legend pills */}
          <div className="flex gap-3 flex-shrink-0 mx-auto">
            <span className="flex items-center gap-1.5 text-xs text-blue-700 font-semibold bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
              <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
              Factory
            </span>
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              On-site
            </span>
          </div>

        </div>

        {/* ── RIGHT: Onsite ──────────────────────────────────────────────────── */}
        <div
          className="flex-shrink-0 flex flex-col bg-white overflow-hidden"
          style={{ width: colW }}
        >
          <div className="h-1 bg-gradient-to-r from-emerald-600 to-teal-500 flex-shrink-0" />
          <div className="flex-1 flex flex-col p-4 min-h-0 overflow-hidden">
            <CheckinColumn
              title="Check-in On-site"
              accentColor="text-emerald-800"
              accentBg="bg-emerald-600"
              icon={
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
              entries={onsiteEntries}
              newIds={newIds}
            />
          </div>
        </div>
      </main>

      {/* ══════════════════════════════════════════════════════════════════════
          FOOTER
      ═════════════════════════════════════════════════════════════════════ */}
      <footer className="flex items-center justify-between px-6 py-2 border-t border-slate-200 bg-white flex-shrink-0">
        <p className="text-slate-400 text-xs">อัปเดตล่าสุด: {currentTime}</p>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-slate-500 text-xs font-medium">ระบบทำงานปกติ</span>
        </div>
        <p className="text-slate-400 text-xs">
          รวม <span className="font-bold text-slate-700">{allEntries.length}</span> คน Check-in วันนี้
        </p>
      </footer>
    </div>
  );
}