import { ComponentType } from "react";
import { SiOpenai, SiGoogle, SiClaude, SiPerplexity, SiGooglegemini } from "react-icons/si";

type IconProps = { className?: string };

type Chat = {
  Engine: ComponentType<IconProps>;
  engineColor: string;
  title: string;
  excerpt: string;
  age: string;
  citations?: number;
};

const CHATS: Chat[] = [
  {
    Engine: SiOpenai,
    engineColor: "text-emerald-600",
    title: "Which SEO agencies specialize in link building services?",
    excerpt: "In 2026, the SEO landscape has shifted toward high-quality, editorial-first link building, largely driven by the need for...",
    age: "16 hr ago",
  },
  {
    Engine: SiGooglegemini,
    engineColor: "text-blue-500",
    title: "Which SEO agencies specialize in link building services?",
    excerpt: "Several SEO agencies specialize specifically in link building, ranging from premium boutique firms to high-volume white...",
    age: "16 hr ago",
  },
  {
    Engine: SiPerplexity,
    engineColor: "text-cyan-700",
    title: "Which SEO agencies specialize in link building services?",
    excerpt: "Top SEO agencies specializing in link building include Rhino Rank (best overall), Siege Media (content-led), uSERP (P...",
    age: "16 hr ago",
  },
  {
    Engine: SiClaude,
    engineColor: "text-orange-600",
    title: "Which SEO agencies specialize in link building services?",
    excerpt: "Here are reputable SEO agencies that specialize in link-building services. I've included a mix of established firms...",
    age: "16 hr ago",
    citations: 2,
  },
  {
    Engine: SiGoogle,
    engineColor: "text-violet-500",
    title: "What digital marketing agencies design high-converti...",
    excerpt: 'Finding an agency that designs "high-converting" pages means looking for those that prioritize psychology, dat...',
    age: "16 hr ago",
  },
];

export function RecentChats() {
  return (
    <section>
      <header className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-sm font-medium text-zinc-900">Recent Chats</h2>
          <p className="text-xs text-zinc-500">Where AI gets its information about this brand</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-600">
          <span className="relative inline-flex h-4 w-7 items-center rounded-full bg-zinc-200">
            <span className="ml-0.5 inline-block h-3 w-3 rounded-full bg-white shadow" />
          </span>
          Thrive mentioned
        </label>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {CHATS.map((c, i) => (
          <article key={i} className="rounded-xl border border-zinc-200 bg-white p-3">
            <div className="flex items-start gap-2 text-sm font-medium text-zinc-900">
              <c.Engine className={`mt-0.5 h-4 w-4 shrink-0 ${c.engineColor}`} />
              <span className="line-clamp-2">{c.title}</span>
            </div>
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-zinc-500">{c.excerpt}</p>
            <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
              <div className="flex items-center gap-1">
                {c.citations && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600">
                    {c.citations}
                  </span>
                )}
                <span className="inline-block h-3 w-3 rounded-full bg-zinc-200" />
                <span className="inline-block h-3 w-3 rounded-full bg-emerald-200" />
                <span className="inline-block h-3 w-3 rounded-full bg-amber-200" />
              </div>
              <span>{c.age}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
