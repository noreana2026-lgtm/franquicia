import React, { useEffect } from 'react';
import { GROUPS, sqOf } from '../game/data.js';
import { money } from '../game/engine.js';

export const M = ({ v, className = '' }) => <span className={'money ' + className}>{money(v)}</span>;

const PIPS = { 1: [[50, 50]], 2: [[30, 30], [70, 70]], 3: [[28, 28], [50, 50], [72, 72]], 4: [[30, 30], [70, 30], [30, 70], [70, 70]], 5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]], 6: [[30, 26], [70, 26], [30, 50], [70, 50], [30, 74], [70, 74]] };
export const Die = ({ n, size = 44 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className="die">
    <rect x="4" y="4" width="92" height="92" rx="18" fill="#f6efe2" />
    {(PIPS[n] || []).map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9" fill="#15203a" />)}
  </svg>
);

export function Sheet({ onClose, children, title, color }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="sheet-in">
        <div className="sheet-top" style={color ? { '--c': color } : undefined}>
          {title && <h2>{title}</h2>}
          {onClose && <button className="x" onClick={onClose} aria-label="Cerrar">✕</button>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stepper({ value, set, step = 10, min = 0, max = 99999, suffix = '' }) {
  const v = Number(value) || 0;
  return (
    <div className="stepper">
      <button type="button" onClick={() => set(Math.max(min, v - step))} aria-label="Menos">−</button>
      <input inputMode="numeric" value={value} onChange={(e) => { const n = e.target.value.replace(/[^0-9]/g, ''); set(n === '' ? '' : Math.min(max, +n)); }} onBlur={() => set(Math.max(min, Math.min(max, v)))} />
      <span className="suf">{suffix}</span>
      <button type="button" onClick={() => set(Math.min(max, v + step))} aria-label="Más">+</button>
    </div>
  );
}

export const Dot = ({ col, size = 10 }) => <i className="pdot" style={{ background: col, width: size, height: size }} />;

export function PropTag({ sq, G, onClick, on, sub }) {
  const s = sqOf(G, sq); const p = G?.props?.[sq];
  const col = s.g ? GROUPS[s.g].c : '#c9ced8';
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag type={onClick ? 'button' : undefined} className={'ptag' + (on ? ' on' : '') + (p?.mort ? ' mort' : '')} style={{ '--c': col }} onClick={onClick} aria-pressed={onClick ? !!on : undefined}>
      <i className="sw" /><b>{s.ab || s.n}</b><span>{s.t === 'team' ? s.n : s.n.replace('Derechos ', '')}</span>
      {p?.lvl ? <em>N{p.lvl}</em> : null}{p?.mort ? <em>Hip.</em> : null}{sub ? <em>{sub}</em> : null}
    </Tag>
  );
}

export function Seg({ value, set, opts }) {
  return (
    <div className="seg" style={{ '--n': opts.length }}>
      {opts.map(([v, l, s]) => <button type="button" key={String(v)} aria-pressed={value === v} onClick={() => set(v)}>{l}{s && <small>{s}</small>}</button>)}
    </div>
  );
}

export function Toggle({ on, set, label, hint }) {
  return (
    <button type="button" className="toggle" aria-pressed={!!on} onClick={() => set(!on)}>
      <span className="tk"><i /></span>
      <span className="tx"><b>{label}</b>{hint && <small>{hint}</small>}</span>
    </button>
  );
}
