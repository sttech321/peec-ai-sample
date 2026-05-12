"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown, Search, Plus, LogOut, FolderOpen,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
}

interface Props {
  projects: Project[];
  activeProjectId: string;
  activeProjectName: string;
  userEmail?: string;
  switchProjectAction: (projectId: string) => Promise<void>;
  createProjectAction: (formData: FormData) => Promise<void>;
}

export default function ProjectSwitcher({
  projects,
  activeProjectId,
  activeProjectName,
  userEmail = "admin@workspace.com",
  switchProjectAction,
  createProjectAction,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowAddForm(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  // Get initials for project icon
  const getInitials = (name: string) => {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="ps-wrapper" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        className="ps-trigger"
        onClick={() => { setOpen(!open); setShowAddForm(false); setSearch(""); }}
      >
        <div className="ps-trigger-icon">
          <FolderOpen size={14} />
        </div>
        <span className="ps-trigger-name">{activeProjectName}</span>
        <ChevronDown size={14} className={`ps-trigger-chevron ${open ? "ps-chevron-open" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="ps-dropdown">
          {/* User email */}
          <div className="ps-dropdown-email">{userEmail}</div>

          {/* Search */}
          <div className="ps-search-wrapper">
            <Search size={12} className="ps-search-icon" />
            <input
              className="ps-search-input"
              placeholder="Search projects"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          {/* Project list */}
          <div className="ps-project-list">
            {filtered.map((p) => (
              <button
                key={p.id}
                className={`ps-project-item ${p.id === activeProjectId ? "ps-project-active" : ""}`}
                onClick={async () => {
                  if (p.id !== activeProjectId) {
                    await switchProjectAction(p.id);
                  }
                  setOpen(false);
                }}
              >
                <span className="ps-project-icon">{getInitials(p.name)}</span>
                <span className="ps-project-name">{p.name}</span>
                {p.id === activeProjectId && (
                  <span className="ps-project-check">✓</span>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="ps-empty">No projects found</div>
            )}
          </div>

          {/* Add new project — opens the setup wizard */}
          {!showAddForm ? (
            <button
              className="ps-add-btn"
              onClick={() => {
                setOpen(false);
                router.push("/setup");
              }}
            >
              <Plus size={14} />
              Add new project
            </button>
          ) : (
            <form
              className="ps-add-form"
              action={async (formData) => {
                await createProjectAction(formData);
                setShowAddForm(false);
                setOpen(false);
              }}
            >
              <input
                className="ps-add-input"
                name="name"
                placeholder="Project name..."
                required
                autoFocus
              />
              <div className="ps-add-actions">
                <button
                  type="button"
                  className="ps-add-cancel"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="ps-add-submit">
                  Create
                </button>
              </div>
            </form>
          )}

          {/* Logout */}
          <button className="ps-logout-btn">
            <LogOut size={13} />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
