// src/app/api/cron/auto-checkout/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// GitHub Actions / Cron: ทุกวัน เวลา 17:30 ICT (10:30 UTC)
// หน้าที่: Auto-checkout พนักงานทุกคนที่ Check-in แล้วแต่ยังไม่ได้ Checkout
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getThaiToday(): string {
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function getAutoCheckoutTime(dateStr: string): string {
  return new Date(`${dateStr}T17:30:00+07:00`).toISOString();
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today        = getThaiToday();
    const checkoutTime = getAutoCheckoutTime(today);

    // หา record ที่:
    // - วันนี้
    // - มี check-in แล้ว (ไม่ว่า work_type ไหน)
    // - ยังไม่ได้ checkout
    // - ยังไม่เคย auto-checkout มาก่อน
    const { data: logs, error: fetchErr } = await supabaseAdmin
      .from("daily_time_logs")
      .select("id, user_id, timeline_events")
      .eq("log_date", today)
      .eq("auto_checked_out", false)
      .is("last_check_out", null)
      .not("first_check_in", "is", null); // ✅ ลบ work_type filter ออก

    if (fetchErr) throw fetchErr;
    if (!logs || logs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "ไม่มี record ที่ต้อง auto-checkout",
        count: 0,
      });
    }

    const results = await Promise.allSettled(
      logs.map(async (log) => {
        const autoCheckoutEvent = {
          event:     "auto_checkout",
          timestamp: checkoutTime,
          source:    "github_actions",
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
      success:       true,
      date:          today,
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