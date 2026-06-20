// src/app/api/qr-token/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildQRPayload, buildQRPayloadBatch } from "@/lib/qr-token";
import { hasDisplayOrAdminAccess } from "@/lib/display-api-access";

// Service role client — เขียน qr_nonces ได้โดยไม่ผ่าน RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_BATCH_SIZE = 20;
const MAX_BATCH_SIZE = 40;

function getBatchSize(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("batch");
  if (!raw) return null;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_BATCH_SIZE;
  return Math.min(parsed, MAX_BATCH_SIZE);
}

export async function GET(request: NextRequest) {
  try {
    if (!(await hasDisplayOrAdminAccess(request))) {
      return NextResponse.json({ error: "Unauthorized display" }, { status: 401 });
    }

    const batchSize = getBatchSize(request);
    const payload = batchSize
      ? { tokens: buildQRPayloadBatch(batchSize) }
      : buildQRPayload();

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
