// src/app/api/factory-checkin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { validateQRToken } from "@/lib/qr-token";

// Service role สำหรับ consume nonce (ต้องการ bypass RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getLocalToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, loc, nonce } = body as {
      token: string;
      loc:   string;
      nonce: string; // ← ใหม่
    };

    // ── 1. Basic validation ────────────────────────────────────────────────
if (!token || !loc || !nonce) {
  return NextResponse.json(
    { error: "token, loc และ nonce จำเป็น" },
    { status: 400 }
  );
}

// ── 2. ตรวจ HMAC token (time window) ──────────────────────────────────
if (!validateQRToken(token, loc)) {
  return NextResponse.json(
    { error: "QR Code หมดอายุแล้ว กรุณาสแกนใหม่" },
    { status: 401 }
  );
}

// ── 3. ตรวจสอบ Auth ────────────────────────────────────────────────────
const cookieStore = await cookies();
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {}
      },
    },
  }
);

const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) {
  return NextResponse.json(
    { error: "กรุณาเข้าสู่ระบบก่อน" },
    { status: 401 }
  );
}

// ── 4. ตรวจและ consume nonce (per user) ───────────────────────────────
// ต้องอยู่หลัง auth เพราะต้องใช้ user.id
const { error: nonceError } = await supabaseAdmin
  .from("qr_nonces")
  .insert({
    nonce:       nonce,
    user_id:     user.id,
    location_id: loc,
    used_at:     new Date().toISOString(),
  });

if (nonceError) {
  if (nonceError.code === "23505") {
    return NextResponse.json(
      { error: "QR Code นี้ถูกใช้งานไปแล้ว กรุณาสแกน QR ใหม่บนหน้าจอ" },
      { status: 409 }
    );
  }
  console.error("[factory-checkin] nonce insert error:", nonceError);
  return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
}

    // ── 5. Mark nonce as used (atomic — WHERE used_at IS NULL) ────────────
    // ใช้ .is("used_at", null) ป้องกัน race condition กรณี 2 คน scan พร้อมกัน
    const { data: updated } = await supabaseAdmin
  .from("qr_nonces")
  .update({ used_at: new Date().toISOString(), used_by: user.id })
  .eq("nonce", nonce)
  .is("used_at", null)
  .select("nonce");  // คืน rows ที่ถูก update กลับมา

if (!updated || updated.length === 0) {
  return NextResponse.json(
    { error: "QR Code นี้ถูกใช้งานไปแล้ว กรุณาสแกน QR ใหม่บนหน้าจอ" },
    { status: 409 }
  );
}

    // ── 6. ตรวจสอบว่า check-in ซ้ำไหม ────────────────────────────────────
    const today = getLocalToday();
    const now   = new Date().toISOString();

    const { data: existing } = await supabase
      .from("daily_time_logs")
      .select("id, first_check_in")
      .eq("user_id", user.id)
      .eq("log_date", today)
      .maybeSingle();

    if (existing?.first_check_in) {
      return NextResponse.json(
        { error: "คุณ Check-in วันนี้ไปแล้ว" },
        { status: 409 }
      );
    }

    // ── 7. คำนวณ status ────────────────────────────────────────────────────
    const checkInBangkok = new Date(
      new Date(now).toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
    );
    const lateThreshold = new Date(checkInBangkok);
    lateThreshold.setHours(8, 30, 0, 0);
    const attendanceStatus = checkInBangkok > lateThreshold ? "late" : "on_time";

    // ── 8. บันทึก daily_time_logs ──────────────────────────────────────────
    const newEvent = {
      event:     "arrive_factory",
      timestamp: now,
      method:    "qr_scan",
      location:  loc,
    };

    if (existing) {
      await supabase
        .from("daily_time_logs")
        .update({
          first_check_in:  now,
          status:          attendanceStatus,
          work_type:       "in_factory",
          timeline_events: [newEvent],
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("daily_time_logs").insert({
        user_id:         user.id,
        log_date:        today,
        work_type:       "in_factory",
        first_check_in:  now,
        status:          attendanceStatus,
        timeline_events: [newEvent],
      });
    }

    return NextResponse.json({ success: true, checkin_at: now });
  } catch (err) {
    console.error("[factory-checkin]", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
