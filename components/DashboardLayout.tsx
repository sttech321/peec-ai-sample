import {
  LayoutDashboard, Search, Settings, Bell,
  Activity, MessageSquare, BarChart3, Globe, Command, Sparkles,
  Eye, Link2, TrendingUp, Crosshair, Bug, Users, Tag,
  FolderOpen, Key, UserCircle
} from "lucide-react";
import NextLink from "next/link";
import ProjectSwitcher from "./ProjectSwitcher";
import { getAllProjects, getActiveProject } from "../lib/project-context";
import { switchProject, createProject } from "../app/projects/actions";
import "../app/globals-sidebar.css";

export default async function DashboardLayout({ children, currentPath }: { children: React.ReactNode, currentPath: string }) {
  // Fetch projects data for the switcher
  const allProjects = await getAllProjects();
  const activeProject = await getActiveProject();

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-slate-200 font-sans overflow-hidden">

      {/* Sidebar Navigation - PEEC Style */}
      <aside className="w-60 border-r border-slate-800 bg-[#0f0f13] flex flex-col shrink-0">

        {/* Project Switcher */}
        <div className="px-3 pt-4 pb-2">
          <ProjectSwitcher
            projects={allProjects.map(p => ({ id: p.id, name: p.name }))}
            activeProjectId={activeProject.id}
            activeProjectName={activeProject.name}
            userEmail={process.env.NEXT_PUBLIC_USER_EMAIL || "admin@workspace.com"}
            switchProjectAction={switchProject}
            createProjectAction={createProject}
          />
        </div>

        {/* Scrollable Nav */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-hide">

          {/* General */}
          <div className="sidebar-section-label">General</div>
          <NavItem href="/" icon={<LayoutDashboard size={16} />} label="Overview" active={currentPath === "/"} />
          <NavItem href="/prompts" icon={<MessageSquare size={16} />} label="Prompts" active={currentPath === "/prompts"} />

          {/* Sources */}
          <div className="sidebar-section-label">Sources</div>
          <NavItem href="/domains" icon={<Globe size={16} />} label="Domains" active={currentPath === "/domains"} />
          <NavItem href="/urls" icon={<Link2 size={16} />} label="URLs" active={currentPath === "/urls"} />

          {/* Brand */}
          <div className="sidebar-section-label">Brand</div>
          <NavItem href="/insights" icon={<Eye size={16} />} label="Insights" active={currentPath === "/insights"} badge="★" />

          {/* Actions */}
          <div className="sidebar-section-label">Actions</div>
          <NavItem href="/earned" icon={<TrendingUp size={16} />} label="Earned" active={currentPath === "/earned"} suffix="Off-page" />
          <NavItem href="/owned" icon={<Crosshair size={16} />} label="Owned" active={currentPath === "/owned"} suffix="On-page" />
          <NavItem href="/impact" icon={<BarChart3 size={16} />} label="Impact" active={currentPath === "/impact"} />

          {/* Agent Analytics */}
          <div className="sidebar-section-label">Agent analytics</div>
          <NavItem href="/crawl-insights" icon={<Bug size={16} />} label="Crawl Insights" active={currentPath === "/crawl-insights"} />
          <NavItem href="/crawlability" icon={<Activity size={16} />} label="Crawlability" active={currentPath === "/crawlability"} />

          {/* Project */}
          <div className="sidebar-section-label">Project</div>
          <NavItem href="/profile" icon={<UserCircle size={16} />} label="Profile" active={currentPath === "/profile"} badge="★" />
          <NavItem href="/brands" icon={<Sparkles size={16} />} label="Brands" active={currentPath === "/brands"} />
          <NavItem href="/tags" icon={<Tag size={16} />} label="Tags" active={currentPath === "/tags"} />

          {/* Company */}
          <div className="sidebar-section-label">Company</div>
          <NavItem href="/settings" icon={<Settings size={16} />} label="Settings" active={currentPath === "/settings"} />
          <NavItem href="/projects" icon={<FolderOpen size={16} />} label="Projects" active={currentPath === "/projects"} />
          <NavItem href="/api-keys" icon={<Key size={16} />} label="API Keys" active={currentPath === "/api-keys"} />
          <NavItem href="/members" icon={<Users size={16} />} label="Members" active={currentPath === "/members"} />
        </nav>

        {/* Setup Progress */}
        <div className="p-3 border-t border-slate-800">
          <div className="sidebar-setup">
            <div className="sidebar-setup-title">
              Get set up · {allProjects.length}/{Math.max(5, allProjects.length)}
            </div>
            <div className="sidebar-setup-progress">
              <div className="sidebar-setup-bar" style={{ width: `${Math.min(100, (allProjects.length / 5) * 100)}%` }} />
            </div>
            <div className="sidebar-setup-text">
              Organize your prompts and insights into themes.
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-96 bg-indigo-900/10 blur-[120px] -z-10 rounded-full" />

        {/* Header */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-slate-800/50 backdrop-blur-sm z-10 shrink-0">
          <div className="relative w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search metrics, brands, or prompts..."
              className="w-full bg-[#141418] border border-slate-800 text-sm rounded-lg pl-10 pr-4 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-500 text-slate-200"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center bg-slate-800 rounded px-1.5 py-0.5">
              <Command className="w-3 h-3 text-slate-400 mr-1" />
              <span className="text-xs font-medium text-slate-400">K</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button className="text-slate-400 hover:text-white transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-indigo-500 rounded-full"></span>
            </button>
            <button className="text-slate-400 hover:text-white transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <div className="flex-1 overflow-auto p-6 z-10 scrollbar-hide">
          <div className="w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ href, icon, label, active = false, badge, suffix }: any) {
  return (
    <NextLink href={href} className={`flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg transition-colors group text-[13px] ${active
      ? "bg-indigo-500/10 text-indigo-400"
      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
      }`}>
      {icon}
      <span className="font-medium flex-1">{label}</span>
      {badge && <span className="text-amber-400 text-[10px]">{badge}</span>}
      {suffix && <span className="text-[10px] text-slate-600">{suffix}</span>}
    </NextLink>
  );
}
