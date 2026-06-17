// Skeleton for the URLs (/urls) page content area.

export default function UrlsSkeleton() {
  return (
    <div>
      {/* ── Filter bar ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[90, 120, 90, 110, 100].map((w, i) => (
          <div key={i} className={`sk-box sk-delay-${i}`} style={{ width: w, height: 30, borderRadius: 7 }} />
        ))}
      </div>

      {/* ── Breadcrumb ── */}
      <div className="sk-row" style={{ marginBottom: 14 }}>
        <div className="sk-box" style={{ width: 55, height: 12 }} />
        <div className="sk-box sk-delay-1" style={{ width: 6, height: 12 }} />
        <div className="sk-box sk-delay-1" style={{ width: 40, height: 12 }} />
      </div>

      {/* ── Overview section ── */}
      <div className="sk-box" style={{ width: 80, height: 20, marginBottom: 6 }} />
      <div className="sk-box sk-delay-1" style={{ width: 240, height: 13, marginBottom: 18 }} />

      {/* ── Chart + Domain types two-column ── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
        {/* Chart card */}
        <div style={{
          flex: "0 0 72%", border: "1px solid #e5e7eb", borderRadius: 12,
          padding: "16px 20px", background: "#fff",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="sk-box" style={{ width: 180, height: 14 }} />
            <div className="sk-row">
              <div className="sk-box sk-delay-1" style={{ width: 28, height: 26, borderRadius: 5 }} />
              <div className="sk-box sk-delay-2" style={{ width: 28, height: 26, borderRadius: 5 }} />
              <div className="sk-box sk-delay-3" style={{ width: 28, height: 26, borderRadius: 5 }} />
            </div>
          </div>
          <div style={{ position: "relative", height: 220, background: "#fafafa", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 20, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "4px 0" }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className={`sk-box sk-delay-${i}`} style={{ width: 24, height: 9, marginLeft: 2 }} />
              ))}
            </div>
            <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
              <path d="M 40 195 Q 150 170 260 130 Q 370 85 480 55 Q 560 35 640 25" stroke="#d1d5db" strokeWidth="2" fill="none" />
              <path d="M 40 200 Q 150 188 260 170 Q 370 152 480 140 Q 560 130 640 125" stroke="#e5e7eb" strokeWidth="2" fill="none" />
              <path d="M 40 207 Q 150 198 260 185 Q 370 175 480 166 Q 560 158 640 153" stroke="#edf0f4" strokeWidth="2" fill="none" />
            </svg>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            {[70, 85, 60, 75].map((w, i) => (
              <div key={i} className="sk-row" style={{ gap: 5 }}>
                <div className={`sk-box sk-delay-${i}`} style={{ width: 8, height: 8, borderRadius: "50%" }} />
                <div className={`sk-box sk-delay-${i}`} style={{ width: w, height: 11 }} />
              </div>
            ))}
          </div>
        </div>

        {/* Domain types card */}
        <div style={{
          flex: 1, border: "1px solid #e5e7eb", borderRadius: 12,
          padding: "16px 20px", background: "#fff",
        }}>
          <div className="sk-box" style={{ width: 100, height: 14, marginBottom: 16 }} />
          {[80, 55, 70, 65, 60, 75, 50].map((w, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div className={`sk-box sk-delay-${i}`} style={{ width: 12, height: 12, borderRadius: 3, flexShrink: 0 }} />
              <div className={`sk-box sk-delay-${i}`} style={{ width: w, height: 13 }} />
            </div>
          ))}
        </div>
      </div>

      {/* ── URL Movers section ── */}
      <div className="sk-box" style={{ width: 110, height: 20, marginBottom: 6 }} />
      <div className="sk-box sk-delay-1" style={{ width: 230, height: 13, marginBottom: 14 }} />

      {/* Movers tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {[55, 75, 65, 55].map((w, i) => (
          <div key={i} className={`sk-box sk-delay-${i}`} style={{ width: w, height: 30, borderRadius: 20 }} />
        ))}
      </div>

      {/* URL rows */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 16px", borderBottom: "1px solid #f1f5f9",
          }}>
            <div className={`sk-box sk-delay-${i % 4}`} style={{ width: 18, height: 13, flexShrink: 0 }} />
            <div className={`sk-box sk-delay-${i % 4}`} style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0 }} />
            <div className={`sk-box sk-delay-${i % 4}`} style={{ width: 140 + (i % 4) * 20, height: 13 }} />
            <div style={{ flex: 1, height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
              <div className={`sk-box sk-delay-${i % 4}`} style={{ width: `${25 + (i % 5) * 13}%`, height: "100%", borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
