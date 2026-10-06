import AdminClient from "@/components/admin/admin-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "관리자",
  description: "사용자, 권한, 병원과 활동 기록를 관리합니다.",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminClient />;
}
