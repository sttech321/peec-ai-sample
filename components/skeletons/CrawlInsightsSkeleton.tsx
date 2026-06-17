export default function CrawlInsightsSkeleton() {
  return (
    <div className="w-full">
      {/* Header / filter bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="sk-box h-9 w-36 rounded-md" />
          <div className="sk-box sk-delay-1 h-9 w-28 rounded-md" />
          <div className="sk-box sk-delay-2 h-9 w-28 rounded-md" />
        </div>
        <div className="sk-box sk-delay-3 h-4 w-40 rounded" />
      </div>

      {/* Stat summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="border border-gray-100 rounded-xl p-4">
            <div className={`sk-box sk-delay-${i % 4} h-3 w-24 rounded mb-3`} />
            <div className={`sk-box sk-delay-${(i + 1) % 4} h-8 w-16 rounded`} />
          </div>
        ))}
      </div>

      {/* Top folders / bots breakdown */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Top folders */}
        <div className="border border-gray-100 rounded-xl p-4">
          <div className="sk-box h-4 w-28 rounded mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`sk-box sk-delay-${i % 4} h-4 flex-1 rounded`} />
                <div className={`sk-box sk-delay-${(i + 1) % 4} h-4 w-12 rounded`} />
              </div>
            ))}
          </div>
        </div>

        {/* Top bots */}
        <div className="border border-gray-100 rounded-xl p-4">
          <div className="sk-box sk-delay-1 h-4 w-24 rounded mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`sk-box sk-delay-${i % 4} h-6 w-6 rounded-full flex-shrink-0`} />
                <div className={`sk-box sk-delay-${(i + 1) % 4} h-4 flex-1 rounded`} />
                <div className={`sk-box sk-delay-${(i + 2) % 4} h-4 w-12 rounded`} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* URL table */}
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-4 px-4 py-3 bg-gray-50 border-b border-gray-100">
          <div className="sk-box h-3 w-48 rounded" />
          <div className="sk-box sk-delay-1 h-3 w-20 rounded" />
          <div className="sk-box sk-delay-2 h-3 w-24 rounded ml-auto" />
          <div className="sk-box sk-delay-3 h-3 w-16 rounded" />
          <div className="sk-box sk-delay-1 h-3 w-16 rounded" />
        </div>

        {/* Rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-50 last:border-0">
            <div className={`sk-box sk-delay-${i % 4} h-4 w-64 rounded flex-shrink-0`} />
            <div className={`sk-box sk-delay-${(i + 1) % 4} h-4 w-20 rounded flex-shrink-0`} />
            <div className="flex items-center gap-2 ml-auto flex-shrink-0">
              <div className={`sk-box sk-delay-${(i + 2) % 4} h-5 w-5 rounded-full`} />
              <div className={`sk-box sk-delay-${i % 4} h-4 w-24 rounded`} />
            </div>
            <div className={`sk-box sk-delay-${(i + 3) % 4} h-4 w-12 rounded flex-shrink-0`} />
            <div className={`sk-box sk-delay-${(i + 1) % 4} h-3 w-16 rounded flex-shrink-0`} />
          </div>
        ))}
      </div>
    </div>
  );
}
