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

const fmtTime = (iso: string | null) =>
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

// คำนวณชั่วโมงทำงานปกติ (หักพัก 12:00-13:00, จำกัด 08:30-17:30)
const calculateWorkTime = (inTime: string | null, outTime: string | null) => {
  if (!inTime || !outTime) return { normal: 0 };
  const checkIn  = new Date(inTime);
  const checkOut = new Date(outTime);
  const fix = (h: number, m: number) => {
    const d = new Date(checkIn); d.setHours(h, m, 0, 0); return d;
  };
  const workStart  = fix(8, 30);
  const workEnd    = fix(17, 30);
  const breakStart = fix(12, 0);
  const breakEnd   = fix(13, 0);
  const effStart = checkIn  > workStart ? checkIn  : workStart;
  const effEnd   = checkOut < workEnd   ? checkOut : workEnd;
  let normalHours = 0;
  if (effEnd > effStart) {
    let ms = effEnd.getTime() - effStart.getTime();
    const bStart = effStart > breakStart ? effStart : breakStart;
    const bEnd   = effEnd   < breakEnd   ? effEnd   : breakEnd;
    if (bEnd > bStart) ms -= bEnd.getTime() - bStart.getTime();
    normalHours = ms / 3_600_000;
  }
  return { normal: Math.max(0, Number(normalHours.toFixed(2))) };
};

// คำนวณ OT (หน่วย 30 นาที ปัดลง)
const calcOtHours = (otStart: string | null, otEnd: string | null): number => {
  if (!otStart || !otEnd) return 0;
  const mins = (new Date(otEnd).getTime() - new Date(otStart).getTime()) / 60_000;
  return Math.floor(mins / 30) * 0.5;
};

