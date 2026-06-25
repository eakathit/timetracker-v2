// src/app/api/qr-token/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { buildQRPayload, buildQRPayloadBatch } from "@/lib/qr-token";
import { hasDisplayOrAdminAccess } from "@/lib/display-api-access";

const DEFAULT_BATCH_SIZE = 20;
const MAX_BATCH_SIZE = 80;

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
