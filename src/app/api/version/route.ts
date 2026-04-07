import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    version: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "dev",
  });
}