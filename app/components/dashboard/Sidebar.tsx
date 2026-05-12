import { ReactNode } from "react";
import {
  LuHouse,
  LuMessageSquare,
  LuGlobe,
  LuLink2,
  LuBookOpen,
  LuFileText,
  LuClipboard,
  LuClipboardCheck,
  LuActivity,
  LuSearch,
  LuUser,
  LuBuilding2,
  LuTag,
  LuSettings,
  LuFolder,
  LuKey,
  LuUsers,
  LuCreditCard,
  LuGift,
  LuChevronDown,
  LuSparkles,
} from "react-icons/lu";

type Item = { label: string; icon: ReactNode; active?: boolean; sub?: string; dot?: boolean };
type Section = { title?: string; beta?: boolean; items: Item[] };

const ICON_CLS = "h-[18px] w-[18px] shrink-0";

const sections: Section[] = [
  {
    title: "General",
    items: [
      { label: "Overview", icon: <LuHouse className={ICON_CLS} />, active: true },
      { label: "Prompts", icon: <LuMessageSquare className={ICON_CLS} /> },
    ],
  },
  {
    title: "Sources",
    items: [
      { label: "Domains", icon: <LuGlobe className={ICON_CLS} /> },
      { label: "URLs", icon: <LuLink2 className={ICON_CLS} /> },
    ],
  },
  {
    title: "Brand",
    items: [{ label: "Insights", icon: <LuBookOpen className={ICON_CLS} />, dot: true }],
  },
  {
    title: "Actions",
    beta: true,
    items: [
      { label: "Earned", icon: <LuFileText className={ICON_CLS} />, sub: "Off-page" },
      { label: "Owned", icon: <LuClipboard className={ICON_CLS} />, sub: "On-page" },
      { label: "Impact", icon: <LuActivity className={ICON_CLS} /> },
    ],
  },
  {
    title: "Agent analytics",
    beta: true,
    items: [
      { label: "Crawl insights", icon: <LuSearch className={ICON_CLS} /> },
      { label: "Crawlability", icon: <LuClipboardCheck className={ICON_CLS} /> },
    ],
  },
  {
    title: "Project",
    items: [
      { label: "Profile", icon: <LuUser className={ICON_CLS} /> },
      { label: "Brands", icon: <LuBuilding2 className={ICON_CLS} /> },
      { label: "Tags", icon: <LuTag className={ICON_CLS} /> },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "Settings", icon: <LuSettings className={ICON_CLS} /> },
      { label: "Projects", icon: <LuFolder className={ICON_CLS} /> },
      { label: "API Keys", icon: <LuKey className={ICON_CLS} /> },
      { label: "Members", icon: <LuUsers className={ICON_CLS} /> },
      { label: "Billing", icon: <LuCreditCard className={ICON_CLS} /> },
    ],
  },
];

export function Sidebar() {
  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-white">
      <div className="flex h-14 items-center gap-2 px-4 border-b border-zinc-100">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-emerald-400 to-cyan-500 text-white">
          <LuSparkles className="h-4 w-4" />
        </div>
        <div className="flex-1 truncate text-[14px] font-semibold tracking-tight text-zinc-900">Thrive Interne...</div>
        <LuChevronDown className="h-4 w-4 text-zinc-400" />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 text-sm">
        {sections.map((section) => (
          <div key={section.title} className="mb-2">
            {section.title && (
              <div className="flex items-center gap-1.5 px-3 pb-1 pt-3 text-[12px] font-medium text-zinc-500">
                {section.title}
                {section.beta && (
                  <span className="rounded bg-zinc-100 px-1.5 py-px text-[10px] font-medium text-zinc-500">
                    Beta
                  </span>
                )}
              </div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.label}>
                  <a
                    href="#"
                    className={[
                      "group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[14px] text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900",
                      item.active ? "bg-zinc-100 font-medium text-zinc-900" : "font-normal",
                    ].join(" ")}
                  >
                    <span className={item.active ? "text-zinc-900" : "text-zinc-500 group-hover:text-zinc-700"}>
                      {item.icon}
                    </span>
                    <span className="flex-1 truncate">
                      {item.label}
                      {item.sub && <span className="ml-1.5 font-normal text-zinc-400">· {item.sub}</span>}
                    </span>
                    {item.dot && <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="m-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
        <div className="text-[13px] font-semibold tracking-tight text-zinc-900">
          Get set up <span className="text-zinc-400">· 3/5</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
          <div className="h-full w-3/5 rounded-full bg-blue-500" />
        </div>
        <p className="mt-2 text-[13px] leading-snug text-zinc-500">
          Organize your prompts and insights into themes.
        </p>
      </div>

      <div className="border-t border-zinc-100 px-4 py-3">
        <a href="#" className="flex items-center gap-2 text-[14px] font-normal text-zinc-700 hover:text-zinc-900">
          <LuGift className="h-4 w-4 text-zinc-500" />
          Refer &amp; Earn
        </a>
      </div>
    </aside>
  );
}
