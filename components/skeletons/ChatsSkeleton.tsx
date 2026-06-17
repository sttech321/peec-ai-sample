// Skeleton for the Chats (/chats) page content area.

export default function ChatsSkeleton() {
  return (
    <div>
      {/* ── Stats row (4 metric cards) ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            flex: 1, border: "1px solid #e5e7eb", borderRadius: 10,
            padding: "14px 18px", background: "#fff",
          }}>
            <div className={`sk-box sk-delay-${i}`} style={{ width: 80, height: 11, marginBottom: 8 }} />
            <div className={`sk-box sk-delay-${i + 1}`} style={{ width: 55, height: 24 }} />
          </div>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div className="sk-box" style={{ width: 140, height: 32, borderRadius: 7 }} />
        {[100, 90, 85, 95, 80].map((w, i) => (
          <div key={i} className={`sk-box sk-delay-${i + 1}`} style={{ width: w, height: 32, borderRadius: 7 }} />
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <div className="sk-box" style={{ width: 32, height: 32, borderRadius: 7 }} />
          <div className="sk-box sk-delay-1" style={{ width: 32, height: 32, borderRadius: 7 }} />
        </div>
      </div>

      {/* ── Chats table ── */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        {/* Column headers */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(200px,1fr) 60px 110px 110px 110px 90px 90px",
          padding: "10px 16px",
          background: "#f8fafc",
          borderBottom: "1px solid #e5e7eb",
          gap: 12,
          alignItems: "center",
        }}>
          {[100, 40, 70, 70, 70, 55, 55].map((w, i) => (
            <div key={i} className={`sk-box sk-delay-${i}`} style={{ width: w, height: 11 }} />
          ))}
        </div>

        {/* Chat rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{
            display: "grid",
            gridTemplateColumns: "minmax(200px,1fr) 60px 110px 110px 110px 90px 90px",
            padding: "12px 16px",
            borderBottom: "1px solid #f1f5f9",
            gap: 12,
            alignItems: "center",
          }}>
            {/* Prompt text */}
            <div className="sk-col" style={{ gap: 5 }}>
              <div className={`sk-box sk-delay-${i % 5}`} style={{ width: `${55 + (i % 5) * 10}%`, height: 13 }} />
              <div className={`sk-box sk-delay-${(i + 1) % 5}`} style={{ width: `${30 + (i % 3) * 8}%`, height: 11 }} />
            </div>
            {/* Engine icon */}
            <div className={`sk-box sk-delay-${i % 4}`} style={{ width: 24, height: 24, borderRadius: "50%" }} />
            {/* Mentions */}
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 1, 2].map((j) => (
                <div key={j} className={`sk-box sk-delay-${(i + j) % 5}`} style={{ width: 20, height: 20, borderRadius: "50%" }} />
              ))}
            </div>
            {/* Sources */}
            <div className={`sk-box sk-delay-${(i + 2) % 5}`} style={{ width: 65, height: 13 }} />
            {/* Features */}
            <div style={{ display: "flex", gap: 4 }}>
              <div className={`sk-box sk-delay-${i % 4}`} style={{ width: 50, height: 20, borderRadius: 4 }} />
              <div className={`sk-box sk-delay-${(i + 1) % 4}`} style={{ width: 44, height: 20, borderRadius: 4 }} />
            </div>
            {/* Position */}
            <div className={`sk-box sk-delay-${(i + 3) % 5}`} style={{ width: 40, height: 13 }} />
            {/* Time */}
            <div className={`sk-box sk-delay-${(i + 4) % 5}`} style={{ width: 55, height: 13 }} />
          </div>
        ))}
      </div>

      {/* ── Pagination ── */}
      <div style={{ display: "flex", gap: 6, marginTop: 14, justifyContent: "center" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`sk-box sk-delay-${i}`} style={{ width: 28, height: 28, borderRadius: 6 }} />
        ))}
      </div>
    </div>
  );
}
