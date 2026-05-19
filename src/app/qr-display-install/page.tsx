import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Install TimeTracker QR Display",
  manifest: "/qr-display-manifest.webmanifest",
};

export default function QRDisplayInstallPage() {
  return (
    <main className="min-h-dvh bg-slate-950 text-white flex items-center justify-center px-6">
      <section className="w-full max-w-lg text-center">
        <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-white p-2">
          <img
            src="/icon-192x192.png"
            alt=""
            className="h-full w-full object-contain"
          />
        </div>
        <h1 className="text-3xl font-bold">TimeTracker QR Display</h1>
        <p className="mt-3 text-slate-300">
          Install this screen as a dedicated QR display app.
        </p>
        <Link
          href="/qr-display"
          className="mt-8 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Open QR Display
        </Link>
      </section>
    </main>
  );
}
