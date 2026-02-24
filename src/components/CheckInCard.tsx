// components/CheckInCard.tsx
"use client";

import { useState, useEffect } from "react";

export default function CheckInCard() {
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("th-TH"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCheckIn = () => {
    alert("บันทึกเวลาเข้างานเรียบร้อยแล้ว!");
    // เดี๋ยวเราจะเอาฟังก์ชันเชื่อม Database มาใส่ตรงนี้
  };

  return (
    <div className="bg-white rounded-3xl p-8 shadow-xl text-center w-full max-w-md">
      <div className="mb-6 p-4 rounded-xl shadow-inner bg-gray-50 border border-gray-100">
        <p className="text-sm text-gray-400 mb-1">เวลาปัจจุบัน</p>
        <p className="text-4xl font-bold text-gray-800 tracking-wider">
          {currentTime || "กำลังโหลด..."}
        </p>
      </div>

      <button 
        onClick={handleCheckIn}
        className="w-48 h-48 bg-sky-500 hover:bg-sky-600 text-white rounded-full flex flex-col items-center justify-center mx-auto shadow-[0_10px_20px_rgba(14,165,233,0.3)] transition-all active:scale-95"
      >
        <svg className="w-14 h-14 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path>
        </svg>
        <span className="text-2xl font-bold">เข้างาน</span>
      </button>
    </div>
  );
}