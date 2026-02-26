"use client";

import { useState, useEffect } from "react";

export default function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIOSInstruction, setShowIOSInstruction] = useState(false);

  useEffect(() => {
    // 1. เช็คว่าติดตั้งแอปไปแล้วหรือยัง (ถ้าติดตั้งแล้วซ่อนปุ่ม)
    const checkStandalone = () => {
      const isAlreadyInstalled = window.matchMedia("(display-mode: standalone)").matches || 
                                 ('standalone' in navigator && (navigator as any).standalone === true);
      setIsStandalone(isAlreadyInstalled);
    };
    checkStandalone();

    // 2. เช็คว่าเป็น iOS หรือไม่
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    // 3. ดักจับ Event สำหรับ Chrome / Android
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  // ถ้าติดตั้งไปแล้ว ไม่ต้องโชว์ปุ่มเลย
  if (isStandalone) {
    return null; 
  }

  // ฟังก์ชันเมื่อกดปุ่มติดตั้ง
  const handleInstallClick = async () => {
    if (isIOS) {
      // โชว์ Pop-up สอนวิธีติดตั้งบน iOS
      setShowIOSInstruction(true);
    } else if (deferredPrompt) {
      // เด้งหน้าต่างติดตั้งอัตโนมัติของ Android / PC
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      alert("เบราว์เซอร์ของคุณอาจไม่รองรับการติดตั้ง หรือคุณได้ติดตั้งไปแล้วครับ");
    }
  };

  return (
    <div className="flex flex-col items-center mt-6 w-full max-w-sm">
      <button
        onClick={handleInstallClick}
        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        ติดตั้งแอป Time Tracker
      </button>

      {/* Pop-up แจ้งเตือนสำหรับผู้ใช้ iOS */}
      {showIOSInstruction && (
        <div className="mt-4 p-4 bg-gray-100 text-gray-800 rounded-lg text-sm border border-gray-300 shadow-sm relative">
          <button 
            onClick={() => setShowIOSInstruction(false)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
          <p className="font-semibold mb-2">วิธีติดตั้งบน iOS (Safari):</p>
          <ol className="list-decimal pl-4 space-y-1">
            <li>กดที่ปุ่ม <b>Share</b> <span className="inline-block border p-1 rounded mx-1">↑</span> ด้านล่างของจอ</li>
            <li>เลื่อนลงมาแล้วเลือก <b>Add to Home Screen</b></li>
            <li>กดปุ่ม <b>Add</b> ที่มุมขวาบน</li>
          </ol>
        </div>
      )}
    </div>
  );
}