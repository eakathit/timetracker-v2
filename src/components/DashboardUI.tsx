"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import DailyReportForm from "@/components/DailyReportForm";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import OTWindowCard from "@/components/OTWindowCard";
import { ChangelogBellButton } from "@/components/ChangelogPanel";
import dynamic from "next/dynamic";
const QRScannerModal = dynamic(() => import("@/components/QRScannerModal"), { ssr: false });
// ─── Types ────────────────────────────────────────────────────────────────────
interface DashboardUIProps {
  userName?: string;
  userEmail?: string;
  userId: string;
}

type WorkStatus =
  | "loading"
  | "idle"
  | "working"
  | "completed"
  | "ot_window"
  | "ot_working"
  | "ot_completed";

type DayType = "workday" | "working_sat" | "weekend" | "holiday";

interface DayInfo {
  dayType: DayType;
  payMultiplier: number;
  holidayName: string | null;
}

async function getDayInfo(dateStr: string): Promise<DayInfo> {
  const dow = new Date(dateStr).getDay(); // 0=อาทิตย์, 6=เสาร์

  // Query holidays table ก่อน
  const { data: holiday } = await supabase
    .from("holidays")
    .select("name, holiday_type")
    .eq("holiday_date", dateStr)
    .maybeSingle();

  if (holiday) {
    if (holiday.holiday_type === "working_sat") {
      // เสาร์ทำงาน → ถือเป็นวันทำงานปกติ (1.0x)
      return {
        dayType: "working_sat",
        payMultiplier: 1.0,
        holidayName: holiday.name,
      };
    }
    // national / company / special → วันหยุด (2.0x)
    return {
      dayType: "holiday",
      payMultiplier: 2.0,
      holidayName: holiday.name,
    };
  }

  // ไม่มีใน holidays table
  if (dow === 0 || dow === 6) {
    // เสาร์/อาทิตย์ปกติ → 2.0x
    return { dayType: "weekend", payMultiplier: 2.0, holidayName: null };
  }

  // วันทำงานปกติ จ–ศ → 1.0x
  return { dayType: "workday", payMultiplier: 1.0, holidayName: null };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
// ── คำนวณ attendance status จากเวลา check-in ─────────────────────────────────
function calcAttendanceStatus(checkInIso: string): "on_time" | "late" {
  const checkIn = new Date(checkInIso);
  const lateThreshold = new Date(checkIn);
  lateThreshold.setHours(8, 30, 0, 0);
  return checkIn > lateThreshold ? "late" : "on_time";
}

const getLocalToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const fmtTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

const FACTORY_LAT = 13.625;
const FACTORY_LNG = 101.025;
const ALLOWED_RADIUS_METERS = 100;

const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
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
  const checkIn = new Date(inTime);
  const checkOut = new Date(outTime);
  const fix = (h: number, m: number) => {
    const d = new Date(checkIn);
    d.setHours(h, m, 0, 0);
    return d;
  };
  const workStart = fix(8, 30);
  const workEnd = fix(17, 30);
  const breakStart = fix(12, 0);
  const breakEnd = fix(13, 0);
  const effStart = checkIn > workStart ? checkIn : workStart;
  const effEnd = checkOut < workEnd ? checkOut : workEnd;
  let normalHours = 0;
  if (effEnd > effStart) {
    let ms = effEnd.getTime() - effStart.getTime();
    const bStart = effStart > breakStart ? effStart : breakStart;
    const bEnd = effEnd < breakEnd ? effEnd : breakEnd;
    if (bEnd > bStart) ms -= bEnd.getTime() - bStart.getTime();
    normalHours = ms / 3_600_000;
  }
  return { normal: Math.max(0, Number(normalHours.toFixed(2))) };
};

// คำนวณ OT (หน่วย 30 นาที ปัดลง)
const calcOtHours = (otStart: string | null, otEnd: string | null): number => {
  if (!otStart || !otEnd) return 0;
  const mins =
    (new Date(otEnd).getTime() - new Date(otStart).getTime()) / 60_000;
  return Math.floor(mins / 30) * 0.5;
};

