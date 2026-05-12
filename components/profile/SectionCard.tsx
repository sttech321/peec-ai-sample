"use client";

import { ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";

interface Props {
  title: string;
  description?: string;
  helper?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  action?: ReactNode;
  children: ReactNode;
}

export default function SectionCard({
  title, description, helper, collapsible = false, defaultOpen = true, action, children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="bp-section">
      <div className="bp-section-header">
        <div className="bp-section-titles">
          <h3
            className={`bp-section-title ${collapsible ? "bp-section-title--clickable" : ""}`}
            onClick={collapsible ? () => setOpen(!open) : undefined}
          >
            {collapsible && (
              <ChevronDown
                size={14}
                className={`bp-chevron ${open ? "bp-chevron--open" : ""}`}
              />
            )}
            {title}
          </h3>
          {description && <p className="bp-section-description">{description}</p>}
        </div>
        {action && <div className="bp-section-action">{action}</div>}
      </div>
      {open && (
        <>
          {helper && <div className="bp-section-helper">{helper}</div>}
          <div className="bp-section-body">{children}</div>
        </>
      )}
    </section>
  );
}
