"use client";

import { useState } from "react";

interface Props {
  domain: string;
  size?: number;
  eager?: boolean; // set true only for above-the-fold critical images
}

export default function DomainFavicon({ domain, size = 18, eager = false }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed || !domain) {
    return (
      <div
        style={{
          width: size,
          height: size,
          background: "#475569",
          color: "#fff",
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: Math.max(8, size - 10),
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {(domain || "?").charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
      alt={domain}
      width={size}
      height={size}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      style={{
        borderRadius: 4,
        background: "#fff",
        border: "1px solid #1e293b",
        flexShrink: 0,
      }}
      onError={() => setFailed(true)}
    />
  );
}
