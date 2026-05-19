"use client";

import React, { useState } from "react";
import { X, ExternalLink, Globe } from "lucide-react";
import EngineIcon from "./EngineIcon";

interface Source {
  domain: string;
  title: string | null;
  url: string | null;
}

interface ChatRecord {
  id: string;
  engine: string;
  runDate: string;
  brandsFound: string[];
  sourcesFound: Source[];
  avgSentiment: number;
  avgPosition: number;
  rawResponse?: string | null;
  query?: string | null;
}

interface Props {
  chat: ChatRecord;
  ownBrand?: string;
  brandDomains?: Map<string, string>;
  onClose: () => void;
}

function guessDomain(brand: string): string {
  return brand.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9.-]/g, "") + ".com";
}

function favUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;
}

function FaviconImg({ domain, size = 14 }: { domain: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed || !domain) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={favUrl(domain)}
      alt=""
      width={size}
      height={size}
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        borderRadius: 3,
        marginRight: 3,
        flexShrink: 0,
      }}
      onError={() => setFailed(true)}
    />
  );
}

export default function ChatModal({ chat, ownBrand, brandDomains, onClose }: Props) {
  const handleContentClick = (e: React.MouseEvent) => e.stopPropagation();
  const ownLower = ownBrand?.toLowerCase();

  function getBrandDomain(name: string): string {
    return brandDomains?.get(name) ?? guessDomain(name);
  }

  function countInText(brand: string): number {
    if (!chat.rawResponse) return 0;
    try {
      const re = new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
      return (chat.rawResponse.match(re) ?? []).length;
    } catch {
      return 0;
    }
  }

  // Render inline segments: markdown links → **bold** → brand highlights (word-boundary)
  function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
    const brands = chat.brandsFound;

    const escapedBrands = brands
      .slice()
      .sort((a, b) => b.length - a.length)
      .map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

    const patterns = [
      `\\[([^\\]]+)\\]\\(([^)\\s]+)\\)`,
      `\\*\\*([^*]{1,120})\\*\\*`,
      ...(escapedBrands.length ? [`\\b(?:${escapedBrands.join("|")})\\b`] : []),
    ];

    let regex: RegExp;
    try {
      regex = new RegExp(patterns.join("|"), "gi");
    } catch {
      return [text];
    }

    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;

    for (const match of text.matchAll(regex)) {
      const idx = match.index!;
      if (idx > lastIndex) result.push(text.slice(lastIndex, idx));

      const full = match[0];

      // Markdown link [text](url)
      const mdLink = full.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (mdLink) {
        let domain = "";
        try { domain = new URL(mdLink[2]).hostname.replace(/^www\./, ""); } catch {}
        result.push(
          <a key={`${keyPrefix}-${key++}`} href={mdLink[2]} target="_blank"
             rel="noopener noreferrer" className="cm-md-link">
            {domain && <FaviconImg domain={domain} size={12} />}
            {mdLink[1]}
          </a>
        );
        lastIndex = idx + full.length;
        continue;
      }

      // **Bold**
      const bold = full.match(/^\*\*([^*]+)\*\*$/);
      if (bold) {
        result.push(
          <strong key={`${keyPrefix}-${key++}`} className="cm-bold">{bold[1]}</strong>
        );
        lastIndex = idx + full.length;
        continue;
      }

      // Brand name
      const matchedBrand = brands.find((b) => b.toLowerCase() === full.toLowerCase());
      if (matchedBrand) {
        const isOwn = !!(ownLower && full.toLowerCase() === ownLower);
        const domain = getBrandDomain(matchedBrand);
        result.push(
          <mark key={`${keyPrefix}-${key++}`}
                className={isOwn ? "cm-brand-own" : "cm-brand-other"}>
            <FaviconImg domain={domain} size={12} />
            {full}
          </mark>
        );
        lastIndex = idx + full.length;
        continue;
      }

      result.push(full);
      lastIndex = idx + full.length;
    }

    if (lastIndex < text.length) result.push(text.slice(lastIndex));
    return result.length ? result : [text];
  }

  const renderResponse = (text: string | null | undefined) => {
    if (!text) return <p className="cm-empty">No response content available.</p>;
    return text.split("\n").map((line, i) => {
      const kp = `ln${i}`;
      if (line.startsWith("# "))   return <h2 key={kp} className="cm-h1">{renderInline(line.slice(2), kp)}</h2>;
      if (line.startsWith("## "))  return <h3 key={kp} className="cm-h2">{renderInline(line.slice(3), kp)}</h3>;
      if (line.startsWith("### ")) return <h4 key={kp} className="cm-h3">{renderInline(line.slice(4), kp)}</h4>;
      if (line.startsWith("- ") || line.startsWith("* ") || line.startsWith("• ")) {
        return <li key={kp} className="cm-li">{renderInline(line.slice(2), kp)}</li>;
      }
      if (line.trim() === "") return <div key={kp} className="cm-spacer" />;
      return <p key={kp} className="cm-p">{renderInline(line, kp)}</p>;
    });
  };

  return (
    <div className="cm-overlay" onClick={onClose}>
      <div className="cm-modal" onClick={handleContentClick}>

        {/* ── Main panel ─────────────────────────────────────── */}
        <div className="cm-main">

          {/* Header */}
          <div className="cm-header">
            <div className="cm-header-left">
              <EngineIcon engine={chat.engine} size={22} />
              <span className="cm-engine-name">{chat.engine}</span>
              <div className="cm-sep" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://flagcdn.com/w40/us.png" alt="US" className="cm-flag" />
              <span className="cm-location">US</span>
            </div>
            <span className="cm-view-prompt">
              View prompt <ExternalLink size={10} style={{ display: "inline", verticalAlign: "middle" }} />
            </span>
          </div>

          {/* Scrollable response */}
          <div className="cm-scroll custom-scrollbar">
            <div className="cm-content">

              {/* Question bubble */}
              {chat.query && (
                <div className="cm-question">
                  <span className="cm-question-text">{`"${chat.query}"`}</span>
                </div>
              )}

              {/* Response body */}
              <div className="cm-response">
                {renderResponse(chat.rawResponse)}
              </div>

            </div>
          </div>
        </div>

        {/* ── Sidebar ────────────────────────────────────────── */}
        <div className="cm-sidebar">
          <div className="cm-sidebar-header">
            <span className="cm-sidebar-title">Details</span>
            <button className="cm-close" onClick={onClose}><X size={16} /></button>
          </div>

          <div className="cm-sidebar-scroll custom-scrollbar">

            {/* Brands */}
            <div className="cm-sidebar-section">
              <div className="cm-sidebar-label">
                <span className="cm-sidebar-dot cm-sidebar-dot-brand" />
                Brands
              </div>
              <div className="cm-brands-list">
                {chat.brandsFound.length === 0 && (
                  <p className="cm-empty-text">No brands identified.</p>
                )}
                {chat.brandsFound.map((brand, i) => {
                  const isOwn = !!(ownLower && brand.toLowerCase() === ownLower);
                  const count = countInText(brand);
                  return (
                    <div key={i} className="cm-brand-row">
                      <span className={`cm-brand-indicator ${isOwn ? "cm-brand-indicator-own" : "cm-brand-indicator-other"}`} />
                      <span className="cm-brand-name">{brand}</span>
                      {count > 0 && <span className="cm-brand-count">{count}</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Fanout queries */}
            <div className="cm-sidebar-section">
              <div className="cm-sidebar-label">
                <Globe size={10} />
                Fanout queries
              </div>
              <p className="cm-empty-text">No Fanout queries</p>
            </div>

            {/* Sources */}
            <div className="cm-sidebar-section">
              <div className="cm-sidebar-label">
                <Globe size={10} />
                Sources
              </div>
              <div className="cm-sources-list">
                {chat.sourcesFound.length === 0 && (
                  <p className="cm-empty-text">No sources cited.</p>
                )}
                {chat.sourcesFound.slice(0, 6).map((source, i) => (
                  <a key={i} href={source.url || "#"} target="_blank"
                     rel="noopener noreferrer" className="cm-source-row">
                    <FaviconImg domain={source.domain} size={18} />
                    <div className="cm-source-meta">
                      <span className="cm-source-title">{source.title || source.domain}</span>
                      <span className="cm-source-domain">{source.domain}</span>
                    </div>
                  </a>
                ))}
                {chat.sourcesFound.length > 6 && (
                  <button className="cm-view-all">View all...</button>
                )}
              </div>
            </div>

          </div>

          <div className="cm-sidebar-footer">
            <button className="cm-insights-btn">View all insights</button>
          </div>
        </div>

      </div>

      <style jsx>{`
        .cm-overlay {
          position: fixed; inset: 0; z-index: 100;
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          background: rgba(0,0,0,0.55);
          backdrop-filter: blur(4px);
        }
        .cm-modal {
          background: #fff;
          width: 100%; max-width: 960px;
          height: 88vh;
          border-radius: 16px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.18);
          overflow: hidden;
          display: flex;
          position: relative;
        }

        /* ── Main panel ── */
        .cm-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-right: 1px solid #f1f5f9;
        }
        .cm-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          border-bottom: 1px solid #f1f5f9;
          background: #fafafa;
          flex-shrink: 0;
        }
        .cm-header-left {
          display: flex; align-items: center; gap: 8px;
        }
        .cm-engine-name {
          font-size: 13px; font-weight: 700; color: #1e293b;
        }
        .cm-sep {
          width: 1px; height: 16px; background: #e2e8f0; margin: 0 4px;
        }
        .cm-flag {
          width: 18px; height: 13px;
          border-radius: 2px;
          object-fit: cover;
          box-shadow: 0 0 0 1px rgba(0,0,0,0.08);
        }
        .cm-location {
          font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;
        }
        .cm-view-prompt {
          font-size: 11px; font-weight: 700; color: #6366f1;
          text-transform: uppercase; letter-spacing: 0.04em;
          display: flex; align-items: center; gap: 4px;
          cursor: pointer;
        }
        .cm-close {
          position: absolute; top: 12px; right: 12px;
          width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 50%; border: none; background: transparent;
          color: #94a3b8; cursor: pointer;
          transition: background 0.12s, color 0.12s;
        }
        .cm-close:hover { background: #f1f5f9; color: #334155; }

        .cm-scroll {
          flex: 1; overflow-y: auto; padding: 32px;
        }
        .cm-content { max-width: 640px; margin: 0 auto; }

        /* Question bubble */
        .cm-question {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 14px 18px;
          margin-bottom: 28px;
        }
        .cm-question-text {
          font-size: 13px; font-weight: 600; color: #1e293b;
          font-style: italic; line-height: 1.5;
        }

        /* Response typography */
        .cm-response { font-size: 14px; line-height: 1.7; color: #334155; }
        :global(.cm-h1) { font-size: 17px; font-weight: 700; color: #0f172a; margin: 20px 0 8px; }
        :global(.cm-h2) { font-size: 15px; font-weight: 700; color: #0f172a; margin: 18px 0 6px; }
        :global(.cm-h3) { font-size: 14px; font-weight: 700; color: #0f172a; margin: 14px 0 4px; }
        :global(.cm-p)  { margin-bottom: 10px; }
        :global(.cm-li) { margin-left: 18px; margin-bottom: 6px; list-style-type: disc; padding-left: 4px; }
        :global(.cm-bold) { font-weight: 700; color: #0f172a; }
        :global(.cm-spacer) { height: 12px; }
        :global(.cm-empty) { color: #94a3b8; font-style: italic; }

        /* Brand highlights */
        :global(.cm-brand-own) {
          background: #fef08a; color: #713f12;
          border-radius: 4px; padding: 1px 4px;
          font-weight: 600;
          display: inline-flex; align-items: center; gap: 2px;
          vertical-align: baseline;
        }
        :global(.cm-brand-other) {
          background: #e0e7ff; color: #3730a3;
          border-radius: 4px; padding: 1px 4px;
          font-weight: 500;
          display: inline-flex; align-items: center; gap: 2px;
          vertical-align: baseline;
        }

        /* Markdown links */
        :global(.cm-md-link) {
          color: #6366f1; text-decoration: none; font-weight: 500;
          display: inline-flex; align-items: center; gap: 2px;
          vertical-align: baseline;
        }
        :global(.cm-md-link:hover) { text-decoration: underline; }

        /* ── Sidebar ── */
        .cm-sidebar {
          width: 280px; flex-shrink: 0;
          display: flex; flex-direction: column;
          background: #fafafa;
          border-left: 1px solid #f1f5f9;
        }
        .cm-sidebar-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 18px;
          border-bottom: 1px solid #f1f5f9;
          flex-shrink: 0;
        }
        .cm-sidebar-title {
          font-size: 11px; font-weight: 700;
          color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em;
        }
        .cm-sidebar-scroll {
          flex: 1; overflow-y: auto; padding: 0;
        }
        .cm-sidebar-section {
          padding: 16px 18px;
          border-bottom: 1px solid #f1f5f9;
        }
        .cm-sidebar-label {
          display: flex; align-items: center; gap: 6px;
          font-size: 10.5px; font-weight: 700;
          color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em;
          margin-bottom: 12px;
        }
        .cm-sidebar-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
        }
        .cm-sidebar-dot-brand { background: #6366f1; }

        /* Brands list */
        .cm-brands-list { display: flex; flex-direction: column; gap: 8px; }
        .cm-brand-row {
          display: flex; align-items: center; gap: 8px;
        }
        .cm-brand-indicator {
          width: 10px; height: 3px; border-radius: 2px; flex-shrink: 0;
        }
        .cm-brand-indicator-own   { background: #f59e0b; }
        .cm-brand-indicator-other { background: #10b981; }
        .cm-brand-name {
          font-size: 12.5px; font-weight: 500; color: #1e293b;
          flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .cm-brand-count {
          font-size: 11px; font-weight: 600; color: #64748b;
        }

        /* Fanout / empty text */
        .cm-empty-text { font-size: 12px; color: #94a3b8; font-style: italic; }

        /* Sources */
        .cm-sources-list { display: flex; flex-direction: column; gap: 12px; }
        .cm-source-row {
          display: flex; align-items: flex-start; gap: 10px;
          text-decoration: none;
        }
        .cm-source-meta {
          display: flex; flex-direction: column; min-width: 0; flex: 1;
        }
        .cm-source-title {
          font-size: 11px; font-weight: 600; color: #334155;
          line-height: 1.3;
          overflow: hidden; text-overflow: ellipsis;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        }
        .cm-source-row:hover .cm-source-title { color: #6366f1; }
        .cm-source-domain {
          font-size: 9.5px; color: #94a3b8; margin-top: 2px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .cm-view-all {
          font-size: 11px; color: #6366f1; font-weight: 500;
          background: none; border: none; cursor: pointer; padding: 0;
          text-align: left;
        }

        /* Footer */
        .cm-sidebar-footer {
          padding: 14px 18px;
          border-top: 1px solid #f1f5f9;
          flex-shrink: 0;
        }
        .cm-insights-btn {
          width: 100%; padding: 8px;
          border: 1px solid #e2e8f0; border-radius: 8px;
          background: #fff; font-size: 10.5px; font-weight: 700;
          color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;
          cursor: pointer; font-family: inherit;
          transition: background 0.12s, color 0.12s;
        }
        .cm-insights-btn:hover { background: #f8fafc; color: #334155; }

        /* Scrollbar */
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
}
