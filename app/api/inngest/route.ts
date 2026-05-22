import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";

// Lazy-load the function definitions on first request so that visiting any
// unrelated page doesn't drag in the inngest module graph (which transitively
// pulls db, db/schema, lib/ai-clients, lib/generate-actions). On a slow disk
// that's 10–20s of compilation the first time it's touched.
type AppHandler = (req: Request) => Promise<Response> | Response;
type AppHandlers = { GET: AppHandler; POST: AppHandler; PUT: AppHandler };

let handlersPromise: Promise<AppHandlers> | null = null;

function getHandlers(): Promise<AppHandlers> {
  if (!handlersPromise) {
    handlersPromise = import("../../../inngest/functions").then(
      (mod) =>
        serve({
          client: inngest,
          functions: [
            mod.runPromptPipeline,
            mod.scheduleDailyScans,
            mod.generateDailyActions,
          ],
        }) as unknown as AppHandlers,
    );
  }
  return handlersPromise;
}

export async function GET(req: Request) {
  const h = await getHandlers();
  return h.GET(req);
}

export async function POST(req: Request) {
  const h = await getHandlers();
  return h.POST(req);
}

export async function PUT(req: Request) {
  const h = await getHandlers();
  return h.PUT(req);
}
