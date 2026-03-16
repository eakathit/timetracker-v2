import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function getLocalToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

export async function GET() {
  try {
    const today = getLocalToday();

    // ── Step 1: ดึง time logs วันนี้ก่อน ──────────────────────────────────
    const { data: logs, error: logsError } = await supabase
      .from("daily_time_logs")
      .select("id, user_id, work_type, first_check_in")
      .eq("log_date", today)
      .not("first_check_in", "is", null)
      .order("first_check_in", { ascending: false })
      .limit(30);

    if (logsError) {
      console.error("[recent-checkins] logs error:", logsError);
      return NextResponse.json({ error: logsError.message }, { status: 500 });
    }

    if (!logs || logs.length === 0) {
      return NextResponse.json([], {
        headers: { "Cache-Control": "no-store, no-cache" },
      });
    }

    // ── Step 2: ดึง profiles ของ user_ids ที่ได้มา ──────────────────────
    const userIds = [...new Set(logs.map((l) => l.user_id))];

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .in("id", userIds);

    if (profilesError) {
      console.error("[recent-checkins] profiles error:", profilesError);
    }

    // ── Step 3: Merge ──────────────────────────────────────────────────────
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    const result = logs.map((log) => ({
      id: log.id,
      user_id: log.user_id,
      work_type: log.work_type,
      first_check_in: log.first_check_in,
      profiles: profileMap.get(log.user_id) ?? null,
    }));

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, no-cache" },
    });
  } catch (err) {
    console.error("[recent-checkins]", err);
    return NextResponse.json([], { status: 500 });
  }
}