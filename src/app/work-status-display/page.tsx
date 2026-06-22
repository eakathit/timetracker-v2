export default function WorkStatusDisplayDisabledPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-900">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">Work Status Display</p>
        <h1 className="mt-2 text-xl font-bold tracking-normal text-slate-950">
          Temporarily disabled
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          This display is paused while we monitor Vercel usage. The main QR
          display and attendance flows are still available.
        </p>
      </section>
    </main>
  );
}
