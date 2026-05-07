import LogoutButton from "@/components/LogoutButton";

export default function PendingApprovalPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <section className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v5" />
            <path d="M12 16h.01" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-900">รอการอนุมัติ</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          บัญชีของคุณถูกสร้างแล้ว แต่ยังต้องรอ Admin อนุมัติสิทธิ์ก่อนเข้าใช้งานระบบ
        </p>
        <div className="mt-6 flex justify-center">
          <LogoutButton />
        </div>
      </section>
    </main>
  );
}
