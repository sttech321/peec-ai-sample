import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";

export const dynamic = "force-dynamic";

type AppHandler = (req: Request) => Promise<Response> | Response;
type AppHandlers = { GET: AppHandler; POST: AppHandler; PUT: AppHandler };

const ok = () => new Response("ok", { status: 200 });

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

async function handle(method: "GET" | "POST" | "PUT", req: Request): Promise<Response> {
  try {
    const h = await getHandlers();
    return await h[method](req);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException & { cause?: { code?: string } })?.cause?.code;
    if (code === "ECONNREFUSED" || code === "ENOTFOUND") {
      console.warn("[inngest] No Inngest server reachable — skipping registration.");
      return ok();
    }
    throw err;
  }
}

export function GET(req: Request) { return handle("GET", req); }
export function POST(req: Request) { return handle("POST", req); }
export function PUT(req: Request) { return handle("PUT", req); }
