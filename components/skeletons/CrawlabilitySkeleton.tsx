export default function CrawlabilitySkeleton() {
  return (
    <div className="w-full">
      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="sk-box h-9 w-28 rounded-md" />
        <div className="sk-box sk-delay-1 h-9 w-32 rounded-md" />
        <div className="sk-box sk-delay-2 h-9 w-28 rounded-md" />
        <div className="sk-box sk-delay-3 h-9 w-24 rounded-md" />
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-100 mb-5">
        <div className="sk-box h-8 w-28 rounded-t" />
        <div className="sk-box sk-delay-1 h-8 w-24 rounded-t" />
      </div>

      {/* Domain summary banner */}
      <div className="border border-gray-100 rounded-xl p-4 mb-4">
        <div className="sk-box h-5 w-72 rounded mb-2" />
        <div className="sk-box sk-delay-1 h-3 w-96 rounded" />
      </div>

      {/* Search bar */}
      <div className="sk-box h-10 w-full rounded-md mb-4" />

      {/* Table header */}
      <div className="flex items-center gap-6 px-4 py-3 border-b border-gray-100">
        <div className="sk-box h-3 w-6 rounded" />
        <div className="sk-box sk-delay-1 h-3 w-16 rounded" />
        <div className="sk-box sk-delay-2 h-3 w-20 rounded ml-auto" />
        <div className="sk-box sk-delay-3 h-3 w-24 rounded" />
        <div className="sk-box sk-delay-1 h-3 w-28 rounded" />
      </div>

      {/* Section label */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
        <div className="sk-box h-3 w-44 rounded" />
      </div>

      {/* Bot rows */}
      {Array.from({ length: 13 }).map((_, i) => (
        <div key={i} className="flex items-center gap-6 px-4 py-3 border-b border-gray-50 last:border-0">
          {/* Row number */}
          <div className={`sk-box sk-delay-${i % 4} h-4 w-4 rounded flex-shrink-0`} />

          {/* Bot icon + name */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`sk-box sk-delay-${(i + 1) % 4} h-7 w-7 rounded-full flex-shrink-0`} />
            <div className={`sk-box sk-delay-${(i + 2) % 4} h-4 w-32 rounded`} />
          </div>

          {/* Status badge */}
          <div className={`sk-box sk-delay-${i % 4} h-6 w-20 rounded-full flex-shrink-0 ml-auto`} />

          {/* Type chip */}
          <div className={`sk-box sk-delay-${(i + 1) % 4} h-5 w-20 rounded flex-shrink-0`} />

          {/* Platform */}
          <div className={`sk-box sk-delay-${(i + 2) % 4} h-4 w-24 rounded flex-shrink-0`} />
        </div>
      ))}
    </div>
  );
}
