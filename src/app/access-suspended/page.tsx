import LogoutButton from "@/components/LogoutButton";

export default function AccessSuspendedPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <section className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9.5 9.5l5 5" />
            <path d="M14.5 9.5l-5 5" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-900">บัญชีถูกระงับ</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          บัญชีนี้ยังไม่สามารถเข้าใช้งาน Web App ได้ กรุณาติดต่อ Admin หากต้องการเปิดใช้งานอีกครั้ง
        </p>
        <div className="mt-6 flex justify-center">
          <LogoutButton />
        </div>
      </section>
    </main>
  );
}
