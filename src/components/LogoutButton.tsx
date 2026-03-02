"use client";

import { supabase } from "@/lib/supabase"; // หรือ "@/app/lib/supabase" ขึ้นอยู่กับว่าคุณเลือกแก้ path แบบไหนในข้อที่แล้วนะครับ
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    // 1. สั่งให้ Supabase ล้างข้อมูล Session ออกจากระบบ
    await supabase.auth.signOut();
    
    // 2. Refresh ข้อมูลในหน้าเพื่อให้ Server รู้ว่าไม่มี Session แล้ว
    router.refresh();
    
    // 3. พาผู้ใช้กลับไปที่หน้า Login
    router.push("/login");
  };

  return (
    <button
    onClick={handleLogout}
    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl 
               bg-rose-50 text-rose-500 border border-rose-100 
               text-sm font-bold hover:bg-rose-100 transition-colors"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
    ออกจากระบบ
  </button>
  );
}