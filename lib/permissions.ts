export type MemberRole = "owner" | "company_member" | "project_member" | "project_viewer";

// ── Permission checks ──────────────────────────────────────────────────────

/** Can invite members, remove members, change member roles */
export function canManageMembers(role: string): boolean {
  return role === "owner" || role === "company_member";
}

/** Can create/edit prompts, brands, projects, run scans */
export function canEdit(role: string): boolean {
  return role === "owner" || role === "company_member" || role === "project_member";
}

/** Can run AI scans */
export function canRunScans(role: string): boolean {
  return role === "owner" || role === "company_member" || role === "project_member";
}

/** Can change workspace-level settings (name, plan, etc.) */
export function canManageWorkspace(role: string): boolean {
  return role === "owner";
}

/** All authenticated users can view */
export function canView(role: string): boolean {
  return true;
}

// ── UI labels & colours ────────────────────────────────────────────────────

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  company_member: "Company Member",
  project_member: "Project Member",
  project_viewer: "Project Viewer",
};

export const ROLE_COLORS: Record<string, string> = {
  owner:          "member-badge--amber",
  company_member: "member-badge--blue",
  project_member: "member-badge--green",
  project_viewer: "member-badge--gray",
};

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner:          "Full control — workspace settings, billing, all data",
  company_member: "Manage team members + edit all projects and brands",
  project_member: "Edit projects, prompts and brands — cannot manage members",
  project_viewer: "View-only — dashboards, reports and chats (no editing)",
};

// What each role can do — used for the permissions summary table in /members
export const ROLE_PERMISSIONS: Record<string, {
  view: boolean;
  edit: boolean;
  runScans: boolean;
  manageMembers: boolean;
  workspaceSettings: boolean;
}> = {
  owner:          { view: true, edit: true, runScans: true, manageMembers: true,  workspaceSettings: true  },
  company_member: { view: true, edit: true, runScans: true, manageMembers: true,  workspaceSettings: false },
  project_member: { view: true, edit: true, runScans: true, manageMembers: false, workspaceSettings: false },
  project_viewer: { view: true, edit: false, runScans: false, manageMembers: false, workspaceSettings: false },
};
