"use client";

import { useState, useEffect, useMemo } from "react";
import LogoutButton from "@/components/LogoutButton";
import { supabase } from "@/lib/supabase";

interface DashboardUIProps {
  userEmail: string | undefined;
  userId: string;
}

const getLocalToday = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const FACTORY_LAT = 13.625; 
const FACTORY_LNG = 101.025; 
const ALLOWED_RADIUS_METERS = 100; 

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; 
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; 
};

const calculateWorkTime = (inTime: string | null, outTime: string | null) => {
  if (!inTime || !outTime) return { normal: 0, ot: 0 };

  const checkIn = new Date(inTime);
  const checkOut = new Date(outTime);

  // สร้างฟังก์ชันช่วยเซ็ตเวลาให้เป็นวันเดียวกันกับที่ Check-in
  const getFixedTime = (hours: number, mins: number) => {
    const d = new Date(checkIn);
    d.setHours(hours, mins, 0, 0);
    return d;
  };

  const workStart = getFixedTime(8, 30);  // เริ่มงาน 08:30
  const workEnd = getFixedTime(17, 30);   // เลิกงาน 17:30
  const breakStart = getFixedTime(12, 0); // พัก 12:00
  const breakEnd = getFixedTime(13, 0);   // เลิกพัก 13:00
  const otStart = getFixedTime(18, 0);    // เริ่ม OT 18:00

  // --- คำนวณชั่วโมงทำงานปกติ ---
  let normalHours = 0;
  // จำกัดเวลาเริ่มต้นและสิ้นสุดไม่ให้เกินกรอบเวลาทำงานปกติ
  const effectiveStart = checkIn > workStart ? checkIn : workStart;
  const effectiveEnd = checkOut < workEnd ? checkOut : workEnd;

  if (effectiveEnd > effectiveStart) {
    let diffMs = effectiveEnd.getTime() - effectiveStart.getTime();
    
    // หักเวลาพักเที่ยง หากทำงานคร่อมช่วง 12:00 - 13:00
    const effBreakStart = effectiveStart > breakStart ? effectiveStart : breakStart;
    const effBreakEnd = effectiveEnd < breakEnd ? effectiveEnd : breakEnd;
    
    if (effBreakEnd > effBreakStart) {
      diffMs -= (effBreakEnd.getTime() - effBreakStart.getTime());
    }
    
    normalHours = diffMs / (1000 * 60 * 60); // แปลง Milliseconds เป็นชั่วโมง
  }

  // --- คำนวณ OT ---
  let otHours = 0;
  if (checkOut > otStart) {
    const otDiffMs = checkOut.getTime() - otStart.getTime();
    const otMinutes = otDiffMs / (1000 * 60); // แปลงเป็นนาที
    // หาร 30 นาที แล้วปัดเศษลง (เช่น 45 นาที / 30 = 1.5 -> ปัดลงเหลือ 1 -> คูณ 0.5 = 0.5 ชม.)
    otHours = Math.floor(otMinutes / 30) * 0.5; 
  }

  return { 
    normal: Math.max(0, Number(normalHours.toFixed(2))), 
    ot: Math.max(0, otHours) 
  };
};

