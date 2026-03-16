// src/app/api/factory-checkin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { validateQRToken } from "@/lib/qr-token";

function getLocalToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, loc } = body as { token: string; loc: string };

    // ── 1. Validate QR token ────────────────────────────────────────────────
    if (!token || !loc) {
      return NextResponse.json({ error: "token และ loc จำเป็น" }, { status: 400 });
    }
    if (!validateQRToken(token, loc)) {
      return NextResponse.json({ error: "QR Code หมดอายุแล้ว กรุณาสแกนใหม่" }, { status: 401 });
    }

    // ── 2. ตรวจสอบ Auth ────────────────────────────────────────────────────
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
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
    }

    const today = getLocalToday();
    const now   = new Date().toISOString();

    // ── 3. ตรวจสอบว่า check-in ซ้ำไหม ────────────────────────────────────
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

    // ── 4. คำนวณ status & day info ─────────────────────────────────────────
    const checkInDate  = new Date(now);
    const lateThreshold = new Date(checkInDate);
    lateThreshold.setHours(8, 30, 0, 0);
    const attendanceStatus = checkInDate > lateThreshold ? "late" : "on_time";

    // ── 5. บันทึก daily_time_logs ──────────────────────────────────────────
    const newEvent = {
      event:     "arrive_factory",
      timestamp: now,
      method:    "qr_scan",
      location:  loc,
    };

    if (existing) {
      // row มีแต่ยังไม่ check-in (edge case)
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