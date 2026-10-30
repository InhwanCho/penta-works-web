"use client";
import { createContext, useContext } from "react";
import { useRouter as useNextRouter, useSearchParams as useNextSearchParams } from "next/navigation";
export const OverlayNavigation = createContext<{ href: string; push: (href: string) => void; replace: (href: string) => void; close: () => void } | null>(null);
export const isWorkspaceOverlay = (href: string) => /^\/(work(?:\/(?:new|\d+))?|schedule)(?:[?#]|$)/.test(href);
export function openWorkspaceOverlay(href: string) { window.dispatchEvent(new CustomEvent("workspace-overlay", { detail: href })); }
export function useRouter() {
 const router = useNextRouter(); const overlay = useContext(OverlayNavigation);
 return { ...router, push: (href: string) => { if (isWorkspaceOverlay(href)) { if (overlay) overlay.push(href); else openWorkspaceOverlay(href); } else if (href === "/overview" && overlay) overlay.close(); else router.push(href); }, replace: (href: string) => { if (overlay && isWorkspaceOverlay(href)) overlay.replace(href); else if (href === "/overview" && overlay) overlay.close(); else router.replace(href); } };
}
export function useSearchParams() { const search = useNextSearchParams(); const overlay = useContext(OverlayNavigation); return overlay ? new URL(overlay.href, "https://workspace.local").searchParams : search; }
