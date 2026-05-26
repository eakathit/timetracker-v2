"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface LogoutButtonProps {
  compact?: boolean;
  className?: string;
}

export default function LogoutButton({
  compact = false,
  className = "",
}: LogoutButtonProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoggingOut}
      aria-label="ออกจากระบบ"
      title={compact ? "ออกจากระบบ" : undefined}
      className={`
        flex items-center justify-center gap-2 rounded-2xl border border-rose-100
        bg-rose-50 text-rose-500 font-bold hover:bg-rose-100
        disabled:cursor-not-allowed disabled:opacity-60 transition-colors
        ${compact ? "h-11 w-11 px-0" : "w-full px-4 py-3 text-sm"}
        ${className}
      `}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 flex-shrink-0"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      {!compact && (
        <span>{isLoggingOut ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}</span>
      )}
    </button>
  );
}
