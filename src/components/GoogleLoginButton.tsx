"use client";

import { supabase } from "@/lib/supabase";

export default function GoogleLoginButton() {
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // บังคับใช้ PKCE flow (ต้องตรงกับ route handler ที่ใช้ exchangeCodeForSession)
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      console.error("[GoogleLogin] OAuth error:", error.message);
    }
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