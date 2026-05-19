import { LuInfo, LuEllipsis, LuChartLine, LuChartColumn } from "react-icons/lu";

type Series = { name: string; color: string; data: number[] };

const SERIES: Series[] = [
  { name: "Thrive", color: "#b45309", data: [37, 39, 38.5, 38, 37.5, 38, 38] },
  { name: "WebFX", color: "#0e7490", data: [33, 33.5, 33, 32.8, 33, 33.5, 33] },
  { name: "SmartSites", color: "#a16207", data: [22, 21.5, 21, 21.5, 21, 20.5, 21] },
  { name: "Ignite", color: "#dc2626", data: [16, 15.5, 15, 14.8, 15, 15.2, 15] },
  { name: "Disruptive", color: "#b91c1c", data: [14.5, 14, 13.8, 13.5, 14, 14.2, 14] },
  { name: "Victorious", color: "#0891b2", data: [12, 11.8, 11.5, 11.2, 11, 11.2, 11] },
  { name: "KlientBoost", color: "#06b6d4", data: [10.5, 10.2, 10, 10.1, 10.3, 10.2, 10] },
];

const LABELS = ["6 Apr", "", "13 Apr", "", "20 Apr", "27 Apr", "4 May"];
const Y_TICKS = [0, 10, 20, 30, 40];

const W = 640;
const H = 240;
const PAD = { l: 36, r: 16, t: 12, b: 28 };
const innerW = W - PAD.l - PAD.r;
const innerH = H - PAD.t - PAD.b;

function pathFor(data: number[]) {
  const max = 40;
  const stepX = innerW / (data.length - 1);
  return data
    .map((v, i) => {
      const x = PAD.l + i * stepX;
      const y = PAD.t + innerH * (1 - v / max);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function VisibilityChart() {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-900">
          Visibility
          <LuInfo className="h-3.5 w-3.5 text-zinc-400" />
        </div>
        <div className="flex items-center gap-1">
          <div className="flex overflow-hidden rounded-md border border-zinc-200 text-[11px]">
            <button className="px-2 py-1 text-zinc-500 hover:bg-zinc-50">D</button>
            <button className="bg-zinc-900 px-2 py-1 font-medium text-white">W</button>
            <button className="px-2 py-1 text-zinc-500 hover:bg-zinc-50">M</button>
          </div>
          <button className="rounded-md p-1 text-zinc-400 hover:bg-zinc-50">
            <LuEllipsis className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative mt-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {Y_TICKS.map((t) => {
            const y = PAD.t + innerH * (1 - t / 40);
            return (
              <g key={t}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="#f4f4f5" strokeWidth={1} />
                <text x={PAD.l - 6} y={y + 3} textAnchor="end" className="fill-zinc-400" fontSize={10}>
                  {t}%
                </text>
              </g>
            );
          })}

          {SERIES.map((s) => (
            <g key={s.name}>
              <path d={pathFor(s.data)} fill="none" stroke={s.color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
              {s.data.map((v, i) => {
                const stepX = innerW / (s.data.length - 1);
                const x = PAD.l + i * stepX;
                const y = PAD.t + innerH * (1 - v / 40);
                return <circle key={i} cx={x} cy={y} r={2} fill={s.color} />;
              })}
            </g>
          ))}

          {LABELS.map((label, i) => {
            if (!label) return null;
            const stepX = innerW / (LABELS.length - 1);
            const x = PAD.l + i * stepX;
            return (
              <text key={i} x={x} y={H - 8} textAnchor="middle" className="fill-zinc-400" fontSize={10}>
                {label}
              </text>
            );
          })}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-3xl font-semibold tracking-tight text-zinc-100">
          Peec AI
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs text-zinc-500">
        <span>Showing data for 30 days</span>
        <div className="flex gap-1">
          <button className="rounded border border-zinc-200 bg-white p-1 text-zinc-700">
            <LuChartLine className="h-3.5 w-3.5" />
          </button>
          <button className="rounded border border-zinc-200 bg-zinc-50 p-1 text-zinc-700">
            <LuChartColumn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}
