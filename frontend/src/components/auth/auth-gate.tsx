"use client";

import CircleLoader from "@/components/icons/circle-loader";
import DashboardLoading from "@/components/dashboard/dashboard-loading";
import { useAuth } from "@/components/provider/auth-provider";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

export default function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, isLoading } = useAuth();
  const publicPage = pathname === "/login" || pathname === "/accept-invite" || pathname === "/reset-password" || pathname === "/forgot-password";

  useEffect(() => {
    if (!publicPage && !isLoading && !session) {
      router.replace(`/login?next=${encodeURIComponent(pathname + window.location.search)}`);
    }
  }, [isLoading, pathname, publicPage, router, session]);

  if (publicPage) return children;
  if (isLoading || !session) {
    if (pathname === "/") return <DashboardLoading />;
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <CircleLoader size="xl" />
      </main>
    );
  }
  return children;
}
