import DashboardLayout from "../../components/DashboardLayout";
import { checkAllKeys, KeyStatus } from "../../lib/api-keys-status";
import { CheckCircle2, XCircle, AlertCircle, Key as KeyIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const statuses = await checkAllKeys();
  const okCount = statuses.filter((s) => s.ok).length;
  const configuredCount = statuses.filter((s) => s.configured).length;

  return (
    <DashboardLayout currentPath="/api-keys">
      <div className="max-w-5xl">
        <div className="flex items-center gap-3 mb-2">
          <KeyIcon className="w-6 h-6 text-indigo-400" />
          <h1 className="text-2xl font-semibold text-slate-100">API Keys</h1>
        </div>
        <p className="text-sm text-slate-400 mb-6">
          Live status for each AI engine. Each row pings the provider with a tiny request.
          Edit <code className="text-indigo-300 bg-slate-900/60 px-1.5 py-0.5 rounded text-xs">.env.local</code> and reload to refresh.
        </p>

        <div className="flex gap-3 mb-6">
          <Stat label="Working" value={`${okCount} / ${statuses.length}`} tone={okCount === statuses.length ? "good" : okCount === 0 ? "bad" : "warn"} />
          <Stat label="Configured" value={`${configuredCount} / ${statuses.length}`} tone="neutral" />
        </div>

        <div className="space-y-2">
          {statuses.map((s) => (
            <KeyRow key={s.envVar} s={s} />
          ))}
        </div>

        <form action={refreshAction} className="mt-6">
          <button
            type="submit"
            className="px-4 py-2 text-sm rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 transition-colors"
          >
            Re-check all keys
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}

async function refreshAction() {
  "use server";
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/api-keys");
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "good" | "bad" | "warn" | "neutral" }) {
  const toneClass = {
    good: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
    bad: "border-rose-500/30 bg-rose-500/5 text-rose-300",
    warn: "border-amber-500/30 bg-amber-500/5 text-amber-300",
    neutral: "border-slate-700 bg-slate-900/40 text-slate-300",
  }[tone];
  return (
    <div className={`px-4 py-2 rounded-lg border ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function KeyRow({ s }: { s: KeyStatus }) {
  const icon = s.ok ? (
    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
  ) : !s.configured ? (
    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
  ) : (
    <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
  );

  const statusLabel = s.ok ? "OK" : !s.configured ? "Not configured" : "Failing";
  const statusClass = s.ok
    ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
    : !s.configured
    ? "text-amber-300 bg-amber-500/10 border-amber-500/20"
    : "text-rose-300 bg-rose-500/10 border-rose-500/20";

  return (
    <div className="flex items-start gap-3 p-4 rounded-lg border border-slate-800 bg-[#0f0f13]">
      {icon}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-slate-100">{s.engine}</h3>
          <code className="text-xs text-slate-400 bg-slate-900/60 px-1.5 py-0.5 rounded">
            {s.envVar}
          </code>
          <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${statusClass}`}>
            {statusLabel}
          </span>
          {typeof s.latencyMs === "number" && (
            <span className="text-[10px] text-slate-500">{s.latencyMs} ms</span>
          )}
        </div>
        {s.reason && (
          <div className="mt-1.5 text-xs text-rose-300/90 break-words">
            <span className="text-rose-400/70">Error:</span> {s.reason}
          </div>
        )}
        {!s.ok && s.hint && (
          <div className="mt-1 text-xs text-slate-500">{s.hint}</div>
        )}
      </div>
    </div>
  );
}
