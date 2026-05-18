"use server";

import { db } from "../../db";
import { earnedActions, ownedActions, actionHistory } from "../../db/schema";
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

export async function updateImpactActionStatus(args: {
  id: string;
  kind: "earned" | "owned";
  status: "done" | "declined" | "todo";
}) {
  const { workspaceId, email } = await getAuditContext();

  if (args.kind === "earned") {
    await db
      .update(earnedActions)
      .set({ status: args.status, updatedAt: new Date() })
      .where(eq(earnedActions.id, args.id));
  } else {
    await db
      .update(ownedActions)
      .set({ status: args.status, updatedAt: new Date() })
      .where(eq(ownedActions.id, args.id));
  }

  await db.insert(actionHistory).values({
    workspaceId,
    actionId: args.id,
    actionKind: args.kind,
    status: args.status,
    changedBy: email ?? null,
  });

  revalidatePath("/impact");
  revalidatePath("/earned");
  revalidatePath("/owned");
}
