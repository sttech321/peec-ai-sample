import { inngest } from "@/lib/inngest/client";

export const helloWorld = inngest.createFunction(
  { id: "hello-world", triggers: [{ event: "test/hello" }] },
  async ({ event, step }) => {
    const greeting = await step.run(
      "greet",
      () => `Hello, ${(event.data as { name?: string } | undefined)?.name ?? "world"}!`,
    );
    return { ok: true, greeting, receivedAt: new Date().toISOString() };
  },
);
