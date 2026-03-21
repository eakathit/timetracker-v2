// src/app/api/qr-token/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildQRPayload } from "@/lib/qr-token";

// Service role client — เขียน qr_nonces ได้โดยไม่ผ่าน RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const payload = buildQRPayload();

    // ── Cleanup nonces เก่าเกิน 5 นาที (fire-and-forget) ─────────────────
    // nonce จะถูกบันทึกตอน scan เท่านั้น ไม่ต้อง insert ตอนสร้าง QR
    void supabaseAdmin
      .from("qr_nonces")
      .delete()
      .lt("used_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err) {
    console.error("[qr-token] error:", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}