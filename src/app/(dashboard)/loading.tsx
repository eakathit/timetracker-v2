// src/app/(dashboard)/loading.tsx
export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full">
      <div className="flex flex-col items-center space-y-6">
        {/* อนิเมชั่นวงกลมหมุน (Spinner) */}
        <div className="w-14 h-14 border-4 border-gray-100 border-t-sky-500 rounded-full animate-spin shadow-sm"></div>
        
        {/* ข้อความ "กำลังโหลดข้อมูล..." แบบมี Effect กระพริบเบาๆ (Pulse) */}
        <p className="text-gray-500 font-medium text-lg tracking-wide animate-pulse">
          กำลังโหลดข้อมูล...
        </p>
      </div>
    </div>
  );
}