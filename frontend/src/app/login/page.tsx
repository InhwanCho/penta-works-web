import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "로그인",
  description: "MrEyes 로그인",
};

export default function LoginPage() {
  redirect("/");
}
