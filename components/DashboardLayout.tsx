import { Gift } from "lucide-react";
import ProjectSwitcher from "./ProjectSwitcher";
import InviteProjectsDropdown from "./InviteProjectsDropdown";
import { SidebarNav } from "./SidebarNav";
import PageHeader from "./PageHeader";
import { getAllProjects, getActiveProject, getInvitedProjects, getCurrentRole } from "../lib/project-context";
import { switchProject, createProject, switchToInvitedWorkspace, switchToOwnWorkspace } from "../app/projects/actions";
import { canManageWorkspace, canManageMembers } from "../lib/permissions";
import "../app/globals-sidebar.css";

export default async function DashboardLayout({
  children,
  headerAction,
  breadcrumbs,
}: {
  children: React.ReactNode;
  /** Accepted for backward-compat with pages that still pass it; the sidebar
   *  (SidebarNav) now derives the active route from usePathname() itself. */
  currentPath?: string;
  headerAction?: React.ReactNode;
  /** Breadcrumb trail shown in the page-title bar for nested pages
   *  (e.g. Prompts › [query] › Ranking). Falls back to a route-derived title. */
  breadcrumbs?: { label: string; href?: string }[];
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
      <aside className="app-sidebar w-60 border-r border-zinc-200 bg-white flex flex-col shrink-0">

        {/* Project Switcher */}
        <div className="sidebar-top px-3 pt-4 pb-2">
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

        {/* Scrollable Nav — client component; derives active route via usePathname */}   
        <SidebarNav isOwner={isOwner} canManageTeam={canManageTeam} />

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
        <div className="sidebar-bottom border-t border-zinc-100 px-4 py-3">
          <a href="#" title="Refer & Earn" className="sidebar-nav-item flex items-center gap-2 text-[14px] font-normal text-zinc-700 hover:text-zinc-900">
            <Gift className="w-4 h-4 text-zinc-500" />
            <span className="sidebar-nav-label">Refer &amp; Earn</span>
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-white">

        {/* Header */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-zinc-200 shrink-0 bg-white" style={{ position: "relative", /* zIndex: 40, */ overflow: "visible" }}>
          <div className="flex items-center gap-3 min-w-0">
            <PageHeader breadcrumbs={breadcrumbs} />
            {headerAction && (
              <div>
                {headerAction}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Portal slot — pages (e.g. prompt detail) render their top-right
                action buttons here via createPortal(#page-header-actions). */}
            <div id="page-header-actions" className="flex items-center gap-2.5" />
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
          </div>
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
