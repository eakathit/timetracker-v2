// src/lib/qr-token.ts
import { createHmac } from "crypto";

const SECRET = process.env.QR_TOKEN_SECRET ?? "change-me-in-production";
const LOCATION_ID = "factory-main";
const WINDOW_MINUTES = 1; // accept ± 1 นาที เผื่อนาฬิกา tablet drift

// ─── Bucket = เลขนาทีปัจจุบัน (เปลี่ยนทุก 1 นาที) ──────────────────────────
export function getMinuteBucket(date = new Date()): number {
  return Math.floor(date.getTime() / (1000 * 60));
}

// ─── สร้าง HMAC token สำหรับ bucket นั้นๆ ──────────────────────────────────
export function generateTokenForBucket(bucket: number, locationId: string): string {
  return createHmac("sha256", SECRET)
    .update(`${bucket}:${locationId}`)
    .digest("hex")
    .slice(0, 24);
}

// ─── Payload ที่เข้ารหัสใน QR code ─────────────────────────────────────────
export interface QRPayload {
  t: string;   // token
  loc: string; // location id
  exp: number; // unix ms หมดอายุ
}

export function buildQRPayload(locationId = LOCATION_ID): QRPayload {
  const bucket = getMinuteBucket();
  return {
    t:   generateTokenForBucket(bucket, locationId),
    loc: locationId,
    exp: (bucket + 1) * 60 * 1000,
  };
}

// ─── Validate: ตรวจสอบว่า token ยังอยู่ใน window ─────────────────────────
export function validateQRToken(token: string, locationId: string): boolean {
  const now = getMinuteBucket();
  for (let offset = -WINDOW_MINUTES; offset <= WINDOW_MINUTES; offset++) {
    if (token === generateTokenForBucket(now + offset, locationId)) return true;
  }
  return false;
}