export default function OwnedSkeleton() {
  return (
    <div className="w-full">
      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="sk-box h-9 w-32 rounded-md" />
        <div className="sk-box sk-delay-1 h-9 w-32 rounded-md" />
        <div className="sk-box sk-delay-2 h-9 w-28 rounded-md" />
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-4">
        {/* Left nav sidebar */}
        <div className="w-52 flex-shrink-0">
          <div className="sk-box h-5 w-24 rounded mb-4" />
          <div className="space-y-1">
            {["w-36", "w-28", "w-32", "w-24", "w-30"].map((w, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-2 rounded">
                <div className={`sk-box sk-delay-${i % 4} h-4 ${w} rounded`} />
              </div>
            ))}
          </div>
          <div className="mt-6 sk-box h-4 w-20 rounded mb-3" />
          <div className="space-y-1">
            {["w-32", "w-28", "w-36"].map((w, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-2 rounded">
                <div className={`sk-box sk-delay-${(i + 2) % 4} h-4 ${w} rounded`} />
              </div>
            ))}
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 min-w-0">
          {/* Stat cards row */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="border border-gray-100 rounded-lg p-3">
                <div className={`sk-box sk-delay-${i % 4} h-3 w-24 rounded mb-2`} />
                <div className={`sk-box sk-delay-${(i + 1) % 4} h-7 w-12 rounded`} />
              </div>
            ))}
          </div>

          {/* Section heading */}
          <div className="sk-box h-5 w-48 rounded mb-4" />

          {/* Content type tabs */}
          <div className="flex gap-2 mb-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={`sk-box sk-delay-${i % 4} h-8 w-24 rounded-full`} />
            ))}
          </div>

          {/* Recommendation cards grid */}
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-4">
                <div className={`sk-box sk-delay-${i % 4} h-5 w-20 rounded-full mb-3`} />
                <div className={`sk-box sk-delay-${(i + 1) % 4} h-4 w-full rounded mb-2`} />
                <div className={`sk-box sk-delay-${(i + 2) % 4} h-4 w-4/5 rounded mb-4`} />
                <div className="flex gap-2">
                  <div className={`sk-box sk-delay-${i % 4} h-7 w-16 rounded`} />
                  <div className={`sk-box sk-delay-${(i + 1) % 4} h-7 w-16 rounded`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
