// src/lib/qr-token.ts
import { createHmac, randomBytes } from "crypto";

const SECRET      = process.env.QR_TOKEN_SECRET ?? "change-me-in-production";
const LOCATION_ID = "factory-main";

export const QR_TOKEN_BUCKET_SECONDS = 15; // QR เปลี่ยนทุก 15 วินาที
const WINDOW_BUCKETS = 1;  // accept ±1 bucket = ±15s เผื่อ clock drift

// ─── Bucket = ช่วง 15 วินาทีปัจจุบัน ────────────────────────────────────────
export function getSecondBucket(date = new Date()): number {
  return Math.floor(date.getTime() / (1000 * QR_TOKEN_BUCKET_SECONDS));
}

// ─── สร้าง HMAC token สำหรับ bucket นั้นๆ ───────────────────────────────────
export function generateTokenForBucket(bucket: number, locationId: string): string {
  return createHmac("sha256", SECRET)
    .update(`${bucket}:${locationId}`)
    .digest("hex")
    .slice(0, 24);
}

// ─── Payload ที่เข้ารหัสใน QR code ──────────────────────────────────────────
export interface QRPayload {
  t:     string; // HMAC token
  loc:   string; // location id
  exp:   number; // unix ms หมดอายุ
  nonce: string; // one-time use ID ← ใหม่
}

export function buildQRPayloadForBucket(bucket: number, locationId = LOCATION_ID): QRPayload {
  return {
    t:     generateTokenForBucket(bucket, locationId),
    loc:   locationId,
    exp:   (bucket + 1) * QR_TOKEN_BUCKET_SECONDS * 1000,
    nonce: randomBytes(16).toString("hex"), // 32 char hex สุ่มใหม่ทุกครั้ง
  };
}

export function buildQRPayload(locationId = LOCATION_ID): QRPayload {
  return buildQRPayloadForBucket(getSecondBucket(), locationId);
}

export function buildQRPayloadBatch(count: number, locationId = LOCATION_ID): QRPayload[] {
  const startBucket = getSecondBucket();
  return Array.from({ length: count }, (_, index) =>
    buildQRPayloadForBucket(startBucket + index, locationId),
  );
}

// ─── Validate HMAC token (ไม่ตรวจ nonce — ทำที่ฝั่ง API) ───────────────────
export function validateQRToken(token: string, locationId: string): boolean {
  const now = getSecondBucket();
  for (let offset = -WINDOW_BUCKETS; offset <= WINDOW_BUCKETS; offset++) {
    if (token === generateTokenForBucket(now + offset, locationId)) return true;
  }
  return false;
}
