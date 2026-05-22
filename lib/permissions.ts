export type MemberRole = "owner" | "company_member" | "project_member" | "project_viewer";

export function canManageMembers(role: string): boolean {
  return role === "owner" || role === "company_member";
}

export function canEdit(role: string): boolean {
  return role === "owner" || role === "company_member" || role === "project_member";
}

export function canView(role: string): boolean {
  return true; // all authenticated roles can view
}

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  company_member: "Company Member",
  project_member: "Project Member",
  project_viewer: "Project Viewer",
};

export const ROLE_COLORS: Record<string, string> = {
  owner: "member-badge--blue",
  company_member: "member-badge--blue",
  project_member: "member-badge--green",
  project_viewer: "member-badge--gray",
};
