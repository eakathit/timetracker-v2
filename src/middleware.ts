// src/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: { headers: request.headers },
  });

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const isLoginPage = url.pathname === "/login";
  const isAuthCallback = url.pathname.startsWith("/auth/callback");
  const isCronRoute = url.pathname.startsWith("/api/cron/");
  const isQRDisplay = url.pathname === "/qr-display";
  const isQRTokenAPI = url.pathname === "/api/qr-token";
  const isRecentCheckinsAPI = url.pathname === "/api/recent-checkins";
  // แล้วเพิ่มเข้า isPublicPage:
  const isPublicPage =
    isLoginPage ||
    isAuthCallback ||
    isCronRoute ||
    isQRTokenAPI ||
    isRecentCheckinsAPI;

  if (!user && !isPublicPage) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (user && url.pathname.startsWith("/settings")) {
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

  // ✅ เพิ่มใหม่ — qr-display เฉพาะ admin เท่านั้น
  if (user && isQRDisplay) {
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
