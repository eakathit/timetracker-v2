// src/app/api/cron/ot-notify/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Vercel Cron Job: ทุกวันจันทร์-ศุกร์ เวลา 18:00 ICT (11:00 UTC)
// หน้าที่: แจ้งเตือน user ที่กด "รอทำ OT" ว่าตอนนี้สามารถ Start OT ได้แล้ว
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Web Push Config ──────────────────────────────────────────────────────────
// ต้อง set VAPID keys ใน .env (generate ด้วย web-push generate-vapid-keys)
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL ?? "admin@example.com"}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// ─── Helper: วันนี้ timezone ไทย ────────────────────────────────────────────
function getThaiToday(): string {
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

// ─── Main Handler ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = getThaiToday();

    // 1. หา user ที่กด "รอทำ OT" (ot_intent = true) วันนี้
    const { data: logs, error: fetchErr } = await supabaseAdmin
      .from("daily_time_logs")
      .select("user_id")
      .eq("log_date", today)
      .eq("ot_intent", true)
      .eq("auto_checked_out", true); // ต้องผ่าน auto-checkout มาก่อน

    if (fetchErr) throw fetchErr;
    if (!logs || logs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "ไม่มี user ที่รอ OT",
        count: 0,
      });
    }

    const userIds = logs.map((l) => l.user_id);

    // 2. ดึง push_subscription ของ user เหล่านั้น
    //    (ต้องมีตาราง push_subscriptions แยก — ดู Step 3b)
    const { data: subs, error: subErr } = await supabaseAdmin
      .from("push_subscriptions")
      .select("user_id, subscription")
      .in("user_id", userIds);

    if (subErr) throw subErr;
    if (!subs || subs.length === 0) {
      return NextResponse.json({
        success: true,
        message: `พบ ${userIds.length} user รอ OT แต่ไม่มี push subscription`,
        count: 0,
      });
    }

    // 3. ส่ง Push Notification
    const payload = JSON.stringify({
      title: "⏰ เริ่ม OT ได้แล้ว!",
      body:  "กดเพื่อ Start OT ตอนนี้เลย",
      icon:  "/icons/icon-192x192.png",
      badge: "/icons/badge-72x72.png",
      url:   "/",
      data:  { action: "start_ot" },
    });

    const results = await Promise.allSettled(
      subs.map(async (sub) => {
        await webpush.sendNotification(
          sub.subscription as webpush.PushSubscription,
          payload
        );
        return sub.user_id;
      })
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed    = results.filter((r) => r.status === "rejected").length;

    console.log(`[ot-notify] ${today}: ส่งแจ้งเตือน ${succeeded} คน, ล้มเหลว ${failed} คน`);

    return NextResponse.json({
      success: true,
      date:      today,
      notified:  succeeded,
      failed,
    });

  } catch (err) {
    console.error("[ot-notify] Fatal error:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}