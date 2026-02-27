"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import LogoutButton from "@/components/LogoutButton";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashboardUIProps {
  userEmail: string | undefined;
  userId: string;
}

type WorkStatus =
  | "loading"
  | "idle"
  | "working"
  | "completed"
  | "ot_working"
  | "ot_completed";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getLocalToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
    : "-";

const FACTORY_LAT = 13.625;
const FACTORY_LNG = 101.025;
const ALLOWED_RADIUS_METERS = 100;

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─── Work-time calculator (ชั่วโมงปกติ, ไม่รวม OT จริง) ──────────────────────
const calculateWorkTime = (inTime: string | null, outTime: string | null) => {
  if (!inTime || !outTime) return { normal: 0 };

  const checkIn = new Date(inTime);
  const checkOut = new Date(outTime);

  const fix = (h: number, m: number) => {
    const d = new Date(checkIn);
    d.setHours(h, m, 0, 0);
    return d;
  };

  const workStart  = fix(8, 30);
  const workEnd    = fix(17, 30);
  const breakStart = fix(12, 0);
  const breakEnd   = fix(13, 0);

  const effStart = checkIn > workStart ? checkIn : workStart;
  const effEnd   = checkOut < workEnd  ? checkOut : workEnd;

  let normalHours = 0;
  if (effEnd > effStart) {
    let ms = effEnd.getTime() - effStart.getTime();
    const bStart = effStart > breakStart ? effStart : breakStart;
    const bEnd   = effEnd < breakEnd     ? effEnd   : breakEnd;
    if (bEnd > bStart) ms -= bEnd.getTime() - bStart.getTime();
    normalHours = ms / 3_600_000;
  }

  return { normal: Math.max(0, Number(normalHours.toFixed(2))) };
};

// ─── OT-hours calculator (30-min increments) ─────────────────────────────────
const calcOtHours = (otStart: string | null, otEnd: string | null): number => {
  if (!otStart || !otEnd) return 0;
  const ms = new Date(otEnd).getTime() - new Date(otStart).getTime();
  const mins = ms / 60_000;
  return Math.floor(mins / 30) * 0.5;
};

