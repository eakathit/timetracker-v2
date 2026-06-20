// src/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  DISPLAY_ACCESS_PARAM,
  hasValidDisplayAccess,
  redirectToCleanDisplayUrl,
  setDisplayAccessCookie,
} from "@/lib/display-access";
import { isAdminRole } from "@/lib/roles";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: { headers: request.headers },
  });

  const url = request.nextUrl.clone();

  // ── Public routes — ไม่ต้องการ auth เลย → return ทันที ──────────────────
  // สำคัญ: ออกก่อนสร้าง Supabase client เพื่อไม่ให้เรียก getUser() โดยไม่จำเป็น
  const isQRTokenAPI        = url.pathname === "/api/qr-token";
  const isRecentCheckinsAPI = url.pathname === "/api/recent-checkins";
  const isDisplayTodayStatusAPI = url.pathname === "/api/display-today-status";
  const isQRDisplayStatusAPI = url.pathname === "/api/qr-display-status";
  const isCronRoute         = url.pathname.startsWith("/api/cron/");
  const isAuthCallback      = url.pathname.startsWith("/auth/callback");
  const isPendingApprovalPage = url.pathname === "/pending-approval";
  const isAccessSuspendedPage = url.pathname === "/access-suspended";
  const isQRDisplayPage = url.pathname === "/qr-display";
  const isWorkStatusDisplayPage = url.pathname === "/work-status-display";
  const isQRDisplayInstallPage = url.pathname === "/qr-display-install";
  const isQRDisplayManifest = url.pathname === "/qr-display-manifest.webmanifest";

  if ((isQRDisplayPage || isWorkStatusDisplayPage) && hasValidDisplayAccess(request)) {
    if (url.searchParams.has(DISPLAY_ACCESS_PARAM)) {
      return redirectToCleanDisplayUrl(request);
    }
    return supabaseResponse;
  }

  if (
    isQRTokenAPI ||
    isRecentCheckinsAPI ||
    isDisplayTodayStatusAPI ||
    isQRDisplayStatusAPI ||
    isCronRoute ||
    isAuthCallback ||
    isQRDisplayInstallPage ||
    isQRDisplayManifest
  ) {
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

  if (!user) {
    return supabaseResponse;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, access_status")
    .eq("id", user.id)
    .maybeSingle();

  const accessStatus = profile?.access_status ?? "pending";

  if (accessStatus === "pending") {
    if (!isPendingApprovalPage) {
      url.pathname = "/pending-approval";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  if (accessStatus === "suspended") {
    if (!isAccessSuspendedPage) {
      url.pathname = "/access-suspended";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  if (isPendingApprovalPage || isAccessSuspendedPage) {
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (isLoginPage) {
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // ── Admin-only paths — รวม /qr-display ไว้ในก้อนเดียว (1 DB query) ───────
  const ADMIN_ONLY_PATHS = ["/settings", "/audit", "/team", "/hr", "/qr-display", "/work-status-display", "/work-status"];

  if (ADMIN_ONLY_PATHS.some((p) => url.pathname.startsWith(p))) {
    if (!profile || !isAdminRole(profile.role)) {
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    if (isQRDisplayPage || isWorkStatusDisplayPage) {
      setDisplayAccessCookie(supabaseResponse);
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
