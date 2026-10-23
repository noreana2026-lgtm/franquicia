import React, { useEffect, useMemo, useState } from 'react';
import { SQ, GROUPS, BUILD_SETS, groupSqs } from '../game/data.js';
import { pk, isP, isU, oNum, getUte, rentOf, houseCost, mortValue, unmortCost, netWorth, money, rank, entName, buildErr, sellErr, mortErr, uteOpErr, OP_TXT, lockOf, contractTitle } from '../game/engine.js';
import Board, { CourtCenter } from './Board.jsx';
import { M, Sheet, Stepper, Dot, PropTag } from './common.jsx';
import ContractsTab, { ContractEditor } from './Contracts.jsx';
import Rules from './Rules.jsx';

export default function Game({ ctx, onExit, roomCode }) {
  const { G } = ctx;
  const [tab, setTab] = useState('mio');
  const [sheet, setSheet] = useState(null); // {k:'prop', sq} | {k:'rules'} | {k:'contract', preset}
  const [rolling, setRolling] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  useEffect(() => { if (!G.rollSeq) return undefined; setRolling(true); const t = setTimeout(() => setRolling(false), 450); return () => clearTimeout(t); }, [G.rollSeq]);

  const humans = G.players.map((p, i) => i).filter((i) => ctx.can(i));
  const actor = ctx.actor;

  return (
    <div className="app game">
      <header className="gtop">
        <h1 className="logo sm">Franquicia</h1>
        <div className="gbtns">
          {roomCode && <span className="codepill">Sala {roomCode}</span>}
          <button className="mini" onClick={() => setSheet({ k: 'rules' })}>Reglas</button>
          {confirmExit ? <button className="mini warn" onClick={onExit}>¿Salir? Sí</button> : <button className="mini" onClick={() => setConfirmExit(true)}>Salir</button>}
        </div>
      </header>

      <Scoreboard G={G} />
      <Alerts ctx={ctx} goContracts={() => setTab('contratos')} />

      <Board G={G} onTile={(sq) => setSheet({ k: 'prop', sq })} hi={G.pending?.sq ?? G.auction?.sq}
        center={<CourtCenter G={G} rolling={rolling} />} />

      <Dock ctx={ctx} openProp={(sq) => setSheet({ k: 'prop', sq })} goMine={() => setTab('mio')} />

      {ctx.local && humans.length > 1 && (tab === 'mio' || tab === 'contratos') && (
        <div className="actor">
          <span>Gestionando como</span>
          <div className="chips">{humans.filter((i) => !G.players[i].bankrupt).map((i) => (
            <button key={i} className="chip" aria-pressed={actor === i} onClick={() => ctx.setActor(i)}><Dot col={G.players[i].col} />{G.players[i].name}</button>
          ))}</div>
        </div>
      )}

      <nav className="tabs" aria-label="Secciones">
        {[['mio', 'Mis franquicias'], ['contratos', `Contratos${badge(G, ctx)}`], ['log', 'Jugadas']].map(([k, l]) => (
          <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </nav>
      {tab === 'mio' && <Mine ctx={ctx} openProp={(sq) => setSheet({ k: 'prop', sq })} />}
      {tab === 'contratos' && <ContractsTab ctx={ctx} openNew={(preset) => setSheet({ k: 'contract', preset })} openRules={() => setSheet({ k: 'rules', sec: 'contratos' })} />}
      {tab === 'log' && !ctx.local && ctx.isHost && <AwayTools ctx={ctx} />}
      {tab === 'log' && <Log G={G} />}

      {sheet?.k === 'prop' && <PropSheet ctx={ctx} sq={sheet.sq} onClose={() => setSheet(null)} />}
      {sheet?.k === 'rules' && <Sheet title="Reglas" onClose={() => setSheet(null)}><Rules settings={G.settings} focus={sheet.sec} /></Sheet>}
      {sheet?.k === 'contract' && <ContractEditor ctx={ctx} preset={sheet.preset} onClose={() => setSheet(null)} onDone={() => { setSheet(null); setTab('contratos'); }} />}
    </div>
  );
}

function badge(G, ctx) {
  const n = G.proposals.filter((p) => p.parties.some((i) => ctx.can(i) && !p.signed.includes(i))).length
    + G.votes.filter((v) => { const u = getUte(G, v.uid); return u && u.members.some((m) => ctx.can(m.p) && !v.yes.includes(m.p) && !v.no.includes(m.p)); }).length;
  return n ? ` (${n})` : '';
}

function Scoreboard({ G }) {
  return (
    <div className="score" role="list">
      {G.players.map((p, i) => (
        <div key={i} role="listitem" className={'sc' + (i === G.turn ? ' on' : '') + (p.bankrupt ? ' out' : '')} style={{ '--p': p.col }}>
          <span className="nm">{p.name}{p.bot ? ' 🤖' : ''}{p.away ? ' (ausente)' : ''}{p.inJail ? ' · sancionado' : ''}</span>
          <b className="cash">{p.bankrupt ? 'Quiebra' : money(p.cash)}</b>
          {!p.bankrupt && <small>Patrimonio {money(netWorth(G, i))}</small>}
        </div>
      ))}
    </div>
  );
}

function Alerts({ ctx, goContracts }) {
  const { G } = ctx;
  const sign = G.proposals.filter((p) => p.parties.some((i) => ctx.can(i) && !p.signed.includes(i)));
  const votes = G.votes.filter((v) => { const u = getUte(G, v.uid); return u && u.members.some((m) => ctx.can(m.p) && !v.yes.includes(m.p) && !v.no.includes(m.p)); });
  if (!sign.length && !votes.length) return null;
  return (
    <button className="alert" onClick={goContracts}>
      {sign.length ? `Tienes ${sign.length} contrato${sign.length > 1 ? 's' : ''} por firmar` : ''}{sign.length && votes.length ? ' y ' : ''}{votes.length ? `${votes.length} votación${votes.length > 1 ? 'es' : ''} de UTE` : ''}. Ver contratos
    </button>
  );
}

// ---------- acciones del turno ----------
function Dock({ ctx, openProp, goMine }) {
  const { G, dispatch } = ctx;
  const t = G.turn; const P = G.players[t];
  const canT = ctx.can(t);
  const [custom, setCustom] = useState(0);
  const [sure, setSure] = useState(null);

  if (G.limit) {
    const host = ctx.isHost;
    return (
      <section className="dock limit">
        <h3>Fin de las rondas pactadas</h3>
        <p>Vais por la ronda {G.round}. Podéis seguir unas rondas más o cerrar ya: gana el mayor patrimonio.</p>
        {host ? (
          <>
            <div className="row3">{[3, 5, 10].map((n) => <button key={n} className="btn" onClick={() => dispatch({ t: 'extend', by: ctx.hostIdx, n })}>+{n} rondas</button>)}</div>
            <button className="cta" onClick={() => dispatch({ t: 'finish', by: ctx.hostIdx })}>Terminar y ver ganador</button>
          </>
        ) : <p className="wait">El anfitrión decide si se amplía.</p>}
      </section>
    );
  }

  if (G.debts.length) {
    const byP = [...new Set(G.debts.map((d) => d.p))];
    return (
      <section className="dock debt">
        {byP.map((i) => {
          const ds = G.debts.filter((d) => d.p === i); const tot = ds.reduce((a, d) => a + d.amt, 0); const Pi = G.players[i];
          const d0 = ds[0];
          return (
            <div key={i} className="debtrow">
              <p><b>{Pi.name}</b> debe {money(tot)} ({ds.map((d) => `${money(d.amt)} a ${entName(G, d.to)}`).join(', ')}). Tiene {money(Pi.cash)}.</p>
              {ctx.can(i) ? (
                <div className="row3">
                  <button className="btn hot" disabled={Pi.cash < d0.amt} onClick={() => dispatch({ t: 'pay_debt', by: i })}>Pagar {money(d0.amt)}</button>
                  <button className="btn" onClick={() => { ctx.setActor?.(i); goMine(); }}>Vender o hipotecar</button>
                  {sure === i ? <button className="btn warn" onClick={() => { setSure(null); dispatch({ t: 'bankrupt', by: i }); }}>Confirmar quiebra</button>
                    : <button className="btn ghost" onClick={() => setSure(i)}>Declarar quiebra</button>}
                </div>
              ) : <p className="wait">Esperando a que {Pi.name} consiga el dinero.</p>}
            </div>
          );
        })}
        <p className="hint">También puedes pedir un préstamo o vender franquicias con un contrato.</p>
      </section>
    );
  }

  if (G.auction) {
    const A = G.auction; const s = SQ[A.sq];
    const bidders = G.players.map((p, i) => i).filter((i) => ctx.can(i) && !G.players[i].bankrupt && !A.out.includes(i));
    return (
      <section className="dock auction" style={{ '--c': s.g ? GROUPS[s.g].c : '#ccc' }}>
        <h3>Subasta: {s.n}</h3>
        <p>Precio de salida {money(s.price)} · Puja actual <b>{A.bid ? `${money(A.bid)} de ${G.players[A.lead].name}` : 'ninguna'}</b></p>
        <p className="hint">Siguen: {G.players.map((p, i) => i).filter((i) => !G.players[i].bankrupt && !A.out.includes(i)).map((i) => G.players[i].name).join(', ')}</p>
        {bidders.map((i) => (
          <div key={i} className="bidrow">
            <span><Dot col={G.players[i].col} /> {G.players[i].name} ({money(G.players[i].cash)})</span>
            {A.lead === i ? <em>Vas ganando</em> : (
              <div className="row4">
                {[10, 50, 100].map((v) => <button key={v} className="btn" disabled={A.bid + v > G.players[i].cash} onClick={() => dispatch({ t: 'bid', by: i, amt: A.bid + v })}>+{v}</button>)}
                <button className="btn ghost" onClick={() => dispatch({ t: 'fold', by: i })}>Me retiro</button>
              </div>
            )}
          </div>
        ))}
        {bidders.some((i) => i !== A.lead) ? (
          <div className="customrow"><Stepper value={custom || A.bid + 10} set={setCustom} step={10} /><span className="hint">Puja exacta</span>
            <div className="chips">{bidders.filter((i) => i !== A.lead).map((i) => <button key={i} className="chip" onClick={() => dispatch({ t: 'bid', by: i, amt: +(custom || A.bid + 10) })}>{G.players[i].name}</button>)}</div>
          </div>
        ) : null}
      </section>
    );
  }

  if (!canT) {
    return <section className="dock"><p className="wait">{P.away ? 'Piloto automático' : P.bot ? 'Juega' : 'Turno de'} <b style={{ color: P.col }}>{P.name}</b>…</p></section>;
  }

  if (G.phase === 'roll') {
    return (
      <section className="dock">
        {P.inJail ? (
          <>
            <p>Estás sancionado. Saca dobles para salir (intento {P.jailTries + 1} de 3), paga 50 o usa una carta.</p>
            <div className="row3">
              <button className="cta" onClick={() => dispatch({ t: 'roll', by: t })}>Tirar dados</button>
              <button className="btn" disabled={P.cash < 50} onClick={() => dispatch({ t: 'jail_pay', by: t })}>Pagar 50</button>
              {P.jailFree.length > 0 && <button className="btn" onClick={() => dispatch({ t: 'jail_card', by: t })}>Usar recurso</button>}
            </div>
          </>
        ) : <button className="cta" onClick={() => dispatch({ t: 'roll', by: t })}>{ctx.local ? `${P.name}: tirar dados` : 'Tirar dados'}</button>}
      </section>
    );
  }
  if (G.phase === 'buy' && G.pending) {
    const s = SQ[G.pending.sq];
    return (
      <section className="dock buy" style={{ '--c': s.g ? GROUPS[s.g].c : '#c9ced8' }}>
        <button className="buyhead" onClick={() => openProp(s.i)}><i className="sw" /><span><b>{s.t === 'team' ? `${s.city} ${s.n}` : s.n}</b><small>Libre · ver ficha</small></span><M v={s.price} /></button>
        <div className="row2">
          <button className="cta" disabled={P.cash < s.price} onClick={() => dispatch({ t: 'buy', by: t })}>Comprar</button>
          <button className="btn" onClick={() => dispatch({ t: 'decline', by: t })}>{G.settings.rules.auction ? 'Subastar' : 'No comprar'}</button>
        </div>
        {P.cash < s.price && <p className="hint">No te llega: hipoteca algo en «Mis franquicias» o pide un préstamo.</p>}
      </section>
    );
  }
  if (G.phase === 'end') {
    return (
      <section className="dock">
        <button className="cta" onClick={() => dispatch({ t: 'end_turn', by: t })}>{G.again && !P.inJail ? 'Dobles: tirar otra vez' : 'Terminar turno'}</button>
        <p className="hint">Antes de pasar puedes mejorar, hipotecar o proponer contratos.</p>
      </section>
    );
  }
  return null;
}

// ---------- ficha de franquicia ----------
function PropSheet({ ctx, sq, onClose }) {
  const { G, dispatch } = ctx;
  const s = SQ[sq]; const p = G.props[sq]; const bs = BUILD_SETS[G.settings.build];
  const col = s.g ? GROUPS[s.g].c : '#c9ced8';
  const actor = ctx.actor;
  const u = p && isU(p.o) ? getUte(G, oNum(p.o)) : null;
  const mineDirect = p && actor != null && p.o === pk(actor);
  const member = u && actor != null && u.members.some((m) => m.p === actor);
  const lock = p ? lockOf(G, sq) : null;
  const cessions = G.contracts.filter((c) => c.k === 'cession' && c.sq === sq);

  const opBtn = (k, label, cost) => {
    let err;
    if (mineDirect) err = { build: buildErr, sell: sellErr, mortgage: mortErr }[k]?.(G, pk(actor), sq) ?? (k === 'unmortgage' && !p.mort ? 'No está hipotecada' : null);
    else if (member) err = uteOpErr(G, u, { k, sq });
    const act = mineDirect ? () => dispatch({ t: k, by: actor, sq }) : () => dispatch({ t: 'ute_op', by: actor, uid: u.id, op: { k, sq } });
    const viaVote = member && u.gov !== 'gestor';
    const notGestor = member && u.gov === 'gestor' && u.gestor !== actor;
    const money0 = mineDirect && !err && (k === 'build' || k === 'unmortgage') && G.players[actor].cash < (k === 'build' ? houseCost(sq) : unmortCost(sq)) ? 'No tienes dinero suficiente' : null;
    const why = err || money0 || (notGestor ? `Solo decide el gestor (${G.players[u.gestor]?.name})` : null);
    return (
      <React.Fragment key={k}>
        <button className="btn" disabled={!!why} onClick={act}>
          {viaVote ? 'Proponer: ' : ''}{label}{cost ? ` (${cost})` : ''}
        </button>
        {why && <p className="operr">{why}</p>}
      </React.Fragment>
    );
  };

  return (
    <Sheet onClose={onClose} title={s.t === 'team' ? `${s.city} ${s.n}` : s.n} color={col}>
      {s.price ? (
        <>
          <dl className="facts">
            <dt>Precio</dt><dd>{money(s.price)}</dd>
            <dt>Dueño</dt><dd>{p ? entName(G, p.o) : 'Libre'}</dd>
            {p && <><dt>Estado</dt><dd>{p.mort ? 'Hipotecada' : s.t === 'team' ? bs.lv[p.lvl] : 'Activa'}</dd></>}
            <dt>Hipoteca</dt><dd>{money(mortValue(sq))} (levantar: {money(unmortCost(sq))})</dd>
            {s.t === 'team' && <><dt>Cada mejora</dt><dd>{money(houseCost(sq))}</dd></>}
            {p && <><dt>Cobra ahora</dt><dd>{s.t === 'util' ? (rentOf(G, sq, 1) === 10 ? '10 × dados' : '4 × dados') : money(rentOf(G, sq))}</dd></>}
          </dl>
          {s.t === 'team' && (
            <table className="rent">
              <tbody>
                <tr><td>Solo la franquicia</td><td>{money(s.rent[0])}</td></tr>
                <tr><td>Con el grupo completo</td><td>{money(s.rent[0] * 2)}</td></tr>
                {[1, 2, 3, 4, 5].map((l) => <tr key={l} className={p?.lvl === l ? 'on' : ''}><td>{l}. {bs.lv[l]}</td><td>{money(s.rent[l])}</td></tr>)}
              </tbody>
            </table>
          )}
          {s.t === 'tv' && <p className="note">Cobra 25 con un canal, 50 con dos, 100 con tres y 200 con los cuatro.</p>}
          {s.t === 'util' && <p className="note">Cobra 4 veces los dados con un patrocinio, 10 veces con los dos.</p>}
          {s.t === 'team' && <p className="hint">Grupo {GROUPS[s.g].n}: {groupSqs(s.g).map((j) => SQ[j].n).join(', ')}.</p>}
          {lock && <p className="note">Bloqueada por un contrato: {lock.k === 'loan' ? 'es aval de un préstamo' : contractTitle(G, lock)}.</p>}
          {cessions.map((c) => <p key={c.id} className="note">{G.players[c.benef].name} cobra el {c.pct} % de sus alquileres.</p>)}
          {u && <p className="note">Es de la UTE {u.name} ({u.members.map((m) => `${G.players[m.p].name} ${m.pct}%`).join(', ')}). {u.gov === 'gestor' ? `Decide ${G.players[u.gestor]?.name}.` : u.gov === 'mayoria' ? 'Se decide por mayoría.' : 'Se decide por unanimidad.'}</p>}
          {(mineDirect || member) && (
            <div className="opgrid">
              {s.t === 'team' && opBtn('build', `Mejorar a ${bs.lv[Math.min(5, (p.lvl || 0) + 1)]}`, money(houseCost(sq)))}
              {s.t === 'team' && p.lvl > 0 && opBtn('sell', 'Vender mejora', '+' + money(houseCost(sq) / 2))}
              {!p.mort ? opBtn('mortgage', 'Hipotecar', '+' + money(mortValue(sq))) : opBtn('unmortgage', 'Levantar hipoteca', money(unmortCost(sq)))}
            </div>
          )}
        </>
      ) : <SpecialInfo s={s} G={G} />}
    </Sheet>
  );
}

function SpecialInfo({ s, G }) {
  const r = G.settings.rules;
  const txt = {
    go: `Cada vez que pasas cobras ${money(G.settings.salary)}${r.doubleGo ? '; si caes justo aquí, el doble' : ''}.`,
    jail: 'Si solo pasas, estás de visita. Sancionado: sales sacando dobles (3 intentos), pagando 50 o con «Recurso aprobado».',
    pot: r.pot ? `Quien cae aquí se lleva el bote de multas. Ahora hay ${money(G.pot)}.` : 'Descanso: no pasa nada.',
    gojail: 'Vas directo a la sanción sin pasar por el Draft.',
    td: 'Roba una carta de Trade Deadline: movimientos, cobros y pagos.',
    fo: 'Roba una carta de Front Office: casi siempre dinero.',
    tax: `Pagas ${money(s.v)}${r.pot ? ' al bote del All-Star' : ' a la liga'}.`,
  }[s.t];
  return <p className="note">{txt}</p>;
}

// ---------- lo mío ----------
function Mine({ ctx, openProp }) {
  const { G } = ctx; const i = ctx.actor;
  if (i == null) return <p className="note">Estás mirando la partida.</p>;
  const P = G.players[i];
  const mine = Object.keys(G.props).map(Number).filter((k) => G.props[k].o === pk(i)).sort((a, b) => a - b);
  const utes = G.utes.filter((u) => u.active && u.members.some((m) => m.p === i));
  const byG = {};
  mine.forEach((sq) => { const g = SQ[sq].g || SQ[sq].t; (byG[g] = byG[g] || []).push(sq); });
  return (
    <section className="mine">
      <div className="mehead"><Dot col={P.col} size={14} /><b>{P.name}</b><span><M v={P.cash} /> en caja · patrimonio {money(netWorth(G, i))}{P.jailFree.length ? ` · ${P.jailFree.length} recurso${P.jailFree.length > 1 ? 's' : ''}` : ''}</span></div>
      {!mine.length && <p className="hint">Aún no tienes franquicias. Cae en una libre para comprarla.</p>}
      {Object.entries(byG).map(([g, sqs]) => {
        const full = GROUPS[g] && groupSqs(g).every((j) => G.props[j]?.o === pk(i));
        return (
          <div key={g} className="grp">
            <span className="glabel">{GROUPS[g]?.n || (g === 'tv' ? 'Derechos de TV' : 'Patrocinios')}{full ? ' · grupo completo' : GROUPS[g] ? ` · ${sqs.length} de ${groupSqs(g).length}` : ''}</span>
            <div className="ptags">{sqs.map((sq) => <PropTag key={sq} sq={sq} G={G} onClick={() => openProp(sq)} />)}</div>
          </div>
        );
      })}
      {utes.map((u) => {
        const ps = Object.keys(G.props).map(Number).filter((k) => G.props[k].o === 'u' + u.id);
        return (
          <div key={u.id} className="grp">
            <span className="glabel">UTE {u.name} · tu parte {u.members.find((m) => m.p === i).pct} %</span>
            <div className="ptags">{ps.map((sq) => <PropTag key={sq} sq={sq} G={G} onClick={() => openProp(sq)} />)}</div>
          </div>
        );
      })}
      <p className="hint">Toca una franquicia para mejorarla, hipotecarla o ver sus alquileres.</p>
    </section>
  );
}

function AwayTools({ ctx }) {
  const { G, dispatch } = ctx;
  const list = G.players.map((p, i) => ({ p, i })).filter(({ p, i }) => !p.bot && !p.away && !p.bankrupt && i !== ctx.actor);
  if (!list.length) return null;
  return (
    <div className="note">
      <p className="hint">Si alguien se ha quedado sin conexión, pásalo a piloto automático para que la partida siga. Vuelve cuando él quiera.</p>
      <div className="chips" style={{ marginTop: 6 }}>{list.map(({ p, i }) => <button key={i} className="chip" onClick={() => dispatch({ t: 'set_away', by: ctx.actor, target: i })}><Dot col={p.col} />{p.name}: automático</button>)}</div>
    </div>
  );
}

function Log({ G }) {
  const items = useMemo(() => [...G.log].reverse(), [G.log]);
  return <ol className="log">{items.map((l, k) => <li key={k} className={l.t.startsWith('—') ? 'rh' : ''}>{l.t}</li>)}</ol>;
}

export function EndScreen({ G, onRematch, onHome }) {
  const r = rank(G);
  return (
    <div className="app end">
      <h1 className="logo">Franquicia</h1>
      <div className="winner"><small>Campeón</small><h2 style={{ color: r[0].p.col }}>{r[0].p.name}</h2><p>Patrimonio {money(r[0].w)} en {G.round} rondas</p></div>
      <ol className="rank">
        {r.map((x, k) => <li key={x.i}><span className="pos">{k + 1}</span><Dot col={x.p.col} /><b>{x.p.name}</b><span>{x.p.bankrupt ? 'Quiebra' : money(x.w)}</span></li>)}
      </ol>
      {onRematch && <button className="cta" onClick={onRematch}>Revancha</button>}
      <button className="btn" onClick={onHome}>Volver al inicio</button>
      <details className="rules"><summary>Últimas jugadas</summary><Log G={G} /></details>
    </div>
  );
}

export { isP };
