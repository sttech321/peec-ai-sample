export default function ImpactSkeleton() {
  return (
    <div className="w-full">
      {/* Filter / header bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="sk-box h-9 w-32 rounded-md" />
          <div className="sk-box sk-delay-1 h-9 w-28 rounded-md" />
        </div>
        <div className="sk-box sk-delay-2 h-9 w-36 rounded-md" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="border border-gray-100 rounded-lg p-3">
            <div className={`sk-box sk-delay-${i % 4} h-3 w-20 rounded mb-2`} />
            <div className={`sk-box sk-delay-${(i + 1) % 4} h-7 w-10 rounded`} />
          </div>
        ))}
      </div>

      {/* Section heading + tabs */}
      <div className="flex items-center gap-3 mb-4">
        <div className="sk-box h-5 w-36 rounded" />
        <div className="sk-box sk-delay-1 h-7 w-20 rounded-full" />
        <div className="sk-box sk-delay-2 h-7 w-20 rounded-full" />
      </div>

      {/* Action rows table */}
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-4 px-4 py-3 bg-gray-50 border-b border-gray-100">
          <div className="sk-box h-3 w-32 rounded" />
          <div className="ml-auto flex gap-6">
            <div className="sk-box sk-delay-1 h-3 w-16 rounded" />
            <div className="sk-box sk-delay-2 h-3 w-16 rounded" />
            <div className="sk-box sk-delay-3 h-3 w-16 rounded" />
          </div>
        </div>

        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-4 px-4 py-4 border-b border-gray-50 last:border-0"
          >
            {/* Status indicator */}
            <div className={`sk-box sk-delay-${i % 4} h-5 w-5 rounded-full flex-shrink-0 mt-0.5`} />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className={`sk-box sk-delay-${i % 4} h-4 w-3/4 rounded mb-2`} />
              <div className={`sk-box sk-delay-${(i + 1) % 4} h-3 w-1/2 rounded`} />
            </div>

            {/* Tags / badges */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className={`sk-box sk-delay-${(i + 2) % 4} h-5 w-16 rounded-full`} />
              <div className={`sk-box sk-delay-${(i + 3) % 4} h-5 w-16 rounded-full`} />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className={`sk-box sk-delay-${i % 4} h-7 w-16 rounded`} />
              <div className={`sk-box sk-delay-${(i + 1) % 4} h-7 w-16 rounded`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