export default function DashboardUI({ userEmail, userId }: DashboardUIProps) {
  const [currentTime, setCurrentTime] = useState("");
  
  const [workStatus, setWorkStatus] = useState<"loading" | "idle" | "working" | "completed">("loading");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [checkInTime, setCheckInTime] = useState<string>("-");
  const [checkOutTime, setCheckOutTime] = useState<string>("-");

  // 🌟 2. เพิ่ม State สำหรับเก็บ Date String แบบเต็มๆ ไว้คำนวณระยะเวลา
  const [rawCheckIn, setRawCheckIn] = useState<string | null>(null);
  const [rawCheckOut, setRawCheckOut] = useState<string | null>(null);

  // 🌟 3. ใช้ useMemo ให้คำนวณผลลัพธ์ใหม่ทุกครั้งที่ rawCheckIn หรือ rawCheckOut เปลี่ยนแปลง
  const workSummary = useMemo(() => calculateWorkTime(rawCheckIn, rawCheckOut), [rawCheckIn, rawCheckOut]);
  
  const [workType, setWorkType] = useState<"in_factory" | "on_site">("in_factory");
  const [onSiteRole, setOnSiteRole] = useState<"member" | "leader">("member");

  // 🌟 1. เพิ่ม State สำหรับ Modal Request OT
  const [isOTModalOpen, setIsOTModalOpen] = useState(false);
  const [otForm, setOtForm] = useState({
    date: getLocalToday(), // ใช้วันที่ปัจจุบันเป็นค่าเริ่มต้น
    startTime: "",
    endTime: "",
    task: ""
  });
  
  // 🌟 2. ฟังก์ชันจัดการเมื่อกด Submit Form ขอ OT
  const handleOTSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ตรงนี้คุณสามารถนำไปต่อยอดใช้ supabase.from('ot_requests').insert(...) ได้ครับ
    console.log("Submitting OT Request:", otForm);
    alert(`ส่งคำขอ OT เรียบร้อย!\nวันที่: ${otForm.date}\nเวลา: ${otForm.startTime} - ${otForm.endTime}\nงานที่ทำ: ${otForm.task}`);
    
    // ส่งเสร็จให้ปิด Modal และเคลียร์ฟอร์ม
    setIsOTModalOpen(false);
    setOtForm({ ...otForm, startTime: "", endTime: "", task: "" });
  };
  
  const [locationStatus, setLocationStatus] = useState<"checking" | "in_range" | "out_of_range" | "error">("checking");
  const [distanceText, setDistanceText] = useState<string>("กำลังตรวจสอบตำแหน่ง...");

  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString("en-GB"));
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("en-GB"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (workType !== "in_factory") return;

    setLocationStatus("checking");
    setDistanceText("กำลังตรวจสอบพิกัด...");

    if (!navigator.geolocation) {
      setLocationStatus("error");
      setDistanceText("อุปกรณ์ของคุณไม่รองรับ GPS");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const distance = calculateDistance(FACTORY_LAT, FACTORY_LNG, latitude, longitude);
        
        if (distance <= ALLOWED_RADIUS_METERS) {
          setLocationStatus("in_range");
          setDistanceText(`อยู่ในพื้นที่โรงงาน (${Math.round(distance)} เมตร)`);
        } else {
          setLocationStatus("out_of_range");
          setDistanceText(`อยู่นอกพื้นที่โรงงาน (${Math.round(distance)} เมตร)`);
        }
      },
      (error) => {
        setLocationStatus("error");
        setDistanceText(error.code === 1 ? "กรุณาเปิดสิทธิ์การเข้าถึงตำแหน่ง (GPS)" : "ไม่สามารถระบุตำแหน่งได้");
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [workType]);

  useEffect(() => {
    const fetchTodayStatus = async () => {
      if (!userId) return;
      const today = getLocalToday();
      
      const { data } = await supabase
        .from("daily_time_logs")
        .select("timeline_events, first_check_in, last_check_out")
        .eq("user_id", userId)
        .eq("log_date", today)
        .single();

      if (data) {
        if (data.first_check_in) {
          setRawCheckIn(data.first_check_in);
          setCheckInTime(new Date(data.first_check_in).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }));
        }
        if (data.last_check_out) {
          setRawCheckOut(data.last_check_out);
          setCheckOutTime(new Date(data.last_check_out).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }));
        }

        if (data.timeline_events && data.timeline_events.length > 0) {
          const lastEvent = data.timeline_events[data.timeline_events.length - 1];
          if (lastEvent.event === "checkout") {
            setWorkStatus("completed");
          } else {
            setWorkStatus("working");
          }
        } else {
          setWorkStatus("idle");
        }
      } else {
        setWorkStatus("idle");
      }
    };

    fetchTodayStatus();
  }, [userId]);

  // 🌟 1. สร้างฟังก์ชันตรวจสอบ Location ก่อนทำรายการ
  const validateLocation = () => {
    if (workType === "on_site") return true; // ทำงานนอกสถานที่ ไม่ต้องเช็ค GPS โรงงาน
    
    if (locationStatus === "checking") {
      alert("ระบบกำลังตรวจสอบพิกัด GPS โปรดรอสักครู่...");
      return false;
    }
    
    if (locationStatus !== "in_range") {
      alert("ไม่สามารถ Check-in / Check-out ได้ เนื่องจากคุณอยู่นอกพื้นที่โรงงาน");
      return false;
    }
    
    return true; // ถ้าอยู่ในระยะ ให้ผ่านได้
  };

  const handleCheckIn = async () => {
    if (!userId) return;

    // 🌟 2. เรียกใช้การตรวจสอบก่อนทำงาน Check-in
    if (!validateLocation()) return;

    setIsSubmitting(true);

    const today = getLocalToday();
    const now = new Date().toISOString(); 

    const newEvent = {
      event: workType === "in_factory" ? "arrive_factory" : "arrive_site",
      timestamp: now,
      work_type: workType,
    };

    const { data: existingLog } = await supabase
      .from("daily_time_logs")
      .select("timeline_events, first_check_in")
      .eq("user_id", userId)
      .eq("log_date", today)
      .single();

    if (existingLog) {
      const updatedTimeline = [...existingLog.timeline_events, newEvent];
      const { error } = await supabase.from("daily_time_logs")
        .update({ timeline_events: updatedTimeline })
        .eq("user_id", userId)
        .eq("log_date", today);

      if (!error) {
        setRawCheckIn(existingLog?.first_check_in || now);
        setCheckInTime(new Date(existingLog.first_check_in || now).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }));
        setWorkStatus("working");
      }
    } else {
      const { error } = await supabase.from("daily_time_logs")
        .insert([{
          user_id: userId,
          log_date: today,
          work_type: workType,
          first_check_in: now,
          timeline_events: [newEvent]
        }]);

      if (!error) {
        setCheckInTime(new Date(now).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }));
        setWorkStatus("working");
      }
    }
    
    setIsSubmitting(false);
  };

  const handleCheckOut = async () => {
    if (!userId) return;

    // 🌟 3. เรียกใช้การตรวจสอบก่อนทำงาน Check-out
    if (!validateLocation()) return;

    setIsSubmitting(true);

    const today = getLocalToday();
    const now = new Date().toISOString();

    const newEvent = { event: "checkout", timestamp: now, note: "เลิกงาน" };

    const { data: existingLog } = await supabase.from("daily_time_logs")
      .select("timeline_events")
      .eq("user_id", userId)
      .eq("log_date", today)
      .single();

    if (existingLog) {
      const updatedTimeline = [...existingLog.timeline_events, newEvent];
      const { error } = await supabase.from("daily_time_logs")
        .update({ 
          timeline_events: updatedTimeline,
          last_check_out: now,
          status: "completed"
        })
        .eq("user_id", userId)
        .eq("log_date", today);

      if (!error) {
        setRawCheckOut(now);
        setCheckOutTime(new Date(now).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }));
        setWorkStatus("completed");
      }
    }
    
    setIsSubmitting(false);
  };

  return (
    <main className="p-4 md:p-6 pb-24 space-y-6 w-full">
      {/* 1. Header */}
      <div className="flex justify-between items-center relative gap-4">
        <div className="overflow-hidden">
          <p className="text-gray-500">TimeTracker System</p>
          <h2 className="text-xl md:text-2xl font-bold truncate text-sky-700">
            {userEmail || "ผู้ใช้งาน"}
          </h2>
        </div>
        <div><LogoutButton /></div>
      </div>

      {/* 2. Action Button Card */}
      <div className="card text-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[380px]">
        <p className="text-gray-400 text-sm">Current Time</p>
        <p className="text-5xl font-bold my-4">{currentTime}</p>

        {workStatus === "loading" && (
          <div className="w-48 h-48 bg-gray-50 text-gray-400 rounded-full flex flex-col items-center justify-center mx-auto shadow-inner animate-pulse border-4 border-gray-100">
            <span className="text-sm font-medium mt-2">กำลังโหลด...</span>
          </div>
        )}

        {/* 🌟 4. แก้ไขปุ่ม Check-in ให้มีสีปกติเสมอ (ยกเว้นตอนกดให้ขึ้นหมุนๆ) */}
        {workStatus === "idle" && (
          <button 
            onClick={handleCheckIn} 
            disabled={isSubmitting} // เอาตัวแปร isCheckInDisabled ออก
            className={`w-48 h-48 rounded-full flex flex-col items-center justify-center mx-auto shadow-lg transition-all duration-300 
              ${isSubmitting ? "bg-sky-400 text-white opacity-80 cursor-wait" : "bg-sky-400 text-white hover:bg-sky-500 checkin-btn-anim"}
            `}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-12 w-12 text-white mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-xl font-semibold mt-2">กำลังบันทึก...</span>
              </>
            ) : (
              <>
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                <span className="text-2xl font-semibold mt-2">Check In</span>
              </>
            )}
          </button>
        )}

        {/* 🌟 5. ปุ่ม Check-out มีสีแดงเสมอเหมือนเดิม */}
        {workStatus === "working" && (
          <button 
            onClick={handleCheckOut} 
            disabled={isSubmitting}
            className={`w-48 h-48 rounded-full flex flex-col items-center justify-center mx-auto shadow-lg transition-all duration-300 
              ${isSubmitting ? "bg-red-500 text-white opacity-80 cursor-wait" : "bg-red-500 text-white hover:bg-red-600 checkout-btn-anim"}
            `}
          >
             {isSubmitting ? (
              <>
                <svg className="animate-spin h-12 w-12 text-white mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-xl font-semibold mt-2">กำลังบันทึก...</span>
              </>
            ) : (
              <>
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                </svg>
                <span className="text-2xl font-semibold mt-2">Check Out</span>
              </>
            )}
          </button>
        )}

        {/* 🌟 3. อัปเดตส่วน Completed ให้มีปุ่ม Request OT อยู่ด้วย */}
        {workStatus === "completed" && (
          <div className="animate-fade-in flex flex-col items-center">
            <div className="w-48 h-48 bg-emerald-500 text-white rounded-full flex flex-col items-center justify-center shadow-lg">
              <svg className="w-16 h-16 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path>
              </svg>
              <span className="text-2xl font-bold mt-1">Complete</span>
            </div>

            {/* ปุ่ม Request OT ย้ายมาอยู่ตรงนี้ */}
            <button 
              onClick={() => setIsOTModalOpen(true)}
              className="w-full max-w-xs mt-6 py-3 bg-transparent border-2 border-sky-500 text-sky-600 rounded-xl font-semibold hover:bg-sky-500 hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
              <span>Request OT</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Work Type & Location Settings */}
      <div className="card space-y-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h3 className="font-semibold mb-3">Work Type</h3>
          <div className="flex bg-gray-100 rounded-xl p-1">
            <button 
              onClick={() => setWorkType("in_factory")}
              className={`flex-1 p-2 rounded-lg transition-all ${workType === "in_factory" ? "bg-sky-500 text-white shadow" : "text-gray-600"}`}
            >
              Factory
            </button>
            <button 
              onClick={() => setWorkType("on_site")}
              className={`flex-1 p-2 rounded-lg transition-all ${workType === "on_site" ? "bg-sky-500 text-white shadow" : "text-gray-600"}`}
            >
              On-site
            </button>
          </div>
        </div>

        {/* ส่วน on_site เหมือนเดิม... */}
        {workType === "on_site" && (
          <div className="pt-4 border-t border-gray-100 space-y-4 animate-fade-in">
             <h3 className="font-semibold text-center mb-2 text-gray-700">Select Your Role</h3>
            <div className="flex gap-3">
              <button 
                onClick={() => setOnSiteRole("member")}
                className={`flex-1 py-3 border-2 rounded-xl font-bold transition-all ${onSiteRole === "member" ? "border-sky-500 text-sky-600 bg-sky-50" : "border-gray-300 text-gray-500 bg-white"}`}
              >
                Scan QR <br/><span className="text-xs font-normal">(Member)</span>
              </button>
              <button 
                onClick={() => setOnSiteRole("leader")}
                className={`flex-1 py-3 border-2 rounded-xl font-bold transition-all ${onSiteRole === "leader" ? "border-sky-500 text-sky-600 bg-sky-50" : "border-gray-300 text-gray-500 bg-white"}`}
              >
                Create Room <br/><span className="text-xs font-normal">(Leader)</span>
              </button>
            </div>

            {onSiteRole === "member" && (
              <div className="space-y-3">
                <button className="w-full bg-sky-500 text-white rounded-lg py-3 flex items-center justify-center gap-2 hover:bg-sky-600 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>
                  </svg>
                  Open Camera to Scan QR
                </button>
              </div>
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

        {workType === "in_factory" && (
          <div className="pt-4 border-t border-gray-100">
            <h3 className="font-semibold mb-3">Location Status</h3>
            <div className={`flex items-center p-3 rounded-xl ${
              locationStatus === "in_range" ? "bg-emerald-50 text-emerald-700" :
              locationStatus === "out_of_range" ? "bg-red-50 text-red-700" :
              locationStatus === "error" ? "bg-orange-50 text-orange-700" :
              "bg-gray-100 text-gray-700"
            }`}>
              <svg className="w-6 h-6 mr-3 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              <div className="flex flex-col">
                <span className="font-medium text-sm">{distanceText}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Daily Summary */}
      <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="font-semibold mb-4 text-gray-800">Daily Summary</h3>
        <div className="space-y-4 text-sm">
          {/* ข้อมูลเวลาเข้า-ออก */}
          <div className="flex justify-between items-center pb-3 border-b border-gray-100">
            <span className="text-gray-500">เวลาเข้างาน (Check-in):</span>
            <span className="font-bold text-sky-600 bg-sky-50 px-3 py-1 rounded-lg">{checkInTime}</span>
          </div>
          <div className="flex justify-between items-center pb-3 border-b border-gray-100">
            <span className="text-gray-500">เวลาออกงาน (Check-out):</span>
            <span className="font-bold text-red-500 bg-red-50 px-3 py-1 rounded-lg">{checkOutTime}</span>
          </div>
          
          {/* 🌟 แสดงผลการคำนวณชั่วโมงทำงาน และ OT */}
          <div className="flex justify-between items-center">
            <span className="text-gray-500">ชั่วโมงทำงานปกติ:</span>
            <span className="font-medium text-gray-800">
              {workSummary.normal > 0 ? `${workSummary.normal} ชม.` : "-"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">ล่วงเวลา (OT):</span>
            <span className="font-medium text-emerald-600">
              {workSummary.ot > 0 ? `${workSummary.ot} ชม.` : "-"}
            </span>
          </div>
        </div>
      </div>

      {/* 🛠️ Debug Tools สำหรับทดสอบ (อย่าลืมลบออกตอนเอาขึ้น Production) */}
      <div className="card bg-yellow-50 p-4 rounded-xl border border-yellow-200 mt-6">
        <h4 className="font-bold text-yellow-700 mb-3 text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
          Debug: จำลองเวลาเข้า-ออกงาน
        </h4>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => {
              const d = new Date();
              setRawCheckIn(new Date(d.setHours(8, 30, 0, 0)).toISOString());
              setRawCheckOut(new Date(d.setHours(17, 30, 0, 0)).toISOString());
            }}
            className="text-xs bg-white border border-yellow-400 text-yellow-700 px-3 py-2 rounded-lg hover:bg-yellow-100 transition-colors"
          >
            ทำงานปกติ (08:30 - 17:30)
          </button>
          
          <button 
            onClick={() => {
              const d = new Date();
              setRawCheckIn(new Date(d.setHours(8, 30, 0, 0)).toISOString());
              setRawCheckOut(new Date(d.setHours(20, 0, 0, 0)).toISOString());
            }}
            className="text-xs bg-white border border-yellow-400 text-yellow-700 px-3 py-2 rounded-lg hover:bg-yellow-100 transition-colors"
          >
            มี OT 2 ชม. (08:30 - 20:00)
          </button>

          <button 
            onClick={() => {
              const d = new Date();
              setRawCheckIn(new Date(d.setHours(9, 30, 0, 0)).toISOString());
              setRawCheckOut(new Date(d.setHours(18, 45, 0, 0)).toISOString());
            }}
            className="text-xs bg-white border border-yellow-400 text-yellow-700 px-3 py-2 rounded-lg hover:bg-yellow-100 transition-colors"
          >
            มาสาย + OT ครึ่งชม. (09:30 - 18:45)
          </button>

          <button 
            onClick={() => {
              const d = new Date();
              setRawCheckIn(new Date(d.setHours(8, 30, 0, 0)).toISOString());
              setRawCheckOut(new Date(d.setHours(12, 0, 0, 0)).toISOString());
            }}
            className="text-xs bg-white border border-yellow-400 text-yellow-700 px-3 py-2 rounded-lg hover:bg-yellow-100 transition-colors"
          >
            ทำครึ่งวันเช้า (08:30 - 12:00)
          </button>
        </div>
      </div>

            {isOTModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-sky-700">Request OT</h3>
              <button onClick={() => setIsOTModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <form onSubmit={handleOTSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">วันที่ทำ OT</label>
                <input 
                  type="date" 
                  required 
                  className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500" 
                  value={otForm.date} 
                  onChange={e => setOtForm({...otForm, date: e.target.value})} 
                />
              </div>
              
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">เวลาเริ่มต้น</label>
                  <input 
                    type="time" 
                    required 
                    className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500" 
                    value={otForm.startTime} 
                    onChange={e => setOtForm({...otForm, startTime: e.target.value})} 
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">เวลาสิ้นสุด</label>
                  <input 
                    type="time" 
                    required 
                    className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500" 
                    value={otForm.endTime} 
                    onChange={e => setOtForm({...otForm, endTime: e.target.value})} 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียดงานที่ทำ</label>
                <textarea 
                  required 
                  rows={3} 
                  placeholder="เช่น ประกอบตู้คอนโทรล, ซ่อมบำรุงเครื่องจักร..." 
                  className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 resize-none" 
                  value={otForm.task} 
                  onChange={e => setOtForm({...otForm, task: e.target.value})}
                ></textarea>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsOTModalOpen(false)} 
                  className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 font-semibold hover:bg-gray-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 rounded-xl bg-sky-500 text-white font-semibold hover:bg-sky-600 transition-colors shadow-md"
                >
                  ส่งคำขอ OT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
    </main>
  );
}