"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, Globe, Search, Check, Languages } from "lucide-react";
import { COMMON_TIMEZONES, COUNTRIES, LANGUAGES, tzOffset, tzLabel } from "../../lib/setup-types";

/** Circular country flag (matches Peec). Falls back to the country code letters
 *  if the flag image fails to load. Emoji flags don't render on Windows, so we
 *  use an SVG flag CDN instead. */
function CircleFlag({ code, size = 20 }: { code: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <span className="step1-flag-fallback" style={{ width: size, height: size }}>
        {code.toUpperCase()}
      </span>
    );
  }
  return (
    <img
      className="step1-flag-circle"
      src={`https://hatscripts.github.io/circle-flags/flags/${code.toLowerCase()}.svg`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setErr(true)}
    />
  );
}

interface Props {
  url: string;
  brandName: string;
  location: string;
  language: string;
  timezone: string;
  onUrlChange: (v: string) => void;
  onBrandNameChange: (v: string) => void;
  onLocationChange: (v: string) => void;
  onLanguageChange: (v: string) => void;
  onTimezoneChange: (v: string) => void;
  onNext: () => void;
  loading?: boolean;
  error?: string | null;
}

function useClickAway(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [open, close]);
  return ref;
}

interface DropdownProps<T> {
  options: T[];
  value: T | null;
  onSelect: (opt: T) => void;
  renderTrigger: () => React.ReactNode;
  renderOption: (opt: T, selected: boolean) => React.ReactNode;
  searchKey?: (opt: T) => string;
  placeholder?: string;
}

function Dropdown<T>({
  options, value, onSelect, renderTrigger, renderOption, searchKey, placeholder,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useClickAway(open, () => { setOpen(false); setQ(""); });

  const filtered = useMemo(() => {
    if (!searchKey || !q.trim()) return options;
    const needle = q.trim().toLowerCase();
    return options.filter((o) => searchKey(o).toLowerCase().includes(needle));
  }, [options, q, searchKey]);

  return (
    <div ref={ref} className="setup-dd">
      <button type="button" className="setup-dd-trigger" onClick={() => setOpen(!open)}>
        {renderTrigger()}
        <ChevronsUpDown size={14} className="setup-dd-chevron" />
      </button>
      {open && (
        <div className="setup-dd-panel">
          {searchKey && (
            <div className="setup-dd-search">
              <Search size={12} />
              <input
                placeholder={placeholder ?? "Search..."}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
            </div>
          )}
          <div className="setup-dd-list custom-scrollbar">
            {filtered.map((opt, i) => (
              <button
                key={i}
                type="button"
                className="setup-dd-option"
                onClick={() => {
                  onSelect(opt);
                  setOpen(false);
                  setQ("");
                }}
              >
                {renderOption(opt, value === opt)}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="setup-dd-empty">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectDetailsStep(props: Props) {
  const selectedCountry = COUNTRIES.find((c) => c.name === props.location) ?? COUNTRIES[0];
  const selectedLanguage = LANGUAGES.find((l) => l.name === props.language) ?? LANGUAGES[0];

  return (
    <div className="step1">
      <div className="step1-field">
        <label className="step1-label">Brand URL</label>
        <div className="step1-url-wrapper">
          <span className="step1-url-prefix">https://</span>
          <input
            type="text"
            className="step1-input step1-url-input"
            value={props.url}
            onChange={(e) => props.onUrlChange(e.target.value)}
            placeholder="example.com"
            autoFocus
          />
        </div>
      </div>

      <div className="step1-field">
        <label className="step1-label">Brand name</label>
        <input
          type="text"
          className="step1-input"
          value={props.brandName}
          onChange={(e) => props.onBrandNameChange(e.target.value)}
          placeholder="e.g. Acme"
        />
      </div>

      <div className="step1-row">
        <div className="step1-field" style={{ flex: 1 }}>
          <label className="step1-label">Location</label>
          <Dropdown
            options={COUNTRIES}
            value={selectedCountry}
            onSelect={(c) => props.onLocationChange(c.name)}
            searchKey={(c) => c.name}
            placeholder="Search countries..."
            renderTrigger={() => (
              <span className="step1-flag-line">
                <CircleFlag code={selectedCountry.code} />
                <span className="step1-dd-text">{selectedCountry.name}</span>
              </span>
            )}
            renderOption={(c, sel) => (
              <>
                <span className="step1-flag-line">
                  <CircleFlag code={c.code} />
                  <span className="step1-dd-text">{c.name}</span>
                </span>
                {sel && <Check size={13} />}
              </>
            )}
          />
        </div>

        <div className="step1-field" style={{ flex: 1 }}>
          <label className="step1-label">Language</label>
          <Dropdown
            options={LANGUAGES}
            value={selectedLanguage}
            onSelect={(l) => props.onLanguageChange(l.name)}
            searchKey={(l) => l.name}
            placeholder="Search languages..."
            renderTrigger={() => (
              <span className="step1-flag-line">
                <Languages size={15} className="step1-flag-icon" />
                <span className="step1-dd-text">{selectedLanguage.name}</span>
              </span>
            )}
            renderOption={(l, sel) => (
              <>
                <span className="step1-flag-line">
                  <Languages size={15} className="step1-flag-icon" />
                  <span className="step1-dd-text">{l.name}</span>
                </span>
                {sel && <Check size={13} />}
              </>
            )}
          />
        </div>
      </div>

      <div className="step1-field">
        <label className="step1-label">Time zone</label>
        <Dropdown
          options={[props.timezone, ...COMMON_TIMEZONES.filter((tz) => tz !== props.timezone)]}
          value={props.timezone}
          onSelect={(tz) => props.onTimezoneChange(tz)}
          searchKey={(tz) => tz}
          placeholder="Search timezones..."
          renderTrigger={() => (
            <span className="step1-flag-line">
              <Globe size={14} className="step1-flag-icon" />
              <span className="step1-dd-text">{tzLabel(props.timezone)}</span>
              <span className="step1-tz-offset">{tzOffset(props.timezone)}</span>
            </span>
          )}
          renderOption={(tz, sel) => (
            <>
              <span className="step1-flag-line">
                <Globe size={14} className="step1-flag-icon" />
                <span className="step1-dd-text">{tzLabel(tz)}</span>
                <span className="step1-tz-offset">{tzOffset(tz)}</span>
              </span>
              {sel && <Check size={13} />}
            </>
          )}
        />
      </div>

      {props.error && <div className="step1-error">{props.error}</div>}

      <div className="setup-nav">
        <button
          type="button"
          className="setup-btn setup-btn--primary setup-btn--block"
          onClick={props.onNext}
          disabled={props.loading || !props.url.trim() || !props.brandName.trim()}
        >
          {props.loading ? "Loading..." : "Next"}
        </button>
      </div>
    </div>
  );
}
