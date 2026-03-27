// src/app/api/factory-checkin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { validateQRToken } from "@/lib/qr-token";
import { getEffectiveThreshold, computeAttendanceStatus } from "@/lib/attendance";

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
      nonce: string;
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

    const today = getLocalToday();
    const now   = new Date().toISOString();

    // ── 4. เช็ค check-in ซ้ำก่อน (ก่อน consume nonce) ────────────────────
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

    // ── 5. Consume nonce (per user) — ทำหลังผ่านทุกเงื่อนไขแล้ว ──────────
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
        // unique (nonce + user_id) violation = คนนี้ scan QR นี้ไปแล้ว
        return NextResponse.json(
          { error: "QR Code นี้ถูกใช้งานไปแล้ว กรุณาสแกน QR ใหม่บนหน้าจอ" },
          { status: 409 }
        );
      }
      console.error("[factory-checkin] nonce insert error:", nonceError);
      return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
    }

    // ── 6. คำนวณ status (คำนึงถึงใบลาที่ approved) ────────────────────────
    const threshold = await getEffectiveThreshold(supabase, user.id, today);
    const attendanceStatus = computeAttendanceStatus(now, threshold);

    // ── 6.5. ตรวจ shift_type จาก holidays table ────────────────────────────
    const { data: holidayRecord } = await supabase
      .from("holidays")
      .select("is_workday")
      .eq("date", today)
      .maybeSingle();

    let shiftType: "regular" | "holiday";
    if (holidayRecord) {
      shiftType = holidayRecord.is_workday ? "regular" : "holiday";
    } else {
      const dayOfWeek = new Date(today).getDay(); // 0 = Sun, 6 = Sat
      shiftType = dayOfWeek === 0 || dayOfWeek === 6 ? "holiday" : "regular";
    }
    const dayoffCredit = shiftType === "holiday" ? "pending" : null;

    // ── 7. บันทึก daily_time_logs ──────────────────────────────────────────
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
          shift_type:      shiftType,
          dayoff_credit:   dayoffCredit,
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
        shift_type:      shiftType,
        dayoff_credit:   dayoffCredit,
        timeline_events: [newEvent],
      });
    }

    return NextResponse.json({ success: true, checkin_at: now });
  } catch (err) {
    console.error("[factory-checkin]", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}