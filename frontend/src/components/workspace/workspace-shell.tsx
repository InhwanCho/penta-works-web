"use client";
import { scrollPageToTop } from "@/components/common/route-scroll-reset";
import SiteFooter from "@/components/legal/site-footer";
import { DeferredUnreadAlertDot } from "@/components/common/unread-alert-dot";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/provider/auth-provider";
import { useEffect, useRef, type ReactNode } from "react";
const items = [
  { href: "/", label: "모니터링", icon: "monitor" },
  { href: "/overview", label: "업무 현황", icon: "home" },
  { href: "/hospitals", label: "병원", icon: "hospital" },
  { href: "/baselines", label: "알림", icon: "bell" },
  { href: "/settings", label: "설정", icon: "settings" },
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
      {name === "settings" ? (
        <>
          <circle
            cx="12"
            cy="12"
            r="8"
          />
          <circle
            cx="12"
            cy="12"
            r="3"
          />
          <path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" />
        </>
      ) : name === "bell" ? (
        <>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </>
      ) : name === "home" ? (
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
  const bottomNav = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = bottomNav.current;
    if (!nav) return;
    const measure = () =>
      document.documentElement.style.setProperty(
        "--workspace-bottom-height",
        `${nav.getBoundingClientRect().height}px`,
      );
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    measure();
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty(
        "--workspace-bottom-height",
      );
    };
  }, [session]);
  if (!session || ["/about", "/privacy", "/terms"].includes(path))
    return (
      <>
        {children}
        <SiteFooter />
      </>
    );
  const active = (href: string) =>
    path === href ||
    (href === "/settings" &&
      ["/account", "/admin", "/companies", "/privacy-requests"].some((p) =>
        path.startsWith(p),
      )) ||
    (href === "/overview" &&
      (path.startsWith("/work") || path.startsWith("/schedule"))) ||
    (href === "/hospitals" && path.startsWith("/sites/")) ||
    (href === "/baselines" &&
      (path.startsWith("/alert-settings") ||
        path.startsWith("/notification-settings"))) ||
    (href !== "/" && path.startsWith(href));
  return (
    <div className="workspace-frame">
      <aside className="workspace-sidebar">
        <span className="workspace-caption">WORKSPACE</span>
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            onNavigate={() => {
              if (path === i.href) scrollPageToTop();
            }}
            className={active(i.href) ? "selected" : ""}
            aria-current={active(i.href) ? "page" : undefined}
          >
            <WorkIcon name={i.icon} />
            {i.label}
            {i.href === "/hospitals"
              ? " · 장비"
              : i.href === "/baselines"
                ? " 관리"
                : ""}
          </Link>
        ))}
      </aside>
      <div className="workspace-content">
        {children}
        <SiteFooter />
      </div>
      <nav
        ref={bottomNav}
        className="workspace-bottom"
        aria-label="주 메뉴"
      >
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            onNavigate={() => {
              if (path === i.href) scrollPageToTop();
            }}
            className={active(i.href) ? "selected" : ""}
            aria-current={active(i.href) ? "page" : undefined}
          >
            <WorkIcon name={i.icon} />
            <span>{i.label}</span>
            {i.href === "/baselines" && (
              <span className="workspace-alert-dot">
                <DeferredUnreadAlertDot />
              </span>
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
}
