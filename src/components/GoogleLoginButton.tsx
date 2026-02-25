"use client";

import { supabase } from "@/lib/supabase"; // เรียกใช้ client ที่เราสร้างไว้ใน lib

export default function GoogleLoginButton() {
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // กำหนดให้กลับมาที่หน้านี้หลังจาก Login สำเร็จ
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <button
      onClick={handleLogin}
      className="flex items-center justify-center gap-3 w-full max-w-xs mx-auto py-3 px-4 bg-white border border-gray-300 rounded-xl shadow-sm hover:bg-gray-50 transition-all font-medium text-gray-700"
    >
      <img
        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
        alt="Google"
        className="w-5 h-5"
      />
      เข้าสู่ระบบด้วย Google
    </button>
  );
}