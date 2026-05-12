"use client";

import React, { useState } from "react";
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  Check, 
  X,
  ExternalLink,
  ChevronDown,
  Info
} from "lucide-react";

import { 
  deleteBrand, 
  acceptSuggestion, 
  rejectSuggestion,
  createBrand
} from "../app/brands/actions";

export default function BrandsClient({ 
  initialBrands, 
  initialSuggestions,
  projectId,
  workspaceId
}: { 
  initialBrands: any[], 
  initialSuggestions: any[],
  projectId: string,
  workspaceId: string
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [brands, setBrands] = useState(initialBrands);
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [openDeleteMenu, setOpenDeleteMenu] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Modal form state
  const [newName, setNewName] = useState("");
  const [newAliases, setNewAliases] = useState<string[]>([""]);
  const [newDomains, setNewDomains] = useState<string[]>([""]);

  const filteredBrands = brands.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.domains.some((d: string) => d.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleDeleteBrand = async (id: string) => {
    setBrands(prev => prev.filter(b => b.id !== id));
    setOpenDeleteMenu(null);
    await deleteBrand(id);
  };

  const handleCreateBrand = async () => {
    if (!newName.trim()) return;
    
    const data = {
      projectId,
      workspaceId,
      name: newName.trim(),
      aliases: newAliases.filter(a => a.trim() !== ""),
      domains: newDomains.filter(d => d.trim() !== ""),
    };

    // Optimistic update
    setBrands(prev => [...prev, { ...data, id: Math.random().toString(), isOwn: false, mentions: 0 }]);
    setIsModalOpen(false);
    
    // Reset form
    setNewName("");
    setNewAliases([""]);
    setNewDomains([""]);

    await createBrand(data);
  };

  const handleAcceptSuggestion = async (id: string) => {
    const suggestion = suggestions.find(s => s.id === id);
    if (!suggestion) return;
    
    setSuggestions(prev => prev.filter(s => s.id !== id));
    setBrands(prev => [...prev, {
      ...suggestion,
      id: Math.random().toString(),
      isOwn: false,
      aliases: [suggestion.name],
      domains: suggestion.domain ? [suggestion.domain] : []
    }]);

    await acceptSuggestion(id);
  };

  const handleRejectSuggestion = async (id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
    await rejectSuggestion(id);
  };

  return (
    <div className="brands-container" onClick={() => setOpenDeleteMenu(null)}>
      <div className="brands-main">
        <div className="brands-header">
          <h1 className="brands-title">Your brands <span>· {brands.length}</span></h1>
          <div className="brands-actions">
            <button className="btn-add-brand" onClick={() => setIsModalOpen(true)}>
              <Plus size={16} />
              Add brand
            </button>
          </div>
        </div>

        <div className="brands-search-wrapper">
          <Search className="brands-search-icon" size={16} />
          <input 
            type="text" 
            className="brands-search-input" 
            placeholder="Search..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="brands-table-container">
          {brands.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-6">
                <Search size={32} className="text-slate-600" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Add more competitors</h2>
              <p className="text-slate-400 max-w-sm mb-8">
                Actions work best when you're tracking enough competitors and brands. 
                Add more to see where you're missing out.
              </p>
              <button 
                className="px-6 py-2 bg-white text-black rounded-lg font-bold hover:bg-white/90 transition-all flex items-center gap-2"
                onClick={() => setIsModalOpen(true)}
              >
                <Plus size={18} />
                Add competitors
              </button>
            </div>
          ) : (
            <table className="brands-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>Brand color</th>
                  <th>Display name <ChevronDown size={12} className="inline ml-1" /></th>
                  <th>Tracked names <ChevronDown size={12} className="inline ml-1" /></th>
                  <th>Domains <ChevronDown size={12} className="inline ml-1" /></th>
                  <th>Mentions <ChevronDown size={12} className="inline ml-1" /></th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredBrands.map((brand, i) => (
                  <tr key={brand.id}>
                    <td>
                      <div className="brand-color-dot" style={{ background: i === 0 ? '#fbbf24' : '#64748b' }}></div>
                    </td>
                    <td>
                      <div className="brand-name-cell">
                        {brand.name}
                        {brand.isOwn && <span className="tag-you">You</span>}
                      </div>
                    </td>
                    <td>{brand.aliases.join(", ")}</td>
                    <td>{brand.domains.join(", ")}</td>
                    <td>{brand.mentions || 0}</td>
                    <td className="relative">
                      <button 
                        className="text-slate-500 hover:text-slate-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDeleteMenu(openDeleteMenu === brand.id ? null : brand.id);
                        }}
                      >
                        <MoreHorizontal size={16} />
                      </button>

                      {openDeleteMenu === brand.id && (
                        <div 
                          className="delete-popover"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <p className="text-[11px] text-slate-400 mb-2">
                            Permanently delete this brand and all associated data.
                          </p>
                          <button 
                            className="btn-delete-confirm"
                            onClick={() => handleDeleteBrand(brand.id)}
                          >
                            Delete brand
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="brands-sidebar">
        <div className="sidebar-section-title">
          Brand suggestions <span>· {suggestions.length}</span>
          <Info size={14} className="text-slate-500" />
        </div>
        
        <div className="flex flex-col gap-3">
          {suggestions.map((suggestion) => (
            <div key={suggestion.id} className="suggestion-card">
              <div className="suggestion-header">
                <span className="suggestion-mentions">{suggestion.mentions} mentions</span>
                <div className="suggestion-actions">
                  <button 
                    className="btn-suggestion btn-reject"
                    onClick={() => handleRejectSuggestion(suggestion.id)}
                  >
                    <X size={14} />
                  </button>
                  <button 
                    className="btn-suggestion btn-accept"
                    onClick={() => handleAcceptSuggestion(suggestion.id)}
                  >
                    <Check size={14} />
                  </button>
                </div>
              </div>
              <div className="suggestion-name">{suggestion.name}</div>
              <div className="suggestion-domain flex items-center gap-1">
                {suggestion.domain}
                <ExternalLink size={10} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Brand Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add brand</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label className="form-label flex items-center gap-1">
                  Display Name <Info size={14} className="text-slate-500" />
                </label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. My Awesome Brand"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tracked Name</label>
                <p className="form-help">
                  Only the tracked name and its aliases are matched in an AI answer to identify the brand.
                </p>
                <div className="flex flex-col gap-2">
                  {newAliases.map((alias, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Tracked Name"
                        value={alias}
                        onChange={(e) => {
                          const updated = [...newAliases];
                          updated[index] = e.target.value;
                          setNewAliases(updated);
                        }}
                      />
                      {newAliases.length > 1 && (
                        <button 
                          className="text-slate-500 hover:text-rose-500"
                          onClick={() => setNewAliases(newAliases.filter((_, i) => i !== index))}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button 
                    className="text-indigo-400 text-xs font-medium flex items-center gap-1 mt-1 hover:text-indigo-300 transition-colors"
                    onClick={() => setNewAliases([...newAliases, ""])}
                  >
                    <Plus size={14} /> Add Alias
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Domains</label>
                <div className="flex flex-col gap-2">
                  {newDomains.map((domain, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Domain"
                        value={domain}
                        onChange={(e) => {
                          const updated = [...newDomains];
                          updated[index] = e.target.value;
                          setNewDomains(updated);
                        }}
                      />
                      {newDomains.length > 1 && (
                        <button 
                          className="text-slate-500 hover:text-rose-500"
                          onClick={() => setNewDomains(newDomains.filter((_, i) => i !== index))}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button 
                    className="text-indigo-400 text-xs font-medium flex items-center gap-1 mt-1 hover:text-indigo-300 transition-colors"
                    onClick={() => setNewDomains([...newDomains, ""])}
                  >
                    <Plus size={14} /> Add alternative domain
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button className="btn-create" onClick={handleCreateBrand}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
