"use client";

import { useState } from "react";

const ENGINE_DOMAIN: Record<string, string> = {
  ChatGPT: "chatgpt.com",
  Claude: "claude.ai",
  Perplexity: "perplexity.ai",
  Gemini: "gemini.google.com",
  "AI Overviews": "google.com",
  "AI Overview": "google.com",
  "AI Mode": "google.com",
  Groq: "groq.com",
  Copilot: "copilot.microsoft.com",
  Grok: "grok.com",
};

const ENGINE_COLORS: Record<string, string> = {
  ChatGPT: "#10a37f", Claude: "#d97706", Perplexity: "#3b82f6",
  Gemini: "#8b5cf6", "AI Overviews": "#ef4444", "AI Overview": "#ef4444", "AI Mode": "#ef4444",
  Groq: "#f97316", Copilot: "#0ea5e9", Grok: "#0f172a",
};

function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
}

interface Props {
  engine: string;
  size?: number;
}

export default function EngineIcon({ engine, size = 20 }: Props) {
  const [failed, setFailed] = useState(false);
  const domain = ENGINE_DOMAIN[engine];

  if (!domain || failed) {
    return (
      <div
        className="pd-chat-engine-icon"
        style={{
          backgroundColor: ENGINE_COLORS[engine] || "#6366f1",
          width: size,
          height: size,
        }}
      >
        {engine.charAt(0)}
      </div>
    );
  }

  return (
    <div
      className="pd-chat-engine-icon"
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        width: size,
        height: size,
        padding: 2,
        overflow: "hidden",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={faviconUrl(domain)}
        alt={engine}
        width={size - 4}
        height={size - 4}
        style={{ display: "block" }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
