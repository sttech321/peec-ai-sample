"use client";

import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

// ── Color conversion ─────────────────────────────────────────────────────────

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const clean = hex.replace("#", "").padEnd(6, "0");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return { h: 0, s: 1, v: 1 };
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else                h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s: max ? d / max : 0, v: max };
}

function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return "#" + [f(5), f(3), f(1)].map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0")).join("");
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  color: string;
  position: { top: number; left: number }; // pre-calculated from click event
  onChange: (hex: string) => void;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BrandColorPicker({ color, position, onChange, onClose }: Props) {
  const init = hexToHsv(color);
  const [h, setH] = useState(init.h);
  const [s, setS] = useState(init.s);
  const [v, setV] = useState(init.v);
  const [hex, setHex] = useState(color.replace("#", "").toUpperCase());

  const gradRef = useRef<HTMLDivElement>(null);
  const hueRef  = useRef<HTMLDivElement>(null);
  const boxRef  = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  function apply(nh: number, ns: number, nv: number) {
    setH(nh); setS(ns); setV(nv);
    const newHex = hsvToHex(nh, ns, nv).replace("#", "").toUpperCase();
    setHex(newHex);
    onChange("#" + newHex);
  }

  function pickGrad(e: React.PointerEvent) {
    const rect = gradRef.current?.getBoundingClientRect();
    if (!rect) return;
    apply(
      h,
      Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height)),
    );
  }

  function pickHue(e: React.PointerEvent) {
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;
    apply(Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360)), s, v);
  }

  function onHexInput(val: string) {
    const clean = val.replace(/[^0-9a-fA-F]/g, "").toUpperCase().slice(0, 6);
    setHex(clean);
    if (clean.length === 6) {
      const hsv = hexToHsv(clean);
      setH(hsv.h); setS(hsv.s); setV(hsv.v);
      onChange("#" + clean);
    }
  }

  const hueBase = hsvToHex(h, 1, 1);

  // Clamp position so picker never goes off-screen
  const PICKER_W = 220, PICKER_H = 290;
  const safeTop  = Math.max(8, Math.min(position.top,  window.innerHeight - PICKER_H - 8));
  const safeLeft = Math.max(8, Math.min(position.left, window.innerWidth  - PICKER_W - 8));

  const picker = (
    <div
      ref={boxRef}
      className="bcp-wrap"
      style={{ position: "fixed", top: safeTop, left: safeLeft, zIndex: 99999 }}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Gradient area */}
      <div
        ref={gradRef}
        className="bcp-gradient"
        style={{ background: `linear-gradient(to bottom, transparent, #000), linear-gradient(to right, #fff, ${hueBase})` }}
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); pickGrad(e); }}
        onPointerMove={e => { if (e.buttons) pickGrad(e); }}
      >
        <div className="bcp-sel" style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }} />
      </div>

      {/* Hue slider */}
      <div
        ref={hueRef}
        className="bcp-hue"
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); pickHue(e); }}
        onPointerMove={e => { if (e.buttons) pickHue(e); }}
      >
        <div className="bcp-hue-thumb" style={{ left: `${(h / 360) * 100}%`, background: hueBase }} />
      </div>

      {/* Hex input */}
      <div className="bcp-hex-section">
        <span className="bcp-hex-label">Hex Code</span>
        <div className="bcp-hex-row">
          <div className="bcp-hex-preview" style={{ background: "#" + hex }} />
          <div className="bcp-hex-input-wrap">
            <span className="bcp-hex-hash">#</span>
            <input
              className="bcp-hex-input"
              value={hex}
              onChange={e => onHexInput(e.target.value)}
              maxLength={6}
              spellCheck={false}
              autoFocus
            />
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? ReactDOM.createPortal(picker, document.body) : null;
}
