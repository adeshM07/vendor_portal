import { LoginCard } from "@/components/login/LoginCard";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-50 px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-[300px] w-[300px] rounded-full bg-orange-100/40 blur-3xl" />
      </div>

      <LoginCard />
    </div>
  );
}
