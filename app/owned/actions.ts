"use server";

import { db } from "../../db";
import { ownedActions } from "../../db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateOwnedActionStatus(actionId: string, status: string) {
  await db
    .update(ownedActions)
    .set({ status, updatedAt: new Date() })
    .where(eq(ownedActions.id, actionId));

  revalidatePath("/owned");
}
