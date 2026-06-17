// Skeleton for the Overview (/) page content area — renders inside the real DashboardLayout.

function SkRow({ cols }: { cols: number[] }) {
  return (
    <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
      {cols.map((w, i) => (
        <td key={i} style={{ padding: "10px 12px" }}>
          <div className="sk-box" style={{ width: w, height: 13 }} />
        </td>
      ))}
    </tr>
  );
}

export default function OverviewSkeleton() {
  return (
    <div>
      {/* ── Filter bar (PageFilterBar chips) ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[110, 100, 80, 90, 90].map((w, i) => (
          <div
            key={i}
            className={`sk-box sk-delay-${i + 1}`}
            style={{ width: w, height: 30, borderRadius: 7 }}
          />
        ))}
      </div>

      {/* ── Breadcrumb + settings ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div className="sk-row">
          <div className="sk-box" style={{ width: 70, height: 12 }} />
          <div className="sk-box" style={{ width: 6, height: 12 }} />
          <div className="sk-box" style={{ width: 60, height: 12 }} />
        </div>
        <div className="sk-box" style={{ width: 80, height: 28, borderRadius: 7 }} />
      </div>

      {/* ── Overview section title ── */}
      <div className="sk-box" style={{ width: 80, height: 18, marginBottom: 6 }} />
      <div className="sk-box sk-delay-1" style={{ width: 280, height: 13, marginBottom: 18 }} />

      {/* ── Chart + Domain Types cards ── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
        {/* Visibility chart card */}
        <div style={{
          flex: "0 0 63%", border: "1px solid #e5e7eb", borderRadius: 12,
          padding: "16px 20px", background: "#fff",
        }}>
          {/* Chart header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="sk-box" style={{ width: 90, height: 14 }} />
            <div className="sk-row">
              <div className="sk-box sk-delay-1" style={{ width: 70, height: 26, borderRadius: 6 }} />
              <div className="sk-box sk-delay-2" style={{ width: 24, height: 24, borderRadius: 6 }} />
            </div>
          </div>
          {/* Chart area */}
          <div style={{ position: "relative", height: 248, background: "#fafafa", borderRadius: 8, overflow: "hidden" }}>
            {/* Y-axis ticks */}
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 20, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "4px 0" }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className={`sk-box sk-delay-${i}`} style={{ width: 28, height: 10, marginLeft: 2 }} />
              ))}
            </div>
            {/* Fake lines */}
            <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
              <path d="M 40 200 Q 120 150 200 120 Q 280 90 360 80 Q 440 70 520 65" stroke="#e2e8f0" strokeWidth="2" fill="none" />
              <path d="M 40 210 Q 120 180 200 160 Q 280 140 360 130 Q 440 120 520 115" stroke="#e9edf2" strokeWidth="2" fill="none" />
              <path d="M 40 220 Q 120 200 200 190 Q 280 175 360 165 Q 440 155 520 150" stroke="#edf0f5" strokeWidth="2" fill="none" />
            </svg>
          </div>
          {/* Legend */}
          <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            {[60, 75, 55, 80, 65, 70].map((w, i) => (
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div className="sk-box" style={{ width: 100, height: 14 }} />
            <div className="sk-box sk-delay-1" style={{ width: 110, height: 11 }} />
          </div>
          {[80, 65, 90, 70, 55, 75, 60].map((w, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div className="sk-row" style={{ gap: 6 }}>
                  <div className={`sk-box sk-delay-${i}`} style={{ width: 8, height: 8, borderRadius: "50%" }} />
                  <div className={`sk-box sk-delay-${i}`} style={{ width: w, height: 11 }} />
                </div>
                <div className={`sk-box sk-delay-${i}`} style={{ width: 28, height: 11 }} />
              </div>
              <div className="sk-box" style={{ width: `${40 + i * 8}%`, height: 8, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Top Brands section ── */}
      <div className="sk-box" style={{ width: 100, height: 18, marginBottom: 6 }} />
      <div className="sk-box sk-delay-1" style={{ width: 240, height: 13, marginBottom: 14 }} />
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", marginBottom: 28 }}>
        {/* Table header */}
        <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 110px 110px 110px 110px", background: "#f8fafc", padding: "10px 16px", borderBottom: "1px solid #e5e7eb", gap: 12 }}>
          {[16, 100, 70, 70, 70, 70].map((w, i) => (
            <div key={i} className={`sk-box sk-delay-${i}`} style={{ width: w, height: 11 }} />
          ))}
        </div>
        {/* 7 brand rows */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {Array.from({ length: 7 }).map((_, i) => (
              <SkRow key={i} cols={[24, 130 - i * 5, 55, 55, 55, 55]} />
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Top Domains section ── */}
      <div className="sk-box" style={{ width: 110, height: 18, marginBottom: 6 }} />
      <div className="sk-box sk-delay-1" style={{ width: 220, height: 13, marginBottom: 14 }} />
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", marginBottom: 28 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <SkRow key={i} cols={[24, 140 - i * 4, 70, 55, 55, 60]} />
            ))}
          </tbody>
        </table>
      </div>

      {/* ── All Chats section ── */}
      <div className="sk-box" style={{ width: 80, height: 18, marginBottom: 6 }} />
      <div className="sk-box sk-delay-1" style={{ width: 200, height: 13, marginBottom: 14 }} />
      {/* Filter controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className="sk-row">
          {[80, 70, 80].map((w, i) => (
            <div key={i} className={`sk-box sk-delay-${i}`} style={{ width: w, height: 28, borderRadius: 7 }} />
          ))}
        </div>
        <div className="sk-row">
          <div className="sk-box" style={{ width: 28, height: 28, borderRadius: 7 }} />
          <div className="sk-box sk-delay-1" style={{ width: 28, height: 28, borderRadius: 7 }} />
        </div>
      </div>
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {Array.from({ length: 10 }).map((_, i) => (
              <SkRow key={i} cols={[200 - i * 4, 50, 50, 60, 50, 70]} />
            ))}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      <div style={{ display: "flex", gap: 6, marginTop: 14, justifyContent: "center" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`sk-box sk-delay-${i}`} style={{ width: 28, height: 28, borderRadius: 6 }} />
        ))}
      </div>
    </div>
  );
}
