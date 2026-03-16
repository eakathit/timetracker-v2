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
  "bg-blue-600","bg-emerald-600","bg-sky-600","bg-amber-500",
  "bg-rose-500","bg-indigo-500","bg-teal-600","bg-orange-500",
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

// ─── Sub-components ───────────────────────────────────────────────────────────
function AvatarBubble({ entry, size = "md" }: { entry: CheckinEntry; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  if (entry.profiles?.avatar_url) {
    return (
      <img
        src={entry.profiles.avatar_url}
        referrerPolicy="no-referrer"
        alt={getFullName(entry.profiles)}
        className={`${sz} rounded-xl object-cover flex-shrink-0 ring-2 ring-blue-400/20`}
      />
    );
  }
  return (
    <span className={`${sz} rounded-xl ${avatarColor(entry.user_id)} text-white font-bold flex items-center justify-center flex-shrink-0 ring-2 ring-blue-400/20`}>
      {getInitials(entry.profiles)}
    </span>
  );
}

function CheckinRow({ entry, isNew }: { entry: CheckinEntry; isNew: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-700 ${
        isNew
          ? "bg-blue-400/15 scale-[1.01] ring-1 ring-blue-400/30"
          : "bg-white/[0.04] hover:bg-white/[0.07]"
      }`}
    >
      <AvatarBubble entry={entry} />
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold truncate leading-tight">
          {getFullName(entry.profiles)}
        </p>
        <p className="text-blue-200/50 text-xs">
          {entry.profiles?.first_name
            ? `เข้างานเวลา ${fmtTime(entry.first_check_in)}`
            : fmtTime(entry.first_check_in)}
        </p>
      </div>
      {isNew && (
        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded-md animate-pulse flex-shrink-0">
          NEW
        </span>
      )}
    </div>
  );
}

function CheckinColumn({
  title, color, icon, entries, newIds,
}: {
  title: string;
  color: string;
  icon: React.ReactNode;
  entries: CheckinEntry[];
  newIds: Set<string>;
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center shadow-lg`}>
            {icon}
          </div>
          <h2 className="text-white font-semibold text-sm">{title}</h2>
          <span className="text-xs font-bold text-blue-200/50 bg-blue-900/50 border border-blue-700/30 px-2 py-0.5 rounded-full">
            {entries.length} คน
          </span>
        </div>
        <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          entries.length > 0
            ? "bg-emerald-500/20 text-emerald-400"
            : "bg-blue-900/50 text-blue-300/40"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${entries.length > 0 ? "bg-emerald-400 animate-pulse" : "bg-blue-400/30"}`} />
          LIVE
        </span>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-hide">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-900/40 border border-blue-800/40 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-blue-400/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-blue-200/30 text-sm">ยังไม่มีการ Check-in</p>
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

  // QR state
  const [timeLeft, setTimeLeft] = useState(60);
  const [isLoading, setIsLoading] = useState(true);

  // Clock
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  // Check-in feed
  const [allEntries, setAllEntries] = useState<CheckinEntry[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevIdsRef = useRef<Set<string>>(new Set());

  // ── QR Refresh ───────────────────────────────────────────────────────────────
  const refreshQR = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/qr-token", { cache: "no-store" });
      const payload: QRPayload = await res.json();
      if (canvasRef.current) {
        await QRCode.toCanvas(canvasRef.current, JSON.stringify(payload), {
          width: 320,
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

  // ── Derived data ──────────────────────────────────────────────────────────────
  const factoryEntries = allEntries.filter((e) => e.work_type === "in_factory");
  const onsiteEntries  = allEntries.filter((e) => e.work_type !== "in_factory");
  const progressPct    = (timeLeft / 60) * 100;
  const isExpiringSoon = timeLeft <= 0;

  return (
    // ── HSD Brand Background: Deep Navy with subtle dot grid ──────────────────
    <div
      className="min-h-screen flex flex-col overflow-hidden select-none"
      style={{
        background: "linear-gradient(160deg, #0c1a3d 0%, #0f2147 50%, #091530 100%)",
        backgroundImage: `
          linear-gradient(160deg, #0c1a3d 0%, #0f2147 50%, #091530 100%),
          radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)
        `,
        backgroundSize: "100% 100%, 28px 28px",
      }}
    >
      {/* Ambient glow blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute top-[-100px] left-[-100px] w-[400px] h-[400px] rounded-full bg-blue-700/10 blur-[80px]" />
        <div className="absolute bottom-[-80px] right-[-80px] w-[350px] h-[350px] rounded-full bg-emerald-600/10 blur-[80px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-blue-800/8 blur-[100px]" />
      </div>

      {/* ── Top Bar ──────────────────────────────────────────────────────────── */}
      <header
        className="relative flex items-center justify-between px-6 py-3 flex-shrink-0 z-10"
        style={{
          background: "rgba(9, 21, 48, 0.75)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(59, 130, 246, 0.15)",
          boxShadow: "0 1px 0 rgba(59,130,246,0.08), 0 4px 16px rgba(0,0,0,0.3)",
        }}
      >
        {/* Left: Logo + Company Name */}
        <div className="flex items-center gap-3">
          {/* Company Logo */}
          <div
            className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-blue-400/20"
            style={{ background: "white", padding: "2px" }}
          >
            <Image
              src="/logo.jpg"
              alt="HSD Logo"
              width={40}
              height={40}
              className="w-full h-full object-contain rounded-lg"
              priority
            />
          </div>
          {/* Company Name */}
          <div>
            <p className="text-white font-bold text-sm tracking-wide leading-tight">
              HARU SYSTEM DEVELOPMENT (THAILAND) CO., LTD.
            </p>
            <p className="text-blue-300/50 text-[10px] tracking-widest uppercase mt-0.5">
              Time Tracker — ระบบบันทึกเวลาเข้า-ออกงาน
            </p>
          </div>
        </div>

        {/* Right: Clock */}
        <div className="text-right flex-shrink-0">
          <p className="text-white font-mono font-bold text-xl leading-none tracking-tight">
            {currentTime}
          </p>
          <p className="text-blue-200/50 text-xs mt-0.5 text-right">{currentDate}</p>
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 flex overflow-hidden min-h-0 relative z-10">

        {/* ── LEFT: Factory Feed ────────────────────────────────────────────── */}
        <div
          className="flex-1 flex flex-col p-5 min-h-0 overflow-hidden"
          style={{ borderRight: "1px solid rgba(59,130,246,0.12)" }}
        >
          <CheckinColumn
            title="Check-in โรงงาน"
            color="bg-blue-600"
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

        {/* ── CENTER: QR Section ───────────────────────────────────────────── */}
        <div
          className="w-96 xl:w-[440px] flex-shrink-0 flex flex-col items-center justify-center p-6"
          style={{
            borderRight: "1px solid rgba(59,130,246,0.12)",
            background: "rgba(12, 26, 61, 0.5)",
          }}
        >
          <p className="text-blue-200/60 text-xs tracking-[0.2em] uppercase mb-4 font-medium">
            สแกนเพื่อ Check-in
          </p>

          {/* QR Card */}
          <div
            className="relative bg-white rounded-3xl p-5"
            style={{
              boxShadow: "0 0 0 1px rgba(59,130,246,0.2), 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(59,130,246,0.15)",
            }}
          >
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white rounded-3xl z-10">
                <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
              </div>
            )}
            <canvas
              ref={canvasRef}
              className="block"
              style={{ width: 320, height: 320 }}
            />
          </div>

          {/* Progress bar */}
          <div className="mt-5 w-full">
            <div className="flex justify-between text-xs mb-1.5">
              <span className={isExpiringSoon ? "text-rose-400 font-bold" : "text-blue-200/60"}>
                {isExpiringSoon ? "⚠ กำลังหมดอายุ!" : "QR อัปเดตอัตโนมัติ"}
              </span>
              <span className={`font-mono font-bold ${isExpiringSoon ? "text-rose-400" : "text-blue-100"}`}>
                {timeLeft}s
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(30,58,138,0.6)" }}>
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  isExpiringSoon
                    ? "bg-rose-500"
                    : "bg-gradient-to-r from-blue-600 to-blue-400"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Stats summary */}
          <div className="mt-5 w-full grid grid-cols-2 gap-2">
            <div
              className="rounded-xl p-3 text-center"
              style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(59,130,246,0.2)" }}
            >
              <p className="text-blue-400 text-3xl font-bold">{factoryEntries.length}</p>
              <p className="text-blue-200/50 text-xs mt-0.5">🏭 Factory</p>
            </div>
            <div
              className="rounded-xl p-3 text-center"
              style={{ background: "rgba(22,163,74,0.12)", border: "1px solid rgba(34,197,94,0.2)" }}
            >
              <p className="text-emerald-400 text-3xl font-bold">{onsiteEntries.length}</p>
              <p className="text-blue-200/50 text-xs mt-0.5">📍 On-site</p>
            </div>
          </div>

          <p className="mt-4 text-blue-200/25 text-xs text-center">
            QR Code จะเปลี่ยนทุก 1 นาที
          </p>
        </div>

        {/* ── RIGHT: Onsite Feed ───────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col p-5 min-h-0 overflow-hidden">
          <CheckinColumn
            title="Check-in งานนอกสถานที่"
            color="bg-emerald-600"
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
      </main>

      {/* ── Bottom bar ───────────────────────────────────────────────────────── */}
      <footer
        className="relative z-10 flex items-center justify-between px-6 py-2 flex-shrink-0"
        style={{
          background: "rgba(9,21,48,0.7)",
          backdropFilter: "blur(8px)",
          borderTop: "1px solid rgba(59,130,246,0.12)",
        }}
      >
        <p className="text-blue-200/30 text-xs">
          อัปเดตล่าสุด: {currentTime}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-blue-200/40 text-xs">ระบบทำงานปกติ</span>
        </div>
        <p className="text-blue-200/30 text-xs">
          รวม {allEntries.length} คน Check-in วันนี้
        </p>
      </footer>
    </div>
  );
}