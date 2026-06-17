// Skeleton for the Ranking (/ranking) page content area.

export default function RankingSkeleton() {
  return (
    <div>
      {/* ── Page title ── */}
      <div className="sk-box" style={{ width: 90, height: 22, marginBottom: 16 }} />

      {/* ── Filter bar ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <div className="sk-box" style={{ width: 130, height: 32, borderRadius: 7 }} />
        <div className="sk-box sk-delay-1" style={{ width: 120, height: 32, borderRadius: 7 }} />
      </div>

      {/* ── Ranking table ── */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        {/* Table header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "48px 1fr 150px 130px 150px 130px",
          padding: "10px 16px",
          background: "#f8fafc",
          borderBottom: "1px solid #e5e7eb",
          gap: 12,
          alignItems: "center",
        }}>
          {[20, 80, 70, 60, 70, 60].map((w, i) => (
            <div key={i} className={`sk-box sk-delay-${i}`} style={{ width: w, height: 11 }} />
          ))}
        </div>

        {/* Brand rows */}
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} style={{
            display: "grid",
            gridTemplateColumns: "48px 1fr 150px 130px 150px 130px",
            padding: "11px 16px",
            borderBottom: "1px solid #f1f5f9",
            gap: 12,
            alignItems: "center",
          }}>
            {/* Rank # */}
            <div className={`sk-box sk-delay-${i % 4}`} style={{ width: 18, height: 13 }} />
            {/* Brand name + logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className={`sk-box sk-delay-${i % 4}`} style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0 }} />
              <div className={`sk-box sk-delay-${i % 4}`} style={{ width: 80 + (i % 5) * 14, height: 13 }} />
            </div>
            {/* Visibility */}
            <div className={`sk-box sk-delay-${(i + 1) % 5}`} style={{ width: 60, height: 13 }} />
            {/* SOV */}
            <div className={`sk-box sk-delay-${(i + 2) % 5}`} style={{ width: 50, height: 13 }} />
            {/* Sentiment */}
            <div className={`sk-box sk-delay-${(i + 3) % 5}`} style={{ width: 55, height: 13 }} />
            {/* Position */}
            <div className={`sk-box sk-delay-${(i + 4) % 5}`} style={{ width: 45, height: 13 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
