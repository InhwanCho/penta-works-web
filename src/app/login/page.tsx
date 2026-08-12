import LoginForm from "@/components/auth/login-form";
import ThreeDotLoader from "@/components/icons/three-dot-loader";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "로그인",
  description: "PENTA WORKS 로그인",
};

export default function LoginPage() {
  return (
    // useSearchParams 를 쓰는 클라이언트 폼은 Suspense 경계가 필요합니다.
    <Suspense
      fallback={
        <main className="mx-auto flex h-[70vh] w-full items-center justify-center">
          <ThreeDotLoader size="xl" />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
