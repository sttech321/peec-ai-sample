"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Search, Plus, LogOut } from "lucide-react";

interface Project {
  id: string;
  name: string;
  domain?: string | null;
}

interface Props {
  projects: Project[];
  activeProjectId: string;
  activeProjectName: string;
  activeProjectDomain?: string | null;
  userEmail?: string;
  switchProjectAction: (projectId: string) => Promise<void>;
  createProjectAction: (formData: FormData) => Promise<void>;
}

function ProjectIcon({
  name,
  domain,
  size = 22,
}: {
  name: string;
  domain?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  const initials = (() => {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  })();

  if (!domain || failed) {
    return (
      <span
        className="ps-project-icon"
        style={{ width: size, height: size, fontSize: Math.max(9, size - 13) }}
      >
        {initials}
      </span>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
      alt={name}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="ps-project-favicon"
      style={{ width: size, height: size }}
    />
  );
}

export default function ProjectSwitcher({
  projects,
  activeProjectId,
  activeProjectName,
  activeProjectDomain,
  userEmail = "admin@workspace.com",
  switchProjectAction,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="ps-wrapper" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        className="ps-trigger"
        onClick={() => { setOpen(!open); setSearch(""); }}
      >
        <ProjectIcon name={activeProjectName} domain={activeProjectDomain} size={28} />
        <span className="ps-trigger-name">{activeProjectName}</span>
        <ChevronDown size={14} className={`ps-trigger-chevron ${open ? "ps-chevron-open" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="ps-dropdown">
          <div className="ps-dropdown-email">{userEmail}</div>

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
                <ProjectIcon name={p.name} domain={p.domain} size={22} />
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

          {/* Add new project → setup wizard */}
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

          <button className="ps-logout-btn">
            <LogOut size={13} />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
