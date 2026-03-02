// src/app/(dashboard)/report/page.tsx
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import DailyReportForm from "@/components/DailyReportForm";

export default async function ReportPage() {
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

  // ดึงข้อมูล User และ Master Data ทั้งหมดแบบขนาน (Parallel) เพื่อความรวดเร็ว
  const [{ data: { user } }, uRes, pRes, dRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('end_users').select('*'),
    supabase.from('projects').select('*'),
    supabase.from('work_details').select('*')
  ]);

  return (
    <main className="min-h-screen bg-gray-50 pb-28 md:pb-10">
      <DailyReportForm 
        userId={user?.id || null}
        initialEndUsers={uRes.data || []}
        initialProjects={pRes.data || []}
        initialDetails={dRes.data || []}
      />
    </main>
  );
}