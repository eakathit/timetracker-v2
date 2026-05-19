import { NextResponse, type NextRequest } from "next/server";

export const DISPLAY_ACCESS_COOKIE = "tt_display_access";
export const DISPLAY_ACCESS_PARAM = "display_token";

const DISPLAY_ACCESS_TOKEN = process.env.QR_DISPLAY_ACCESS_TOKEN?.trim() ?? "";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

export function isDisplayAccessConfigured() {
  return DISPLAY_ACCESS_TOKEN.length > 0;
}

export function hasValidDisplayAccess(request: NextRequest) {
  if (!isDisplayAccessConfigured()) return false;

  const queryToken = request.nextUrl.searchParams.get(DISPLAY_ACCESS_PARAM);
  const cookieToken = request.cookies.get(DISPLAY_ACCESS_COOKIE)?.value;

  return queryToken === DISPLAY_ACCESS_TOKEN || cookieToken === DISPLAY_ACCESS_TOKEN;
}

export function setDisplayAccessCookie(response: NextResponse) {
  if (!isDisplayAccessConfigured()) return;

  response.cookies.set(DISPLAY_ACCESS_COOKIE, DISPLAY_ACCESS_TOKEN, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function redirectToCleanDisplayUrl(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.searchParams.delete(DISPLAY_ACCESS_PARAM);

  const response = NextResponse.redirect(url);
  setDisplayAccessCookie(response);
  return response;
}
