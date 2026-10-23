import React from 'react';
import { MODES, RULESETS, RULE_INFO, BUILD_SETS, BOT_NAMES, BOARDS, NBA_TEAMS, SCORE } from '../game/data.js';
import { Seg, Stepper, Toggle } from './common.jsx';

export function SettingsForm({ s, set }) {
  const up = (patch) => set({ ...s, ...patch });
  const setRule = (k, v) => up({ ruleset: 'personal', rules: { ...s.rules, [k]: v } });
  return (
    <div className="form">
      <div className="field"><span className="flabel">Tablero</span>
        <Seg value={s.board || 'liga'} set={(board) => up({ board })} opts={[['liga', 'Liga', 'compras franquicias'], ['franquicia', 'Franquicia', 'fichas jugadores']]} />
        <small className="hint">{BOARDS[s.board || 'liga'].d}{s.board === 'franquicia' ? ` Valoración = patrimonio + ${SCORE.group} por grupo completo + ${SCORE.ring} por anillo.` : ''}</small>
      </div>
      <div className="field"><span className="flabel">Versión</span>
        <Seg value={s.mode} set={(mode) => up({ mode, maxRounds: mode === 'rapida' ? (s.maxRounds || 20) : 0 })} opts={[['rapida', 'Rápida'], ['estandar', 'Estándar']]} />
        <small className="hint">{MODES[s.mode].d}</small>
      </div>
      <div className="field"><span className="flabel">{s.mode === 'rapida' ? 'Rondas' : 'Límite de rondas'}</span>
        <Stepper value={s.maxRounds} set={(maxRounds) => up({ maxRounds })} step={5} min={s.mode === 'rapida' ? 5 : 0} max={200} />
        <small className="hint">Una ronda es una tirada de cada jugador. {s.mode === 'rapida' ? 'Al llegar podréis ampliar o cerrar.' : '0 = sin límite: hasta la quiebra.'}</small>
      </div>
      {s.mode === 'rapida' && (
        <div className="field"><span className="flabel">{s.board === 'franquicia' ? 'Jugadores' : 'Franquicias'} de salida por cabeza</span><Stepper value={s.deal} set={(deal) => up({ deal })} step={1} min={0} max={4} /></div>
      )}
      <Toggle on={s.contracts} set={(contracts) => up({ contracts })} label="Contratos y UTE" hint="Traspasos, UTE, préstamos, pases VIP, cesiones, opciones y compras a plazos." />
      {s.board === 'franquicia' ? (
        <div className="field"><span className="flabel">Qué se construye</span><small className="hint">Progresión de cada jugador: {BUILD_SETS.jugador.lv.slice(1).join(' → ')}</small></div>
      ) : (
        <div className="field"><span className="flabel">Qué se construye</span>
          <Seg value={s.build} set={(build) => up({ build })} opts={[['infra', BUILD_SETS.infra.n], ['plantilla', BUILD_SETS.plantilla.n]]} />
          <small className="hint">{BUILD_SETS[s.build === 'plantilla' ? 'plantilla' : 'infra'].lv.slice(1).join(' → ')}</small>
        </div>
      )}
      <div className="field"><span className="flabel">Reglas</span>
        <Seg value={s.ruleset} set={(ruleset) => up({ ruleset, rules: ruleset === 'personal' ? s.rules : { ...RULESETS[ruleset] } })} opts={[['clasicas', 'Clásicas'], ['caseras', 'Caseras'], ['personal', 'A medida']]} />
        <div className="toggles">{Object.entries(RULE_INFO).map(([k, r]) => <Toggle key={k} on={s.rules[k]} set={(v) => setRule(k, v)} label={r.n} hint={r.d} />)}</div>
      </div>
      <div className="field"><span className="flabel">Dinero inicial</span><Stepper value={s.startCash} set={(startCash) => up({ startCash })} step={100} min={500} max={5000} /></div>
    </div>
  );
}

export function TeamSelect({ value, set, taken = [], label = 'Franquicia' }) {
  return (
    <select className="tsel" value={value || ''} onChange={(e) => set(e.target.value || null)} aria-label={label}>
      <option value="">Franquicia al azar</option>
      {NBA_TEAMS.map(([c, n]) => <option key={c} value={c} disabled={taken.includes(c) && c !== value}>{n}</option>)}
    </select>
  );
}

export function LocalPlayers({ list, set, board }) {
  const upd = (i, patch) => set(list.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const used = new Set(list.map((p) => p.name));
  return (
    <div className="field"><span className="flabel">Jugadores ({list.length}/6)</span>
      {list.map((p, i) => (
        <div key={i} className="prow">
          <input value={p.name} maxLength={14} placeholder={`Jugador ${i + 1}`} onChange={(e) => upd(i, { name: e.target.value })} aria-label={`Nombre del jugador ${i + 1}`} />
          <button type="button" className="chip" aria-pressed={!!p.bot} onClick={() => upd(i, { bot: !p.bot, name: !p.bot ? (BOT_NAMES.find((b) => !used.has(b)) || p.name) : '' })}>Bot</button>
          {list.length > 2 && <button type="button" className="iconbtn" aria-label="Quitar" onClick={() => set(list.filter((_, k) => k !== i))}>✕</button>}
          {board === 'franquicia' && <TeamSelect value={p.team} set={(team) => upd(i, { team })} taken={list.map((x) => x.team).filter(Boolean)} />}
        </div>
      ))}
      {list.length < 6 && (
        <div className="row2">
          <button type="button" className="btn ghost" onClick={() => set([...list, { name: '', bot: false }])}>+ Persona</button>
          <button type="button" className="btn ghost" onClick={() => set([...list, { name: BOT_NAMES.find((b) => !used.has(b)) || 'Bot', bot: true }])}>+ Bot</button>
        </div>
      )}
    </div>
  );
}
