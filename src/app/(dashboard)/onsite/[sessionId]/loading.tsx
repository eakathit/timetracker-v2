// src/app/(dashboard)/onsite/[sessionId]/loading.tsx

export default function SessionDetailLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-52 animate-pulse">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <div className="w-9 h-9 rounded-xl bg-gray-100" />
        <div className="flex-1 space-y-1.5">
          <div className="h-4 w-40 bg-gray-200 rounded-lg" />
          <div className="h-3 w-24 bg-gray-100 rounded-lg" />
        </div>
        <div className="h-6 w-16 bg-gray-100 rounded-full" />
      </header>

      <div className="flex-1 px-4 py-5 space-y-4">

        {/* Status bar */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gray-100" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-24 bg-gray-200 rounded" />
              <div className="h-3 w-16 bg-gray-100 rounded" />
            </div>
          </div>
          <div className="h-6 w-20 bg-gray-100 rounded-full" />
        </div>

        {/* Member list */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <div className="h-3.5 w-20 bg-gray-200 rounded" />
            <div className="h-3 w-10 bg-gray-100 rounded" />
          </div>
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-28 bg-gray-200 rounded" />
                  <div className="h-3 w-16 bg-gray-100 rounded" />
                </div>
                <div className="h-6 w-14 bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-20 md:bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4">
        <div className="h-14 w-full bg-gray-100 rounded-2xl" />
      </div>

    </div>
  );
}