"use client";

import { useState, useEffect } from "react";
import LogoutButton from "@/components/LogoutButton";
import { supabase } from "@/lib/supabase";

interface DashboardUIProps {
  userEmail: string | undefined;
  userId: string;
}

// 🌟 แก้ปัญหา Timezone: ฟังก์ชันนี้จะดึง "วันที่ของไทย" เสมอ (YYYY-MM-DD)
const getLocalToday = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function DashboardUI({ userEmail, userId }: DashboardUIProps) {
  // 1. ควบคุมนาฬิกา (เริ่มด้วยค่าว่างเพื่อป้องกัน UI กระตุกตอนโหลด)
  const [currentTime, setCurrentTime] = useState("");
  
  // 2. 🌟 เปลี่ยนจาก boolean เป็น Status 4 ระดับ
  const [workStatus, setWorkStatus] = useState<"loading" | "idle" | "working" | "completed">("loading");
  
  // 3. 🌟 ตัวแปรเก็บเวลาจริงเพื่อเอาไปโชว์ใน Daily Summary
  const [checkInTime, setCheckInTime] = useState<string>("-");
  const [checkOutTime, setCheckOutTime] = useState<string>("-");

  const [workType, setWorkType] = useState<"in_factory" | "on_site">("in_factory");
  const [onSiteRole, setOnSiteRole] = useState<"member" | "leader">("member");

  // --- นาฬิกา Real-time ---
  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString("en-GB")); // อัปเดตทันทีที่โหลด
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("en-GB"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // --- โหลดข้อมูลจาก Database ทันทีที่เข้าเว็บ (ยึดตามความเป็นจริง) ---
  useEffect(() => {
    const fetchTodayStatus = async () => {
      if (!userId) return;

      const today = getLocalToday(); // ใช้วันที่ไทย
      
      const { data, error } = await supabase
        .from("daily_time_logs")
        .select("timeline_events, first_check_in, last_check_out")
        .eq("user_id", userId)
        .eq("log_date", today)
        .single();

      if (data) {
        // ดึงเวลามาแสดงในช่อง Summary
        if (data.first_check_in) {
          setCheckInTime(new Date(data.first_check_in).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }));
        }
        if (data.last_check_out) {
          setCheckOutTime(new Date(data.last_check_out).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }));
        }

        // เช็คว่ากดเลิกงานหรือยัง
        if (data.timeline_events && data.timeline_events.length > 0) {
          const lastEvent = data.timeline_events[data.timeline_events.length - 1];
          if (lastEvent.event === "checkout") {
            setWorkStatus("completed"); // โชว์ปุ่ม Complete
          } else {
            setWorkStatus("working"); // โชว์ปุ่ม Check Out
          }
        } else {
          setWorkStatus("idle"); // โชว์ปุ่ม Check In
        }
      } else {
        setWorkStatus("idle"); // ไม่มีประวัติเลย = โชว์ปุ่ม Check In
      }
    };

    fetchTodayStatus();
  }, [userId]);

  // --- บันทึกเวลาเข้างาน ---
  const handleCheckIn = async () => {
    if (!userId) return;

    setWorkStatus("loading"); 
    const today = getLocalToday();
    const now = new Date().toISOString(); // Database ชอบเวลาแบบ UTC เราส่งไปตามนี้ถูกต้องแล้ว

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
      // ต่อท้าย Timeline เดิม
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
      // สร้างแถวใหม่
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
  };

  // --- บันทึกเวลาเลิกงาน ---
  const handleCheckOut = async () => {
    if (!userId) return;

    setWorkStatus("loading");
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
        setWorkStatus("completed"); // เด้งไปโชว์ปุ่ม Complete
      }
    }
  };
  
  return (
    <main className="p-4 md:p-6 pb-24 space-y-6 w-full">
      {/* 1. Header Section */}
      <div className="flex justify-between items-center relative gap-4">
        <div className="overflow-hidden">
          <p className="text-gray-500">TimeTracker System</p>
          <h2 className="text-xl md:text-2xl font-bold truncate text-sky-700">
            {userEmail || "ผู้ใช้งาน"}
          </h2>
        </div>
        <div><LogoutButton /></div>
      </div>

      {/* 2. Current Time & Action Button Card */}
      <div className="card text-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[380px]">
        <p className="text-gray-400 text-sm">Current Time</p>
        <p className="text-5xl font-bold my-4">{currentTime}</p>

        {/* 🌟 แสดงปุ่มตามสถานะ (loading, idle, working, completed) */}
        {workStatus === "loading" && (
          <div className="w-48 h-48 bg-gray-100 text-gray-400 rounded-full flex flex-col items-center justify-center mx-auto shadow-inner animate-pulse">
            <span className="text-lg font-medium">กำลังประมวลผล...</span>
          </div>
        )}

        {workStatus === "idle" && (
          <button onClick={handleCheckIn} className="w-48 h-48 bg-sky-400 text-white rounded-full flex flex-col items-center justify-center mx-auto shadow-lg hover:bg-sky-500 transition-all duration-300 checkin-btn-anim">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            <span className="text-2xl font-semibold mt-2">Check In</span>
          </button>
        )}

        {workStatus === "working" && (
          <button onClick={handleCheckOut} className="w-48 h-48 bg-red-500 text-white checkout-btn-anim rounded-full flex flex-col items-center justify-center mx-auto shadow-lg hover:bg-red-600 transition-all duration-300">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
            </svg>
            <span className="text-2xl font-semibold mt-2">Check Out</span>
          </button>
        )}

        {workStatus === "completed" && (
          <div className="w-48 h-48 bg-emerald-500 text-white rounded-full flex flex-col items-center justify-center mx-auto shadow-lg">
            <svg className="w-16 h-16 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path>
            </svg>
            <span className="text-2xl font-bold mt-1">Complete</span>
            <span className="text-sm font-medium opacity-80">เลิกงานเรียบร้อย</span>
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

      {/* 3. Work Type Settings (ซ่อนถ้าเลิกงานแล้ว) */}
      {workStatus !== "completed" && (
        <div className="card space-y-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h3 className="font-semibold mb-3">Work Type</h3>
            <div className="flex bg-gray-100 rounded-xl p-1">
              <button onClick={() => setWorkType("in_factory")} className={`flex-1 p-2 rounded-lg transition-all ${workType === "in_factory" ? "bg-sky-500 text-white shadow" : "text-gray-600"}`}>Factory</button>
              <button onClick={() => setWorkType("on_site")} className={`flex-1 p-2 rounded-lg transition-all ${workType === "on_site" ? "bg-sky-500 text-white shadow" : "text-gray-600"}`}>On-site</button>
            </div>
          </div>
          {/* ... ส่วน On-site UI เดิมของคุณ ... */}
        </div>
      )}

      {/* 4. Daily Summary (โชว์เวลาเข้า-ออกจริงจาก DB) */}
      <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="font-semibold mb-3">Daily Summary</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Check-in:</span>
            {/* ดึงเวลาจริงมาโชว์ */}
            <span className="font-medium text-gray-800">{checkInTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Check-out:</span>
            {/* ดึงเวลาออกงานจริงมาโชว์ */}
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