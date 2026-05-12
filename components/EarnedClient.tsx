"use client";

import React, { useState, useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  AlertCircle,
  MoreVertical,
  Filter,
  Users,
  FileText,
  ChevronDown,
  Globe,
  Share2,
  BookOpen
} from "lucide-react";
import Link from "next/link";
import { updateActionStatus } from "../app/earned/actions";

export default function EarnedClient({
  initialActions,
  projectName
}: {
  initialActions: any[],
  projectName: string
}) {
  const [actions, setActions] = useState(initialActions);
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  const stats = {
    total: actions.length,
    done: actions.filter(a => a.status === 'done').length,
    skipped: actions.filter(a => a.status === 'declined').length,
    todo: actions.filter(a => a.status === 'todo').length,
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    await updateActionStatus(id, newStatus);
  };

  // Grouping logic for sidebar
  const categories = useMemo(() => {
    const ugcDomains = new Set<string>();
    const editorialTypes = new Set<string>();

    actions.forEach(a => {
      const type = (a.type || "").toLowerCase();
      const domain = (a.sourceDomain || "").toLowerCase();
      
      if (['reddit', 'forum', 'facebook', 'instagram', 'youtube', 'quora'].includes(type) || domain.includes('reddit') || domain.includes('facebook')) {
        if (a.sourceDomain) ugcDomains.add(a.sourceDomain);
      } else {
        if (a.type) editorialTypes.add(a.type);
      }
    });

    return {
      ugc: Array.from(ugcDomains).sort(),
      editorial: Array.from(editorialTypes).sort()
    };
  }, [actions]);

  const filteredActions = actions.filter(a => {
    // Status filter
    if (activeFilter !== "all" && a.status !== activeFilter) return false;
    
    // Category/Domain filter
    if (selectedDomain && a.sourceDomain !== selectedDomain) return false;
    if (selectedCategory && a.type !== selectedCategory) return false;

    return true;
  });

  if (initialActions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="earned-empty-state">
          <div className="empty-icon-wrapper">
            <FileText size={24} />
          </div>
          <h2 className="empty-title">Add more competitors</h2>
          <p className="empty-description">
            Actions work best when you're tracking enough competitors and brands. 
            Add more to see where you're missing out.
          </p>
          <Link href="/brands" className="btn-add-competitors">
            Add competitors
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="earned-container">
      {/* Header with Title and Icon */}
      <div className="earned-header flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
            <FileText size={20} />
          </div>
          <div>
            <h1 className="earned-title text-xl font-bold text-white leading-none mb-1">Actions</h1>
            <p className="text-slate-400 text-[11px]">Improve visibility for {projectName} across external platforms.</p>
          </div>
        </div>

        {/* Top Filters */}
        <div className="flex items-center gap-3">
          <div className="filter-dropdown-mock">
            <Globe size={14} className="text-slate-500" />
            <span>All Models</span>
            <ChevronDown size={14} className="text-slate-500" />
          </div>
          <div className="filter-dropdown-mock">
            <BookOpen size={14} className="text-slate-500" />
            <span>All Topics</span>
            <ChevronDown size={14} className="text-slate-500" />
          </div>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Dynamic Sidebar */}
        <aside className="w-52 shrink-0 flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <button 
              onClick={() => { setSelectedDomain(null); setSelectedCategory(null); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${!selectedDomain && !selectedCategory ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:bg-slate-800/50'}`}
            >
              Overview
            </button>
          </div>

          {categories.ugc.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 flex items-center justify-between">
                UGC <AlertCircle size={10} className="text-slate-600" />
              </span>
              {categories.ugc.map(domain => (
                <button 
                  key={domain}
                  onClick={() => { setSelectedDomain(domain); setSelectedCategory(null); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedDomain === domain ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/30'}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${domain.includes('reddit') ? 'bg-orange-500' : domain.includes('facebook') ? 'bg-blue-600' : 'bg-slate-500'}`} />
                  {domain}
                </button>
              ))}
            </div>
          )}

          {categories.editorial.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 flex items-center justify-between">
                Editorial <AlertCircle size={10} className="text-slate-600" />
              </span>
              {categories.editorial.map(type => (
                <button 
                  key={type}
                  onClick={() => { setSelectedCategory(type); setSelectedDomain(null); }}
                  className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedCategory === type ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/30'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Stats Bar */}
          <div className="earned-stats-grid">
            <div className="stat-item">
              <span className="stat-label">All earned actions</span>
              <span className="stat-value">{stats.total}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Done actions</span>
              <span className="stat-value text-emerald-500">{stats.done}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Skipped actions</span>
              <span className="stat-value text-rose-500">{stats.skipped}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Todo actions</span>
              <span className="stat-value text-blue-500">{stats.todo}</span>
            </div>
          </div>

          <div className="recommendations-section">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-white">All recommendations</h2>
                <p className="text-[11px] text-slate-500">Act on these suggestions to increase your AI search visibility.</p>
              </div>
              <div className="flex items-center bg-[#0f0f13] rounded-lg p-1 border border-slate-800/50">
                <StatusFilterBtn label="All" active={activeFilter === 'all'} onClick={() => setActiveFilter('all')} />
                <StatusFilterBtn label="Todo" active={activeFilter === 'todo'} onClick={() => setActiveFilter('todo')} />
                <StatusFilterBtn label="Done" active={activeFilter === 'done'} onClick={() => setActiveFilter('done')} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredActions.map((action) => (
                <div key={action.id} className="bg-[#141418] border border-slate-800 rounded-xl p-4 flex flex-col gap-3 hover:border-slate-700 transition-all group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        action.priority === 'High' ? 'bg-rose-500/10 text-rose-500' : 
                        action.priority === 'Medium' ? 'bg-amber-500/10 text-amber-500' : 
                        'bg-blue-500/10 text-blue-500'
                      }`}>
                        {action.priority}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-800/50 px-1.5 py-0.5 rounded">
                        <Globe size={10} />
                        {action.sourceDomain || "General"}
                      </span>
                    </div>
                    <button className="text-slate-600 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical size={14} />
                    </button>
                  </div>

                  <div className="flex-1">
                    <h4 className="text-[13px] font-semibold text-white mb-1 group-hover:text-indigo-400 transition-colors">{action.title}</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">{action.description}</p>
                  </div>

                  {action.sourceUrl && (
                    <a href={action.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1">
                      View source <ExternalLink size={10} />
                    </a>
                  )}

                  <div className="pt-3 border-t border-slate-800/50 flex items-center justify-between">
                    <div className="flex gap-2">
                      <ActionBtn 
                        label="Done" 
                        icon={<CheckCircle2 size={12} />} 
                        active={action.status === 'done'} 
                        onClick={() => handleStatusUpdate(action.id, 'done')} 
                        variant="done"
                      />
                      <ActionBtn 
                        label="Decline" 
                        icon={<XCircle size={12} />} 
                        active={action.status === 'declined'} 
                        onClick={() => handleStatusUpdate(action.id, 'declined')} 
                        variant="decline"
                      />
                    </div>
                    <ActionBtn 
                      label="Todo" 
                      icon={<Clock size={12} />} 
                      active={action.status === 'todo'} 
                      onClick={() => handleStatusUpdate(action.id, 'todo')} 
                      variant="todo"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusFilterBtn({ label, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${active ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
    >
      {label}
    </button>
  );
}

function ActionBtn({ label, icon, active, onClick, variant }: any) {
  const variants: any = {
    done: active ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50' : 'hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-500 border-transparent',
    decline: active ? 'bg-rose-500/20 text-rose-500 border-rose-500/50' : 'hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 border-transparent',
    todo: active ? 'bg-blue-500 text-white border-transparent' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border-transparent'
  };

  return (
    <button 
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase border transition-all ${variants[variant]}`}
    >
      {icon}
      {label}
    </button>
  );
}
