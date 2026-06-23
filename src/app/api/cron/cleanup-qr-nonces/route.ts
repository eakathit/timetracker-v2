import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const RETENTION_HOURS = 24;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000).toISOString();

    const { error, count } = await supabaseAdmin
      .from("qr_nonces")
      .delete({ count: "exact" })
      .lt("used_at", cutoff);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      cutoff,
      deleted: count ?? 0,
    });
  } catch (err) {
    console.error("[cleanup-qr-nonces] Fatal error:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    );
  }
}
