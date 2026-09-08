import AdminClient from "@/components/admin/admin-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "관리자",
  description:
    "알림 임계값, 발송 이력, 사용자 목록을 확인합니다. (목업 데이터)",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminClient />;
}
