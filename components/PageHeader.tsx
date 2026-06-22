"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import NextLink from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Page-title bar shown at the top of every dashboard page (rendered once inside
 * DashboardLayout). It mirrors Peec's title header: a "Toggle Sidebar" button
 * using /collapse.svg followed by the current page title.
 *
 * The title is derived automatically from the route, but can be overridden via
 * the `title` prop for pages that don't map cleanly to a path.
 */

const TITLES: Record<string, string> = {
  "/": "Overview",
  "/prompts": "Prompts",
  "/domains": "Domains",
  "/urls": "URLs",
  "/insights": "Insights",
  "/earned": "Earned",
  "/owned": "Owned",
  "/impact": "Impact",
  "/crawl-insights": "Crawl insights",
  "/crawlability": "Crawlability",
  "/profile": "Profile",
  "/brands": "Brands",
  "/tags": "Tags",
  "/settings": "Settings",
  "/projects": "Projects",
  "/api-keys": "API Keys",
  "/members": "Members",
  "/ranking": "Ranking",
  "/chats": "Chats",
  "/reports": "Reports",
  "/outreach": "Outreach",
  "/engines": "Engines",
};

function titleFromPath(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];

  // Nested / dynamic routes (e.g. /prompts/[id], /domains/[slug]) — fall back to
  // the first path segment.
  const seg = pathname.split("/").filter(Boolean)[0];
  if (!seg) return "Overview";

  const base = `/${seg}`;
  if (TITLES[base]) return TITLES[base];

  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
}

export interface Crumb {
  label: string;
  /** When present (and not the last crumb) the label renders as a link. */
  href?: string;
}

export default function PageHeader({
  title,
  breadcrumbs,
}: {
  title?: string;
  breadcrumbs?: Crumb[];
}) {
  const pathname = usePathname();
  const resolved = title ?? titleFromPath(pathname || "/");
  const [, setCollapsed] = useState(false);

  // Sync React state with the collapse class the anti-flash script may have set.
  useEffect(() => {
    setCollapsed(document.documentElement.classList.contains("sidebar-collapsed"));
  }, []);

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("sidebar-collapsed", next);
      try {
        localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* storage unavailable (private mode) — ignore */
      }
      return next;
    });
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="Toggle Sidebar"
        className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg px-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
      >
        <img src="/collapse.svg" alt="" aria-hidden="true" className="h-4 w-4" />
        <span className="sr-only">Toggle Sidebar</span>
      </button>

      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center gap-1 text-[14px]"
        >
          {breadcrumbs.flatMap((crumb, i) => {
            const isLast = i === breadcrumbs.length - 1;
            const node =
              crumb.href && !isLast ? (
                <NextLink
                  key={`c${i}`}
                  href={crumb.href}
                  className="max-w-56 truncate text-zinc-500 transition-colors hover:text-zinc-900"
                >
                  {crumb.label}
                </NextLink>
              ) : (
                <span
                  key={`c${i}`}
                  className={`max-w-56 truncate ${
                    isLast ? "font-medium text-zinc-900" : "text-zinc-500"
                  }`}
                >
                  {crumb.label}
                </span>
              );
            return i === 0
              ? [node]
              : [
                  <ChevronRight
                    key={`s${i}`}
                    size={15}
                    className="shrink-0 text-zinc-300"
                  />,
                  node,
                ];
          })}
        </nav>
      ) : (
        <h1 className="max-w-60 truncate text-[14px] font-medium text-zinc-900">
          {resolved}
        </h1>
      )}
    </div>
  );
}
