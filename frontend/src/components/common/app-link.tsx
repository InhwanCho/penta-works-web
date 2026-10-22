"use client";

import Link from "next/link";
import { forwardRef, type ComponentProps } from "react";
import { scrollPageToTop } from "./route-scroll-reset";

// Use the same navigation behavior for footer, policy, list and main-menu links.
const AppLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof Link>>(
  function AppLink({ href, scroll, onNavigate, ...props }, ref) {
    const targetsSection = typeof href === "string"
      ? href.includes("#") || /[?&]scrollTo=/.test(href)
      : !!href.hash || !!href.query && Object.prototype.hasOwnProperty.call(href.query, "scrollTo");
    return <Link {...props} ref={ref} href={href}
      scroll={scroll ?? (targetsSection ? true : false)}
      onNavigate={(event) => {
        let cancelled = false;
        onNavigate?.({ preventDefault: () => { cancelled = true; event.preventDefault(); } });
        if (cancelled || targetsSection) return;
        const destination = new URL(typeof href === "string" ? href : href.pathname ?? window.location.pathname, window.location.href);
        // Filter/date query updates must not jump away from the current view.
        if (destination.pathname !== window.location.pathname ||
            (typeof href === "string" && destination.search === window.location.search)) {
          scrollPageToTop();
        }
      }} />;
  },
);
export default AppLink;
