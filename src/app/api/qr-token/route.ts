// src/app/api/qr-token/route.ts
import { NextResponse } from "next/server";
import { buildQRPayload } from "@/lib/qr-token";

// Public route — ให้เฉพาะ tablet ในโรงงานดึง token
// ความปลอดภัยคือ token อายุแค่ 1 นาที + ต้องอยู่หน้าจอเท่านั้น
export async function GET() {
  const payload = buildQRPayload();
  return NextResponse.json(payload, {
    headers: {
      // ห้าม cache เด็ดขาด
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}