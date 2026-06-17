// Skeleton for the Insights (/insights) page content area.

export default function InsightsSkeleton() {
  return (
    <div>
      {/* ── Filter bar ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[90, 120, 90, 110, 100].map((w, i) => (
          <div key={i} className={`sk-box sk-delay-${i}`} style={{ width: w, height: 30, borderRadius: 7 }} />
        ))}
      </div>

      {/* ── Brand profile header ── */}
      <div style={{
        border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 24px",
        marginBottom: 24, background: "#fff", display: "flex", gap: 20, alignItems: "flex-start",
      }}>
        {/* Brand logo */}
        <div className="sk-box" style={{ width: 56, height: 56, borderRadius: 12, flexShrink: 0 }} />
        <div className="sk-col" style={{ flex: 1 }}>
          <div className="sk-box" style={{ width: 160, height: 20, marginBottom: 8 }} />
          <div className="sk-box sk-delay-1" style={{ width: 220, height: 13, marginBottom: 6 }} />
          <div className="sk-box sk-delay-2" style={{ width: 180, height: 13 }} />
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <div className="sk-box" style={{ width: 90, height: 32, borderRadius: 7 }} />
          <div className="sk-box sk-delay-1" style={{ width: 80, height: 32, borderRadius: 7 }} />
        </div>
      </div>

      {/* ── Metric cards row ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            flex: 1, border: "1px solid #e5e7eb", borderRadius: 10,
            padding: "14px 18px", background: "#fff",
          }}>
            <div className={`sk-box sk-delay-${i}`} style={{ width: 85, height: 11, marginBottom: 8 }} />
            <div className={`sk-box sk-delay-${i + 1}`} style={{ width: 55, height: 26, marginBottom: 6 }} />
            <div className={`sk-box sk-delay-${i + 2}`} style={{ width: 65, height: 10 }} />
          </div>
        ))}
      </div>

      {/* ── Visibility chart ── */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px", background: "#fff", marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div className="sk-box" style={{ width: 140, height: 14 }} />
          <div className="sk-row">
            <div className="sk-box sk-delay-1" style={{ width: 80, height: 28, borderRadius: 6 }} />
            <div className="sk-box sk-delay-2" style={{ width: 100, height: 28, borderRadius: 6 }} />
          </div>
        </div>
        <div style={{ position: "relative", height: 200, background: "#fafafa", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 20, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "4px 0" }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={`sk-box sk-delay-${i}`} style={{ width: 26, height: 9, marginLeft: 2 }} />
            ))}
          </div>
          <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
            <path d="M 40 180 Q 150 155 260 120 Q 370 85 480 60 Q 560 42 640 35" stroke="#c7d2fe" strokeWidth="2.5" fill="none" />
            <path d="M 40 188 Q 150 172 260 155 Q 370 138 480 125 Q 560 115 640 108" stroke="#e5e7eb" strokeWidth="2" fill="none" />
          </svg>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          {[80, 95, 70].map((w, i) => (
            <div key={i} className="sk-row" style={{ gap: 5 }}>
              <div className={`sk-box sk-delay-${i}`} style={{ width: 8, height: 8, borderRadius: "50%" }} />
              <div className={`sk-box sk-delay-${i}`} style={{ width: w, height: 11 }} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Brand mentions table ── */}
      <div className="sk-box" style={{ width: 140, height: 18, marginBottom: 6 }} />
      <div className="sk-box sk-delay-1" style={{ width: 220, height: 13, marginBottom: 14 }} />
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 120px 110px 110px 110px",
          padding: "10px 16px", background: "#f8fafc",
          borderBottom: "1px solid #e5e7eb", gap: 12,
        }}>
          {[100, 75, 70, 70, 70].map((w, i) => (
            <div key={i} className={`sk-box sk-delay-${i}`} style={{ width: w, height: 11 }} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "1fr 120px 110px 110px 110px",
            padding: "11px 16px", borderBottom: "1px solid #f1f5f9", gap: 12, alignItems: "center",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className={`sk-box sk-delay-${i % 4}`} style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0 }} />
              <div className={`sk-box sk-delay-${i % 4}`} style={{ width: 90 + (i % 4) * 16, height: 13 }} />
            </div>
            <div className={`sk-box sk-delay-${(i + 1) % 5}`} style={{ width: 60, height: 13 }} />
            <div className={`sk-box sk-delay-${(i + 2) % 5}`} style={{ width: 55, height: 13 }} />
            <div className={`sk-box sk-delay-${(i + 3) % 5}`} style={{ width: 50, height: 13 }} />
            <div className={`sk-box sk-delay-${(i + 4) % 5}`} style={{ width: 45, height: 13 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
