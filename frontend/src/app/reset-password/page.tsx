import ResetPasswordClient from "@/components/auth/reset-password-client";
import AuthPageLoading from "@/components/auth/auth-page-loading";
import { Suspense } from "react";

export default function ResetPasswordPage() { return <Suspense fallback={<AuthPageLoading title="재설정 정보를 확인하고 있습니다" />}><ResetPasswordClient /></Suspense>; }
