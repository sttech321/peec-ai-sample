import { LuInfo, LuSettings, LuArrowUpRight, LuMaximize2 } from "react-icons/lu";

type Row = {
  rank: number;
  brand: string;
  initial: string;
  color: string;
  visibility: number;
  visibilityDelta: number;
  sov: number;
  sovDelta: number;
  sentiment: number;
  sentimentDelta: number;
  position: number;
  positionDelta: number;
};

const ROWS: Row[] = [
  { rank: 1, brand: "WebFX", initial: "W", color: "bg-orange-500", visibility: 33, visibilityDelta: -0.9, sov: 14, sovDelta: 0.4, sentiment: 67, sentimentDelta: -2, position: 3.4, positionDelta: -1.1 },
  { rank: 2, brand: "SmartSites", initial: "S", color: "bg-amber-700", visibility: 21, visibilityDelta: -1.0, sov: 9, sovDelta: 0.1, sentiment: 71, sentimentDelta: -4, position: 4.0, positionDelta: -1.1 },
  { rank: 3, brand: "Ignite", initial: "I", color: "bg-red-500", visibility: 15, visibilityDelta: 0.3, sov: 6, sovDelta: 0.4, sentiment: 69, sentimentDelta: -1, position: 3.6, positionDelta: -0.8 },
  { rank: 4, brand: "Disruptive", initial: "D", color: "bg-rose-700", visibility: 14, visibilityDelta: -0.3, sov: 5, sovDelta: 0.1, sentiment: 55, sentimentDelta: -4, position: 4.1, positionDelta: -1.1 },
  { rank: 5, brand: "Victorious", initial: "V", color: "bg-cyan-700", visibility: 11, visibilityDelta: -0.5, sov: 4, sovDelta: 0.0, sentiment: 70, sentimentDelta: -4, position: 3.8, positionDelta: -0.9 },
  { rank: 6, brand: "KlientBoost", initial: "K", color: "bg-cyan-500", visibility: 10, visibilityDelta: 0.3, sov: 4, sovDelta: 0.3, sentiment: 67, sentimentDelta: -2, position: 4.0, positionDelta: -0.8 },
  { rank: 18, brand: "Thrive", initial: "T", color: "bg-emerald-500", visibility: 38, visibilityDelta: -3.6, sov: 20, sovDelta: -1.5, sentiment: 66, sentimentDelta: -2, position: 3.1, positionDelta: -1.0 },
];

function Delta({ v, invert = false }: { v: number; invert?: boolean }) {
  const positive = invert ? v < 0 : v > 0;
  const cls = v === 0 ? "text-zinc-400" : positive ? "text-emerald-600" : "text-rose-500";
  const sign = v > 0 ? "+" : "";
  return <span className={`ml-1 text-[10px] ${cls}`}>{sign}{v.toFixed(1).replace(/\.0$/, "")}</span>;
}

function SentimentDot({ v }: { v: number }) {
  const color = v >= 70 ? "bg-emerald-500" : v >= 60 ? "bg-amber-500" : "bg-rose-500";
  return <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${color}`} />;
}

export function TopBrandsTable() {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white">
      <header className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-900">
          Top 7 Brands
          <LuInfo className="h-3.5 w-3.5 text-zinc-400" />
        </div>
        <div className="flex items-center gap-1 text-zinc-400">
          <button className="rounded p-1 hover:bg-zinc-50">
            <LuSettings className="h-3.5 w-3.5" />
          </button>
          <button className="rounded p-1 hover:bg-zinc-50">
            <LuArrowUpRight className="h-3.5 w-3.5" />
          </button>
          <button className="rounded p-1 hover:bg-zinc-50">
            <LuMaximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-zinc-100 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              <th className="px-4 py-2 text-left font-medium">#</th>
              <th className="px-2 py-2 text-left font-medium">Brand</th>
              <th className="px-2 py-2 text-right font-medium">Visibility</th>
              <th className="px-2 py-2 text-right font-medium">SOV</th>
              <th className="px-2 py-2 text-right font-medium">Sentiment</th>
              <th className="px-4 py-2 text-right font-medium">Position</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.brand} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50">
                <td className="px-4 py-2.5 text-zinc-500">{r.rank}</td>
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-medium text-white ${r.color}`}>
                      {r.initial}
                    </span>
                    <span className="font-medium text-zinc-900">{r.brand}</span>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-right">
                  <span className="text-zinc-900">{r.visibility}%</span>
                  <Delta v={r.visibilityDelta} />
                </td>
                <td className="px-2 py-2.5 text-right">
                  <span className="text-zinc-900">{r.sov}%</span>
                  <Delta v={r.sovDelta} />
                </td>
                <td className="px-2 py-2.5 text-right">
                  <SentimentDot v={r.sentiment} />
                  <span className="text-zinc-900">{r.sentiment}</span>
                  <Delta v={r.sentimentDelta} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className="text-zinc-900">#{r.position}</span>
                  <Delta v={r.positionDelta} invert />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
