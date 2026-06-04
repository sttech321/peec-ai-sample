"use client";

import { useRef, useState } from "react";
import ReactDOM from "react-dom";

export default function InfoTooltip({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  function show() {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({
      top: r.top - 8,          // above the icon
      left: r.left + r.width / 2, // horizontally centered on icon
    });
  }

  function hide() {
    setPos(null);
  }

  const tooltip =
    pos &&
    typeof document !== "undefined" &&
    ReactDOM.createPortal(
      <span
        style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          transform: "translate(-50%, -100%)",
          background: "#1e293b",
          color: "#fff",
          fontSize: 12,
          fontWeight: 400,
          whiteSpace: "nowrap",
          padding: "7px 12px",
          borderRadius: 8,
          pointerEvents: "none",
          zIndex: 99999,
          boxShadow: "0 4px 16px rgba(0,0,0,0.22)",
          letterSpacing: "0.01em",
          lineHeight: 1.4,
        }}
      >
        {text}
        {/* arrow */}
        <span
          style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            borderWidth: 5,
            borderStyle: "solid",
            borderColor: "#1e293b transparent transparent transparent",
            width: 0,
            height: 0,
            display: "block",
          }}
        />
      </span>,
      document.body
    );

  return (
    <>
      <span
        ref={ref}
        className="info-tooltip-icon"
        onMouseEnter={show}
        onMouseLeave={hide}
        style={{ fontSize: 13, color: "#94a3b8", cursor: "help", display: "inline-flex", alignItems: "center", verticalAlign: "middle" }}
      >
        ⓘ
      </span>
      {tooltip}
    </>
  );
}
