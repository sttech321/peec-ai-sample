export default function TagsSkeleton() {
  return (
    <div className="w-full">
      {/* Header: search + add button */}
      <div className="flex items-center justify-between mb-6">
        <div className="sk-box h-9 w-56 rounded-md" />
        <div className="sk-box sk-delay-1 h-9 w-24 rounded-md" />
      </div>

      {/* Tags table */}
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-6 px-4 py-3 bg-gray-50 border-b border-gray-100">
          <div className="sk-box h-3 w-24 rounded flex-1" />
          <div className="sk-box sk-delay-1 h-3 w-20 rounded" style={{ width: "120px" }} />
          <div className="sk-box sk-delay-2 h-3 w-16 rounded" style={{ width: "80px" }} />
          <div className="w-16 flex-shrink-0" />
        </div>

        {/* Tag rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 px-4 py-3 border-b border-gray-50 last:border-0">
            {/* Color dot + tag chip */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className={`sk-box sk-delay-${i % 4} h-3 w-3 rounded-full flex-shrink-0`} />
              <div className={`sk-box sk-delay-${(i + 1) % 4} h-6 w-20 rounded-full`} />
            </div>
            {/* Slug */}
            <div className={`sk-box sk-delay-${(i + 2) % 4} h-4 w-24 rounded`} style={{ width: "120px" }} />
            {/* Usage count */}
            <div className={`sk-box sk-delay-${i % 4} h-4 w-10 rounded`} style={{ width: "80px" }} />
            {/* Edit / delete buttons */}
            <div className="flex items-center gap-2 w-16 flex-shrink-0">
              <div className={`sk-box sk-delay-${(i + 1) % 4} h-7 w-7 rounded`} />
              <div className={`sk-box sk-delay-${(i + 2) % 4} h-7 w-7 rounded`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
