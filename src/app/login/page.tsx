import InstallPrompt from "@/components/InstallPrompt";
// Import ปุ่ม Google Login ของคุณ (ถ้ามี)
import GoogleLoginButton from "@/components/GoogleLoginButton"; 

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      
      {/* กล่อง Login หลัก */}
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">เข้าสู่ระบบ</h1>
        <p className="text-gray-500 mb-8">Time Tracker V2</p>
        
        {/* ฟอร์ม Login หรือปุ่ม Login ด้วย Google */}
        <GoogleLoginButton />
        
        {/* เส้นแบ่ง */}
        <div className="mt-8 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">หรือ</span>
          </div>
        </div>

        {/* เรียกใช้ปุ่ม Install PWA ตรงนี้เลย! */}
        <InstallPrompt />
        
      </div>
    </main>
  );
}