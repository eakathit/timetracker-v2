// src/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: { headers: request.headers },
  });

  const url = request.nextUrl.clone();

  // ── Public routes — ไม่ต้องการ auth เลย → return ทันที ──────────────────
  // สำคัญ: ออกก่อนสร้าง Supabase client เพื่อไม่ให้เรียก getUser() โดยไม่จำเป็น
  const isQRTokenAPI        = url.pathname === "/api/qr-token";
  const isRecentCheckinsAPI = url.pathname === "/api/recent-checkins";
  const isCronRoute         = url.pathname.startsWith("/api/cron/");
  const isAuthCallback      = url.pathname.startsWith("/auth/callback");

  if (isQRTokenAPI || isRecentCheckinsAPI || isCronRoute || isAuthCallback) {
    return supabaseResponse;
  }

  // ── สร้าง Supabase client (ยังไม่มี network call ตรงนี้) ─────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // ── getUser() — network call เกิดตรงนี้ เฉพาะ route ที่ต้องการ auth ─────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = url.pathname === "/login";

  if (!user && !isLoginPage) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // ── Admin-only paths — รวม /qr-display ไว้ในก้อนเดียว (1 DB query) ───────
  const ADMIN_ONLY_PATHS = ["/settings", "/audit", "/team", "/hr", "/qr-display"];

  if (user && ADMIN_ONLY_PATHS.some((p) => url.pathname.startsWith(p))) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "admin") {
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // ยกเว้น static files, _next, PWA files, และ auth/callback
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest.json|sw.js|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};