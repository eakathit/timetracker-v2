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

    console.log("[qr-token] URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
     console.log("[qr-token] KEY starts with:", process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 30));
    console.log("[qr-token] KEY length:", process.env.SUPABASE_SERVICE_ROLE_KEY?.length);
    
    const payload = buildQRPayload();

    // ── บันทึก nonce ลง DB ────────────────────────────────────────────────
    const { error } = await supabaseAdmin
      .from("qr_nonces")
      .insert({
        nonce:       payload.nonce,
        location_id: payload.loc,
        created_at:  new Date().toISOString(),
      });

    if (error) {
      console.error("[qr-token] insert nonce error:", error);
      // ถ้า insert ไม่ได้ = ห้ามส่ง QR ออกไป เพราะจะ validate ไม่ผ่านอยู่ดี
      return NextResponse.json(
        { error: "ไม่สามารถสร้าง QR Code ได้" },
        { status: 500 }
      );
    }

    // ── Cleanup nonces เก่าเกิน 5 นาที (fire-and-forget) ─────────────────
    void supabaseAdmin
  .from("qr_nonces")
  .delete()
  .lt("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

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