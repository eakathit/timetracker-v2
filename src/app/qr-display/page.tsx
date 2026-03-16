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

const fmtDate = () =>
  new Date().toLocaleDateString("th-TH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
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
        className="w-10 h-10 rounded-xl object-cover flex-shrink-0 ring-2 ring-slate-200"
      />
    );
  }
  return (
    <span
      className={`w-10 h-10 rounded-xl ${avatarColor(entry.user_id)} text-white text-sm font-bold
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
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-500 ${
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
        <p className="text-slate-500 text-xs mt-0.5">
          เข้างาน {fmtTime(entry.first_check_in)} น.
        </p>
      </div>
      {isNew && (
        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded-md flex-shrink-0">
          NEW
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
      <div className="flex items-center justify-between mb-3 pb-3 border-b-2 border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl ${accentBg} flex items-center justify-center shadow-sm`}>
            {icon}
          </div>
          <div>
            <h2 className={`font-bold text-sm ${accentColor}`}>{title}</h2>
            <p className="text-slate-400 text-xs">{entries.length} คน</p>
          </div>
        </div>
        <span className={`flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full border ${
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

      {/* Entry List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-hide">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

  // ── QR Refresh ───────────────────────────────────────────────────────────────
  const refreshQR = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/qr-token", { cache: "no-store" });
      const payload: QRPayload = await res.json();
      if (canvasRef.current) {
        await QRCode.toCanvas(canvasRef.current, JSON.stringify(payload), {
          width: 300,
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

  useEffect(() => { refreshQR(); }, [refreshQR]);

  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { refreshQR(); return 60; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [refreshQR]);

  // ── Clock ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      setCurrentTime(new Date().toLocaleTimeString("th-TH", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        timeZone: "Asia/Bangkok",
      }));
      setCurrentDate(fmtDate());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Poll Check-ins ────────────────────────────────────────────────────────────
  const fetchCheckins = useCallback(async () => {
    try {
      const res = await fetch("/api/recent-checkins", { cache: "no-store" });
      const data: CheckinEntry[] = await res.json();
      const currentIds = new Set(data.map((e) => e.id));
      const fresh = new Set<string>();
      currentIds.forEach((id) => {
        if (!prevIdsRef.current.has(id)) fresh.add(id);
      });
      if (fresh.size > 0) {
        setNewIds(fresh);
        setTimeout(() => setNewIds(new Set()), 5000);
      }
      prevIdsRef.current = currentIds;
      setAllEntries(data);
    } catch (e) {
      console.error("Checkin fetch error:", e);
    }
  }, []);

  useEffect(() => {
    fetchCheckins();
    const id = setInterval(fetchCheckins, 15_000);
    return () => clearInterval(id);
  }, [fetchCheckins]);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const factoryEntries = allEntries.filter((e) => e.work_type === "in_factory");
  const onsiteEntries  = allEntries.filter((e) => e.work_type !== "in_factory");
  const progressPct    = (timeLeft / 60) * 100;
  const isExpiringSoon = timeLeft <= 10;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col overflow-hidden select-none">

      {/* ═══════════════════════════════════════════════════════════════════════
          TOP BAR — HSD Navy (แน่วแน่ brand, ตัดกับ body ชัดเจน)
      ════════════════════════════════════════════════════════════════════════ */}
      <header
        className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{
          background: "linear-gradient(135deg, #0c1a3d 0%, #1a3570 100%)",
          boxShadow: "0 2px 12px rgba(12,26,61,0.3)",
        }}
      >
        {/* Logo + Company name */}
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
          MAIN — 3 columns, light background
      ════════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 flex overflow-hidden min-h-0">

        {/* ── LEFT: Factory ─────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-white border-r border-slate-200 overflow-hidden">
          {/* Accent strip */}
          <div className="h-1 bg-gradient-to-r from-blue-800 to-blue-500 flex-shrink-0" />
          <div className="flex-1 flex flex-col p-5 min-h-0 overflow-hidden">
            <CheckinColumn
              title="Check-in Factory"
              accentColor="text-blue-800"
              accentBg="bg-blue-700"
              icon={
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="w-96 xl:w-[420px] flex-shrink-0 flex flex-col items-center justify-center p-6 border-r border-slate-200 bg-slate-50">

          {/* Date & Time — เด่นชัด มองเห็นง่าย */}
          <div className="text-center mb-5">
            <p className="text-slate-800 font-mono font-bold text-4xl leading-none tracking-tight">
              {currentTime}
            </p>
            <p className="text-slate-500 text-sm mt-2">{currentDate}</p>
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-slate-200 mb-5" />

          <p className="text-slate-500 text-xs tracking-[0.2em] uppercase mb-5 font-semibold">
            สแกนเพื่อ Check-in
          </p>

          {/* QR Card */}
          <div
            className="relative bg-white rounded-3xl p-4"
            style={{
              boxShadow:
                "0 0 0 1px rgba(12,26,61,0.07), 0 4px 8px rgba(12,26,61,0.07), 0 20px 40px rgba(12,26,61,0.1)",
            }}
          >
            {/* HSD dual-color accent top */}
            <div
              className="absolute top-0 left-6 right-6 h-0.5 rounded-full"
              style={{ background: "linear-gradient(90deg, #1d4ed8 0%, #16a34a 100%)" }}
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white rounded-3xl z-10">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
              </div>
            )}
            <canvas
              ref={canvasRef}
              className="block rounded-xl"
              style={{ width: 300, height: 300 }}
            />
          </div>

          {/* Progress bar */}
          <div className="mt-5 w-full">
            <div className="flex justify-between text-xs mb-1.5">
              <span className={`font-medium ${isExpiringSoon ? "text-rose-600" : "text-slate-500"}`}>
                {isExpiringSoon ? "⚠ กำลังหมดอายุ!" : "QR อัปเดตอัตโนมัติ"}
              </span>
              <span className={`font-mono font-bold ${isExpiringSoon ? "text-rose-600" : "text-slate-700"}`}>
                {timeLeft}s
              </span>
            </div>
            <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  isExpiringSoon ? "bg-rose-500" : "bg-gradient-to-r from-blue-700 to-blue-500"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="mt-5 w-full grid grid-cols-2 gap-2.5">
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 text-center shadow-sm">
              <p className="text-blue-700 text-3xl font-bold">{factoryEntries.length}</p>
              <p className="text-slate-500 text-xs mt-1 font-medium">Factory</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 text-center shadow-sm">
              <p className="text-emerald-600 text-3xl font-bold">{onsiteEntries.length}</p>
              <p className="text-slate-500 text-xs mt-1 font-medium">On-site</p>
            </div>
          </div>

          <p className="mt-4 text-slate-400 text-xs text-center">
            QR Code จะเปลี่ยนทุก 1 นาที
          </p>
        </div>

        {/* ── RIGHT: Onsite ──────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {/* Accent strip — green */}
          <div className="h-1 bg-gradient-to-r from-emerald-600 to-teal-500 flex-shrink-0" />
          <div className="flex-1 flex flex-col p-5 min-h-0 overflow-hidden">
            <CheckinColumn
              title="Check-in On-site"
              accentColor="text-emerald-800"
              accentBg="bg-emerald-600"
              icon={
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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