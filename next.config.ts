import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // เพิ่มบรรทัดนี้: ปิดการทำงานในโหมด Dev ป้องกัน Turbopack Error
  disable: process.env.NODE_ENV === "development", 
});

const nextConfig: NextConfig = {
  // เพิ่มบรรทัดนี้: บอก Next.js ว่าเราตั้งใจใช้ Webpack config (ผ่าน Serwist)
  turbopack: {}, 
};

export default withSerwist(nextConfig);