import CompaniesClient from "@/components/companies/companies-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "회사 관리",
  description: "회사 등록과 최초 최고관리자 초대를 관리합니다.",
  robots: { index: false, follow: false },
};

export default function CompaniesPage() {
  return <CompaniesClient />;
}
