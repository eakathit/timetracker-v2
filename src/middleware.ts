// src/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // 1. สร้าง response ต้นแบบเตรียมไว้
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 2. สร้างตัวจัดการ Supabase Client สำหรับ Middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // อัปเดต Cookie ใน request
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // สร้าง response ใหม่ที่มี request อัปเดตแล้ว
          supabaseResponse = NextResponse.next({
            request,
          });
          // ฝัง Cookie ลงไปใน response ที่จะส่งกลับให้เบราว์เซอร์
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 3. ดึงข้อมูล User (คำสั่งนี้จะทำการ Refresh Token อัตโนมัติถ้าใกล้หมดอายุ)
  const { data: { user } } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  
  // 4. เช็คว่าผู้ใช้กำลังเข้าหน้าไหนอยู่
  const isLoginPage = url.pathname.startsWith('/login');
  const isAuthCallback = url.pathname.startsWith('/auth');
  const isPublicPage = isLoginPage || isAuthCallback;

  // กฎข้อที่ 1: ถ้ายัง "ไม่ล็อกอิน" และพยายามเข้า "หน้าทำงาน (Dashboard)"
  if (!user && !isPublicPage) {
    // เตะกลับไปหน้า Login อัตโนมัติ
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  
  // กฎข้อที่ 2: ถ้า "ล็อกอินแล้ว" แต่พยายามเข้า "หน้า Login" ซ้ำ
  if (user && isLoginPage) {
    // พาไปหน้าหลัก (Dashboard) แทน
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  if (user && url.pathname.startsWith('/settings')) {
    // ใช้ supabase client ตัวเดียวกับที่มีใน middleware
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      // ถ้าไม่มีสิทธิ์ เตะกลับไปหน้าแรก (Dashboard)
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  // 5. ปล่อยให้เข้าไปใช้งานหน้านั้นๆ ได้ตามปกติ พร้อมคืนค่า Cookie ที่อัปเดตแล้ว
  return supabaseResponse;
}

// 6. กำหนดเส้นทาง (Matcher) ว่าจะให้ยามคนนี้เฝ้าที่ประตูไหนบ้าง
export const config = {
  matcher: [
    /*
     * ตรวจสอบทุกเส้นทาง ยกเว้น:
     * - _next/static (ไฟล์สคริปต์ของ Next.js)
     * - _next/image (ไฟล์รูปภาพที่ Next.js จัดการ)
     * - favicon.ico (ไอคอนเว็บ)
     * - ไฟล์ PWA (manifest, sw) <<< เราเพิ่มตรงนี้
     * - ไฟล์นามสกุลรูปภาพต่างๆ
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};