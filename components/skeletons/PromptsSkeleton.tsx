// Skeleton for the Prompts (/prompts) page content area — renders inside the real DashboardLayout.

export default function PromptsSkeleton() {
  return (
    <div>
      {/* ── Inline filter bar (PromptsComparisonClient has its own filter row) ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[110, 100, 80, 90, 90].map((w, i) => (
          <div
            key={i}
            className={`sk-box sk-delay-${i + 1}`}
            style={{ width: w, height: 30, borderRadius: 7 }}
          />
        ))}
      </div>

      {/* ── Page header row ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div className="sk-col">
          <div className="sk-box" style={{ width: 120, height: 20 }} />
          <div className="sk-box sk-delay-1" style={{ width: 200, height: 13 }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="sk-box" style={{ width: 100, height: 32, borderRadius: 7 }} />
          <div className="sk-box sk-delay-1" style={{ width: 80, height: 32, borderRadius: 7 }} />
        </div>
      </div>

      {/* ── Aggregate metrics row (3 stat cards) ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {["Avg Visibility", "Avg Sentiment", "Avg Position"].map((_, i) => (
          <div key={i} style={{
            flex: 1, border: "1px solid #e5e7eb", borderRadius: 10,
            padding: "14px 18px", background: "#fff",
          }}>
            <div className={`sk-box sk-delay-${i}`} style={{ width: 90, height: 11, marginBottom: 8 }} />
            <div className={`sk-box sk-delay-${i + 1}`} style={{ width: 60, height: 26 }} />
          </div>
        ))}
      </div>

      {/* ── Prompts filter bar ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div className="sk-box" style={{ width: 180, height: 30, borderRadius: 7 }} />
        {[100, 90, 85, 90, 85].map((w, i) => (
          <div key={i} className={`sk-box sk-delay-${i + 1}`} style={{ width: w, height: 30, borderRadius: 7 }} />
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <div className="sk-box" style={{ width: 28, height: 30, borderRadius: 7 }} />
          <div className="sk-box sk-delay-1" style={{ width: 28, height: 30, borderRadius: 7 }} />
        </div>
      </div>

      {/* ── Two-column layout: topics sidebar + prompts table ── */}
      <div style={{ display: "flex", gap: 0, border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>

        {/* Topics sidebar */}
        <div style={{ width: 220, borderRight: "1px solid #e5e7eb", background: "#fafafa", flexShrink: 0 }}>
          {/* Search */}
          <div style={{ padding: "12px 12px 8px" }}>
            <div className="sk-box" style={{ width: "100%", height: 30, borderRadius: 7 }} />
          </div>
          {/* All topics / No topic */}
          <div style={{ padding: "6px 12px 4px" }}>
            <div className="sk-box sk-delay-1" style={{ width: "80%", height: 13, marginBottom: 6 }} />
            <div className="sk-box sk-delay-2" style={{ width: "65%", height: 13 }} />
          </div>
          <div style={{ height: 1, background: "#e5e7eb", margin: "8px 0" }} />
          {/* Topic items */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ padding: "7px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className={`sk-box sk-delay-${i % 6}`} style={{ width: 80 + (i % 4) * 12, height: 13 }} />
              <div className={`sk-box sk-delay-${(i + 1) % 6}`} style={{ width: 22, height: 13 }} />
            </div>
          ))}
          {/* New topic button */}
          <div style={{ padding: "10px 12px" }}>
            <div className="sk-box sk-delay-3" style={{ width: "90%", height: 30, borderRadius: 7 }} />
          </div>
        </div>

        {/* Prompts table */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          {/* Table toolbar */}
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #e5e7eb", display: "flex", gap: 6, alignItems: "center", background: "#fff" }}>
            <div className="sk-box" style={{ width: 200, height: 28, borderRadius: 7 }} />
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <div className="sk-box" style={{ width: 80, height: 28, borderRadius: 7 }} />
              <div className="sk-box sk-delay-1" style={{ width: 60, height: 28, borderRadius: 7 }} />
              <div className="sk-box sk-delay-2" style={{ width: 28, height: 28, borderRadius: 7 }} />
              <div className="sk-box sk-delay-3" style={{ width: 28, height: 28, borderRadius: 7 }} />
            </div>
          </div>

          {/* Column headers */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "24px minmax(180px,1fr) 90px 90px 80px 80px 80px 80px 80px",
            padding: "8px 14px",
            borderBottom: "1px solid #e5e7eb",
            background: "#f8fafc",
            gap: 8,
          }}>
            {[16, 70, 60, 60, 55, 55, 55, 55, 55].map((w, i) => (
              <div key={i} className={`sk-box sk-delay-${i % 6}`} style={{ width: w, height: 11 }} />
            ))}
          </div>

          {/* Prompt rows */}
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} style={{
              display: "grid",
              gridTemplateColumns: "24px minmax(180px,1fr) 90px 90px 80px 80px 80px 80px 80px",
              padding: "10px 14px",
              borderBottom: "1px solid #f1f5f9",
              gap: 8,
              alignItems: "center",
            }}>
              <div className={`sk-box sk-delay-${i % 5}`} style={{ width: 16, height: 16, borderRadius: 3 }} />
              <div className={`sk-box sk-delay-${i % 5}`} style={{ width: `${55 + (i % 5) * 10}%`, height: 13 }} />
              {[50, 50, 40, 40, 40, 40, 40].map((w, j) => (
                <div key={j} className={`sk-box sk-delay-${(i + j) % 6}`} style={{ width: w, height: 13 }} />
              ))}
            </div>
          ))}

          {/* Pagination */}
          <div style={{ padding: "12px 14px", display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`sk-box sk-delay-${i}`} style={{ width: 28, height: 28, borderRadius: 6 }} />
            ))}
            <div className="sk-box sk-delay-4" style={{ width: 60, height: 13, marginLeft: 8 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
