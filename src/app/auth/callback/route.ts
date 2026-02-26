import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // ดึงค่า next ออกมา (ถ้าไม่มีให้ใช้ค่าเริ่มต้นเป็น /)
  const next = searchParams.get('next') ?? '/'; 

  if (code) {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.delete({ name, ...options });
          },
        },
      }
    );
    
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // เมื่อ Login เสร็จ ให้ Redirect ไปที่ origin + next path
      // เช่น ถ้า next คือ /report ก็จะเด้งไป http://localhost:3000/report
      return NextResponse.redirect(`${origin}${next}`);
    } else {
      // ล็อกเก็บ Error ไว้ดูหลังบ้าน เผื่อมีปัญหาตั้งค่า Supabase
      console.error('Supabase Auth Error:', error.message);
    }
  }

  // หากไม่มี code หรือมี Error จาก Supabase ให้กลับไปหน้า login พร้อมแจ้งเตือน
  return NextResponse.redirect(`${origin}/login?error=auth-failed`);
}