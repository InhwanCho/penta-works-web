"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/provider/auth-provider";
import type { ReactNode } from "react";
const items = [
  { href: "/", label: "오늘", icon: "home" },
  { href: "/monitoring", label: "모니터링", icon: "monitor" },
  { href: "/hospitals", label: "병원", icon: "hospital" },
  { href: "/work", label: "업무", icon: "work" },
  { href: "/schedule", label: "일정", icon: "calendar" },
];
export function WorkIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "home" ? (
        <>
          <path d="m3 10 9-7 9 7" />
          <path d="M5 9v12h14V9M9 21v-7h6v7" />
        </>
      ) : name === "monitor" ? (
        <>
          <rect
            x="3"
            y="4"
            width="18"
            height="13"
            rx="3"
          />
          <path d="M8 21h8M12 17v4m-6-10 3-3 3 5 3-4 3 2" />
        </>
      ) : name === "hospital" ? (
        <>
          <rect
            x="5"
            y="3"
            width="14"
            height="18"
            rx="2"
          />
          <path d="M9 7h6m-3-2v4M9 13h1m4 0h1M10 21v-4h4v4" />
        </>
      ) : name === "calendar" ? (
        <>
          <rect
            x="3"
            y="5"
            width="18"
            height="16"
            rx="2"
          />
          <path d="M7 3v4m10-4v4M3 11h18M7 15h2m4 0h2" />
        </>
      ) : (
        <>
          <rect
            x="5"
            y="4"
            width="14"
            height="17"
            rx="2"
          />
          <path d="M9 3h6v3H9zM9 11h6m-6 4h6" />
        </>
      )}
    </svg>
  );
}
export default function WorkspaceShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { session } = useAuth();
  if (!session) return children;
  return (
    <div className="workspace-frame">
      <aside className="workspace-sidebar">
        <span className="workspace-caption">WORKSPACE</span>
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={
              path === i.href || (i.href !== "/" && path.startsWith(i.href))
                ? "selected"
                : ""
            }
            aria-current={path === i.href ? "page" : undefined}
          >
            <WorkIcon name={i.icon} />
            {i.label}
            {i.href === "/hospitals"
              ? " · 장비"
              : i.href === "/work"
                ? " 기록"
                : ""}
          </Link>
        ))}
      </aside>
      <div className="workspace-content">{children}</div>
      <nav
        className="workspace-bottom"
        aria-label="주 메뉴"
      >
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={
              path === i.href || (i.href !== "/" && path.startsWith(i.href))
                ? "selected"
                : ""
            }
            aria-current={path === i.href ? "page" : undefined}
          >
            <WorkIcon name={i.icon} />
            <span>{i.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
