"use server";

import { db } from "../../db";
import { earnedActions } from "../../db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateActionStatus(actionId: string, status: string) {
  await db
    .update(earnedActions)
    .set({ 
      status: status as any,
      updatedAt: new Date()
    })
    .where(eq(earnedActions.id, actionId));

  revalidatePath("/earned");
}
