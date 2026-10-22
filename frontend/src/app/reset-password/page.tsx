import ResetPasswordClient from "@/components/auth/reset-password-client";
import AuthPageLoading from "@/components/auth/auth-page-loading";
import { Suspense } from "react";

export default function ResetPasswordPage() { return <Suspense fallback={<AuthPageLoading />}><ResetPasswordClient /></Suspense>; }
