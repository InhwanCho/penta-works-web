import ForgotPasswordForm from "@/components/auth/forgot-password-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "비밀번호 찾기" };

export default function ForgotPasswordPage() { return <ForgotPasswordForm />; }