// นับเวลาผ่านไปแบบ live
const elapsedStr = (isoStart: string | null): string => {
  if (!isoStart) return "00:00:00";
  const diff = Math.max(
    0,
    Math.floor((Date.now() - new Date(isoStart).getTime()) / 1000),
  );
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

// ═══════════════════════════════════════════════════════════════════════════════
export default function DashboardUI({ userName, userEmail, userId }: DashboardUIProps) {
  const router = useRouter();
  /* ── Clock ── */
  const [currentTime, setCurrentTime] = useState("");

  /* ── Status ── */
  const [workStatus, setWorkStatus] = useState<WorkStatus>("loading");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showReportPopup, setShowReportPopup] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);

  const [popupEndUsers, setPopupEndUsers] = useState<any[]>([]);
  const [popupProjects, setPopupProjects] = useState<any[]>([]);
  const [popupDetails, setPopupDetails] = useState<any[]>([]);

  const [checkInTime, setCheckInTime] = useState<string>("-");
  const [checkOutTime, setCheckOutTime] = useState<string>("-");
  /* ── Regular times ── */
  const [rawCheckIn, setRawCheckIn] = useState<string | null>(null);
  const [rawCheckOut, setRawCheckOut] = useState<string | null>(null);

  /* ── OT times ── */
  const [rawOtStart, setRawOtStart] = useState<string | null>(null);
  const [rawOtEnd, setRawOtEnd] = useState<string | null>(null);
  const [otElapsed, setOtElapsed] = useState("00:00:00");
  const [otIntent, setOtIntent] = useState(false);
  const [otTimeReady, setOtTimeReady] = useState(new Date().getHours() >= 18);

  /* ── Work-type / location ── */
  const [workType, setWorkType] = useState<"in_factory" | "on_site">(
    "in_factory",
  );
  const [onSiteRole, setOnSiteRole] = useState<"member" | "leader">("member");
  const [locationStatus, setLocationStatus] = useState<
    "checking" | "in_range" | "out_of_range" | "error"
  >("checking");
  const [distanceText, setDistanceText] = useState("กำลังตรวจสอบตำแหน่ง...");

  /* ── Derived ── */
  const workSummary = useMemo(
    () => calculateWorkTime(rawCheckIn, rawCheckOut),
    [rawCheckIn, rawCheckOut],
  );
  const otHours = useMemo(
    () => calcOtHours(rawOtStart, rawOtEnd),
    [rawOtStart, rawOtEnd],
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

  // ── OT time unlock (18:00) ────────────────────────────────────────────────
  useEffect(() => {
    if (otTimeReady) return;

    const now = new Date();
    const target = new Date();
    target.setHours(18, 0, 0, 0);
    const msUntil18 = target.getTime() - now.getTime();

    if (msUntil18 <= 0) {
      // เลย 18:00 แล้ว (เช่น refresh หน้าหลัง 18:00) → unlock ทันที
      setOtTimeReady(true);
      return;
    }

    // fire ตรงเวลา 18:00:00 พอดี
    const id = setTimeout(() => setOtTimeReady(true), msUntil18);
    return () => clearTimeout(id);
  }, [otTimeReady]);

  // ── Location watch ────────────────────────────────────────────────────────
  useEffect(() => {
    if (workType === "in_factory") return;
    setLocationStatus("checking");
    setDistanceText("กำลังตรวจสอบพิกัด...");
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setDistanceText("อุปกรณ์ไม่รองรับ GPS");
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      ({ coords: { latitude, longitude } }) => {
        const dist = calculateDistance(
          FACTORY_LAT,
          FACTORY_LNG,
          latitude,
          longitude,
        );
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
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [workType]);

  // ── Fetch today's log
  useEffect(() => {
    const fetchTodayStatus = async () => {
      if (!userId) return;
      const today = getLocalToday();

      const { data } = await supabase
        .from("daily_time_logs")
        .select(
          "first_check_in, last_check_out, work_type, timeline_events, ot_hours, auto_checked_out, ot_intent",
        )
        .eq("user_id", userId)
        .eq("log_date", today)
        .maybeSingle();

      if (data) {
        // ✅ เช็ค auto_checked_out ก่อนเลย (ต้องอยู่ในนี้)
        if (data.auto_checked_out && !data.ot_hours) {
          setWorkStatus("completed"); // ← กลับไป completed ปกติ
          setRawCheckIn(data.first_check_in);
          setRawCheckOut(data.last_check_out);
          setIsInitializing(false);
          return;
        }

        if (data.first_check_in) {
          setRawCheckIn(data.first_check_in);
          setCheckInTime(
            new Date(data.first_check_in).toLocaleTimeString("th-TH", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          );
        }
        if (data.last_check_out) {
          setRawCheckOut(data.last_check_out);
          setCheckOutTime(
            new Date(data.last_check_out).toLocaleTimeString("th-TH", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          );
        }

        if (data.timeline_events && data.timeline_events.length > 0) {
          const otStartEvent = data.timeline_events.find(
            (e: any) => e.event === "ot_start",
          );
          const otEndEvent = data.timeline_events.find(
            (e: any) => e.event === "ot_end",
          );
          if (otStartEvent) setRawOtStart(otStartEvent.timestamp);
          if (otEndEvent) setRawOtEnd(otEndEvent.timestamp);

          const lastEvent =
            data.timeline_events[data.timeline_events.length - 1];

          if (lastEvent.event === "ot_end") {
            setWorkStatus("ot_completed");
          } else if (lastEvent.event === "ot_start") {
            setWorkStatus("ot_working");
          } else if (
            lastEvent.event === "checkout" ||
            lastEvent.event === "onsite_checkout"
          ) {
            setWorkStatus("completed");
          } else if (lastEvent.event === "auto_checkout") {
            // ✅ Cron auto-checkout 17:30 → restore เป็น completed
            setWorkStatus("completed");
          } else if (
            lastEvent.event === "arrive_factory" ||
            lastEvent.event === "arrive_site" ||
            lastEvent.event === "onsite_checkin"
          ) {
            setWorkStatus("working");
          } else {
            setWorkStatus("working");
          }
        } else {
          setWorkStatus("idle");
        }
      } else {
        setWorkStatus("idle");
      }

      setIsInitializing(false);
    };

    fetchTodayStatus();
  }, [userId]);

  // ── Realtime: รับ auto_checkout จาก Vercel Cron ──────────────────────────
  useEffect(() => {
    if (!userId) return;
    const today = getLocalToday();

    const channel = supabase
      .channel(`auto-checkout:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "daily_time_logs",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as any;

          // กรองเฉพาะวันนี้เท่านั้น
          if (row.log_date !== today) return;

          // Cron auto-checkout เข้ามา → อัปเดต UI ทันที
          if (row.auto_checked_out && row.last_check_out) {
            setRawCheckOut(row.last_check_out);
            setCheckOutTime(
              new Date(row.last_check_out).toLocaleTimeString("th-TH", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            );
            setWorkStatus("completed");
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [uRes, pRes, dRes] = await Promise.all([
        supabase.from("end_users").select("*"),
        supabase.from("projects").select("*"),
        supabase.from("work_details").select("*"),
      ]);
      if (uRes.data) setPopupEndUsers(uRes.data);
      if (pRes.data) setPopupProjects(pRes.data);
      if (dRes.data) setPopupDetails(dRes.data);
    })();
  }, [userId]);

  // ── Location guard ────────────────────────────────────────────────────────
  const validateLocation = useCallback((): boolean => {
    if (workType === "on_site") return true;
    if (locationStatus === "checking") {
      alert("ระบบกำลังตรวจสอบพิกัด GPS โปรดรอสักครู่...");
      return false;
    }
    if (locationStatus !== "in_range") {
      alert(
        "ไม่สามารถ Check-in / Check-out ได้ เนื่องจากคุณอยู่นอกพื้นที่โรงงาน",
      );
      return false;
    }
    return true;
  }, [workType, locationStatus]);

  // ── Push event helper ─────────────────────────────────────────────────────
  const pushEvent = async (
    newEvent: Record<string, unknown>,
    extraUpdate?: Record<string, unknown>,
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

    const now = new Date().toISOString();
    const today = getLocalToday();

    // ── ใหม่: ดึงข้อมูลวันว่าเป็นวันอะไร ──
    const { dayType, payMultiplier, holidayName } = await getDayInfo(today);

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
      .maybeSingle();

    if (existing) {
      // row มีอยู่แล้ว (check-in ซ้ำในวันเดิม) → แค่เพิ่ม event
      await supabase
        .from("daily_time_logs")
        .update({ timeline_events: [...existing.timeline_events, newEvent] })
        .eq("user_id", userId)
        .eq("log_date", today);
      setRawCheckIn(existing.first_check_in || now);
    } else {
      // สร้าง row ใหม่ → ใส่ day_type, pay_multiplier, holiday_name ด้วย
      const attendanceStatus = calcAttendanceStatus(now);

      await supabase.from("daily_time_logs").insert([
        {
          user_id: userId,
          log_date: today,
          work_type: workType,
          first_check_in: now,
          timeline_events: [newEvent],
          day_type: dayType,
          pay_multiplier: payMultiplier,
          holiday_name: holidayName,
          status: attendanceStatus, // ✅ เพิ่มบรรทัดนี้
        },
      ]);
      setRawCheckIn(now);
    }

    setWorkStatus("working");
    setIsSubmitting(false);
    setShowReportPopup(true);
  }; 

  const handleQRCheckInSuccess = async (checkInIsoTime: string) => {
    setShowQRScanner(false);
    setRawCheckIn(checkInIsoTime);
    setCheckInTime(
      new Date(checkInIsoTime).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
    setWorkStatus("working");
    setShowReportPopup(true);
  };
  
  const handleCheckOut = async () => {
    if (!userId || !validateLocation()) return;
    setIsSubmitting(true);
    const now = new Date().toISOString();
    const { error } = await pushEvent(
      { event: "checkout", timestamp: now, note: "เลิกงาน" },
      { last_check_out: now }, // ✅ ลบ status: "completed" ออก
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
    const hrs = calcOtHours(rawOtStart, now);
    const { error } = await pushEvent(
      { event: "ot_end", timestamp: now },
      { ot_hours: hrs },
    );
    if (!error) {
      setRawOtEnd(now);
      setWorkStatus("ot_completed");
    }
    setIsSubmitting(false);
  };

  // ── Shared spinner ────────────────────────────────────────────────────────
  const Spinner = () => (
    <>
      <svg
        className="animate-spin h-12 w-12 text-white mb-2"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
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
      {userName || userEmail || "ผู้ใช้งาน"}
    </h2>
  </div>

  {/* ← เพิ่มตรงนี้ */}
  <div className="flex-shrink-0">
    <ChangelogBellButton />
  </div>

</div>

      {/* ── 2. ACTION BUTTON CARD ───────────────────────────────────────────── */}
      <div className="card text-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[380px]">
        <p className="text-gray-400 text-sm">Current Time</p>
        <p className="text-5xl font-bold my-4">{currentTime}</p>

        {/* LOADING */}
        {/* {workStatus === "loading" && (
          <div className="w-48 h-48 bg-gray-50 text-gray-400 rounded-full flex flex-col items-center justify-center mx-auto shadow-inner animate-pulse border-4 border-gray-100">
            <span className="text-sm font-medium mt-2">กำลังโหลด...</span>
          </div>
        )} */}

        {/* IDLE → Check In */}
        {workStatus === "idle" && (
          <button
            onClick={() => setShowQRScanner(true)}
            disabled={isSubmitting || isInitializing}
            className={`w-48 h-48 rounded-full flex flex-col items-center justify-center mx-auto shadow-lg transition-all duration-300
      ${
        isSubmitting
          ? "bg-sky-400 text-white opacity-80 cursor-wait"
          : isInitializing
            ? "bg-sky-300 text-white cursor-wait"
            : "bg-sky-400 text-white hover:bg-sky-500 checkin-btn-anim"
      }
    `}
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin h-12 w-12 text-white mb-2"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="text-xl font-semibold mt-2">
                  กำลังบันทึก...
                </span>
              </>
            ) : (
              <>
                <svg
                  className="w-16 h-16"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
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
            disabled={isSubmitting || isInitializing} // ← เพิ่ม isInitializing
            className={`w-48 h-48 rounded-full flex flex-col items-center justify-center mx-auto shadow-lg transition-all duration-300
      ${
        isSubmitting
          ? "bg-rose-400 text-white opacity-80 cursor-wait"
          : isInitializing
            ? "bg-rose-300 text-white cursor-wait" // ← สีอ่อนกว่า ระหว่าง sync
            : "bg-rose-400 text-white hover:bg-rose-500 active:scale-95"
      }
    `}
          >
            {isSubmitting ? (
              <Spinner />
            ) : (
              <>
                <svg
                  className="w-16 h-16"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span className="text-2xl font-semibold mt-2">Check Out</span>
              </>
            )}
          </button>
        )}

        {/* COMPLETED → ✅ + Start OT button */}
        {workStatus === "completed" && (
          <div className="animate-fade-in flex flex-col items-center">
            <div className="w-48 h-48 bg-emerald-500 text-white rounded-full flex flex-col items-center justify-center shadow-lg mx-auto">
              <svg
                className="w-16 h-16 mb-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-2xl font-bold mt-1">Complete</span>
            </div>

            {/* Start OT */}
            <div className="w-full mt-6 space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                  Overtime
                </span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              <button
                onClick={handleStartOT}
                disabled={isSubmitting || !otTimeReady}
                className={`w-full max-w-xs mx-auto flex items-center justify-center gap-2 py-3
                  border-2 rounded-xl font-semibold transition-all duration-200
                  disabled:cursor-not-allowed
                  ${
                    otTimeReady
                      ? "border-amber-400 text-amber-600 hover:bg-amber-400 hover:text-white disabled:opacity-60"
                      : "border-gray-200 text-gray-300 bg-gray-50"
                  }`}
              >
                {isSubmitting ? (
                  <svg
                    className="animate-spin w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : otTimeReady ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="9" strokeWidth="2" />
                    <polyline
                      points="12 7 12 12 15 14"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <rect
                      x="3"
                      y="11"
                      width="18"
                      height="11"
                      rx="2"
                      strokeWidth="2"
                    />
                    <path
                      strokeLinecap="round"
                      strokeWidth="2"
                      d="M7 11V7a5 5 0 0110 0v4"
                    />
                  </svg>
                )}
                <span>{otTimeReady ? "Start OT" : "Start OT (18:00 น.)"}</span>
              </button>

              <p className="text-xs text-gray-400 text-center">
                {otTimeReady
                  ? "OT จะถูกนับเป็นหน่วย 30 นาที"
                  : "ปุ่มจะเปิดใช้งานเวลา 18:00 น."}
              </p>
            </div>
          </div>
        )}

        {/* OT WORKING → End OT */}
        {workStatus === "ot_working" && (
          <div className="animate-fade-in flex flex-col items-center">
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="font-bold text-amber-700 tabular-nums tracking-wider">
                {otElapsed}
              </span>
              <span className="text-xs text-amber-500 font-medium">
                OT Elapsed
              </span>
            </div>

            <button
              onClick={handleEndOT}
              disabled={isSubmitting}
              className={`w-48 h-48 rounded-full flex flex-col items-center justify-center mx-auto shadow-lg transition-all duration-300
                ${
                  isSubmitting
                    ? "bg-amber-400 text-white opacity-80 cursor-wait"
                    : "bg-amber-400 text-white hover:bg-amber-500 ot-btn-anim"
                }`}
            >
              {isSubmitting ? (
                <Spinner />
              ) : (
                <>
                  <svg
                    className="w-16 h-16"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="9" strokeWidth="2" />
                    <rect
                      x="9"
                      y="9"
                      width="6"
                      height="6"
                      rx="1"
                      fill="currentColor"
                      opacity="0.85"
                    />
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
              <svg
                className="w-16 h-16 mb-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-xl font-bold mt-1">OT Complete</span>
            </div>
            <p className="text-gray-500 text-sm mt-4">
              OT วันนี้{" "}
              <span className="font-bold text-amber-600">{otHours} ชม.</span>
            </p>
          </div>
        )}

        {/* Location Status — แสดงเฉพาะ on_site เท่านั้น */}
        {workType !== "in_factory" && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className={`flex items-center gap-2 p-3 rounded-xl text-sm
              ${locationStatus === "in_range"
                ? "bg-emerald-50 text-emerald-700"
                : locationStatus === "out_of_range"
                  ? "bg-red-50 text-red-700"
                  : locationStatus === "error"
                    ? "bg-orange-50 text-orange-700"
                    : "bg-gray-100 text-gray-500"
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <span className="text-xs font-medium">{distanceText}</span>
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
            <span className="font-bold text-sky-600 bg-sky-50 px-3 py-1 rounded-lg">
              {fmtTime(rawCheckIn)}
            </span>
          </div>

          {/* Check-out */}
          <div className="flex justify-between items-center pb-3 border-b border-gray-100">
            <span className="text-gray-500">เวลาออกงาน (Check-out):</span>
            <span className="font-bold text-red-500 bg-red-50 px-3 py-1 rounded-lg">
              {fmtTime(rawCheckOut)}
            </span>
          </div>

          {/* Normal hours */}
          <div
            className={`flex justify-between items-center ${rawOtStart ? "pb-3 border-b border-gray-100" : ""}`}
          >
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
                <span className="text-[11px] font-bold text-amber-500 uppercase tracking-widest">
                  Overtime
                </span>
                <div className="flex-1 h-px bg-amber-100" />
              </div>

              {/* OT start */}
              <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                <span className="text-gray-500">เริ่มทำ OT:</span>
                <span className="font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-lg">
                  {fmtTime(rawOtStart)}
                </span>
              </div>

              {/* OT end */}
              {rawOtEnd && (
                <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                  <span className="text-gray-500">จบงาน OT:</span>
                  <span className="font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-lg">
                    {fmtTime(rawOtEnd)}
                  </span>
                </div>
              )}

              {/* Live elapsed (ระหว่าง OT) */}
              {workStatus === "ot_working" && (
                <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                  <span className="text-gray-500 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                    เวลา OT สะสม:
                  </span>
                  <span className="font-bold text-amber-600 tabular-nums">
                    {otElapsed}
                  </span>
                </div>
              )}

              {/* OT hours (เมื่อจบแล้ว) */}
              {rawOtEnd && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">ชั่วโมง OT:</span>
                  <span className="font-bold text-amber-600">
                    {otHours} ชม.
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* ── 5. DAILY REPORT POPUP (MODAL) ─────────────────────────────────── */}
      {showReportPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
            {/* Modal Header */}
            <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 bg-sky-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center text-sky-500">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    วางแผนงานวันนี้
                  </h2>
                  <p className="text-xs text-gray-500">
                    กรอกข้อมูล Daily Report เบื้องต้น
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReportPopup(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Modal Body: เรียกใช้ฟอร์มที่เราแยกออกมาตะกี้! */}
            <div className="p-2 md:p-4 overflow-y-auto flex-1 bg-gray-50/30">
              <DailyReportForm
                hideHeader={true}
                onSaved={() => setShowReportPopup(false)}
                userId={userId}
                initialEndUsers={popupEndUsers}
                initialProjects={popupProjects}
                initialDetails={popupDetails}
              />
            </div>
          </div>
        </div>
      )}

      {showQRScanner && (
        <QRScannerModal
          onSuccess={handleQRCheckInSuccess}
          onClose={() => setShowQRScanner(false)}
        />
      )}

    </main>
  );
}
