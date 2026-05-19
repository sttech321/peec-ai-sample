"use client";

import React from "react";
import { X, ExternalLink, Globe, MessageSquare, Flag } from "lucide-react";

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
  onClose: () => void;
}

const ENGINE_COLORS: Record<string, string> = {
  ChatGPT: "#10a37f", Claude: "#d97706", Perplexity: "#3b82f6",
  Gemini: "#8b5cf6", "AI Overviews": "#ef4444", Groq: "#f97316",
};

export default function ChatModal({ chat, ownBrand, onClose }: Props) {
  const handleContentClick = (e: React.MouseEvent) => e.stopPropagation();

  // Build a combined regex for **bold** and brand names, then render inline nodes
  function renderInline(text: string): React.ReactNode[] {
    const brands = chat.brandsFound;
    const ownLower = ownBrand?.toLowerCase();

    const escaped = brands
      .slice()
      .sort((a, b) => b.length - a.length)
      .map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

    const brandPart = escaped.length > 0 ? "|" + escaped.join("|") : "";
    const regex = new RegExp(`(\\*\\*.*?\\*\\*${brandPart})`, "gi");

    return text.split(regex).filter(Boolean).map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={j} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      const matchedBrand = brands.find((b) => b.toLowerCase() === part.toLowerCase());
      if (matchedBrand) {
        const isOwn = ownLower && matchedBrand.toLowerCase() === ownLower;
        return (
          <mark key={j} className={isOwn ? "cm-brand-own" : "cm-brand-other"}>
            {part}
          </mark>
        );
      }
      return part;
    });
  }

  const renderResponse = (text: string | null | undefined) => {
    if (!text) return <p className="text-slate-400 italic">No response content available.</p>;

    return text.split("\n").map((line, i) => {
      if (line.startsWith("# "))  return <h1  key={i} className="text-2xl font-bold mt-6 mb-4">{renderInline(line.slice(2))}</h1>;
      if (line.startsWith("## ")) return <h2  key={i} className="text-xl font-bold mt-5 mb-3">{renderInline(line.slice(3))}</h2>;
      if (line.startsWith("### "))return <h3  key={i} className="text-lg font-bold mt-4 mb-2">{renderInline(line.slice(4))}</h3>;
      if (line.startsWith("- ") || line.startsWith("* ")) {
        return <li key={i} className="ml-4 mb-1 list-disc pl-2">{renderInline(line.substring(2))}</li>;
      }
      if (line.trim() === "") return <div key={i} className="h-4" />;
      return <p key={i} className="mb-3 leading-relaxed text-slate-700">{renderInline(line)}</p>;
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row relative"
        onClick={handleContentClick}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600 z-10"
        >
          <X size={20} />
        </button>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden border-r border-slate-100">
          {/* Header */}
          <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div 
                  className="w-6 h-6 rounded flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ backgroundColor: ENGINE_COLORS[chat.engine] || "#6366f1" }}
                >
                  {chat.engine.charAt(0)}
                </div>
                <span className="text-sm font-bold text-slate-700">{chat.engine}</span>
              </div>
              <div className="h-4 w-px bg-slate-200" />
              <div className="flex items-center gap-2">
                <Flag size={14} className="text-slate-400" />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">US</span>
              </div>
            </div>
            <div className="mr-8">
              <button className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors uppercase tracking-wider">
                View prompt <ExternalLink size={10} />
              </button>
            </div>
          </div>

          {/* Response Scroll Area */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-3xl mx-auto">
              {/* Question */}
              <div className="bg-slate-100/50 border border-slate-200/50 rounded-xl p-4 mb-8 flex items-start gap-3">
                <MessageSquare size={16} className="text-indigo-500 mt-1 shrink-0" />
                <p className="text-sm font-semibold text-slate-800 italic">"{chat.query}"</p>
              </div>

              {/* Response Body */}
              <div className="prose prose-slate max-w-none">
                {renderResponse(chat.rawResponse)}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar / Details */}
        <div className="w-full md:w-72 bg-slate-50/30 flex flex-col h-full overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Details</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar">
            {/* Brands Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  Brands
                </h4>
              </div>
              <div className="space-y-3">
                {chat.brandsFound.map((brand, i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-600 transition-colors truncate pr-2">
                      {brand}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400" style={{ width: '70%' }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">7.1</span>
                    </div>
                  </div>
                ))}
                {chat.brandsFound.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No brands identified.</p>
                )}
              </div>
            </div>

            {/* Sources Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Globe size={10} />
                  Sources
                </h4>
              </div>
              <div className="space-y-4">
                {chat.sourcesFound.map((source, i) => (
                  <a 
                    key={i} 
                    href={source.url || "#"} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded bg-white shadow-sm border border-slate-200 flex items-center justify-center shrink-0 mt-0.5 group-hover:border-indigo-200 transition-colors">
                        <img 
                          src={`https://www.google.com/s2/favicons?domain=${source.domain}&sz=32`} 
                          alt="" 
                          className="w-3 h-3"
                          onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug">
                          {source.title || source.domain}
                        </p>
                        <p className="text-[9px] text-slate-400 truncate mt-1">{source.domain}</p>
                      </div>
                    </div>
                  </a>
                ))}
                {chat.sourcesFound.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No sources cited.</p>
                )}
              </div>
            </div>
          </div>

          <div className="p-5 border-t border-slate-100 bg-slate-50/50">
            <button className="w-full py-2 text-[10px] font-bold text-slate-500 hover:text-slate-700 uppercase tracking-widest border border-slate-200 rounded-lg hover:bg-white transition-all">
              View all insights
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }

        :global(.cm-brand-own) {
          background: #fef08a;
          color: #713f12;
          border-radius: 3px;
          padding: 0 2px;
          font-weight: 600;
          text-decoration: none;
        }
        :global(.cm-brand-other) {
          background: #e0e7ff;
          color: #3730a3;
          border-radius: 3px;
          padding: 0 2px;
          font-weight: 500;
          text-decoration: none;
        }
      `}</style>
    </div>
  );
}
