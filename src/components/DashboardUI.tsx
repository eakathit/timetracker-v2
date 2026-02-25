"use client";

import { useState, useEffect } from "react";
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

export default function DashboardUI({ userEmail, userId }: DashboardUIProps) {
  const [currentTime, setCurrentTime] = useState("");
  
  const [workStatus, setWorkStatus] = useState<"loading" | "idle" | "working" | "completed">("loading");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [checkInTime, setCheckInTime] = useState<string>("-");
  const [checkOutTime, setCheckOutTime] = useState<string>("-");

  const [workType, setWorkType] = useState<"in_factory" | "on_site">("in_factory");
  const [onSiteRole, setOnSiteRole] = useState<"member" | "leader">("member");

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
          setCheckInTime(new Date(data.first_check_in).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }));
        }
        if (data.last_check_out) {
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

        {workStatus === "completed" && (
          <div className="w-48 h-48 bg-emerald-500 text-white rounded-full flex flex-col items-center justify-center mx-auto shadow-lg">
            <svg className="w-16 h-16 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path>
            </svg>
            <span className="text-2xl font-bold mt-1">Complete</span>
          </div>
        )}

        {workStatus === "working" && (
          <button className="w-full max-w-xs mt-6 py-3 bg-transparent border-2 border-sky-500 text-sky-600 rounded-lg font-semibold hover:bg-sky-500 hover:text-white transition-all mx-auto block">
            <svg className="w-6 h-6 inline-block -mt-1 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
            <span>Request OT</span>
          </button>
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
        <h3 className="font-semibold mb-3">Daily Summary</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Check-in:</span>
            <span className="font-medium text-gray-800">{checkInTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Check-out:</span>
            <span className="font-medium text-gray-800">{checkOutTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Working Hours:</span>
            <span className="font-medium text-gray-800">-</span>
          </div>
        </div>
      </div>
    </main>
  );
}