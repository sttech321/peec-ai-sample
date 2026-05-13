"use server";

import { db } from "../../db";
import { earnedActions, ownedActions } from "../../db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Update the status of an action, dispatched to the correct table by `kind`.
 * Used by the Impact page's Todo list to mark items done/declined.
 */
export async function updateImpactActionStatus(args: {
  id: string;
  kind: "earned" | "owned";
  status: "done" | "declined" | "todo";
}) {
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
  revalidatePath("/impact");
  revalidatePath("/earned");
  revalidatePath("/owned");
}
