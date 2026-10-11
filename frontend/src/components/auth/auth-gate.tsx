"use client";

import CircleLoader from "@/components/icons/circle-loader";
import DashboardLoading from "@/components/dashboard/dashboard-loading";
import { useAuth } from "@/components/provider/auth-provider";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

export default function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, isLoading, connectionError, retrySession } = useAuth();
  const publicPage =
    pathname === "/login" ||
    pathname === "/accept-invite" ||
    pathname === "/reset-password" ||
    pathname === "/forgot-password";

  useEffect(() => {
    if (!publicPage && !isLoading && !session && !connectionError) {
      router.replace(
        `/login?next=${encodeURIComponent(pathname + window.location.search)}`,
      );
    }
  }, [connectionError, isLoading, pathname, publicPage, router, session]);

  if (publicPage) return children;
  if (connectionError && !session)
    return (
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <p role="status">{connectionError}</p>
        <button
          type="button"
          onClick={retrySession}
          className="bg-button-primary mt-5 min-h-12 rounded-xl px-6 font-bold text-white"
        >
          다시 연결
        </button>
      </main>
    );
  if (isLoading || !session) {
    if (pathname === "/") return <DashboardLoading />;
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <CircleLoader size="xl" />
      </main>
    );
  }
  return (
    <>
      {connectionError && (
        <div
          role="status"
          className="bg-amber-50 px-4 py-2 text-sm text-amber-900"
        >
          {connectionError}{" "}
          <button
            onClick={retrySession}
            className="min-h-11 underline"
          >
            다시 연결
          </button>
        </div>
      )}
      {children}
    </>
  );
}
