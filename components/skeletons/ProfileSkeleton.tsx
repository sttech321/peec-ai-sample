export default function ProfileSkeleton() {
  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Page heading */}
      <div className="sk-box h-7 w-40 rounded mb-2" />
      <div className="sk-box sk-delay-1 h-4 w-80 rounded mb-8" />

      {/* Brand banner + avatar */}
      <div className="relative mb-16">
        <div className="sk-box h-32 w-full rounded-xl" />
        <div className="absolute -bottom-10 left-6">
          <div className="sk-box sk-delay-1 h-20 w-20 rounded-2xl border-4 border-white" />
        </div>
      </div>

      {/* Brand name + domain */}
      <div className="mb-8">
        <div className="sk-box h-6 w-36 rounded mb-2" />
        <div className="sk-box sk-delay-1 h-4 w-28 rounded" />
      </div>

      {/* Section cards */}
      {[
        { label: 60, lines: 3 },
        { label: 50, lines: 1 },
        { label: 70, lines: 2 },
        { label: 55, lines: 2 },
        { label: 65, lines: 1 },
      ].map((s, i) => (
        <div key={i} className="border border-gray-100 rounded-xl p-5 mb-4">
          {/* Section label */}
          <div className={`sk-box sk-delay-${i % 4} h-4 w-${s.label} rounded mb-1`} />
          <div className={`sk-box sk-delay-${(i + 1) % 4} h-3 w-48 rounded mb-4`} />
          {/* Input / content area */}
          {Array.from({ length: s.lines }).map((_, j) => (
            <div
              key={j}
              className={`sk-box sk-delay-${(i + j) % 4} h-9 w-full rounded mb-2 last:mb-0`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
