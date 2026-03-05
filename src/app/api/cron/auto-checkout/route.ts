// src/app/api/cron/auto-checkout/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Vercel Cron Job: ทุกวันจันทร์-ศุกร์ เวลา 17:30 ICT (10:30 UTC)
// หน้าที่: Auto-checkout พนักงาน Factory ที่ยังไม่ได้ checkout
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// ใช้ Service Role เพื่อ bypass RLS (อ่าน/เขียนข้ามทุก user ได้)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Helper: วันนี้ตาม timezone ไทย ────────────────────────────────────────
// ─── ตรวจว่าวันนี้เป็นวันทำงานไหม ──────────────────────────────────────────
async function isTodayWorkingDay(today: string): Promise<boolean> {
  const dow = new Date(today).getDay(); // 0=อา, 6=ส

  // เช็ค holidays table ก่อน
  const { data: holiday } = await supabaseAdmin
    .from("holidays")
    .select("holiday_type")
    .eq("holiday_date", today)
    .maybeSingle();

  if (holiday) {
    // เสาร์ทำงาน → ทำงาน
    if (holiday.holiday_type === "working_sat") return true;
    // national / company / special → หยุด
    return false;
  }

  // ไม่มีใน holidays → เช็ค day of week
  if (dow === 0 || dow === 6) return false; // เสาร์-อาทิตย์ปกติ → หยุด
  return true; // จ-ศ → ทำงาน
}

function getThaiToday(): string {
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }); // "YYYY-MM-DD"
}

// ─── Helper: เวลา 17:30:00 ของวันนั้น (timezone ไทย → ISO) ────────────────
function getAutoCheckoutTime(dateStr: string): string {
  // สร้าง Date object ที่ตรงกับ 17:30 ICT
  return new Date(`${dateStr}T17:30:00+07:00`).toISOString();
}

// ─── Main Handler ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // ป้องกัน cron ถูกเรียกจากภายนอก
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today         = getThaiToday();

    const isWorkingDay = await isTodayWorkingDay(today);
if (!isWorkingDay) {
  return NextResponse.json({
    success: true,
    message: `${today} ไม่ใช่วันทำงาน ข้าม`,
    skipped: true,
  });
}

    const checkoutTime  = getAutoCheckoutTime(today);

    // 1. หา log ทุก record ที่:
    //    - วันนี้
    //    - work_type = 'in_factory' (Factory เท่านั้น)
    //    - มี check-in แล้ว
    //    - ยังไม่ checkout
    //    - ยังไม่เคย auto-checkout มาก่อน
    const { data: logs, error: fetchErr } = await supabaseAdmin
      .from("daily_time_logs")
      .select("id, user_id, timeline_events")
      .eq("log_date", today)
      .eq("work_type", "in_factory")
      .eq("auto_checked_out", false)
      .is("last_check_out", null)
      .not("first_check_in", "is", null);

    if (fetchErr) throw fetchErr;
    if (!logs || logs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "ไม่มี record ที่ต้อง auto-checkout",
        count: 0,
      });
    }

    // 2. Update ทีละ record (append timeline event + set checkout time)
    const results = await Promise.allSettled(
      logs.map(async (log) => {
        const autoCheckoutEvent = {
          event:     "auto_checkout",
          timestamp: checkoutTime,
          source:    "vercel_cron",
          note:      "ระบบ Auto-checkout เวลา 17:30",
        };

        const updatedTimeline = [
          ...(log.timeline_events ?? []),
          autoCheckoutEvent,
        ];

        const { error } = await supabaseAdmin
          .from("daily_time_logs")
          .update({
            last_check_out:   checkoutTime,
            auto_checked_out: true,
            timeline_events:  updatedTimeline,
            // คำนวณ regular_hours = 8 ชั่วโมง (08:30-17:30 หักพัก 1 ชั่วโมง)
            regular_hours:    8,
          })
          .eq("id", log.id);

        if (error) throw new Error(`user ${log.user_id}: ${error.message}`);
        return log.user_id;
      })
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed    = results
      .filter((r) => r.status === "rejected")
      .map((r) => (r as PromiseRejectedResult).reason);

    console.log(`[auto-checkout] ${today}: ${succeeded} สำเร็จ, ${failed.length} ล้มเหลว`);
    if (failed.length > 0) console.error("[auto-checkout] errors:", failed);

    return NextResponse.json({
      success: true,
      date:       today,
      checkout_time: checkoutTime,
      succeeded,
      failed: failed.length > 0 ? failed : undefined,
    });

  } catch (err) {
    console.error("[auto-checkout] Fatal error:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}