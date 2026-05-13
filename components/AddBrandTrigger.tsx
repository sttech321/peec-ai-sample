"use client";

import { Plus } from "lucide-react";
import { useBrandsModal } from "../lib/brands-modal-context";

export default function AddBrandTrigger() {
  const { open } = useBrandsModal();
  return (
    <button
      onClick={open}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "#111827",
        color: "#fff",
        padding: "7px 14px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        border: "none",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#374151")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#111827")}
    >
      <Plus size={14} strokeWidth={2.5} />
      Add brand
    </button>
  );
}
