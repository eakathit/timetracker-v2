import GoogleLoginButton from "@/components/GoogleLoginButton";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-sky-600 mb-2">TimeTracker V2</h1>
        <p className="text-gray-500">กรุณาเข้าสู่ระบบเพื่อบันทึกเวลาทำงาน</p>
      </div>
      
      <GoogleLoginButton />
    </div>
  );
}