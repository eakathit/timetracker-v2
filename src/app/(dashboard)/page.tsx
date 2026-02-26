import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import DashboardUI from "@/components/DashboardUI"; // ดึง Component ที่เราเพิ่งสร้างมาใช้

export default async function Home() {
  const cookieStore = await cookies();
  
  // สร้าง Supabase client ฝั่ง Server
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  // ดึงข้อมูล User ปัจจุบัน
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 👉 แก้ไขบรรทัดนี้: ส่ง userId={user.id} เพิ่มเข้าไป
  return <DashboardUI userEmail={user.email} userId={user.id} />;
}