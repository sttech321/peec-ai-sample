import { db } from "../db";
import { users, roles, workspaces, userRoles } from "../db/schema";
import { eq } from "drizzle-orm";

export type AuthProvider = "magic_link" | "google" | "microsoft";

interface UpsertUserOptions {
  email: string;
  name?: string;
  provider: AuthProvider;
  role: string; // owner | admin | member | viewer
}

interface UpsertUserResult {
  userId: string;
  workspaceId: string; // UUID from workspaces table
}

async function ensureRole(name: string): Promise<string> {
  await db.insert(roles).values({ name }).onConflictDoNothing();
  const [row] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, name)).limit(1);
  return row.id;
}

export async function upsertUser({
  email,
  name,
  provider,
  role,
}: UpsertUserOptions): Promise<UpsertUserResult> {
  // 1. Upsert user record
  const [user] = await db
    .insert(users)
    .values({ email, name: name ?? null, provider, isVerified: true, lastLoginAt: new Date() })
    .onConflictDoUpdate({
      target: users.email,
      set: { lastLoginAt: new Date(), updatedAt: new Date(), provider, ...(name ? { name } : {}) },
    })
    .returning({ id: users.id });

  // 2. Upsert workspace — one per owner user
  const [workspace] = await db
    .insert(workspaces)
    .values({ ownerUserId: user.id, name: email })
    .onConflictDoUpdate({
      target: workspaces.ownerUserId,
      set: { updatedAt: new Date() },
    })
    .returning({ id: workspaces.id });

  // 3. Ensure role exists, then upsert user_role
  const roleId = await ensureRole(role);
  await db
    .insert(userRoles)
    .values({ userId: user.id, workspaceId: workspace.id, roleId, assignedBy: email })
    .onConflictDoNothing();

  return { userId: user.id, workspaceId: workspace.id };
}
