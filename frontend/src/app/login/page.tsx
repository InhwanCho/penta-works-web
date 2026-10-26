import LoginForm from "@/components/auth/login-form";
import PageLoader from "@/components/common/page-loader";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "로그인",
  description: "MReyes 로그인",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <PageLoader as="main" />
      }
    >
      <LoginForm />
    </Suspense>
  );
}
