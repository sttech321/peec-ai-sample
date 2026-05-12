"use client";

import React, { useState } from "react";
import { 
  MessageSquare, X, ExternalLink, ShieldCheck, 
  Layers, Globe, Clock, ChevronRight, Zap
} from "lucide-react";

interface Mention {
  name: string;
  sentiment: number | null;
}

interface Source {
  domain: string;
  title: string | null;
  url: string;
}

interface Chat {
  id: string;
  engine: string;
  runDate: Date;
  rawResponse: string | null;
  query: string;
  mentions: Mention[];
  sources: Source[];
}

interface Props {
  chats: Chat[];
}

export default function RecentChats({ chats }: Props) {
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);

  const getEngineColor = (engine: string) => {
    const colors: Record<string, string> = {
      ChatGPT: "bg-emerald-500",
      Gemini: "bg-indigo-500",
      Claude: "bg-amber-500",
      Perplexity: "bg-blue-500",
      "AI Overviews": "bg-rose-500",
    };
    return colors[engine] || "bg-slate-500";
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours} hr ago`;
    return `${Math.floor(hours / 24)} d ago`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Recent Chats
          </h2>
          <p className="text-slate-500 text-xs mt-1">Where AI gets its information about this project</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {chats.map((chat) => (
          <div 
            key={chat.id}
            onClick={() => setSelectedChat(chat)}
            className="bg-[#141418] border border-slate-800 rounded-xl p-5 hover:border-slate-700 hover:bg-slate-900/40 transition-all cursor-pointer group shadow-lg"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getEngineColor(chat.engine)} shadow-[0_0_8px_rgba(0,0,0,0.5)]`} />
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{chat.engine}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                <Clock className="w-3 h-3" />
                {getTimeAgo(chat.runDate)}
              </div>
            </div>
            
            <h3 className="text-sm font-semibold text-slate-200 line-clamp-2 group-hover:text-white transition-colors mb-3 leading-relaxed">
              {chat.query}
            </h3>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-800/50">
              <div className="flex -space-x-2">
                {chat.mentions.slice(0, 3).map((m, i) => (
                  <div key={i} className="w-6 h-6 rounded-full bg-slate-800 border-2 border-[#141418] flex items-center justify-center text-[8px] font-bold text-slate-400">
                    {m.name.charAt(0)}
                  </div>
                ))}
                {chat.mentions.length > 3 && (
                  <div className="w-6 h-6 rounded-full bg-slate-800 border-2 border-[#141418] flex items-center justify-center text-[8px] font-bold text-slate-500">
                    +{chat.mentions.length - 3}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <div className="flex items-center gap-1 bg-slate-800/50 px-2 py-0.5 rounded text-[10px] text-slate-400">
                  <Globe className="w-3 h-3" />
                  {chat.sources.length}
                </div>
              </div>
            </div>
          </div>
        ))}
        {chats.length === 0 && (
          <div className="col-span-full py-12 text-center bg-[#141418]/50 border border-dashed border-slate-800 rounded-xl">
            <p className="text-slate-500 text-sm">No recent chats found.</p>
          </div>
        )}
      </div>

      {/* Chat Modal - Peec Style */}
      {selectedChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0f0f13] border border-slate-800 w-full max-w-6xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row animate-in zoom-in-95 duration-200">
            
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-slate-800 overflow-hidden">
              {/* Modal Header */}
              <div className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-[#141418]">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${getEngineColor(selectedChat.engine)}`} />
                  <span className="text-sm font-bold text-white uppercase tracking-wider">{selectedChat.engine}</span>
                  <span className="text-slate-600 text-sm">|</span>
                  <span className="text-slate-400 text-xs font-medium">US (Global)</span>
                </div>
                <div className="flex items-center gap-4">
                  <button className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                    View prompt <ExternalLink className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={() => setSelectedChat(null)}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Chat Content */}
              <div className="flex-1 overflow-y-auto p-10 bg-[#0a0a0c] custom-scrollbar">
                <div className="max-w-3xl mx-auto space-y-8">
                  <div className="bg-slate-900/30 border border-slate-800/50 rounded-xl p-5 mb-10">
                    <h4 className="text-[10px] uppercase tracking-[0.2em] text-indigo-400 font-bold mb-2">Original Prompt</h4>
                    <p className="text-lg font-bold text-white leading-relaxed">{selectedChat.query}</p>
                  </div>
                  
                  <div className="prose prose-invert max-w-none prose-p:text-slate-300 prose-p:leading-relaxed prose-headings:text-white prose-strong:text-indigo-300">
                    {selectedChat.rawResponse ? (
                      <div className="whitespace-pre-wrap text-slate-300 leading-loose">
                        {selectedChat.rawResponse}
                      </div>
                    ) : (
                      <p className="text-slate-500 italic">No response content recorded.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Details Area */}
            <div className="w-80 bg-[#0f0f13] flex flex-col overflow-hidden">
              <div className="h-14 border-b border-slate-800 flex items-center px-6 bg-[#141418]">
                <h3 className="text-sm font-bold text-white tracking-wide uppercase">Details</h3>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                {/* Brands Section */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Brands Mentioned</h4>
                  </div>
                  <div className="space-y-3">
                    {selectedChat.mentions.map((m, i) => (
                      <div key={i} className="flex items-center justify-between group">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-indigo-400 transition-colors" />
                          <span className="text-[13px] text-slate-200 font-medium">{m.name}</span>
                        </div>
                        {m.sentiment !== null && (
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${m.sentiment > 60 ? "bg-emerald-500" : m.sentiment > 40 ? "bg-amber-500" : "bg-rose-500"}`}
                                style={{ width: `${m.sentiment}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-slate-500">{Math.round(m.sentiment)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {selectedChat.mentions.length === 0 && (
                      <p className="text-[11px] text-slate-600">No brands detected in response.</p>
                    )}
                  </div>
                </section>

                {/* Fanout Placeholder */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fanout Queries</h4>
                  </div>
                  <div className="flex flex-col items-center justify-center py-6 bg-slate-900/20 border border-dashed border-slate-800 rounded-lg">
                    <Zap className="w-5 h-5 text-slate-700 mb-2" />
                    <p className="text-[10px] text-slate-600 uppercase tracking-tighter">No Fanout queries recorded</p>
                  </div>
                </section>

                {/* Sources Section */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sources</h4>
                  </div>
                  <div className="space-y-4">
                    {selectedChat.sources.map((s, i) => (
                      <div key={i} className="group">
                        <a 
                          href={s.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block text-[13px] text-slate-300 font-medium hover:text-indigo-400 transition-colors line-clamp-2 leading-snug"
                        >
                          {s.title || s.domain}
                        </a>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] text-slate-500 font-mono uppercase truncate max-w-[120px]">{s.domain}</span>
                          <ExternalLink className="w-2.5 h-2.5 text-slate-700" />
                        </div>
                      </div>
                    ))}
                    {selectedChat.sources.length === 0 && (
                      <p className="text-[11px] text-slate-600">No sources found for this chat.</p>
                    )}
                    {selectedChat.sources.length > 0 && (
                      <button className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest pt-2">
                        View All Sources
                      </button>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e1e24;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #2a2a35;
        }
      `}</style>
    </div>
  );
}
