import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import DashboardUI from "@/components/DashboardUI";

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

// ดึง first_name + last_name จาก profiles
const { data: profile } = await supabase
  .from("profiles")
  .select("first_name, last_name, role")
  .eq("id", user.id)
  .maybeSingle();

const userName = [profile?.first_name, profile?.last_name]
  .filter(Boolean)
  .join(" ") || undefined;

return <DashboardUI userEmail={user.email} userId={user.id} userName={userName} userRole={profile?.role} />;}