"use client";

import { useState, useEffect } from "react";

export default function Home() {
  // 1. สร้างตัวแปร State ควบคุมหน้าจอ
  const [currentTime, setCurrentTime] = useState("00:00:00");
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [workType, setWorkType] = useState<"in_factory" | "on_site">("in_factory");
  const [onSiteRole, setOnSiteRole] = useState<"member" | "leader">("member");

  // 2. ให้นาฬิกาเดินแบบ Real-time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("en-GB"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="p-4 md:p-6 pb-24 space-y-6 w-full">
      
      {/* 1. Header Section */}
      <div className="flex justify-between items-center relative">
        <div>
          <p className="text-gray-500">TimeTracker System</p>
          <h2 className="text-2xl font-bold">ช่างวิทย์ (รหัส 1055)</h2>
        </div>
      </div>

      {/* 2. Current Time & Action Button Card */}
      <div className="card text-center">
        <p className="text-gray-400 text-sm">Current Time</p>
        <p className="text-5xl font-bold my-4">{currentTime}</p>

        {!isCheckedIn ? (
          <button 
            onClick={() => setIsCheckedIn(true)}
            className="w-48 h-48 bg-sky-400 text-white rounded-full flex flex-col items-center justify-center mx-auto shadow-lg hover:bg-sky-500 transition-all duration-300 checkin-btn-anim"
          >
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            <span className="text-2xl font-semibold mt-2">Check In</span>
          </button>
        ) : (
          <button 
            onClick={() => setIsCheckedIn(false)}
            className="w-48 h-48 bg-red-500 text-white checkout-btn-anim rounded-full flex flex-col items-center justify-center mx-auto shadow-lg hover:bg-red-600 transition-all duration-300"
          >
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
            </svg>
            <span className="text-2xl font-semibold mt-2">Check Out</span>
          </button>
        )}

        {/* ปุ่มขอ OT โชว์ตอนเข้างานแล้ว */}
        {isCheckedIn && (
          <button className="w-full max-w-xs mt-6 py-3 bg-transparent border-2 border-sky-500 text-sky-600 rounded-lg font-semibold hover:bg-sky-500 hover:text-white transition-all">
            <svg className="w-6 h-6 inline-block -mt-1 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
            <span>Request OT</span>
          </button>
        )}
      </div>

      {/* 3. Work Type & Location Settings */}
      <div className="card space-y-4">
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

        {/* โชว์เฉพาะตอนเลือก On-site */}
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

            {/* Member View */}
            {onSiteRole === "member" && (
              <div className="space-y-3">
                <button className="w-full btn-primary py-3 flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>
                  </svg>
                  Open Camera to Scan QR
                </button>
              </div>
            )}

            {/* Leader View */}
            {onSiteRole === "leader" && (
              <div className="space-y-3">
                <input type="text" placeholder="Project Name / Project No." className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:border-sky-400" />
                <input type="text" placeholder="Location" className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:border-sky-400" />
                <button className="w-full btn-primary py-3">Create Check-in Room</button>
              </div>
            )}
          </div>
        )}

        <div className="pt-4 border-t border-gray-100">
          <h3 className="font-semibold mb-3">Location Status</h3>
          <div className="flex items-center p-3 rounded-xl bg-gray-100 text-gray-700">
            <svg className="w-6 h-6 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            <span className="font-medium text-sm">Verifying location...</span>
          </div>
        </div>
      </div>

      {/* 4. Daily Summary */}
      <div className="card">
        <h3 className="font-semibold mb-3">Daily Summary</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Check-in:</span>
            <span className="font-medium text-gray-800">{isCheckedIn ? "08:00" : "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Check-out:</span>
            <span className="font-medium text-gray-800">-</span>
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