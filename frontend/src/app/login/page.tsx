import LoginForm from "@/components/auth/login-form";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "로그인",
  description: "MrEyes 로그인",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[60vh] w-full max-w-7xl items-center justify-center px-4 text-sm">
          로그인 화면을 불러오는 중…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
