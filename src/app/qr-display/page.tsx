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
function AvatarBubble({ entry, size = "md" }: { entry: CheckinEntry; size?: "md" | "lg" }) {
  const sizeClass = size === "lg"
    ? "w-14 h-14 rounded-2xl text-base"
    : "w-11 h-11 rounded-xl text-sm";

  if (entry.profiles?.avatar_url) {
    return (
      <img
        src={entry.profiles.avatar_url}
        referrerPolicy="no-referrer"
        alt={getFullName(entry.profiles)}
        className={`${sizeClass} object-cover flex-shrink-0 ring-2 ring-slate-200`}
      />
    );
  }
  return (
    <span
      className={`${sizeClass} ${avatarColor(entry.user_id)} text-white font-bold
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
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-500 ${
        isNew
          ? "bg-emerald-50 border-emerald-200 shadow-sm scale-[1.01]"
          : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <AvatarBubble entry={entry} />
      <div className="flex-1 min-w-0">
        <p className="text-slate-800 text-base font-semibold truncate leading-tight">
          {getFullName(entry.profiles)}
        </p>
        <p className="text-slate-500 text-sm mt-0.5">
          เข้างาน {fmtTime(entry.first_check_in)} น.
        </p>
      </div>
      {isNew && (
        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-1 rounded-md flex-shrink-0 animate-pulse">
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
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${accentBg} flex items-center justify-center shadow-sm`}>
            {icon}
          </div>
          <div>
            <h2 className={`font-bold text-base ${accentColor}`}>{title}</h2>
            <p className="text-slate-400 text-sm">{entries.length} คน</p>
          </div>
        </div>
        <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${
          entries.length > 0
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-slate-100 text-slate-400 border-slate-200"
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            entries.length > 0 ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
          }`} />
          LIVE
        </span>
      </div>

      {/* Entry List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-slate-400 text-sm font-medium">ยังไม่มีการ Check-in</p>
            <p className="text-slate-300 text-xs mt-1">รอสแกน QR Code</p>
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
// โผล่ขึ้นมาตรงกลางจอชั่วคราวเมื่อมีคน check-in ใหม่
function CheckinToast({ entry, onDone }: { entry: CheckinEntry; onDone: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // เล็กน้อยก่อน animate in
    const t1 = setTimeout(() => setVisible(true), 50);
    // hide หลัง 3.5s
    const t2 = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 400);
    }, 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

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
          ${isFactory
            ? "bg-blue-700 border-blue-500"
            : "bg-emerald-700 border-emerald-500"
          }`}
        style={{ minWidth: 340 }}
      >
        {/* Avatar */}
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

        {/* Text */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {/* checkmark circle */}
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

        {/* Icon right */}
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

  const [timeLeft, setTimeLeft]       = useState(60);
  const [isLoading, setIsLoading]     = useState(true);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [allEntries, setAllEntries]   = useState<CheckinEntry[]>([]);
  const [newIds, setNewIds]           = useState<Set<string>>(new Set());
  const prevIdsRef = useRef<Set<string>>(new Set());

  // Toast queue — แสดงทีละ 1 คน
  const [toastQueue, setToastQueue]   = useState<CheckinEntry[]>([]);
  const [activeToast, setActiveToast] = useState<CheckinEntry | null>(null);

  // ── QR Refresh ───────────────────────────────────────────────────────────────
  const refreshQR = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/qr-token", { cache: "no-store" });
      const payload: QRPayload = await res.json();
      if (canvasRef.current) {
        await QRCode.toCanvas(canvasRef.current, JSON.stringify(payload), {
          width: 400,
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

  // ── Fetch entries ─────────────────────────────────────────────────────────────
  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/qr-display-entries", { cache: "no-store" });
      if (!res.ok) return;
      const data: CheckinEntry[] = await res.json();

      setAllEntries(data);

      // detect new entries
      const currentIds = new Set(data.map((e) => e.id));
      const newlyAdded = data.filter((e) => !prevIdsRef.current.has(e.id));

      if (newlyAdded.length > 0) {
        setNewIds(currentIds);
        // push ทุก entry ใหม่เข้า queue
        setToastQueue((prev) => [...prev, ...newlyAdded]);
        // clear NEW badge หลัง 5s
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
        if (prev <= 1) { refreshQR(); return 60; }
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

  const factoryEntries = allEntries.filter((e) => e.work_type === "in_factory");
  const onsiteEntries  = allEntries.filter((e) => e.work_type !== "in_factory");
  const isExpiringSoon = timeLeft <= 10;
  const progressPct   = (timeLeft / 60) * 100;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 select-none">

      {/* ── Toast Notification ────────────────────────────────────────────────── */}
      {activeToast && (
        <CheckinToast
          entry={activeToast}
          onDone={() => setActiveToast(null)}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          HEADER
      ════════════════════════════════════════════════════════════════════════ */}
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
            <p className="text-white font-bold text-sm tracking-wide leading-tight">
              HARU SYSTEM DEVELOPMENT (THAILAND) CO., LTD.
            </p>
            <p className="text-blue-300/70 text-[10px] tracking-widest uppercase mt-0.5">
              ระบบบันทึกเวลาเข้า-ออกงาน
            </p>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════════
          MAIN — 3 columns
      ════════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 flex overflow-hidden min-h-0">

        {/* ── LEFT: Factory ─────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-white border-r border-slate-200 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-800 to-blue-500 flex-shrink-0" />
          <div className="flex-1 flex flex-col p-5 min-h-0 overflow-hidden">
            <CheckinColumn
              title="Check-in Factory"
              accentColor="text-blue-800"
              accentBg="bg-blue-700"
              icon={
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="w-[480px] xl:w-[540px] flex-shrink-0 flex flex-col items-center justify-center p-6 border-r border-slate-200 bg-slate-50">

          {/* Clock */}
          <div className="text-center mb-5">
            <p className="text-slate-800 font-mono font-bold text-5xl leading-none tracking-tight">
              {currentTime}
            </p>
            <p className="text-slate-500 text-sm mt-2">{currentDate}</p>
          </div>

          <div className="w-full h-px bg-slate-200 mb-5" />

          {/* QR Card */}
          <div
            className="relative bg-white rounded-3xl p-5"
            style={{
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

            <canvas
              ref={canvasRef}
              className="block rounded-xl"
              style={{ width: 400, height: 400 }}
            />
          </div>

          {/* Progress bar */}
          <div className="mt-5 w-full">
            <div className="flex justify-between text-sm mb-1.5">
              <span className={`font-medium ${isExpiringSoon ? "text-rose-600" : "text-slate-500"}`}>
                {isExpiringSoon ? "⚠ กำลังหมดอายุ!" : "QR อัปเดตอัตโนมัติ"}
              </span>
              <span className={`font-mono font-bold text-base ${isExpiringSoon ? "text-rose-600" : "text-slate-700"}`}>
                {timeLeft}s
              </span>
            </div>
            <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  isExpiringSoon ? "bg-rose-500" : "bg-gradient-to-r from-blue-700 to-blue-500"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="mt-5 w-full grid grid-cols-2 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
              <p className="text-blue-700 text-4xl font-bold">{factoryEntries.length}</p>
              <p className="text-slate-500 text-sm mt-1 font-medium">Factory</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
              <p className="text-emerald-600 text-4xl font-bold">{onsiteEntries.length}</p>
              <p className="text-slate-500 text-sm mt-1 font-medium">On-site</p>
            </div>
          </div>

          <p className="mt-4 text-slate-400 text-xs text-center">
            QR Code จะเปลี่ยนทุก 1 นาที
          </p>
        </div>

        {/* ── RIGHT: Onsite ──────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-600 to-teal-500 flex-shrink-0" />
          <div className="flex-1 flex flex-col p-5 min-h-0 overflow-hidden">
            <CheckinColumn
              title="Check-in On-site"
              accentColor="text-emerald-800"
              accentBg="bg-emerald-600"
              icon={
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* ═══════════════════════════════════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════════════════════════════════════ */}
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