// นับเวลาผ่านไปแบบ live
const elapsedStr = (isoStart: string | null): string => {
  if (!isoStart) return "00:00:00";
  const diff = Math.max(0, Math.floor((Date.now() - new Date(isoStart).getTime()) / 1000));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

// ═══════════════════════════════════════════════════════════════════════════════
export default function DashboardUI({ userEmail, userId }: DashboardUIProps) {

  /* ── Clock ── */
  const [currentTime, setCurrentTime] = useState("");

  /* ── Status ── */
  const [workStatus, setWorkStatus]     = useState<WorkStatus>("loading");
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ── Regular times ── */
  const [rawCheckIn,  setRawCheckIn]  = useState<string | null>(null);
  const [rawCheckOut, setRawCheckOut] = useState<string | null>(null);

  /* ── OT times ── */
  const [rawOtStart, setRawOtStart] = useState<string | null>(null);
  const [rawOtEnd,   setRawOtEnd]   = useState<string | null>(null);
  const [otElapsed,  setOtElapsed]  = useState("00:00:00");

  /* ── Work-type / location ── */
  const [workType,    setWorkType]    = useState<"in_factory" | "on_site">("in_factory");
  const [onSiteRole,  setOnSiteRole]  = useState<"member" | "leader">("member");
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

  // ── Clock tick ────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => setCurrentTime(new Date().toLocaleTimeString("en-GB"));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── OT live elapsed ───────────────────────────────────────────────────────
  useEffect(() => {
    if (workStatus !== "ot_working" || !rawOtStart) return;
    const id = setInterval(() => setOtElapsed(elapsedStr(rawOtStart)), 1000);
    return () => clearInterval(id);
  }, [workStatus, rawOtStart]);

  // ── Location watch ────────────────────────────────────────────────────────
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
      () => { setLocationStatus("error"); setDistanceText("ไม่สามารถระบุตำแหน่งได้"); },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [workType]);

  // ── Fetch today's log ─────────────────────────────────────────────────────
  useEffect(() => {
    const fetchTodayStatus = async () => {
      if (!userId) return;
      const { data } = await supabase
        .from("daily_time_logs")
        .select("timeline_events, first_check_in, last_check_out")
        .eq("user_id", userId)
        .eq("log_date", getLocalToday())
        .maybeSingle();

      if (!data) { setWorkStatus("idle"); return; }

      if (data.first_check_in) setRawCheckIn(data.first_check_in);
      if (data.last_check_out) setRawCheckOut(data.last_check_out);

      const events: { event: string; timestamp: string }[] = data.timeline_events ?? [];
      const otStartEv = [...events].reverse().find((e) => e.event === "ot_start");
      const otEndEv   = [...events].reverse().find((e) => e.event === "ot_end");
      if (otStartEv) setRawOtStart(otStartEv.timestamp);
      if (otEndEv)   setRawOtEnd(otEndEv.timestamp);

      const last = events.at(-1);
      if (!last)                     { setWorkStatus("idle");         return; }
      if (last.event === "ot_end")   { setWorkStatus("ot_completed"); return; }
      if (last.event === "ot_start") {
        setWorkStatus("ot_working");
        setOtElapsed(elapsedStr(otStartEv?.timestamp ?? null));
        return;
      }
      if (last.event === "checkout") { setWorkStatus("completed");    return; }
      setWorkStatus("working");
    };
    fetchTodayStatus();
  }, [userId]);

  // ── Location guard ────────────────────────────────────────────────────────
  const validateLocation = useCallback((): boolean => {
    if (workType === "on_site") return true;
    if (locationStatus === "checking") {
      alert("ระบบกำลังตรวจสอบพิกัด GPS โปรดรอสักครู่...");
      return false;
    }
    if (locationStatus !== "in_range") {
      alert("ไม่สามารถ Check-in / Check-out ได้ เนื่องจากคุณอยู่นอกพื้นที่โรงงาน");
      return false;
    }
    return true;
  }, [workType, locationStatus]);

  // ── Push event helper ─────────────────────────────────────────────────────
  const pushEvent = async (
    newEvent: Record<string, unknown>,
    extraUpdate?: Record<string, unknown>
  ) => {
    const { data } = await supabase
      .from("daily_time_logs")
      .select("timeline_events")
      .eq("user_id", userId)
      .eq("log_date", getLocalToday())
      .maybeSingle();
    const timeline = [...(data?.timeline_events ?? []), newEvent];
    return supabase
      .from("daily_time_logs")
      .update({ timeline_events: timeline, ...extraUpdate })
      .eq("user_id", userId)
      .eq("log_date", getLocalToday());
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCheckIn = async () => {
    if (!userId || !validateLocation()) return;
    setIsSubmitting(true);
    const now   = new Date().toISOString();
    const today = getLocalToday();
    const newEvent = {
      event: workType === "in_factory" ? "arrive_factory" : "arrive_site",
      timestamp: now,
      work_type: workType,
    };
    const { data: existing } = await supabase
      .from("daily_time_logs")
      .select("timeline_events, first_check_in")
      .eq("user_id", userId).eq("log_date", today).maybeSingle();

    if (existing) {
      await supabase.from("daily_time_logs")
        .update({ timeline_events: [...existing.timeline_events, newEvent] })
        .eq("user_id", userId).eq("log_date", today);
      setRawCheckIn(existing.first_check_in || now);
    } else {
      await supabase.from("daily_time_logs").insert([{
        user_id: userId, log_date: today, work_type: workType,
        first_check_in: now, timeline_events: [newEvent],
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
    if (!error) { setRawCheckOut(now); setWorkStatus("completed"); }
    setIsSubmitting(false);
  };

  const handleStartOT = async () => {
    if (!userId) return;
    setIsSubmitting(true);
    const now = new Date().toISOString();
    const { error } = await pushEvent({ event: "ot_start", timestamp: now });
    if (!error) { setRawOtStart(now); setOtElapsed("00:00:00"); setWorkStatus("ot_working"); }
    setIsSubmitting(false);
  };

  const handleEndOT = async () => {
    if (!userId) return;
    setIsSubmitting(true);
    const now = new Date().toISOString();
    const hrs = calcOtHours(rawOtStart, now);
    const { error } = await pushEvent(
      { event: "ot_end", timestamp: now },
      { ot_hours: hrs }
    );
    if (!error) { setRawOtEnd(now); setWorkStatus("ot_completed"); }
    setIsSubmitting(false);
  };

  // ── Shared spinner ────────────────────────────────────────────────────────
  const Spinner = () => (
    <>
      <svg className="animate-spin h-12 w-12 text-white mb-2" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span className="text-xl font-semibold mt-2">กำลังบันทึก...</span>
    </>
  );

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <main className="p-4 md:p-6 pb-24 space-y-6 w-full">

      {/* ── 1. HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center relative gap-4">
        <div className="overflow-hidden">
          <p className="text-gray-500">TimeTracker System</p>
          <h2 className="text-xl md:text-2xl font-bold truncate text-sky-700">
            {userEmail || "ผู้ใช้งาน"}
          </h2>
        </div>
        <div><LogoutButton /></div>
      </div>

      {/* ── 2. ACTION BUTTON CARD ───────────────────────────────────────────── */}
      <div className="card text-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[380px]">
        <p className="text-gray-400 text-sm">Current Time</p>
        <p className="text-5xl font-bold my-4">{currentTime}</p>

        {/* LOADING */}
        {workStatus === "loading" && (
          <div className="w-48 h-48 bg-gray-50 text-gray-400 rounded-full flex flex-col items-center justify-center mx-auto shadow-inner animate-pulse border-4 border-gray-100">
            <span className="text-sm font-medium mt-2">กำลังโหลด...</span>
          </div>
        )}

        {/* IDLE → Check In */}
        {workStatus === "idle" && (
          <button
            onClick={handleCheckIn}
            disabled={isSubmitting}
            className={`w-48 h-48 rounded-full flex flex-col items-center justify-center mx-auto shadow-lg transition-all duration-300
              ${isSubmitting
                ? "bg-sky-400 text-white opacity-80 cursor-wait"
                : "bg-sky-400 text-white hover:bg-sky-500 checkin-btn-anim"}`}
          >
            {isSubmitting ? <Spinner /> : (
              <>
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-2xl font-semibold mt-2">Check In</span>
              </>
            )}
          </button>
        )}

        {/* WORKING → Check Out */}
        {workStatus === "working" && (
          <button
            onClick={handleCheckOut}
            disabled={isSubmitting}
            className={`w-48 h-48 rounded-full flex flex-col items-center justify-center mx-auto shadow-lg transition-all duration-300
              ${isSubmitting
                ? "bg-red-500 text-white opacity-80 cursor-wait"
                : "bg-red-500 text-white hover:bg-red-600 checkout-btn-anim"}`}
          >
            {isSubmitting ? <Spinner /> : (
              <>
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="text-2xl font-semibold mt-2">Check Out</span>
              </>
            )}
          </button>
        )}

        {/* COMPLETED → ✅ + Start OT button */}
        {workStatus === "completed" && (
          <div className="animate-fade-in flex flex-col items-center">
            {/* Same circle style as others */}
            <div className="w-48 h-48 bg-emerald-500 text-white rounded-full flex flex-col items-center justify-center shadow-lg mx-auto">
              <svg className="w-16 h-16 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-2xl font-bold mt-1">Complete</span>
            </div>

            {/* Start OT – uses same border-2 outline style as original "Request OT" */}
            <div className="w-full mt-6 space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">Overtime</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <button
                onClick={handleStartOT}
                disabled={isSubmitting}
                className="w-full max-w-xs mx-auto flex items-center justify-center gap-2 py-3 border-2 border-amber-400 text-amber-600 rounded-xl font-semibold hover:bg-amber-400 hover:text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-wait"
              >
                {isSubmitting
                  ? <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeWidth="2"/><polyline points="12 7 12 12 15 14" strokeWidth="2.5" strokeLinecap="round"/></svg>
                }
                <span>Start OT</span>
              </button>
              <p className="text-xs text-gray-400 text-center">OT จะถูกนับเป็นหน่วย 30 นาที</p>
            </div>
          </div>
        )}

        {/* OT WORKING → End OT  (ปุ่มกลมเหมือนเดิม, สี amber) */}
        {workStatus === "ot_working" && (
          <div className="animate-fade-in flex flex-col items-center">
            {/* Live OT elapsed badge */}
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="font-bold text-amber-700 tabular-nums tracking-wider">{otElapsed}</span>
              <span className="text-xs text-amber-500 font-medium">OT Elapsed</span>
            </div>

            {/* Circular End OT button */}
            <button
              onClick={handleEndOT}
              disabled={isSubmitting}
              className={`w-48 h-48 rounded-full flex flex-col items-center justify-center mx-auto shadow-lg transition-all duration-300
                ${isSubmitting
                  ? "bg-amber-400 text-white opacity-80 cursor-wait"
                  : "bg-amber-400 text-white hover:bg-amber-500 ot-btn-anim"}`}
            >
              {isSubmitting ? <Spinner /> : (
                <>
                  <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" strokeWidth="2" />
                    <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.85" />
                  </svg>
                  <span className="text-2xl font-semibold mt-2">End OT</span>
                </>
              )}
            </button>
            <p className="text-gray-400 text-sm mt-3">กดเมื่อจบงาน OT</p>
          </div>
        )}

        {/* OT COMPLETED */}
        {workStatus === "ot_completed" && (
          <div className="animate-fade-in flex flex-col items-center">
            <div className="w-48 h-48 bg-amber-400 text-white rounded-full flex flex-col items-center justify-center shadow-lg mx-auto">
              <svg className="w-16 h-16 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xl font-bold mt-1">OT Complete</span>
            </div>
            <p className="text-gray-500 text-sm mt-4">
              OT วันนี้ <span className="font-bold text-amber-600">{otHours} ชม.</span>
            </p>
          </div>
        )}
      </div>

      {/* ── 3. WORK TYPE & LOCATION CARD ───────────────────────────────────── */}
      <div className="card space-y-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h3 className="font-semibold mb-3">Work Type</h3>
          <div className="flex bg-gray-100 rounded-xl p-1">
            {(["in_factory", "on_site"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setWorkType(t)}
                disabled={workStatus !== "idle" && workStatus !== "loading"}
                className={`flex-1 p-2 rounded-lg transition-all text-sm font-medium disabled:cursor-not-allowed
                  ${workType === t ? "bg-sky-500 text-white shadow" : "text-gray-600"}`}
              >
                {t === "in_factory" ? "Factory" : "On-site"}
              </button>
            ))}
          </div>
        </div>

        {/* On-site role options */}
        {workType === "on_site" && (
          <div className="pt-4 border-t border-gray-100 space-y-4 animate-fade-in">
            <h3 className="font-semibold text-center mb-2 text-gray-700">Select Your Role</h3>
            <div className="flex gap-3">
              {(["member", "leader"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setOnSiteRole(r)}
                  className={`flex-1 py-3 border-2 rounded-xl font-bold transition-all text-sm
                    ${onSiteRole === r
                      ? "border-sky-500 text-sky-600 bg-sky-50"
                      : "border-gray-300 text-gray-500 bg-white"}`}
                >
                  {r === "member"
                    ? <>Scan QR<br /><span className="text-xs font-normal">(Member)</span></>
                    : <>Create Room<br /><span className="text-xs font-normal">(Leader)</span></>}
                </button>
              ))}
            </div>
            {onSiteRole === "member" && (
              <button className="w-full bg-sky-500 text-white rounded-lg py-3 flex items-center justify-center gap-2 hover:bg-sky-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                Open Camera to Scan QR
              </button>
            )}
            {onSiteRole === "leader" && (
              <div className="space-y-3">
                <input type="text" placeholder="Project Name / Project No." className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:border-sky-400" />
                <input type="text" placeholder="Location" className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:border-sky-400" />
                <button className="w-full bg-sky-500 text-white rounded-lg py-3 hover:bg-sky-600 transition-colors">Create Check-in Room</button>
              </div>
            )}
          </div>
        )}

        {/* Location status (factory only) */}
        {workType === "in_factory" && (
          <div className="pt-4 border-t border-gray-100">
            <h3 className="font-semibold mb-3">Location Status</h3>
            <div className={`flex items-center p-3 rounded-xl ${
              locationStatus === "in_range"     ? "bg-emerald-50 text-emerald-700" :
              locationStatus === "out_of_range" ? "bg-red-50 text-red-700" :
              locationStatus === "error"        ? "bg-orange-50 text-orange-700" :
                                                  "bg-gray-100 text-gray-700"
            }`}>
              <svg className="w-6 h-6 mr-3 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div className="flex flex-col">
                <span className="font-medium text-sm">{distanceText}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. DAILY SUMMARY CARD ───────────────────────────────────────────── */}
      <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="font-semibold mb-4 text-gray-800">Daily Summary</h3>
        <div className="space-y-4 text-sm">

          {/* Check-in */}
          <div className="flex justify-between items-center pb-3 border-b border-gray-100">
            <span className="text-gray-500">เวลาเข้างาน (Check-in):</span>
            <span className="font-bold text-sky-600 bg-sky-50 px-3 py-1 rounded-lg">{fmtTime(rawCheckIn)}</span>
          </div>

          {/* Check-out */}
          <div className="flex justify-between items-center pb-3 border-b border-gray-100">
            <span className="text-gray-500">เวลาออกงาน (Check-out):</span>
            <span className="font-bold text-red-500 bg-red-50 px-3 py-1 rounded-lg">{fmtTime(rawCheckOut)}</span>
          </div>

          {/* Normal hours */}
          <div className={`flex justify-between items-center ${rawOtStart ? "pb-3 border-b border-gray-100" : ""}`}>
            <span className="text-gray-500">ชั่วโมงทำงานปกติ:</span>
            <span className="font-medium text-gray-800">
              {workSummary.normal > 0 ? `${workSummary.normal} ชม.` : "-"}
            </span>
          </div>

          {/* ── OT section (แสดงเฉพาะเมื่อมี OT) ── */}
          {rawOtStart && (
            <>
              {/* OT label divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-amber-100" />
                <span className="text-[11px] font-bold text-amber-500 uppercase tracking-widest">Overtime</span>
                <div className="flex-1 h-px bg-amber-100" />
              </div>

              {/* OT start */}
              <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                <span className="text-gray-500">เริ่มทำ OT:</span>
                <span className="font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-lg">{fmtTime(rawOtStart)}</span>
              </div>

              {/* OT end */}
              {rawOtEnd && (
                <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                  <span className="text-gray-500">จบงาน OT:</span>
                  <span className="font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-lg">{fmtTime(rawOtEnd)}</span>
                </div>
              )}

              {/* Live elapsed (ระหว่าง OT) */}
              {workStatus === "ot_working" && (
                <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                  <span className="text-gray-500 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                    เวลา OT สะสม:
                  </span>
                  <span className="font-bold text-amber-600 tabular-nums">{otElapsed}</span>
                </div>
              )}

              {/* OT hours (เมื่อจบแล้ว) */}
              {rawOtEnd && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">ชั่วโมง OT:</span>
                  <span className="font-bold text-amber-600">{otHours} ชม.</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </main>
  );
}