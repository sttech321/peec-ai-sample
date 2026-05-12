import { LuInfo } from "react-icons/lu";

type Type = { label: string; pct: number; color: string };

const TYPES: Type[] = [
  { label: "Corporate", pct: 71, color: "bg-emerald-500" },
  { label: "You", pct: 7, color: "bg-emerald-600" },
  { label: "Competitor", pct: 5, color: "bg-rose-500" },
  { label: "UGC", pct: 5, color: "bg-cyan-500" },
  { label: "Other", pct: 4, color: "bg-zinc-400" },
  { label: "Reference", pct: 3, color: "bg-amber-500" },
  { label: "Editorial", pct: 3, color: "bg-violet-500" },
  { label: "Institutional", pct: 1, color: "bg-blue-500" },
];

export function DomainTypes() {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white">
      <header className="flex items-center justify-between px-4 py-3">
        <div className="text-sm font-medium text-zinc-900">Domain types</div>
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <LuInfo className="h-3.5 w-3.5 text-zinc-400" />
          Total citations: 283.4k
        </div>
      </header>

      <ul className="divide-y divide-zinc-50">
        {TYPES.map((t) => (
          <li key={t.label} className="flex items-center gap-3 px-4 py-2.5">
            <span className={`h-1.5 w-1.5 rounded-full ${t.color}`} />
            <span className="w-24 text-sm text-zinc-700">{t.label}</span>
            <div className="relative flex-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                <div className={`h-full rounded-full ${t.color}`} style={{ width: `${t.pct}%` }} />
              </div>
            </div>
            <span className="w-10 text-right text-xs text-zinc-500">{t.pct}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
