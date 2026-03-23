// src/app/api/cron/auto-checkout-holiday/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// GitHub Actions / Cron: ทุกวัน เวลา 23:00 ICT (16:00 UTC)
// หน้าที่: Safety-net checkout สำหรับพนักงาน Holiday Shift ที่ยังไม่ได้ Checkout
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getThaiToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function getSafetyCheckoutTime(dateStr: string): string {
  return new Date(`${dateStr}T23:00:00+07:00`).toISOString();
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today        = getThaiToday();
    const checkoutTime = getSafetyCheckoutTime(today);

    // หา record ที่:
    // - วันนี้
    // - เป็น holiday shift
    // - มี check-in แล้ว
    // - ยังไม่ได้ checkout
    // - ยังไม่เคย auto-checkout มาก่อน
    const { data: logs, error: fetchErr } = await supabaseAdmin
      .from("daily_time_logs")
      .select("id, user_id, first_check_in, timeline_events")
      .eq("log_date", today)
      .eq("shift_type", "holiday")
      .eq("auto_checked_out", false)
      .is("last_check_out", null)
      .not("first_check_in", "is", null);

    if (fetchErr) throw fetchErr;
    if (!logs || logs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "ไม่มี holiday shift record ที่ต้อง auto-checkout",
        count: 0,
      });
    }

    const results = await Promise.allSettled(
      logs.map(async (log) => {
        const netHours =
          (new Date(checkoutTime).getTime() - new Date(log.first_check_in).getTime()) /
            3_600_000 -
          1; // หัก break 1 ชั่วโมง
        const dayoffCredit = netHours >= 8 ? "earned" : "forfeited";

        const safetyCheckoutEvent = {
          event:     "auto_checkout",
          timestamp: checkoutTime,
          source:    "github_actions",
          note:      "Holiday safety checkout เวลา 23:00",
        };

        const updatedTimeline = [
          ...(log.timeline_events ?? []),
          safetyCheckoutEvent,
        ];

        const { error } = await supabaseAdmin
          .from("daily_time_logs")
          .update({
            last_check_out:   checkoutTime,
            auto_checked_out: true,
            dayoff_credit:    dayoffCredit,
            timeline_events:  updatedTimeline,
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

    console.log(`[auto-checkout-holiday] ${today}: ${succeeded} สำเร็จ, ${failed.length} ล้มเหลว`);
    if (failed.length > 0) console.error("[auto-checkout-holiday] errors:", failed);

    return NextResponse.json({
      success:       true,
      date:          today,
      checkout_time: checkoutTime,
      succeeded,
      failed: failed.length > 0 ? failed : undefined,
    });

  } catch (err) {
    console.error("[auto-checkout-holiday] Fatal error:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
