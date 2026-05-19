"use server";

import { db } from "../../db";
import { ownedActions, actionHistory } from "../../db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "../../lib/session";

async function getAuditContext(): Promise<{ workspaceId: string; email: string | undefined }> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(SESSION_COOKIE)?.value;
    if (raw) {
      const session = verifySession(raw);
      if (session) return { workspaceId: session.workspaceId, email: session.email };
    }
  } catch {}
  return { workspaceId: "unknown", email: undefined };
}

export async function updateOwnedActionStatus(actionId: string, status: string) {
  const { workspaceId, email } = await getAuditContext();

  await db
    .update(ownedActions)
    .set({ status, updatedAt: new Date() })
    .where(eq(ownedActions.id, actionId));

  await db.insert(actionHistory).values({
    workspaceId,
    actionId,
    actionKind: "owned",
    status,
    changedBy: email ?? null,
  });

  revalidatePath("/owned");
  revalidatePath("/impact");
}
