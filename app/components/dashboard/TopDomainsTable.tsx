import { LuArrowUpRight } from "react-icons/lu";

type Type = "You" | "Corporate" | "UGC";
type Row = { domain: string; favicon: string; faviconBg: string; retrieved: number; citation: number; type: Type };

const ROWS: Row[] = [
  { domain: "thriveagency.com", favicon: "T", faviconBg: "bg-emerald-500", retrieved: 41.2, citation: 1.7, type: "You" },
  { domain: "clutch.co", favicon: "C", faviconBg: "bg-rose-500", retrieved: 33.1, citation: 1.3, type: "Corporate" },
  { domain: "designrush.com", favicon: "D", faviconBg: "bg-blue-600", retrieved: 21.4, citation: 0.9, type: "Corporate" },
  { domain: "semrush.com", favicon: "S", faviconBg: "bg-orange-500", retrieved: 13.7, citation: 0.9, type: "Corporate" },
  { domain: "reddit.com", favicon: "R", faviconBg: "bg-orange-600", retrieved: 13.6, citation: 1.0, type: "UGC" },
  { domain: "firstpagesage.com", favicon: "F", faviconBg: "bg-indigo-500", retrieved: 13.6, citation: 1.2, type: "Corporate" },
  { domain: "onelittleweb.com", favicon: "O", faviconBg: "bg-violet-500", retrieved: 10.1, citation: 1.1, type: "Corporate" },
  { domain: "marketingltb.com", favicon: "M", faviconBg: "bg-fuchsia-500", retrieved: 9.2, citation: 1.5, type: "Corporate" },
];

const typeStyles: Record<Type, string> = {
  You: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Corporate: "bg-zinc-100 text-zinc-700 border-zinc-200",
  UGC: "bg-cyan-50 text-cyan-700 border-cyan-200",
};

export function TopDomainsTable() {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white">
      <header className="flex items-start justify-between px-4 py-3">
        <div>
          <div className="text-sm font-medium text-zinc-900">Top Domains</div>
          <div className="text-xs text-zinc-500">Top domains retrieved by AI models in their answers</div>
        </div>
        <button className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50">
          All domains
          <LuArrowUpRight className="h-3 w-3 text-zinc-400" />
        </button>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-zinc-100 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              <th className="px-4 py-2 text-left font-medium">Domain</th>
              <th className="px-2 py-2 text-right font-medium">Retrieved</th>
              <th className="px-2 py-2 text-right font-medium">Citation rate</th>
              <th className="px-4 py-2 text-right font-medium">Type</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.domain} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-4 w-4 items-center justify-center rounded text-[9px] font-medium text-white ${r.faviconBg}`}>
                      {r.favicon}
                    </span>
                    <span className="text-zinc-900">{r.domain}</span>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-right text-zinc-900">{r.retrieved.toFixed(1)}%</td>
                <td className="px-2 py-2.5 text-right text-zinc-900">{r.citation.toFixed(1)}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${typeStyles[r.type]}`}>
                    {r.type}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
