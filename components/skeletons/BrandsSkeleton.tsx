export default function BrandsSkeleton() {
  return (
    <div className="w-full">
      {/* Header: search + add button */}
      <div className="flex items-center justify-between mb-6">
        <div className="sk-box h-9 w-64 rounded-md" />
        <div className="sk-box sk-delay-1 h-9 w-28 rounded-md" />
      </div>

      {/* Table */}
      <div className="border border-gray-100 rounded-xl overflow-hidden mb-8">
        {/* Table header */}
        <div className="flex items-center gap-4 px-4 py-3 bg-gray-50 border-b border-gray-100">
          <div className="sk-box h-3 w-32 rounded" style={{ flex: "2" }} />
          <div className="sk-box sk-delay-1 h-3 w-24 rounded" style={{ flex: "2" }} />
          <div className="sk-box sk-delay-2 h-3 w-24 rounded" style={{ flex: "2" }} />
          <div className="sk-box sk-delay-3 h-3 w-16 rounded" style={{ flex: "1" }} />
          <div className="w-8 flex-shrink-0" />
        </div>

        {/* Brand rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-50 last:border-0">
            {/* Avatar + name */}
            <div className="flex items-center gap-3" style={{ flex: "2" }}>
              <div className={`sk-box sk-delay-${i % 4} h-8 w-8 rounded-lg flex-shrink-0`} />
              <div className={`sk-box sk-delay-${(i + 1) % 4} h-4 w-28 rounded`} />
            </div>
            {/* Aliases */}
            <div className={`sk-box sk-delay-${(i + 2) % 4} h-5 w-20 rounded-full`} style={{ flex: "2" }} />
            {/* Domains */}
            <div className={`sk-box sk-delay-${i % 4} h-4 w-24 rounded`} style={{ flex: "2" }} />
            {/* Mentions */}
            <div className={`sk-box sk-delay-${(i + 1) % 4} h-4 w-10 rounded`} style={{ flex: "1" }} />
            {/* Actions */}
            <div className={`sk-box sk-delay-${(i + 2) % 4} h-6 w-6 rounded flex-shrink-0`} />
          </div>
        ))}
      </div>

      {/* Suggestions section */}
      <div className="sk-box h-5 w-44 rounded mb-4" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border border-gray-100 rounded-xl p-4 flex items-center gap-3">
            <div className={`sk-box sk-delay-${i % 4} h-8 w-8 rounded-lg flex-shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className={`sk-box sk-delay-${(i + 1) % 4} h-4 w-20 rounded mb-1`} />
              <div className={`sk-box sk-delay-${(i + 2) % 4} h-3 w-14 rounded`} />
            </div>
            <div className={`sk-box sk-delay-${i % 4} h-7 w-16 rounded flex-shrink-0`} />
          </div>
        ))}
      </div>
    </div>
  );
}
