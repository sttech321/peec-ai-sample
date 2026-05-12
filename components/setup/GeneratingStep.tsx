"use client";

import { Sparkles } from "lucide-react";

interface Props {
  label?: string;
}

export default function GeneratingStep({ label = "Generating brand profile..." }: Props) {
  return (
    <div className="gen-screen">
      <div className="gen-card">
        <div className="gen-head">
          <Sparkles size={14} className="gen-icon" />
          <span>{label}</span>
        </div>
        <div className="gen-bar">
          <div className="gen-bar-fill" />
        </div>
      </div>
    </div>
  );
}
