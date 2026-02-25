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
      className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors shadow-sm"
    >
      ออกจากระบบ
    </button>
  );
}