// src/app/qr-display/page.tsx
"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useCallback } from "react";
import QRCode from "qrcode";
import { createClient } from "@supabase/supabase-js";
// ─── Types ────────────────────────────────────────────────────────────────────
interface QRPayload { t: string; loc: string; exp: number; }

interface QRTokenBatchResponse {
  tokens?: QRPayload[];
}

interface PersonProfile {
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

interface CheckinEntry {
  id: string;
  user_id: string;
  work_type: string;
  first_check_in: string;
  profiles: PersonProfile | null;
}

interface LeaveEntry {
  id: string;
  user_id: string;
  leave_type: string;
  leave_label: string;
  period_label: string | null;
  hours: number | null;
  profiles: PersonProfile | null;
}

interface DisplayStatusResponse {
  checkins: CheckinEntry[];
  leaves: LeaveEntry[];
}

type QRDisplayVariant = "minimal" | "focus" | "board";

const QR_VARIANTS: Record<
  QRDisplayVariant,
  {
    shellBg: string;
    headerBg: string;
    headerText: string;
    headerSubText: string;
    headerBorder: string;
    mainBg: string;
    panelClass: string;
    panelTopBar: string;
    rowClass: string;
    emptyIconClass: string;
    qrCardShadow: string;
    footerClass: string;
  }
> = {
  minimal: {
    shellBg: "#f7f9fc",
    headerBg: "rgba(255,255,255,0.92)",
    headerText: "text-slate-900",
    headerSubText: "text-slate-400",
    headerBorder: "border-b border-slate-200",
    mainBg: "bg-[#f7f9fc]",
    panelClass: "bg-white/88 border border-slate-200 rounded-2xl shadow-sm",
    panelTopBar: "hidden",
    rowClass: "bg-white/80 border-slate-100 hover:border-slate-200",
    emptyIconClass: "bg-slate-50 border-slate-100",
    qrCardShadow: "0 1px 2px rgba(15,23,42,0.05), 0 16px 40px rgba(15,23,42,0.08)",
    footerClass: "border-t border-slate-200 bg-white/80 backdrop-blur",
  },
  focus: {
    shellBg: "#eef4f8",
    headerBg: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
    headerText: "text-white",
    headerSubText: "text-sky-200/70",
    headerBorder: "",
    mainBg: "bg-[radial-gradient(circle_at_center,#ffffff_0%,#eef4f8_62%,#e2e8f0_100%)]",
    panelClass: "bg-white/72 border border-white/80 rounded-2xl shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur",
    panelTopBar: "hidden",
    rowClass: "bg-white/85 border-white/80 hover:border-slate-200",
    emptyIconClass: "bg-white/70 border-white",
    qrCardShadow: "0 0 0 1px rgba(255,255,255,0.9), 0 24px 70px rgba(15,23,42,0.18)",
    footerClass: "border-t border-white/70 bg-white/70 backdrop-blur",
  },
  board: {
    shellBg: "#f8fafc",
    headerBg: "linear-gradient(135deg, #0c1a3d 0%, #1a3570 100%)",
    headerText: "text-white",
    headerSubText: "text-blue-300/70",
    headerBorder: "",
    mainBg: "bg-slate-50",
    panelClass: "bg-white border-r border-slate-200",
    panelTopBar: "block",
    rowClass: "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm",
    emptyIconClass: "bg-slate-100 border-slate-200",
    qrCardShadow: "0 0 0 1px rgba(12,26,61,0.07), 0 8px 24px rgba(12,26,61,0.10)",
    footerClass: "border-t border-slate-200 bg-white",
  },
};

// ─── Viewport Hook ────────────────────────────────────────────────────────────
// ✅ KEY FIX: อ่าน viewport จริงจาก JS แทน CSS units
// ทำงานถูกต้องทุกสถานการณ์: fullscreen, non-fullscreen, TV zoom, browser zoom
function useViewport() {
  const [size, setSize] = useState({ w: 1920, h: 1080 });

  useEffect(() => {
    const update = () => {
      const viewport = window.visualViewport;
      setSize({
        w: Math.round(viewport?.width ?? window.innerWidth),
        h: Math.round(viewport?.height ?? window.innerHeight),
      });
    };
    const onFullscreenChange = () => {
      // delay เล็กน้อยให้ browser จบ transition ก่อน
      setTimeout(update, 100);
    };

    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    // fullscreenchange → viewport เปลี่ยน → อ่านใหม่
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  return size;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const AVATAR_COLORS = [
  "bg-blue-600", "bg-emerald-600", "bg-sky-500", "bg-amber-500",
  "bg-rose-500",  "bg-indigo-500",  "bg-teal-600", "bg-orange-500",
];
const avatarColor = (id: string) =>
  AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];

const getFullName = (p: PersonProfile | null) =>
  [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "ไม่ระบุชื่อ";

const getInitials = (p: PersonProfile | null) =>
  ((p?.first_name?.[0] ?? "") + (p?.last_name?.[0] ?? "")).toUpperCase() || "?";

const QR_TOKEN_BATCH_SIZE = 40;
const QR_TOKEN_REFILL_THRESHOLD = 8;
const QR_REFRESH_SECONDS = 15;
const DISPLAY_FALLBACK_REFRESH_MS = 15 * 60_000;
const APP_VERSION_CHECK_MS = 5 * 60_000;

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("th-TH", {
    hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });

const fmtNum = (value: number) =>
  Number.isInteger(value) ? value.toString() : parseFloat(value.toFixed(2)).toString();

function getLeaveDetailParts(entry: LeaveEntry) {
  const rawPeriod = entry.period_label?.trim() || null;
  const isFullDay = rawPeriod === "ทั้งวัน";
  const period = rawPeriod && !isFullDay ? rawPeriod : null;
  const hours = Number(entry.hours ?? 0);
  const duration = hours > 0 && !isFullDay ? `${fmtNum(hours)} ชม.` : null;

  return {
    label: entry.leave_label,
    period: period ?? (isFullDay || !rawPeriod ? "ทั้งวัน" : null),
    duration,
  };
}

// ─── AvatarBubble ─────────────────────────────────────────────────────────────
function AvatarBubble({ entry }: { entry: { user_id: string; profiles: PersonProfile | null } }) {
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
function CheckinRow({
  entry,
  isNew,
  variant,
}: {
  entry: CheckinEntry;
  isNew: boolean;
  variant: QRDisplayVariant;
}) {
  const theme = QR_VARIANTS[variant];
  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all duration-500 ${
        isNew
          ? "bg-emerald-50 border-emerald-200 shadow-sm scale-[1.01]"
          : theme.rowClass
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
  title, accentColor, accentBg, icon, entries, newIds, variant,
}: {
  title: string;
  accentColor: string;
  accentBg: string;
  icon: React.ReactNode;
  entries: CheckinEntry[];
  newIds: Set<string>;
  variant: QRDisplayVariant;
}) {
  const theme = QR_VARIANTS[variant];
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
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mb-3 shadow-sm ${theme.emptyIconClass}`}>
              <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-slate-500 text-sm font-bold">ยังไม่มีการ Check-in</p>
            <p className="text-slate-300 text-xs mt-1">รอสแกน QR Code</p>
          </div>
        ) : (
          entries.map((e) => (
            <CheckinRow key={e.id} entry={e} isNew={newIds.has(e.id)} variant={variant} />
          ))
        )}
      </div>
    </div>
  );
}

function LeaveRow({ entry, variant }: { entry: LeaveEntry; variant: QRDisplayVariant }) {
  const theme = QR_VARIANTS[variant];
  const leaveDetail = getLeaveDetailParts(entry);

  return (
    <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${
      variant === "board" ? "bg-rose-50 border-rose-100" : theme.rowClass
    }`}>
      <AvatarBubble entry={entry} />
      <div className="flex-1 min-w-0">
        <p
          className="text-slate-800 text-sm font-semibold leading-snug"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {getFullName(entry.profiles)}
        </p>
        <p className="mt-1 flex min-w-0 items-center gap-1 text-xs leading-none text-rose-500">
          <span className="font-semibold text-rose-600 truncate">
            {leaveDetail.label}
          </span>
          <span className="text-rose-300">·</span>
          <span className="text-rose-500 whitespace-nowrap">
            {leaveDetail.period}
          </span>
          {leaveDetail.duration && (
            <span className="text-rose-400 whitespace-nowrap">
              ({leaveDetail.duration})
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

function LeaveColumn({ entries, variant }: { entries: LeaveEntry[]; variant: QRDisplayVariant }) {
  const theme = QR_VARIANTS[variant];
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-rose-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3M4 11h16M6 5h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z" />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-sm leading-tight text-rose-700">พนักงานลา</h2>
            <p className="text-slate-400 text-xs">{entries.length} คน</p>
          </div>
        </div>
        <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border ${
          entries.length > 0
            ? "bg-rose-50 text-rose-700 border-rose-200"
            : "bg-slate-100 text-slate-400 border-slate-200"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${entries.length > 0 ? "bg-rose-500" : "bg-slate-300"}`} />
          TODAY
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-hide">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mb-3 shadow-sm ${theme.emptyIconClass}`}>
              <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 7V3m8 4V3M4 11h16M6 5h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z" />
              </svg>
            </div>
            <p className="text-slate-500 text-sm font-bold">ไม่มีพนักงานลา</p>
            <p className="text-slate-300 text-xs mt-1">ข้อมูลวันนี้</p>
          </div>
        ) : (
          entries.map((entry) => <LeaveRow key={entry.id} entry={entry} variant={variant} />)
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

  useEffect(() => {
    document.title = "TimeTracker QR Display";

    document.querySelectorAll('link[rel="manifest"]').forEach((link) => {
      link.remove();
    });

    const manifestLink = document.createElement("link");
    manifestLink.rel = "manifest";
    manifestLink.href = "/qr-display-manifest.webmanifest";
    document.head.appendChild(manifestLink);

    return () => {
      manifestLink.remove();
    };
  }, []);

  // ✅ KEY FIX: อ่าน viewport จริงจาก JS — ไม่ใช้ CSS units ที่ TV browser อาจคำนวณผิด
  const { w: vpW, h: vpH } = useViewport();

  const [timeLeft, setTimeLeft]       = useState(15);
  const [isLoading, setIsLoading]     = useState(true);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [allEntries, setAllEntries]   = useState<CheckinEntry[]>([]);
  const [leaveEntries, setLeaveEntries] = useState<LeaveEntry[]>([]);
  const [newIds, setNewIds]           = useState<Set<string>>(new Set());
  const prevIdsRef = useRef<Set<string>>(new Set());

  const [toastQueue, setToastQueue]   = useState<CheckinEntry[]>([]);
  const [activeToast, setActiveToast] = useState<CheckinEntry | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [variant, setVariant] = useState<QRDisplayVariant>("minimal");
  const qrTokenQueueRef = useRef<QRPayload[]>([]);
  const qrBatchPromiseRef = useRef<Promise<void> | null>(null);
  const activeQRPayloadRef = useRef<QRPayload | null>(null);
  const isRefreshingQRRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlVariant = params.get("variant");
    if (urlVariant === "minimal" || urlVariant === "focus" || urlVariant === "board") {
      setVariant(urlVariant);
    }
  }, []);

  // ── Layout calculations (JS-based, ไม่ใช้ CSS units) ─────────────────────────
  // คำนวณจาก visualViewport จริง และเผื่อขอบสำหรับ TV overscan / browser zoom
  const tvSafeInset = clamp(Math.round(Math.min(vpW, vpH) * 0.025), 12, 28);
  const usableW = Math.max(320, vpW - tvSafeInset * 2);
  const usableH = Math.max(300, vpH - tvSafeInset * 2);

  const HEADER_H = clamp(Math.round(usableH * 0.085), 50, 68);
  const showFooter = usableH >= 560;
  const FOOTER_H = showFooter ? clamp(Math.round(usableH * 0.04), 26, 34) : 0;
  const mainH = Math.max(240, usableH - HEADER_H - FOOTER_H);

  // Side rails shrink harder on TV browsers that report a small viewport.
  const sideRailW = clamp(
    Math.round(usableW * (usableW < 980 ? 0.15 : 0.16)),
    usableW < 980 ? 140 : 170,
    260,
  );
  const rightRailW = clamp(
    Math.round(sideRailW * 1.12),
    usableW < 980 ? 168 : 210,
    300,
  );

  const centerPy = clamp(Math.round(mainH * 0.025), 6, 18);
  const centerGap = clamp(Math.round(mainH * 0.018), 6, 12);
  const showLegend = mainH >= 560;

  // QR card: reserve real vertical space for clock, progress, padding, and legend first.
  const centerW = Math.max(220, usableW - sideRailW - rightRailW);
  const clockFontSize = clamp(Math.round(mainH * 0.06), 28, 58);
  const dateFontSize  = clamp(Math.round(mainH * 0.018), 10, 15);
  const showSummaryStrip = mainH >= 420;
  const summaryStripH = showSummaryStrip ? 30 : 0;
  const clockBlockH = clockFontSize + dateFontSize + summaryStripH + 18;
  const legendH = showLegend ? 26 : 0;
  const progressH = 32;
  const reservedCenterH =
    centerPy * 2 +
    clockBlockH +
    progressH +
    legendH +
    centerGap * (showLegend ? 2 : 1) +
    28;
  const maxQrByHeight = clamp(mainH - reservedCenterH, 160, 460);
  const qrSize = Math.floor(Math.min(
    maxQrByHeight,
    Math.round(centerW * 0.82),
    460,
  ));

  // QR card padding
  const qrPadding = clamp(Math.round(qrSize * 0.04), 10, 20);
  const qrCanvasSize = Math.max(120, qrSize - qrPadding * 2);
  const sidePanelPadding = clamp(Math.round(mainH * 0.025), 8, 16);
  const headerPx = clamp(Math.round(usableW * 0.018), 12, 24);
  const logoSize = clamp(HEADER_H - 26, 28, 40);
  const compactQrMeta = qrSize < 240;
  const theme = QR_VARIANTS[variant];
  const isBoardVariant = variant === "board";

  const fetchQRBatch = useCallback(async () => {
    if (qrBatchPromiseRef.current) {
      return qrBatchPromiseRef.current;
    }

    qrBatchPromiseRef.current = (async () => {
      const res = await fetch(`/api/qr-token?batch=${QR_TOKEN_BATCH_SIZE}`, { cache: "no-store" });

      if (!res.ok) {
        console.error("[fetchQRBatch] API error:", res.status);
        return;
      }

      const data: QRTokenBatchResponse | QRPayload = await res.json();
      const tokens = Array.isArray((data as QRTokenBatchResponse).tokens)
        ? (data as QRTokenBatchResponse).tokens ?? []
        : [data as QRPayload];
      const now = Date.now();
      const freshTokens = tokens.filter((token) => token.exp > now + 500 && token.t);
      const mergedTokens = [...qrTokenQueueRef.current, ...freshTokens];
      const tokenMap = new Map(mergedTokens.map((token) => [`${token.exp}:${token.t}`, token]));

      qrTokenQueueRef.current = Array.from(tokenMap.values())
        .filter((token) => token.exp > now + 500)
        .sort((a, b) => a.exp - b.exp);
    })();

    try {
      await qrBatchPromiseRef.current;
    } catch (e) {
      console.error("QR batch fetch error:", e);
    } finally {
      qrBatchPromiseRef.current = null;
    }
  }, []);

  const drawQRPayload = useCallback(async (payload: QRPayload) => {
    if (canvasRef.current) {
      await QRCode.toCanvas(canvasRef.current, JSON.stringify(payload), {
        width: qrCanvasSize,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#0c1a3d", light: "#ffffff" },
      });
    }

    const secondsLeft = Math.min(
      QR_REFRESH_SECONDS,
      Math.max(0, Math.ceil((payload.exp - Date.now()) / 1000)),
    );
    setTimeLeft(secondsLeft);
  }, [qrCanvasSize]);

  // ── QR Refresh ────────────────────────────────────────────────────────────────
  const refreshQR = useCallback(async () => {
    if (isRefreshingQRRef.current) return;
    isRefreshingQRRef.current = true;
    setIsLoading(true);
    try {
      const now = Date.now();
      qrTokenQueueRef.current = qrTokenQueueRef.current.filter((token) => token.exp > now + 500);

      if (qrTokenQueueRef.current.length === 0) {
        await fetchQRBatch();
      }

      const payload = qrTokenQueueRef.current.shift();

      if (!payload?.exp || !payload.t) {
        console.error("[refreshQR] invalid payload:", payload);
        return;
      }

      activeQRPayloadRef.current = payload;
      await drawQRPayload(payload);

      if (qrTokenQueueRef.current.length <= QR_TOKEN_REFILL_THRESHOLD) {
        void fetchQRBatch();
      }
    } catch (e) {
      console.error("QR refresh error:", e);
    } finally {
      setIsLoading(false);
      isRefreshingQRRef.current = false;
    }
  }, [drawQRPayload, fetchQRBatch]);

  const refreshQRRef = useRef(refreshQR);
  useEffect(() => { refreshQRRef.current = refreshQR; }, [refreshQR]);

  useEffect(() => {
    const payload = activeQRPayloadRef.current;
    if (payload) void drawQRPayload(payload);
  }, [drawQRPayload]);

  const isFirstFetchRef = useRef(true);

  // ── Fetch entries ─────────────────────────────────────────────────────────────
  const fetchEntries = useCallback(async () => {
  try {
    const res = await fetch("/api/qr-display-status", { cache: "no-store" });
    if (!res.ok) return;
    const data: DisplayStatusResponse = await res.json();
    const checkins = data.checkins ?? [];
    setAllEntries(checkins);
    setLeaveEntries(data.leaves ?? []);

    const currentIds = new Set(checkins.map((e) => e.id));
    const newlyAdded = checkins.filter((e) => !prevIdsRef.current.has(e.id));

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

// ── fetchEntries ref ──────────────────────────────────────────────────────────
  const fetchEntriesRef = useRef(fetchEntries);
  useEffect(() => { fetchEntriesRef.current = fetchEntries; }, [fetchEntries]);

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
    void refreshQRRef.current();
    const id = setInterval(() => {
      const payload = activeQRPayloadRef.current;
      if (!payload) {
        void refreshQRRef.current();
        return;
      }

      const secondsLeft = Math.min(
        QR_REFRESH_SECONDS,
        Math.max(0, Math.ceil((payload.exp - Date.now()) / 1000)),
      );
      setTimeLeft(secondsLeft);

      if (secondsLeft <= 0) void refreshQRRef.current();
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Initial load + Supabase Realtime (แทน polling) ───────────────────────────
  useEffect(() => {
    fetchEntriesRef.current();

    const supabaseRealtime = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

    const channel = supabaseRealtime
      .channel("qr-display-checkins")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_time_logs",
          filter: `log_date=eq.${today}`,
        },
        (payload) => {
          const record = payload.new as Record<string, unknown>;
          if (!record?.first_check_in) return;
          fetchEntriesRef.current();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leave_requests",
        },
        () => {
          fetchEntriesRef.current();
        },
      )
      .subscribe();

    const refreshId = setInterval(() => fetchEntriesRef.current(), DISPLAY_FALLBACK_REFRESH_MS);

    return () => {
      clearInterval(refreshId);
      supabaseRealtime.removeChannel(channel);
    };
  }, []);

  // ── Auto-reload เมื่อมี deploy ใหม่ ──────────────────────────────────────────
  useEffect(() => {
    const checkVersion = async () => {
      try {
        const res = await fetch(`/app-version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const { version } = await res.json();
        const current = localStorage.getItem("app-version");
        if (current && current !== version) {
          window.location.reload();
        }
        localStorage.setItem("app-version", version);
      } catch {}
    };

    checkVersion();
    const id = setInterval(checkVersion, APP_VERSION_CHECK_MS);
    return () => clearInterval(id);
  }, []);
  
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
  const progressPct   = (timeLeft / QR_REFRESH_SECONDS) * 100;

  return (
    // ใช้ visualViewport จริง + safe inset เพื่อกัน TV overscan ตัดขอบภาพ
    <div
      className="fixed inset-0 flex flex-col overflow-hidden select-none"
      style={{
        width: vpW,
        height: vpH,
        padding: tvSafeInset,
        boxSizing: "border-box",
        background: theme.shellBg,
      }}
    >

      {activeToast && (
        <CheckinToast entry={activeToast} onDone={() => setActiveToast(null)} />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          HEADER
      ═════════════════════════════════════════════════════════════════════ */}
      <header
        className={`flex items-center justify-between flex-shrink-0 ${theme.headerBorder} ${!isBoardVariant ? "rounded-2xl" : ""}`}
        style={{
          height: HEADER_H,
          paddingLeft: headerPx,
          paddingRight: headerPx,
          background: theme.headerBg,
          boxShadow: isBoardVariant ? "0 2px 12px rgba(12,26,61,0.3)" : "0 10px 30px rgba(15,23,42,0.06)",
        }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className="rounded-xl bg-white p-1 flex-shrink-0 shadow-md ring-2 ring-white/20"
            style={{ width: logoSize, height: logoSize }}
          >
            <Image
              src="/logo.jpg"
              alt="HSD Logo"
              width={44}
              height={44}
              className="w-full h-full object-contain rounded-lg"
              priority
            />
          </div>
          <div className="min-w-0">
            <p className={`${theme.headerText} font-extrabold text-[13px] sm:text-sm xl:text-base leading-snug truncate`}>
              HARU SYSTEM DEVELOPMENT (THAILAND) CO., LTD.
            </p>
            <p className={`${theme.headerSubText} text-[11px] sm:text-xs font-medium leading-snug mt-0.5 truncate`}>
              ระบบบันทึกเวลาเข้า-ออกงาน
            </p>
          </div>
        </div>

        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "ออกจาก Fullscreen" : "เปิด Fullscreen"}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20
                     text-white/70 hover:text-white text-xs font-medium transition-all duration-200
                     border border-white/10 hover:border-white/20 flex-shrink-0"
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
      <main className={`flex-1 flex overflow-hidden min-h-0 ${theme.mainBg} ${isBoardVariant ? "" : "gap-3 py-3"}`}>

        {/* ── LEFT: Factory ─────────────────────────────────────────────────── */}
        <div
          className={`flex-shrink-0 flex flex-col overflow-hidden ${theme.panelClass}`}
          style={{ width: sideRailW }}
        >
          <div className={`h-1 bg-gradient-to-r from-blue-800 to-blue-500 flex-shrink-0 ${theme.panelTopBar}`} />
          <div
            className="flex-1 flex flex-col min-h-0 overflow-hidden"
            style={{ padding: sidePanelPadding }}
          >
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
              variant={variant}
            />
          </div>
        </div>

        {/* ── CENTER: QR ────────────────────────────────────────────────────── */}
        <div
          className={`flex-1 flex flex-col items-center justify-center overflow-hidden min-h-0 ${
            isBoardVariant ? "border-r border-slate-200 bg-slate-50" : "rounded-2xl"
          }`}
          style={{ gap: centerGap, paddingTop: centerPy, paddingBottom: centerPy }}
        >

          {/* Clock — ขนาดคำนวณจาก JS mainH */}
          <div className="text-center flex-shrink-0 mx-auto">
            <p
              className="text-slate-900 font-mono font-bold leading-none"
              style={{ fontSize: clockFontSize }}
            >
              {currentTime}
            </p>
            <p
              className="text-slate-500 mt-1"
              style={{ fontSize: dateFontSize }}
            >
              {currentDate}
            </p>
            {showSummaryStrip && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full border border-blue-100 bg-white/80 px-3 py-1 text-xs font-bold text-blue-700 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                  Factory {factoryEntries.length}
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-100 bg-white/80 px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  On-site {onsiteEntries.length}
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-rose-100 bg-white/80 px-3 py-1 text-xs font-bold text-rose-700 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Leave {leaveEntries.length}
                </span>
              </div>
            )}
          </div>

          {/* QR Card — ขนาดคำนวณจาก JS qrSize */}
          <div
            className="flex-shrink-0 relative bg-white rounded-[22px]"
            style={{
              width: qrSize,
              padding: qrPadding,
              boxSizing: "border-box",
              boxShadow: theme.qrCardShadow,
            }}
          >
            {/* Loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white rounded-[22px] z-10">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
              </div>
            )}

            {/* QR Canvas */}
            <canvas
              ref={canvasRef}
              className="block rounded-xl w-full h-auto"
              style={{ width: qrCanvasSize, height: qrCanvasSize }}
            />

            {/* Progress bar */}
            <div className="mt-2.5">
              <div className="flex justify-between items-center mb-1.5">
                {!compactQrMeta && (
                  <span className={`text-xs font-medium ${isExpiringSoon ? "text-rose-500" : "text-slate-400"}`}>
                    {isExpiringSoon ? "⚠ กำลังหมดอายุ!" : "QR Code จะเปลี่ยนทุก 15 วินาที"}
                  </span>
                )}
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
          {showLegend && (
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
          )}

        </div>

        {/* ── RIGHT: Onsite ──────────────────────────────────────────────────── */}
        <div
          className={`flex-shrink-0 flex flex-col overflow-hidden ${theme.panelClass}`}
          style={{ width: rightRailW }}
        >
          <div className={`h-1 bg-gradient-to-r from-emerald-600 via-teal-500 to-rose-500 flex-shrink-0 ${theme.panelTopBar}`} />
          <div
            className="flex-[1.12] flex flex-col min-h-0 overflow-hidden"
            style={{
              padding: sidePanelPadding,
              paddingBottom: Math.max(8, Math.round(sidePanelPadding * 0.75)),
            }}
          >
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
              variant={variant}
            />
          </div>
          <div className="mx-4 h-px bg-slate-100 flex-shrink-0" />
          <div
            className="flex-1 flex flex-col min-h-0 overflow-hidden"
            style={{
              padding: sidePanelPadding,
              paddingTop: Math.max(8, Math.round(sidePanelPadding * 0.75)),
            }}
          >
            <LeaveColumn entries={leaveEntries} variant={variant} />
          </div>
        </div>

        {/* ── FAR RIGHT: Leave ──────────────────────────────────────────────── */}
      </main>

      {/* ══════════════════════════════════════════════════════════════════════
          FOOTER
      ═════════════════════════════════════════════════════════════════════ */}
      {showFooter && (
        <footer
          className={`flex items-center justify-between flex-shrink-0 ${theme.footerClass} ${!isBoardVariant ? "rounded-2xl mt-3" : ""}`}
          style={{ height: FOOTER_H, paddingLeft: headerPx, paddingRight: headerPx }}
        >
          <p className="text-slate-400 text-xs">อัปเดตล่าสุด: {currentTime}</p>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-slate-500 text-xs font-medium">ระบบทำงานปกติ</span>
          </div>
          <p className="text-slate-400 text-xs">
            รวม <span className="font-bold text-slate-700">{allEntries.length}</span> คน Check-in · Leave <span className="font-bold text-rose-600">{leaveEntries.length}</span> คน
          </p>
        </footer>
      )}
    </div>
  );
}
