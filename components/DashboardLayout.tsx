import {
  LayoutDashboard, Search, Settings,
  Activity, MessageSquare, BarChart3, Globe, Command, Sparkles,
  Eye, Link2, TrendingUp, Crosshair, Bug, Users, Tag,
  FolderOpen, Key, UserCircle, Gift, BarChart2, MessagesSquare,
} from "lucide-react";
import NextLink from "next/link";
import ProjectSwitcher from "./ProjectSwitcher";
import InviteProjectsDropdown from "./InviteProjectsDropdown";
import { getAllProjects, getActiveProject, getInvitedProjects, getCurrentRole } from "../lib/project-context";
import { switchProject, createProject, switchToInvitedWorkspace, switchToOwnWorkspace } from "../app/projects/actions";
import { canManageWorkspace, canManageMembers } from "../lib/permissions";
import "../app/globals-sidebar.css";

export default async function DashboardLayout({
  children,
  currentPath,
  headerAction,
}: {
  children: React.ReactNode;
  currentPath: string;
  headerAction?: React.ReactNode;
}) {
  const allProjects = await getAllProjects();
  const activeProject = await getActiveProject();
  const invitedProjects = await getInvitedProjects();
  const role = await getCurrentRole();
  const isOwner = canManageWorkspace(role);
  const canManageTeam = canManageMembers(role);

  return (
    <div className="flex h-screen bg-white text-zinc-800 font-sans overflow-hidden">

      {/* Sidebar Navigation */}
      <aside className="w-60 border-r border-zinc-200 bg-white flex flex-col shrink-0">

        {/* Project Switcher */}
        <div className="px-3 pt-4 pb-2">
          <ProjectSwitcher
            projects={allProjects.map(p => ({ id: p.id, name: p.name, domain: p.domain }))}
            activeProjectId={activeProject.id}
            activeProjectName={activeProject.name}
            activeProjectDomain={activeProject.domain}
            userEmail={process.env.NEXT_PUBLIC_USER_EMAIL || "admin@workspace.com"}
            switchProjectAction={switchProject}
            createProjectAction={createProject}
          />
        </div>

        {/* Scrollable Nav */}
        <nav className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-hide">

          {/* General */}
          <div className="sidebar-section-label">General</div>
          <NavItem href="/" icon={<LayoutDashboard size={16} />} label="Overview" active={currentPath === "/"} />
          {/* Overview sub-items — hidden on the Overview page; revealed once the
              "View all rankings" button navigates to /ranking (or /chats). */}
          {(currentPath === "/ranking" || currentPath === "/chats") && (
            <div className="sidebar-sub-group">
              <SubNavItem href="/ranking" icon={<BarChart2 size={13} />} label="Ranking" active={currentPath === "/ranking"} />
              <SubNavItem href="/chats"   icon={<MessagesSquare size={13} />} label="Chats" active={currentPath === "/chats"} />
            </div>
          )}
          <NavItem href="/prompts" icon={<MessageSquare size={16} />} label="Prompts" active={currentPath === "/prompts"} />

          {/* Sources */}
          <div className="sidebar-section-label">Sources</div>
          <NavItem href="/domains" icon={<Globe size={16} />} label="Domains" active={currentPath === "/domains"} />
          <NavItem href="/urls" icon={<Link2 size={16} />} label="URLs" active={currentPath === "/urls"} />

          {/* Brand */}
          <div className="sidebar-section-label">Brand</div>
          <NavItem href="/insights" icon={<Eye size={16} />} label="Insights" active={currentPath === "/insights"} dot />

          {/* Actions */}
          <div className="sidebar-section-label">
            Actions <span className="sidebar-beta-badge">Beta</span>
          </div>
          <NavItem href="/earned" icon={<TrendingUp size={16} />} label="Earned" active={currentPath === "/earned"} suffix="Off-page" />
          <NavItem href="/owned" icon={<Crosshair size={16} />} label="Owned" active={currentPath === "/owned"} suffix="On-page" />
          <NavItem href="/impact" icon={<BarChart3 size={16} />} label="Impact" active={currentPath === "/impact"} />

          {/* Agent Analytics */}
          <div className="sidebar-section-label">
            Agent analytics <span className="sidebar-beta-badge">Beta</span>
          </div>
          <NavItem href="/crawl-insights" icon={<Bug size={16} />} label="Crawl insights" active={currentPath === "/crawl-insights"} />
          <NavItem href="/crawlability" icon={<Activity size={16} />} label="Crawlability" active={currentPath === "/crawlability"} />

          {/* Project */}
          <div className="sidebar-section-label">Project</div>
          <NavItem href="/profile" icon={<UserCircle size={16} />} label="Profile" active={currentPath === "/profile"} />
          <NavItem href="/brands" icon={<Sparkles size={16} />} label="Brands" active={currentPath === "/brands"} />
          <NavItem href="/tags" icon={<Tag size={16} />} label="Tags" active={currentPath === "/tags"} />

          {/* Company — items shown based on role */}
          <div className="sidebar-section-label">Company</div>
          {isOwner && <NavItem href="/settings" icon={<Settings size={16} />} label="Settings" active={currentPath === "/settings"} />}
          <NavItem href="/projects" icon={<FolderOpen size={16} />} label="Projects" active={currentPath === "/projects"} />
          {isOwner && <NavItem href="/api-keys" icon={<Key size={16} />} label="API Keys" active={currentPath === "/api-keys"} />}
          {canManageTeam && <NavItem href="/members" icon={<Users size={16} />} label="Members" active={currentPath === "/members"} />}
        </nav>

        {/* Setup Progress */}
        {/* <div className="px-3 pb-2">
          <div className="sidebar-setup">
            <div className="sidebar-setup-title">
              Get set up <span className="sidebar-setup-count">· {allProjects.length}/{Math.max(5, allProjects.length)}</span>
            </div>
            <div className="sidebar-setup-progress">
              <div className="sidebar-setup-bar" style={{ width: `${Math.min(100, (allProjects.length / 5) * 100)}%` }} />
            </div>
            <div className="sidebar-setup-text">
              Organize your prompts and insights into themes.
            </div>
          </div>
        </div> */}

        {/* Refer & Earn */}
        <div className="border-t border-zinc-100 px-4 py-3">
          <a href="#" className="flex items-center gap-2 text-[14px] font-normal text-zinc-700 hover:text-zinc-900">
            <Gift className="w-4 h-4 text-zinc-500" />
            Refer &amp; Earn
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-white">

        {/* Header */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-zinc-200 shrink-0 bg-white" style={{ position: "relative", /* zIndex: 40, */ overflow: "visible" }}>
          <div className="flex items-center space-x-3">
            {headerAction && (
              <div>
                {headerAction}
              </div>
            )}
          </div>
          {/* Invite projects dropdown — shows invited workspaces + own workspace switch-back */}
          {invitedProjects.length > 0 && (
            <InviteProjectsDropdown
              invitedProjects={invitedProjects.map(p => ({
                id: String(p.id),
                name: String(p.name),
                workspaceId: String(p.workspaceId),
                isOwn: p.isOwn === true,
                invitedBy: typeof p.invitedBy === "string" ? p.invitedBy : null,
              }))}
              switchAction={switchToInvitedWorkspace}
              switchToOwnAction={switchToOwnWorkspace}
            />
          )}
        </header>

        {/* Dynamic Page Content */}
        <div className="flex-1 overflow-auto p-6 z-10 scrollbar-hide bg-white">
          <div className="w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ href, icon, label, active = false, dot, suffix }: any) {
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

function SubNavItem({ href, icon, label, active = false }: any) {
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
