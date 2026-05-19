import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/qr-display-manifest.webmanifest",
};

export default function QRDisplayLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
