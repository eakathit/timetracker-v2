import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      name: "TimeTracker QR Display",
      short_name: "QR Display",
      description: "TimeTracker factory QR display screen",
      id: "/qr-display",
      start_url: "/qr-display",
      scope: "/",
      display: "standalone",
      background_color: "#f8fafc",
      theme_color: "#0c1a3d",
      icons: [
        { src: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Content-Type": "application/manifest+json",
      },
    },
  );
}
