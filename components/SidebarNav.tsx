"use client";
import { usePathname } from "next/navigation";
import NextLink from "next/link";
import {
  LayoutDashboard, Settings,
  Activity, MessageSquare, BarChart3, Globe,
  Eye, Link2, TrendingUp, Crosshair, Bug, Users, Tag,
  FolderOpen, Key, UserCircle, BarChart2, MessagesSquare, Sparkles,
} from "lucide-react";

function NavItem({ href, icon, label, dot, suffix }: {
  href: string;
  icon: React.ReactNode;
  label: string;
  dot?: boolean;
  suffix?: string;
}) {
  const pathname = usePathname();
  // Exact match for the home route; parent-prefix match for the rest so nested
  // pages (e.g. /prompts/[id], /domains/[slug]) keep their top-level item active.
  const active = href === "/" ? pathname === "/" : (pathname === href || pathname.startsWith(href + "/"));
  return (
    <NextLink
      href={href}
      className={`group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[14px] transition-colors ${
        active
          ? "bg-zinc-100 font-medium text-zinc-900"
          : "font-normal text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
      }`}
    >
      <span className={active ? "text-zinc-900" : "text-zinc-500 group-hover:text-zinc-700"}>
        {icon}
      </span>
      <span className="flex-1 truncate">
        {label}
        {suffix && <span className="ml-1.5 font-normal text-zinc-400">· {suffix}</span>}
      </span>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />}
    </NextLink>
  );
}

function SubNavItem({ href, icon, label }: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <NextLink
      href={href}
      className={`group flex items-center gap-2 rounded-md px-3 py-1 text-[13px] transition-colors ml-4 ${
        active
          ? "font-medium text-zinc-900 bg-zinc-100"
          : "font-normal text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
      }`}
    >
      <span className={active ? "text-zinc-700" : "text-zinc-400 group-hover:text-zinc-600"}>
        {icon}
      </span>
      <span>{label}</span>
    </NextLink>
  );
}

export function SidebarNav({ isOwner, canManageTeam }: {
  isOwner: boolean;
  canManageTeam: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-hide">
      {/* General */}
      <div className="sidebar-section-label">General</div>
      <NavItem href="/" icon={<LayoutDashboard size={16} />} label="Overview" />
      {/* Overview sub-items — hidden on the Overview page; revealed once the
          "Show all" button in Top Brands navigates to /ranking (or /chats). */}
      {(pathname === "/ranking" || pathname === "/chats") && (
        <div className="sidebar-sub-group">
          <SubNavItem href="/ranking" icon={<BarChart2 size={13} />} label="Ranking" />
          <SubNavItem href="/chats" icon={<MessagesSquare size={13} />} label="Chats" />
        </div>
      )}
      <NavItem href="/prompts" icon={<MessageSquare size={16} />} label="Prompts" />

      {/* Sources */}
      <div className="sidebar-section-label">Sources</div>
      <NavItem href="/domains" icon={<Globe size={16} />} label="Domains" />
      <NavItem href="/urls" icon={<Link2 size={16} />} label="URLs" />

      {/* Brand */}
      <div className="sidebar-section-label">Brand</div>
      <NavItem href="/insights" icon={<Eye size={16} />} label="Insights" dot />

      {/* Actions */}
      <div className="sidebar-section-label">
        Actions <span className="sidebar-beta-badge">Beta</span>
      </div>
      <NavItem href="/earned" icon={<TrendingUp size={16} />} label="Earned" suffix="Off-page" />
      <NavItem href="/owned" icon={<Crosshair size={16} />} label="Owned" suffix="On-page" />
      <NavItem href="/impact" icon={<BarChart3 size={16} />} label="Impact" />

      {/* Agent Analytics */}
      <div className="sidebar-section-label">
        Agent analytics <span className="sidebar-beta-badge">Beta</span>
      </div>
      <NavItem href="/crawl-insights" icon={<Bug size={16} />} label="Crawl insights" />
      <NavItem href="/crawlability" icon={<Activity size={16} />} label="Crawlability" />

      {/* Project */}
      <div className="sidebar-section-label">Project</div>
      <NavItem href="/profile" icon={<UserCircle size={16} />} label="Profile" />
      <NavItem href="/brands" icon={<Sparkles size={16} />} label="Brands" />
      <NavItem href="/tags" icon={<Tag size={16} />} label="Tags" />

      {/* Company */}
      <div className="sidebar-section-label">Company</div>
      {isOwner && <NavItem href="/settings" icon={<Settings size={16} />} label="Settings" />}
      <NavItem href="/projects" icon={<FolderOpen size={16} />} label="Projects" />
      {isOwner && <NavItem href="/api-keys" icon={<Key size={16} />} label="API Keys" />}
      {canManageTeam && <NavItem href="/members" icon={<Users size={16} />} label="Members" />}
    </nav>
  );
}