// ─── Elapsed live timer string ────────────────────────────────────────────────
const elapsedStr = (isoStart: string | null): string => {
  if (!isoStart) return "00:00:00";
  const diff = Math.max(0, Math.floor((Date.now() - new Date(isoStart).getTime()) / 1000));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════
export default function DashboardUI({ userEmail, userId }: DashboardUIProps) {
  /* ── Clock ── */
  const [currentTime, setCurrentTime] = useState("");

  /* ── Core status ── */
  const [workStatus, setWorkStatus] = useState<WorkStatus>("loading");
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ── Regular check-in/out ── */
  const [rawCheckIn,  setRawCheckIn]  = useState<string | null>(null);
  const [rawCheckOut, setRawCheckOut] = useState<string | null>(null);

  /* ── OT ── */
  const [rawOtStart, setRawOtStart] = useState<string | null>(null);
  const [rawOtEnd,   setRawOtEnd]   = useState<string | null>(null);
  const [otElapsed,  setOtElapsed]  = useState("00:00:00");

  /* ── Work-type & location ── */
  const [workType, setWorkType] = useState<"in_factory" | "on_site">("in_factory");
  const [locationStatus, setLocationStatus] = useState<
    "checking" | "in_range" | "out_of_range" | "error"
  >("checking");
  const [distanceText, setDistanceText] = useState("กำลังตรวจสอบตำแหน่ง...");

  /* ── Derived ── */
  const workSummary = useMemo(
    () => calculateWorkTime(rawCheckIn, rawCheckOut),
    [rawCheckIn, rawCheckOut]
  );
  const otHours = useMemo(
    () => calcOtHours(rawOtStart, rawOtEnd),
    [rawOtStart, rawOtEnd]
  );

  // ─── Clock tick ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => setCurrentTime(new Date().toLocaleTimeString("en-GB"));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ─── OT live elapsed timer ───────────────────────────────────────────────────
  useEffect(() => {
    if (workStatus !== "ot_working" || !rawOtStart) return;
    const id = setInterval(() => setOtElapsed(elapsedStr(rawOtStart)), 1000);
    return () => clearInterval(id);
  }, [workStatus, rawOtStart]);

  // ─── Location watch ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (workType !== "in_factory") return;

    setLocationStatus("checking");
    setDistanceText("กำลังตรวจสอบพิกัด...");

    if (!navigator.geolocation) {
      setLocationStatus("error");
      setDistanceText("อุปกรณ์ไม่รองรับ GPS");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      ({ coords: { latitude, longitude } }) => {
        const dist = calculateDistance(FACTORY_LAT, FACTORY_LNG, latitude, longitude);
        if (dist <= ALLOWED_RADIUS_METERS) {
          setLocationStatus("in_range");
          setDistanceText(`อยู่ในพื้นที่โรงงาน (${Math.round(dist)} ม.)`);
        } else {
          setLocationStatus("out_of_range");
          setDistanceText(`อยู่นอกพื้นที่โรงงาน (${Math.round(dist)} ม.)`);
        }
      },
      () => {
        setLocationStatus("error");
        setDistanceText("ไม่สามารถระบุตำแหน่งได้");
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [workType]);

  // ─── Fetch today status ──────────────────────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      if (!userId) return;
      const { data } = await supabase
        .from("daily_time_logs")
        .select("timeline_events, first_check_in, last_check_out, ot_hours")
        .eq("user_id", userId)
        .eq("log_date", getLocalToday())
        .single();

      if (!data) { setWorkStatus("idle"); return; }

      if (data.first_check_in) setRawCheckIn(data.first_check_in);
      if (data.last_check_out) setRawCheckOut(data.last_check_out);

      const events: { event: string; timestamp: string }[] =
        data.timeline_events ?? [];

      // Find OT events
      const otStartEvent = events.findLast((e) => e.event === "ot_start");
      const otEndEvent   = events.findLast((e) => e.event === "ot_end");

      if (otStartEvent) setRawOtStart(otStartEvent.timestamp);
      if (otEndEvent)   setRawOtEnd(otEndEvent.timestamp);

      // Determine status from last event
      const last = events.at(-1);
      if (!last) { setWorkStatus("idle"); return; }

      if (last.event === "ot_end")   { setWorkStatus("ot_completed"); return; }
      if (last.event === "ot_start") {
        setWorkStatus("ot_working");
        setOtElapsed(elapsedStr(otStartEvent?.timestamp ?? null));
        return;
      }
      if (last.event === "checkout") { setWorkStatus("completed");    return; }
      setWorkStatus("working");
    };

    fetch();
  }, [userId]);

  // ─── Location guard ──────────────────────────────────────────────────────────
  const validateLocation = useCallback((): boolean => {
    if (workType === "on_site") return true;
    if (locationStatus === "checking") {
      alert("ระบบกำลังตรวจสอบพิกัด GPS โปรดรอสักครู่...");
      return false;
    }
    if (locationStatus !== "in_range") {
      alert("ไม่สามารถดำเนินการได้ เนื่องจากคุณอยู่นอกพื้นที่โรงงาน");
      return false;
    }
    return true;
  }, [workType, locationStatus]);

  // ─── Push event to DB ─────────────────────────────────────────────────────────
  const pushEvent = async (
    newEvent: Record<string, unknown>,
    extraUpdate?: Record<string, unknown>
  ) => {
    const today = getLocalToday();
    const { data } = await supabase
      .from("daily_time_logs")
      .select("timeline_events")
      .eq("user_id", userId)
      .eq("log_date", today)
      .single();

    const timeline = [...(data?.timeline_events ?? []), newEvent];
    return supabase
      .from("daily_time_logs")
      .update({ timeline_events: timeline, ...extraUpdate })
      .eq("user_id", userId)
      .eq("log_date", today);
  };

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleCheckIn = async () => {
    if (!userId || !validateLocation()) return;
    setIsSubmitting(true);
    const now = new Date().toISOString();
    const today = getLocalToday();
    const newEvent = {
      event: workType === "in_factory" ? "arrive_factory" : "arrive_site",
      timestamp: now,
      work_type: workType,
    };

    const { data: existing } = await supabase
      .from("daily_time_logs")
      .select("timeline_events, first_check_in")
      .eq("user_id", userId)
      .eq("log_date", today)
      .single();

    if (existing) {
      await supabase.from("daily_time_logs").update({
        timeline_events: [...existing.timeline_events, newEvent],
      }).eq("user_id", userId).eq("log_date", today);
      setRawCheckIn(existing.first_check_in || now);
    } else {
      await supabase.from("daily_time_logs").insert([{
        user_id: userId,
        log_date: today,
        work_type: workType,
        first_check_in: now,
        timeline_events: [newEvent],
      }]);
      setRawCheckIn(now);
    }

    setWorkStatus("working");
    setIsSubmitting(false);
  };

  const handleCheckOut = async () => {
    if (!userId || !validateLocation()) return;
    setIsSubmitting(true);
    const now = new Date().toISOString();

    const { error } = await pushEvent(
      { event: "checkout", timestamp: now, note: "เลิกงาน" },
      { last_check_out: now, status: "completed" }
    );

    if (!error) {
      setRawCheckOut(now);
      setWorkStatus("completed");
    }
    setIsSubmitting(false);
  };

  const handleStartOT = async () => {
    if (!userId) return;
    setIsSubmitting(true);
    const now = new Date().toISOString();

    const { error } = await pushEvent({ event: "ot_start", timestamp: now });
    if (!error) {
      setRawOtStart(now);
      setOtElapsed("00:00:00");
      setWorkStatus("ot_working");
    }
    setIsSubmitting(false);
  };

  const handleEndOT = async () => {
    if (!userId) return;
    setIsSubmitting(true);
    const now = new Date().toISOString();
    const hrs  = calcOtHours(rawOtStart, now);

    const { error } = await pushEvent(
      { event: "ot_end", timestamp: now },
      { ot_hours: hrs }
    );

    if (!error) {
      setRawOtEnd(now);
      setWorkStatus("ot_completed");
    }
    setIsSubmitting(false);
  };

  // ─── Date header ─────────────────────────────────────────────────────────────
  const dateHeader = new Date().toLocaleDateString("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-50 pb-28">

      {/* ── TOP HEADER ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-20 backdrop-blur-sm bg-white/95">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Time Tracker</p>
          <h2 className="text-base font-extrabold text-gray-800 truncate leading-tight">
            {userEmail ?? "ผู้ใช้งาน"}
          </h2>
        </div>
        <LogoutButton />
      </div>

      <div className="px-4 md:px-6 pt-5 space-y-4 max-w-lg mx-auto">

        {/* ── DATE + TIME HERO ───────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-3xl p-6 text-white shadow-lg shadow-sky-200">
          <p className="text-sky-100 text-xs font-semibold mb-1">{dateHeader}</p>
          <p className="text-5xl font-black tracking-tight tabular-nums leading-none">{currentTime}</p>

          {/* Location badge */}
          {workType === "in_factory" && (
            <div className={`inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-xl text-xs font-bold backdrop-blur-sm ${
              locationStatus === "in_range"    ? "bg-emerald-400/30 text-emerald-100" :
              locationStatus === "out_of_range" ? "bg-red-400/30 text-red-100" :
                                                  "bg-white/20 text-sky-100"
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                locationStatus === "in_range"     ? "bg-emerald-300 animate-pulse" :
                locationStatus === "out_of_range" ? "bg-red-300" : "bg-white/60 animate-pulse"
              }`} />
              {distanceText}
            </div>
          )}
        </div>

        {/* ── WORK TYPE TOGGLE ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-1.5 flex gap-1.5 shadow-sm border border-gray-100">
          {(["in_factory", "on_site"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setWorkType(t)}
              disabled={workStatus !== "idle" && workStatus !== "loading"}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                workType === t
                  ? "bg-sky-500 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
              }`}
            >
              {t === "in_factory" ? "🏭  ในโรงงาน" : "📍  นอกสถานที่"}
            </button>
          ))}
        </div>

        {/* ── MAIN ACTION CARD ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 text-center">

          {/* Loading */}
          {workStatus === "loading" && (
            <div className="flex flex-col items-center py-8">
              <div className="w-24 h-24 rounded-full border-4 border-gray-100 border-t-sky-400 animate-spin mb-4" />
              <p className="text-sm text-gray-400 font-medium">กำลังโหลด...</p>
            </div>
          )}

          {/* ── IDLE → Check In ── */}
          {workStatus === "idle" && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">พร้อมเริ่มงาน</p>
              <button
                onClick={handleCheckIn}
                disabled={isSubmitting}
                className="relative w-44 h-44 rounded-full bg-sky-500 text-white flex flex-col items-center justify-center shadow-2xl shadow-sky-300/60 hover:bg-sky-400 active:scale-95 transition-all duration-200 disabled:opacity-70 disabled:cursor-wait"
              >
                {isSubmitting ? (
                  <svg className="animate-spin w-12 h-12" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : (
                  <>
                    <svg className="w-14 h-14 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    <span className="text-2xl font-extrabold">Check In</span>
                  </>
                )}
                {/* Pulse ring */}
                {!isSubmitting && (
                  <span className="absolute inset-0 rounded-full border-4 border-sky-400 animate-ping opacity-20" />
                )}
              </button>
              <p className="text-xs text-gray-400">กดเพื่อเริ่มบันทึกเวลาทำงาน</p>
            </div>
          )}

          {/* ── WORKING → Check Out ── */}
          {workStatus === "working" && (
            <div className="flex flex-col items-center gap-4">
              {/* Status pill */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-emerald-600">กำลังทำงาน</span>
              </div>

              {/* Check-in badge */}
              <div className="flex items-center gap-2 bg-sky-50 rounded-xl px-4 py-2">
                <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/>
                </svg>
                <span className="text-sm font-semibold text-sky-600">Check-in {fmt(rawCheckIn)}</span>
              </div>

              {/* Checkout button */}
              <button
                onClick={handleCheckOut}
                disabled={isSubmitting}
                className="relative w-44 h-44 rounded-full bg-rose-500 text-white flex flex-col items-center justify-center shadow-2xl shadow-rose-300/60 hover:bg-rose-400 active:scale-95 transition-all duration-200 disabled:opacity-70 disabled:cursor-wait"
              >
                {isSubmitting ? (
                  <svg className="animate-spin w-12 h-12" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : (
                  <>
                    <svg className="w-14 h-14 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                    </svg>
                    <span className="text-2xl font-extrabold">Check Out</span>
                  </>
                )}
              </button>
              <p className="text-xs text-gray-400">กดเมื่อเลิกงานปกติ</p>
            </div>
          )}

          {/* ── COMPLETED → Start OT ── */}
          {workStatus === "completed" && (
            <div className="flex flex-col items-center gap-4">
              {/* Summary chips */}
              <div className="flex gap-2 flex-wrap justify-center">
                <div className="flex items-center gap-1.5 bg-sky-50 rounded-xl px-3 py-1.5">
                  <svg className="w-3.5 h-3.5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span className="text-xs font-semibold text-sky-600">เข้า {fmt(rawCheckIn)}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-rose-50 rounded-xl px-3 py-1.5">
                  <svg className="w-3.5 h-3.5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span className="text-xs font-semibold text-rose-600">ออก {fmt(rawCheckOut)}</span>
                </div>
              </div>

              {/* Done illustration */}
              <div className="w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center">
                <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="font-extrabold text-gray-800 text-lg">เลิกงานแล้ว</p>
                <p className="text-xs text-gray-400 mt-0.5">ทำงานปกติ {workSummary.normal} ชม.</p>
              </div>

              {/* ─── OT Divider ────────────────── */}
              <div className="w-full border-t border-dashed border-amber-200 pt-4">
                <p className="text-xs font-bold text-amber-600 text-center mb-3 uppercase tracking-wider">
                  ✨ ต้องการทำ OT เพิ่มหรือไม่?
                </p>
                <button
                  onClick={handleStartOT}
                  disabled={isSubmitting}
                  className="w-full py-4 bg-amber-400 hover:bg-amber-500 active:scale-[0.98] text-white font-extrabold text-lg rounded-2xl shadow-lg shadow-amber-200/80 transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" strokeWidth="2"/>
                        <polyline points="12 7 12 12 15 14" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                      Start OT
                    </>
                  )}
                </button>
                <p className="text-[11px] text-gray-400 text-center mt-2">
                  OT จะถูกนับเป็นหน่วย 30 นาที
                </p>
              </div>
            </div>
          )}

          {/* ── OT WORKING → End OT ── */}
          {workStatus === "ot_working" && (
            <div className="flex flex-col items-center gap-4">
              {/* Status pill */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-full">
                <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-amber-600">กำลังทำ OT</span>
              </div>

              {/* OT live clock */}
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl px-8 py-5 text-center w-full">
                <p className="text-[11px] font-bold text-amber-500 uppercase tracking-widest mb-1">OT Elapsed</p>
                <p className="text-4xl font-black text-amber-600 tabular-nums tracking-tight">{otElapsed}</p>
                <p className="text-xs text-amber-400 mt-1.5">เริ่ม OT {fmt(rawOtStart)}</p>
              </div>

              {/* End OT button */}
              <button
                onClick={handleEndOT}
                disabled={isSubmitting}
                className="relative w-44 h-44 rounded-full bg-orange-500 text-white flex flex-col items-center justify-center shadow-2xl shadow-orange-300/60 hover:bg-orange-400 active:scale-95 transition-all duration-200 disabled:opacity-70 disabled:cursor-wait"
              >
                {isSubmitting ? (
                  <svg className="animate-spin w-12 h-12" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : (
                  <>
                    <svg className="w-12 h-12 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="2" strokeWidth="2" fill="currentColor" opacity="0.3"/>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5l14 14"/>
                      <circle cx="12" cy="12" r="9" strokeWidth="2"/>
                    </svg>
                    <span className="text-xl font-extrabold">End OT</span>
                  </>
                )}
              </button>
              <p className="text-xs text-gray-400">กดเมื่อจบงาน OT</p>
            </div>
          )}

          {/* ── OT COMPLETED ── */}
          {workStatus === "ot_completed" && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-amber-50 border-4 border-amber-100 flex items-center justify-center">
                <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="font-extrabold text-gray-800 text-xl">เสร็จสิ้นแล้ว! 🎉</p>
                <p className="text-xs text-gray-400 mt-1">ทำ OT เสร็จแล้ว</p>
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                <div className="flex items-center gap-1.5 bg-sky-50 rounded-xl px-3 py-1.5">
                  <span className="text-xs font-semibold text-sky-600">OT เริ่ม {fmt(rawOtStart)}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-orange-50 rounded-xl px-3 py-1.5">
                  <span className="text-xs font-semibold text-orange-600">OT จบ {fmt(rawOtEnd)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── DAILY SUMMARY CARD ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-extrabold text-gray-800 text-sm mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
            สรุปประจำวัน
          </h3>

          <div className="space-y-0">
            {/* Check-in row */}
            <SummaryRow
              label="Check-in"
              value={fmt(rawCheckIn)}
              color="sky"
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
              }
            />
            {/* Check-out row */}
            <SummaryRow
              label="Check-out"
              value={fmt(rawCheckOut)}
              color="rose"
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              }
            />
            {/* Normal hours */}
            <SummaryRow
              label="ชั่วโมงปกติ"
              value={rawCheckIn && rawCheckOut ? `${workSummary.normal} ชม.` : "-"}
              color="emerald"
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              }
            />

            {/* OT section - only show if OT was started */}
            {(rawOtStart) && (
              <>
                <div className="border-t border-dashed border-amber-100 my-1" />

                <SummaryRow
                  label="OT เริ่ม"
                  value={fmt(rawOtStart)}
                  color="amber"
                  icon={
                    <><circle cx="12" cy="12" r="9" strokeWidth="2"/>
                    <polyline points="12 7 12 12 15 14" strokeWidth="2.5" strokeLinecap="round"/></>
                  }
                />
                {rawOtEnd && (
                  <>
                    <SummaryRow
                      label="OT จบ"
                      value={fmt(rawOtEnd)}
                      color="orange"
                      icon={
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 10h6v4H9z"/>
                      }
                    />
                    <SummaryRow
                      label="ชั่วโมง OT"
                      value={`${otHours} ชม.`}
                      color="purple"
                      icon={
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                          d="M13 10V3L4 14h7v7l9-11h-7z"/>
                      }
                    />
                  </>
                )}

                {/* OT running - show live */}
                {workStatus === "ot_working" && (
                  <div className="flex items-center justify-between py-3 px-1">
                    <span className="text-sm text-gray-500 flex items-center gap-2">
                      <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                      เวลา OT สะสม
                    </span>
                    <span className="font-extrabold text-amber-600 tabular-nums text-sm">
                      {otElapsed}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── TIMELINE EVENTS (collapsible) ───────────────────────────────────── */}
        <TimelinePreview userId={userId} />

      </div>
    </main>
  );
}

// ─── Summary Row sub-component ────────────────────────────────────────────────
type RowColor = "sky" | "rose" | "emerald" | "amber" | "orange" | "purple";

function SummaryRow({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color: RowColor;
  icon: React.ReactNode;
}) {
  const cfg: Record<RowColor, { bg: string; text: string; icon: string }> = {
    sky:     { bg: "bg-sky-50",     text: "text-sky-700",     icon: "text-sky-400" },
    rose:    { bg: "bg-rose-50",    text: "text-rose-700",    icon: "text-rose-400" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700", icon: "text-emerald-400" },
    amber:   { bg: "bg-amber-50",   text: "text-amber-700",   icon: "text-amber-400" },
    orange:  { bg: "bg-orange-50",  text: "text-orange-700",  icon: "text-orange-400" },
    purple:  { bg: "bg-violet-50",  text: "text-violet-700",  icon: "text-violet-400" },
  };
  const c = cfg[color];

  return (
    <div className="flex items-center justify-between py-2.5 px-1 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`flex items-center gap-1.5 font-bold text-sm px-2.5 py-1 rounded-lg ${c.bg} ${c.text}`}>
        <svg className={`w-3.5 h-3.5 ${c.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon}
        </svg>
        {value}
      </span>
    </div>
  );
}

// ─── Timeline Preview sub-component ──────────────────────────────────────────
function TimelinePreview({ userId }: { userId: string }) {
  const [events, setEvents] = useState<{ event: string; timestamp: string; note?: string }[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("daily_time_logs")
      .select("timeline_events")
      .eq("user_id", userId)
      .eq("log_date", getLocalToday())
      .single()
      .then(({ data }) => {
        if (data?.timeline_events) setEvents(data.timeline_events);
      });
  }, [open, userId]);

  const eventLabel: Record<string, { label: string; color: string }> = {
    arrive_factory: { label: "เข้าโรงงาน",  color: "bg-sky-400" },
    arrive_site:    { label: "เข้างานนอก",  color: "bg-indigo-400" },
    checkout:       { label: "Check-out",    color: "bg-rose-400" },
    ot_start:       { label: "เริ่ม OT",     color: "bg-amber-400" },
    ot_end:         { label: "จบ OT",        color: "bg-orange-400" },
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-gray-700"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
          </svg>
          ประวัติกิจกรรมวันนี้
        </span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5">
          {events.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีกิจกรรม</p>
          ) : (
            <div className="relative pl-5 space-y-3">
              <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-100" />
              {events.map((e, i) => {
                const cfg = eventLabel[e.event] ?? { label: e.event, color: "bg-gray-400" };
                return (
                  <div key={i} className="flex items-start gap-3">
                    <span className={`absolute left-0 w-3.5 h-3.5 rounded-full ${cfg.color} mt-0.5 ring-2 ring-white`}
                      style={{ top: `${i * 36 + 4}px` }} />
                    <div className="ml-1">
                      <p className="text-sm font-bold text-gray-700">{cfg.label}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(e.timestamp).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                        {e.note ? ` · ${e.note}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}