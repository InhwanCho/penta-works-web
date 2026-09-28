"use client";

import ThreeDotLoader from "@/components/icons/three-dot-loader";
import { useAuth } from "@/components/provider/auth-provider";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

export default function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, isLoading } = useAuth();
  const publicPage = pathname === "/login";

  useEffect(() => {
    if (!publicPage && !isLoading && !session) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, pathname, publicPage, router, session]);

  if (publicPage) return children;
  if (isLoading || !session) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <ThreeDotLoader size="xl" />
      </main>
    );
  }
  return children;
}
