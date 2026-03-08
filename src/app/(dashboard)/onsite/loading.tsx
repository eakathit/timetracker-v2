// src/app/(dashboard)/onsite/loading.tsx

export default function OnsiteLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-32 animate-pulse">

      {/* ── Header Skeleton ─────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-5 w-20 bg-gray-200 rounded-lg" />
            <div className="h-3 w-36 bg-gray-100 rounded-lg" />
          </div>
          <div className="h-9 w-28 bg-gray-100 rounded-xl" />
        </div>
      </header>

      <div className="px-4 py-5 space-y-6">

        {/* ── Today's Session Card Skeleton ───────────────────────────────── */}
        <div>
          <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0" />
                <div className="space-y-1.5">
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                  <div className="h-3 w-20 bg-gray-100 rounded" />
                </div>
              </div>
              <div className="h-6 w-16 bg-gray-100 rounded-full" />
            </div>
            <div className="flex gap-2 pt-1">
              <div className="flex-1 h-10 bg-gray-100 rounded-xl" />
              <div className="flex-1 h-10 bg-sky-100 rounded-xl" />
            </div>
          </div>
        </div>

        {/* ── History Section Skeleton ─────────────────────────────────────── */}
        <div>
          <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0" />
                    <div className="space-y-1.5">
                      <div className="h-4 w-28 bg-gray-200 rounded" />
                      <div className="h-3 w-16 bg-gray-100 rounded" />
                    </div>
                  </div>
                  <div className="h-5 w-14 bg-gray-100 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}