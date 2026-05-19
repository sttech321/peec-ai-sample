import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";
import { runPromptPipeline, scheduleDailyScans, generateDailyActions } from "../../../inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    runPromptPipeline,
    scheduleDailyScans,
    generateDailyActions,
  ],
});
