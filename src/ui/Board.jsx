import React from 'react';
import { SQ, GROUPS, BUILD_SETS, CARDS } from '../game/data.js';
import { isP, isU, oNum, getUte } from '../game/engine.js';
import { Die } from './common.jsx';

export function cellPos(i) {
  if (i <= 10) return [11, 11 - i];          // fila inferior, de derecha a izquierda
  if (i <= 20) return [11 - (i - 10), 1];    // columna izquierda, hacia arriba
  if (i <= 30) return [1, 1 + (i - 20)];     // fila superior, hacia la derecha
  return [1 + (i - 30), 11];                 // columna derecha, hacia abajo
}
const side = (i) => (i < 10 ? 'b' : i < 20 ? 'l' : i < 30 ? 't' : 'r');

const ICON = { go: 'DRAFT', jail: 'SANCIÓN', pot: 'ALL-STAR', gojail: 'EXPULSADO', td: 'TRADE', fo: 'FRONT', tax: 'MULTA' };

export function ownerColor(G, o) {
  if (isP(o)) return G.players[oNum(o)]?.col;
  if (isU(o)) { const u = getUte(G, oNum(o)); if (!u) return '#888'; const cs = u.members.map((m) => G.players[m.p].col); return `repeating-linear-gradient(90deg, ${cs.map((c, k) => `${c} ${k * 6}px ${(k + 1) * 6}px`).join(',')})`; }
  return null;
}

export default function Board({ G, onTile, center, hi }) {
  const bs = BUILD_SETS[G.settings.build];
  return (
    <div className="board" role="grid" aria-label="Tablero">
      {SQ.map((s) => {
        const [r, c] = cellPos(s.i);
        const p = G.props?.[s.i];
        const toks = (G.players || []).map((pl, k) => ({ pl, k })).filter(({ pl }) => !pl.bankrupt && pl.pos === s.i);
        const corner = s.i % 10 === 0;
        const own = p ? ownerColor(G, p.o) : null;
        const cls = ['cell', 's-' + side(s.i), 't-' + s.t, corner ? 'corner' : '', p?.mort ? 'mort' : '', hi === s.i ? 'hi' : '', G.turn != null && G.players?.[G.turn]?.pos === s.i ? 'cur' : ''].join(' ');
        return (
          <button key={s.i} type="button" className={cls} style={{ gridRow: r, gridColumn: c, '--g': s.g ? GROUPS[s.g].c : 'transparent' }}
            onClick={() => onTile?.(s.i)} aria-label={`${s.n}${p ? ', con dueño' : ''}`}>
            {s.g && <i className="strip" />}
            <span className="ab">{s.ab || ICON[s.t] || ''}</span>
            {s.t === 'team' && <span className="pr">{p?.lvl ? (p.lvl === 5 ? '★' : '•'.repeat(p.lvl)) : s.price}</span>}
            {(s.t === 'tv' || s.t === 'util') && <span className="pr">{s.price}</span>}
            {corner && s.t === 'pot' && G.settings.rules.pot && <span className="cs">{G.pot}</span>}
            {corner && s.t === 'go' && <span className="cs">+{G.settings.salary}</span>}
            {own && <i className="own" style={{ background: own }} />}
            {toks.length > 0 && <span className="toks">{toks.map(({ pl, k }) => <i key={k} className={'tok' + (k === G.turn ? ' now' : '')} style={{ background: pl.col }} title={pl.name} />)}</span>}
            {p?.lvl === 5 && <span className="sr-only">{bs.lv[5]}</span>}
          </button>
        );
      })}
      <div className="court">{center}</div>
    </div>
  );
}

export function CourtCenter({ G, rolling }) {
  const P = G.players[G.turn];
  const card = G.card ? CARDS[G.card.deck][G.card.id] : null;
  const last = G.log?.[G.log.length - 1]?.t;
  return (
    <div className="cc">
      <svg className="lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <circle cx="50" cy="50" r="13" /><line x1="0" y1="50" x2="100" y2="50" />
        <path d="M30 0 v16 a20 20 0 0 0 40 0 V0" /><path d="M30 100 v-16 a20 20 0 0 1 40 0 V100" />
      </svg>
      <div className="cc-in">
        <span className="rnd">Ronda {G.round}{G.maxRounds ? ` de ${G.maxRounds}` : ''}{G.settings.rules.pot ? ` · bote ${G.pot}` : ''}</span>
        {G.status === 'playing' && <b className="who" style={{ color: P.col }}>{P.name}</b>}
        {G.dice && <div className={'dice' + (rolling ? ' rolling' : '')}><Die n={G.dice[0]} /><Die n={G.dice[1]} /></div>}
        {card ? (
          <div className={'card-mini ' + G.card.deck}><small>{G.card.deck === 'td' ? 'Trade Deadline' : 'Front Office'}</small><b>{card.n}</b><span>{card.tx}</span></div>
        ) : last ? <p className="last">{last}</p> : null}
      </div>
    </div>
  );
}
