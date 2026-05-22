"use client";

import { LogOut } from "lucide-react";
import { ReactNode } from "react";

interface Props {
  left: ReactNode;
  right: ReactNode;
  onLogout?: () => void;
}

export default function SetupShell({ left, right, onLogout }: Props) {
  return (
    <div className="setup-shell">
      <header className="setup-shell-header">
        <div className="setup-shell-brand">
          <div className="setup-shell-logo-box" />
          <span className="setup-shell-brand-name">Peec AI</span>
        </div>
        <button
          type="button"
          className="setup-shell-logout"
          onClick={onLogout ?? (() => (window.location.href = "/"))}
        >
          <LogOut size={13} />
          Log out
        </button>
      </header>

      <div className="setup-shell-body">
        <section className="setup-shell-left">
          <div className="setup-shell-left-inner">{left}</div>
          <footer className="setup-shell-footer">
            <span>©{new Date().getFullYear()} Peec AI</span>
            <div className="setup-shell-footer-links">
              <a href="#">Privacy policy</a>
              <span>·</span>
              <a href="#">Terms</a>
            </div>
          </footer>
        </section>

        <section className="setup-shell-right">{right}</section>
      </div>
    </div>
  );
}
