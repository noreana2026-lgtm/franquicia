import React, { useMemo, useState } from 'react';
import { SQ, CONTRACTS, CONTRACT_ORDER } from '../game/data.js';
import { pk, getUte, money, contractErr, contractParties, transferErr, splitPct, OP_TXT, uteOpErr, contractTitle } from '../game/engine.js';
import { Sheet, Stepper, Dot, PropTag, Seg, M } from './common.jsx';

const own = (G, i) => Object.keys(G.props).map(Number).filter((k) => G.props[k].o === pk(i)).sort((a, b) => a - b);
const nm = (G, i) => G.players[i]?.name;

// ---------- resumen legible de una propuesta ----------
export function describe(G, kind, d) {
  const props = (l) => (l || []).map((sq) => SQ[sq].n).join(', ');
  const give = (g) => [props(g.props), +g.cash ? money(g.cash) : '', +g.jf ? `${g.jf} recurso${g.jf > 1 ? 's' : ''}` : ''].filter(Boolean).join(' + ') || 'nada';
  switch (kind) {
    case 'trade': return [`${nm(G, d.a)} entrega: ${give(d.ga)}`, `${nm(G, d.b)} entrega: ${give(d.gb)}`];
    case 'ute': return [
      ...d.members.map((m) => `${nm(G, m)} · ${d.pct[m]} % · aporta ${[props(d.props?.[m]), +d.cash?.[m] ? money(d.cash[m]) : ''].filter(Boolean).join(' + ') || 'nada'}`),
      `Decisiones: ${d.gov === 'gestor' ? `gestor único (${nm(G, d.gestor)})` : d.gov === 'mayoria' ? 'mayoría' : 'unanimidad'} · Ingresos: ${d.pay === 'caja' ? 'caja común' : 'reparto directo'}`,
      `Duración: ${+d.rounds ? `${d.rounds} rondas` : 'indefinida'} · Cláusula de salida: ${money(+d.exitFee || 0)}`,
    ];
    case 'loan': return [`${nm(G, d.lender)} presta ${money(d.amount)} a ${nm(G, d.borrower)}`, `Devuelve ${money(d.repay)} en ${d.rounds} rondas (interés ${Math.round(((d.repay - d.amount) / Math.max(1, d.amount)) * 100)} %)`, d.collateral != null ? `Aval: ${SQ[d.collateral].n}` : 'Sin aval'];
    case 'discount': return [`${nm(G, d.tenant)} paga ${money(d.price)} a ${nm(G, d.owner)}`, `A cambio, ${d.pct} % de descuento en ${d.sqs === 'all' ? 'todas sus franquicias' : props(d.sqs)} durante ${d.rounds} rondas`];
    case 'cession': return [`${nm(G, d.benef)} paga ${money(d.price)} a ${nm(G, d.owner)}`, `A cambio cobra el ${d.pct} % de los alquileres de ${SQ[d.sq]?.n} ${+d.rounds ? `durante ${d.rounds} rondas` : 'de forma permanente'}`];
    case 'option': return [`${nm(G, d.holder)} paga ${money(d.premium)} de prima a ${nm(G, d.owner)}`, `Puede comprar ${SQ[d.sq]?.n} por ${money(d.strike)} durante ${d.rounds} rondas`];
    case 'installment': return [`${nm(G, d.buyer)} se queda ${SQ[d.sq]?.n} de ${nm(G, d.seller)}`, `Entrada ${money(+d.down || 0)} + ${d.n} cuotas de ${money(d.per)} (total ${money((+d.down || 0) + d.per * d.n)})`];
    default: return [];
  }
}

export default function ContractsTab({ ctx, openNew, openRules }) {
  const { G, dispatch } = ctx;
  if (!G.settings.contracts) return <p className="note">En esta partida los contratos están desactivados.</p>;
  const actor = ctx.actor;
  const utes = G.utes.filter((u) => u.active);
  return (
    <section className="contracts">
      <div className="row2">
        <button className="cta" disabled={actor == null || G.players[actor]?.bankrupt} onClick={() => openNew(null)}>Nuevo contrato</button>
        <button className="btn" onClick={openRules}>Cómo funcionan</button>
      </div>

      {G.proposals.length > 0 && <h3 className="h3">Propuestas abiertas</h3>}
      {G.proposals.map((pr) => {
        const waiting = pr.parties.filter((i) => !pr.signed.includes(i));
        const mineToSign = waiting.filter((i) => ctx.can(i));
        const canWithdraw = ctx.can(pr.by);
        const err = contractErr(G, pr.kind, pr.data);
        return (
          <article key={pr.id} className="kcard">
            <header><b>{pr.kind === 'ute' ? `UTE ${pr.data.name}` : CONTRACTS[pr.kind].n}</b><span>de {nm(G, pr.by)}</span></header>
            <ul>{describe(G, pr.kind, pr.data).map((l, k) => <li key={k}>{l}</li>)}</ul>
            <p className="hint">Firmado por {pr.signed.map((i) => nm(G, i)).join(', ')}. Falta: {waiting.map((i) => nm(G, i)).join(', ')}.</p>
            {err && <p className="bad">Ahora mismo no se puede ejecutar: {err}</p>}
            <div className="row3">
              {mineToSign.map((i) => <button key={i} className="btn hot" onClick={() => dispatch({ t: 'sign', by: i, id: pr.id })}>Firmar{ctx.local ? ` (${nm(G, i)})` : ''}</button>)}
              {mineToSign.map((i) => <button key={'r' + i} className="btn ghost" onClick={() => dispatch({ t: 'reject', by: i, id: pr.id })}>Rechazar{ctx.local ? ` (${nm(G, i)})` : ''}</button>)}
              {canWithdraw && !mineToSign.length && <button className="btn ghost" onClick={() => dispatch({ t: 'reject', by: pr.by, id: pr.id })}>Retirar propuesta</button>}
            </div>
          </article>
        );
      })}

      {utes.length > 0 && <h3 className="h3">UTE en marcha</h3>}
      {utes.map((u) => <UteCard key={u.id} ctx={ctx} u={u} />)}

      {G.contracts.length > 0 && <h3 className="h3">Contratos vigentes</h3>}
      {G.contracts.map((c) => <ContractCard key={c.id} ctx={ctx} c={c} />)}

      {!G.proposals.length && !utes.length && !G.contracts.length && (
        <p className="note">No hay contratos todavía. Negociad en la mesa (o por el grupo) y luego dad de alta aquí lo pactado: la otra parte solo tiene que firmar.</p>
      )}
    </section>
  );
}

function UteCard({ ctx, u }) {
  const { G, dispatch } = ctx;
  const props = Object.keys(G.props).map(Number).filter((k) => G.props[k].o === 'u' + u.id);
  const me = u.members.find((m) => m.p === ctx.actor);
  const [amt, setAmt] = useState(50);
  const [sure, setSure] = useState(false);
  const votes = G.votes.filter((v) => v.uid === u.id);
  const doOp = (op) => dispatch({ t: 'ute_op', by: ctx.actor, uid: u.id, op });
  const label = u.gov === 'gestor' ? '' : 'Proponer: ';
  const can = me && (u.gov !== 'gestor' || u.gestor === ctx.actor);
  return (
    <article className="kcard ute">
      <header><b>UTE {u.name}</b><span>desde la ronda {u.since}{u.end ? ` · hasta la ${u.end}` : ''}</span></header>
      <div className="members">{u.members.map((m) => <span key={m.p}><Dot col={G.players[m.p].col} /> {nm(G, m.p)} <b>{m.pct} %</b></span>)}</div>
      <p className="hint">{u.gov === 'gestor' ? `Gestor: ${nm(G, u.gestor)}` : u.gov === 'mayoria' ? 'Decide la mayoría (>50 %)' : 'Decide la unanimidad'} · {u.pay === 'caja' ? 'Caja común' : 'Reparto directo'} · Caja <M v={u.caja} /> · Salida {money(u.exitFee)}</p>
      <div className="ptags">{props.map((sq) => <PropTag key={sq} sq={sq} G={G} />)}</div>
      {votes.map((v) => {
        const pend = u.members.filter((m) => !v.yes.includes(m.p) && !v.no.includes(m.p) && ctx.can(m.p));
        return (
          <div key={v.id} className="vote">
            <p><b>Votación:</b> {OP_TXT[v.op.k]}{v.op.sq != null ? ` ${SQ[v.op.sq].n}` : ''}{v.op.amt ? ` ${money(v.op.amt)}` : ''} (propone {nm(G, v.by)}). A favor: {v.yes.map((i) => nm(G, i)).join(', ') || 'nadie'}{v.no.length ? ` · En contra: ${v.no.map((i) => nm(G, i)).join(', ')}` : ''}</p>
            <div className="row3">{pend.map((m) => (
              <React.Fragment key={m.p}>
                <button className="btn hot" onClick={() => dispatch({ t: 'ute_vote', by: m.p, id: v.id, yes: true })}>Sí{ctx.local ? ` (${nm(G, m.p)})` : ''}</button>
                <button className="btn ghost" onClick={() => dispatch({ t: 'ute_vote', by: m.p, id: v.id, yes: false })}>No{ctx.local ? ` (${nm(G, m.p)})` : ''}</button>
              </React.Fragment>
            ))}</div>
          </div>
        );
      })}
      {me && (
        <div className="uteops">
          <div className="customrow"><Stepper value={amt} set={setAmt} step={10} min={1} /></div>
          <div className="row3">
            <button className="btn" onClick={() => dispatch({ t: 'ute_deposit', by: ctx.actor, uid: u.id, amt: +amt })}>Ingresar en caja</button>
            <button className="btn" disabled={!can || !!uteOpErr(G, u, { k: 'dividend', amt: +amt })} onClick={() => doOp({ k: 'dividend', amt: +amt })}>{label}Repartir</button>
          </div>
          <div className="row2">
            <button className="btn ghost" disabled={!can} onClick={() => doOp({ k: 'dissolve' })}>{label}Disolver</button>
            {sure ? <button className="btn warn" onClick={() => { setSure(false); dispatch({ t: 'ute_leave', by: ctx.actor, uid: u.id }); }}>Salir pagando {money(u.exitFee)}</button>
              : <button className="btn ghost" onClick={() => setSure(true)}>Salir de la UTE</button>}
          </div>
          <p className="hint">Para mejorar o hipotecar sus franquicias, tócalas en el tablero.</p>
        </div>
      )}
    </article>
  );
}

function ContractCard({ ctx, c }) {
  const { G, dispatch } = ctx;
  const lines = {
    loan: `Devolver ${money(c.repay)} al empezar la ronda ${c.due}${c.collateral != null ? ` · aval ${SQ[c.collateral].n}` : ''}`,
    discount: `${c.pct} % de descuento en ${c.sqs === 'all' ? 'todas sus franquicias' : c.sqs.map((s) => SQ[s].n).join(', ')} hasta la ronda ${c.end}`,
    cession: `${c.pct} % de los alquileres${c.end ? ` hasta la ronda ${c.end}` : ', permanente'}`,
    option: `Compra a ${money(c.strike)} hasta la ronda ${c.end}`,
    installment: `Quedan ${c.left} cuotas de ${money(c.per)} a ${nm(G, c.seller)}`,
  }[c.k];
  const releaser = { loan: c.lender, discount: c.tenant, cession: c.benef, option: c.holder, installment: c.seller }[c.k];
  return (
    <article className="kcard">
      <header><b>{contractTitle(G, c)}</b><span>{CONTRACTS[c.k].n}</span></header>
      <p>{lines}</p>
      <div className="row3">
        {c.k === 'loan' && ctx.can(c.borrower) && <button className="btn hot" disabled={G.players[c.borrower].cash < c.repay} onClick={() => dispatch({ t: 'loan_repay', by: c.borrower, id: c.id })}>Devolver ya</button>}
        {c.k === 'option' && ctx.can(c.holder) && <button className="btn hot" disabled={G.players[c.holder].cash < c.strike} onClick={() => dispatch({ t: 'option_exercise', by: c.holder, id: c.id })}>Ejecutar compra</button>}
        {ctx.can(releaser) && <button className="btn ghost" onClick={() => dispatch({ t: 'release', by: releaser, id: c.id })}>Liberar contrato</button>}
      </div>
    </article>
  );
}

// ---------- editor ----------
function initData(kind, me, other) {
  switch (kind) {
    case 'trade': return { a: me, b: other, ga: { props: [], cash: 0, jf: 0 }, gb: { props: [], cash: 0, jf: 0 } };
    case 'ute': return { name: '', members: [me, other], pct: { [me]: 50, [other]: 50 }, props: { [me]: [], [other]: [] }, cash: { [me]: 0, [other]: 0 }, gov: 'mayoria', gestor: me, pay: 'directo', rounds: 0, exitFee: 100 };
    case 'loan': return { lender: me, borrower: other, amount: 200, repay: 260, rounds: 5, collateral: null };
    case 'discount': return { owner: other, tenant: me, pct: 100, sqs: 'all', rounds: 5, price: 100 };
    case 'cession': return { owner: me, benef: other, sq: null, pct: 30, rounds: 10, price: 100 };
    case 'option': return { owner: other, holder: me, sq: null, premium: 30, strike: 300, rounds: 8 };
    case 'installment': return { seller: other, buyer: me, sq: null, down: 50, per: 50, n: 5 };
    default: return {};
  }
}

export function ContractEditor({ ctx, onClose, onDone }) {
  const { G, dispatch } = ctx;
  const me = ctx.actor;
  const others = G.players.map((p, i) => i).filter((i) => i !== me && !G.players[i].bankrupt);
  const [kind, setKind] = useState(null);
  const [d, setD] = useState(null);
  const pickKind = (k) => { setKind(k); setD(initData(k, me, others[0])); };
  const set = (patch) => setD((x) => ({ ...x, ...patch }));
  const err = useMemo(() => (kind && d ? contractErr(G, kind, d) : null), [G, kind, d]);

  if (!kind) {
    return (
      <Sheet title="Nuevo contrato" onClose={onClose}>
        <p className="hint">Primero negociad; aquí se da de alta lo pactado y cada parte lo firma en su móvil.</p>
        <div className="ktypes">
          {CONTRACT_ORDER.map((k) => (
            <button key={k} className="ktype" onClick={() => pickKind(k)}>
              <b>{CONTRACTS[k].n}</b><small>{CONTRACTS[k].k}</small><span>{CONTRACTS[k].short}</span>
            </button>
          ))}
        </div>
      </Sheet>
    );
  }
  const info = CONTRACTS[kind];
  const submit = () => { if (err) return; dispatch({ t: 'propose', by: me, kind, data: clean(kind, d) }); onDone(); };

  return (
    <Sheet title={info.n} onClose={onClose}>
      <button className="mini back" onClick={() => setKind(null)}>← Otro tipo</button>
      <details className="kinfo"><summary>{info.short}</summary>
        <ul>{info.how.map((l, k) => <li key={k}>{l}</li>)}{info.rules.map((l, k) => <li key={'r' + k}>{l}</li>)}</ul>
        <p className="hint">Ejemplo: {info.ex}</p>
      </details>
      {kind === 'trade' && <TradeForm G={G} d={d} set={set} me={me} others={others} />}
      {kind === 'ute' && <UteForm G={G} d={d} set={set} me={me} others={others} />}
      {kind === 'loan' && <LoanForm G={G} d={d} set={set} me={me} others={others} />}
      {kind === 'discount' && <DiscountForm G={G} d={d} set={set} me={me} others={others} />}
      {kind === 'cession' && <CessionForm G={G} d={d} set={set} me={me} others={others} />}
      {kind === 'option' && <OptionForm G={G} d={d} set={set} me={me} others={others} />}
      {kind === 'installment' && <InstallForm G={G} d={d} set={set} me={me} others={others} />}
      <div className="summary">
        <b>Resumen</b>
        <ul>{describe(G, kind, clean(kind, d)).map((l, k) => <li key={k}>{l}</li>)}</ul>
      </div>
      {err && <p className="bad">{err}</p>}
      <button className="cta" disabled={!!err} onClick={submit}>Enviar para firmar</button>
      <p className="hint">Se ejecuta en cuanto firmen {contractParties(kind, d).filter((i) => i !== me).map((i) => nm(G, i)).join(' y ')}.</p>
    </Sheet>
  );
}

function clean(kind, d) {
  const n = (v) => Math.max(0, Math.round(+v || 0));
  switch (kind) {
    case 'trade': return { ...d, ga: { props: d.ga.props, cash: n(d.ga.cash), jf: n(d.ga.jf) }, gb: { props: d.gb.props, cash: n(d.gb.cash), jf: n(d.gb.jf) } };
    case 'ute': {
      const pct = {}; const props = {}; const cash = {};
      d.members.forEach((m) => { pct[m] = n(d.pct[m]); props[m] = d.props[m] || []; cash[m] = n(d.cash[m]); });
      return { ...d, name: (d.name || '').trim(), pct, props, cash, rounds: n(d.rounds), exitFee: n(d.exitFee), gestor: d.members.includes(d.gestor) ? d.gestor : d.members[0] };
    }
    case 'loan': return { ...d, amount: n(d.amount), repay: n(d.repay), rounds: n(d.rounds) };
    case 'discount': return { ...d, pct: n(d.pct), rounds: n(d.rounds), price: n(d.price) };
    case 'cession': return { ...d, pct: n(d.pct), rounds: n(d.rounds), price: n(d.price) };
    case 'option': return { ...d, premium: n(d.premium), strike: n(d.strike), rounds: n(d.rounds) };
    case 'installment': return { ...d, down: n(d.down), per: n(d.per), n: n(d.n) };
    default: return d;
  }
}

function Who({ G, label, value, set, options }) {
  return (
    <div className="field"><span className="flabel">{label}</span>
      <div className="chips">{options.map((i) => <button type="button" key={i} className="chip" aria-pressed={value === i} onClick={() => set(i)}><Dot col={G.players[i].col} />{G.players[i].name}</button>)}</div>
    </div>
  );
}

function PropPicker({ G, owner, value, set, multi = true, label, allowLocked }) {
  const list = own(G, owner);
  if (!list.length) return <div className="field"><span className="flabel">{label}</span><p className="hint">{G.players[owner].name} no tiene franquicias.</p></div>;
  const sel = multi ? value || [] : value;
  const toggle = (sq) => { if (!multi) set(sq === sel ? null : sq); else set(sel.includes(sq) ? sel.filter((x) => x !== sq) : [...sel, sq]); };
  return (
    <div className="field"><span className="flabel">{label}</span>
      <div className="ptags">{list.map((sq) => {
        const e = allowLocked ? null : transferErr(G, pk(owner), sq);
        return <PropTag key={sq} sq={sq} G={G} on={multi ? sel.includes(sq) : sel === sq} onClick={e ? undefined : () => toggle(sq)} sub={e ? 'no disponible' : undefined} />;
      })}</div>
    </div>
  );
}

const Num = ({ label, hint, ...p }) => <div className="field"><span className="flabel">{label}</span><Stepper {...p} />{hint && <small className="hint">{hint}</small>}</div>;

function TradeForm({ G, d, set, others }) {
  const side = (who, key) => (
    <div className="side">
      <h4>{G.players[who].name} entrega</h4>
      <PropPicker G={G} owner={who} value={d[key].props} set={(v) => set({ [key]: { ...d[key], props: v } })} label="Franquicias" />
      <Num label="Dinero" value={d[key].cash} set={(v) => set({ [key]: { ...d[key], cash: v } })} step={10} max={G.players[who].cash} />
      {G.players[who].jailFree.length > 0 && <Num label="Cartas «Recurso aprobado»" value={d[key].jf} set={(v) => set({ [key]: { ...d[key], jf: v } })} step={1} max={G.players[who].jailFree.length} />}
    </div>
  );
  return (
    <>
      <Who G={G} label="Con quién" value={d.b} set={(b) => set({ b, gb: { props: [], cash: 0, jf: 0 } })} options={others} />
      {side(d.a, 'ga')}{side(d.b, 'gb')}
    </>
  );
}

function UteForm({ G, d, set, me, others }) {
  const toggleM = (i) => {
    if (i === me) return;
    const has = d.members.includes(i);
    const members = has ? d.members.filter((x) => x !== i) : [...d.members, i];
    const pct = {}; members.forEach((m) => { pct[m] = Math.floor(100 / members.length); }); pct[members[0]] += 100 - members.reduce((a, m) => a + pct[m], 0);
    set({ members, pct, props: { ...d.props, [i]: d.props[i] || [] }, cash: { ...d.cash, [i]: d.cash[i] || 0 } });
  };
  const byValue = () => {
    const vals = d.members.map((m) => ({ p: m, pct: (d.props[m] || []).reduce((a, sq) => a + SQ[sq].price, 0) + (+d.cash[m] || 0) }));
    if (vals.some((v) => v.pct <= 0)) { const pct = {}; d.members.forEach((m) => { pct[m] = Math.round(100 / d.members.length); }); return set({ pct }); }
    const sh = splitPct(100, vals); const pct = {}; sh.forEach(({ p, v }) => { pct[p] = Math.max(1, v); });
    const diff = 100 - Object.values(pct).reduce((a, b) => a + b, 0); pct[d.members[0]] += diff;
    set({ pct });
  };
  const sum = d.members.reduce((a, m) => a + (+d.pct[m] || 0), 0);
  return (
    <>
      <div className="field"><span className="flabel">Nombre de la UTE</span><input value={d.name} maxLength={24} placeholder="Por ejemplo, Costa Oeste" onChange={(e) => set({ name: e.target.value })} /></div>
      <div className="field"><span className="flabel">Socios</span>
        <div className="chips">{[me, ...others].map((i) => <button type="button" key={i} className="chip" aria-pressed={d.members.includes(i)} disabled={i === me} onClick={() => toggleM(i)}><Dot col={G.players[i].col} />{G.players[i].name}</button>)}</div>
      </div>
      {d.members.map((m) => (
        <div key={m} className="side">
          <h4><Dot col={G.players[m].col} /> {G.players[m].name}</h4>
          <PropPicker G={G} owner={m} value={d.props[m]} set={(v) => set({ props: { ...d.props, [m]: v } })} label="Franquicias que aporta" />
          <div className="row2">
            <Num label="Dinero a la caja" value={d.cash[m]} set={(v) => set({ cash: { ...d.cash, [m]: v } })} step={10} max={G.players[m].cash} />
            <Num label="Participación" value={d.pct[m]} set={(v) => set({ pct: { ...d.pct, [m]: v } })} step={5} min={1} max={99} suffix="%" />
          </div>
        </div>
      ))}
      <div className="pctbar"><span className={sum === 100 ? 'ok' : 'bad'}>Suma {sum} %</span><button type="button" className="mini" onClick={byValue}>Calcular % según lo que aporta cada uno</button></div>
      <div className="field"><span className="flabel">Quién decide</span>
        <Seg value={d.gov} set={(gov) => set({ gov })} opts={[['gestor', 'Gestor'], ['mayoria', 'Mayoría'], ['unanimidad', 'Unanimidad']]} />
        <small className="hint">{CONTRACTS.ute.gov[d.gov]}</small>
      </div>
      {d.gov === 'gestor' && <Who G={G} label="Gestor" value={d.gestor} set={(gestor) => set({ gestor })} options={d.members} />}
      <div className="field"><span className="flabel">Ingresos</span>
        <Seg value={d.pay} set={(pay) => set({ pay })} opts={[['directo', 'Reparto directo', 'cada alquiler al momento'], ['caja', 'Caja común', 'se reparte con dividendos']]} />
      </div>
      <div className="row2">
        <Num label="Duración (rondas)" hint={+d.rounds ? '' : '0 = indefinida'} value={d.rounds} set={(rounds) => set({ rounds })} step={1} max={100} />
        <Num label="Cláusula de salida" value={d.exitFee} set={(exitFee) => set({ exitFee })} step={25} />
      </div>
    </>
  );
}

function LoanForm({ G, d, set, me, others }) {
  const iLend = d.lender === me; const other = iLend ? d.borrower : d.lender;
  const setOther = (o) => set(iLend ? { borrower: o, collateral: null } : { lender: o });
  return (
    <>
      <div className="field"><span className="flabel">Tú</span><Seg value={iLend ? 'l' : 'b'} set={(v) => set(v === 'l' ? { lender: me, borrower: other, collateral: null } : { lender: other, borrower: me, collateral: null })} opts={[['l', 'Prestas'], ['b', 'Pides prestado']]} /></div>
      <Who G={G} label={iLend ? 'A quién' : 'Quién te presta'} value={other} set={setOther} options={others} />
      <div className="row2">
        <Num label="Importe" value={d.amount} set={(amount) => set({ amount })} step={50} min={10} />
        <Num label="Total a devolver" value={d.repay} set={(repay) => set({ repay })} step={10} />
      </div>
      <Num label="Plazo (rondas)" value={d.rounds} set={(rounds) => set({ rounds })} step={1} min={1} max={30} />
      <PropPicker G={G} owner={d.borrower} multi={false} value={d.collateral} set={(collateral) => set({ collateral })} label="Aval (opcional)" />
    </>
  );
}

function DiscountForm({ G, d, set, me, others }) {
  const iOwner = d.owner === me; const other = iOwner ? d.tenant : d.owner;
  return (
    <>
      <div className="field"><span className="flabel">Tú</span><Seg value={iOwner ? 'o' : 't'} set={(v) => set(v === 'o' ? { owner: me, tenant: other, sqs: 'all' } : { owner: other, tenant: me, sqs: 'all' })} opts={[['t', 'Compras el pase'], ['o', 'Vendes el pase']]} /></div>
      <Who G={G} label={iOwner ? 'A quién se lo vendes' : 'Dueño de las franquicias'} value={other} set={(o) => set(iOwner ? { tenant: o } : { owner: o, sqs: 'all' })} options={others} />
      <div className="field"><span className="flabel">Qué cubre</span><Seg value={d.sqs === 'all' ? 'all' : 'some'} set={(v) => set({ sqs: v === 'all' ? 'all' : [] })} opts={[['all', 'Todas sus franquicias'], ['some', 'Solo algunas']]} /></div>
      {d.sqs !== 'all' && <PropPicker G={G} owner={d.owner} value={d.sqs} set={(sqs) => set({ sqs })} label="Franquicias cubiertas" allowLocked />}
      <div className="row2">
        <Num label="Descuento" value={d.pct} set={(pct) => set({ pct })} step={10} min={10} max={100} suffix="%" />
        <Num label="Rondas" value={d.rounds} set={(rounds) => set({ rounds })} step={1} min={1} max={30} />
      </div>
      <Num label="Precio del pase" value={d.price} set={(price) => set({ price })} step={10} />
    </>
  );
}

function CessionForm({ G, d, set, me, others }) {
  const iOwner = d.owner === me; const other = iOwner ? d.benef : d.owner;
  return (
    <>
      <div className="field"><span className="flabel">Tú</span><Seg value={iOwner ? 'o' : 'b'} set={(v) => set(v === 'o' ? { owner: me, benef: other, sq: null } : { owner: other, benef: me, sq: null })} opts={[['o', 'Vendes ingresos'], ['b', 'Compras ingresos']]} /></div>
      <Who G={G} label={iOwner ? 'A quién' : 'Dueño de la franquicia'} value={other} set={(o) => set(iOwner ? { benef: o } : { owner: o, sq: null })} options={others} />
      <PropPicker G={G} owner={d.owner} multi={false} value={d.sq} set={(sq) => set({ sq })} label="Franquicia" allowLocked />
      <div className="row2">
        <Num label="% de cada alquiler" value={d.pct} set={(pct) => set({ pct })} step={5} min={5} max={90} suffix="%" />
        <Num label="Rondas" hint={+d.rounds ? '' : '0 = permanente'} value={d.rounds} set={(rounds) => set({ rounds })} step={1} max={60} />
      </div>
      <Num label="Precio" value={d.price} set={(price) => set({ price })} step={10} />
    </>
  );
}

function OptionForm({ G, d, set, me, others }) {
  const iHolder = d.holder === me; const other = iHolder ? d.owner : d.holder;
  return (
    <>
      <div className="field"><span className="flabel">Tú</span><Seg value={iHolder ? 'h' : 'o'} set={(v) => set(v === 'h' ? { holder: me, owner: other, sq: null } : { holder: other, owner: me, sq: null })} opts={[['h', 'Compras la opción'], ['o', 'Vendes la opción']]} /></div>
      <Who G={G} label={iHolder ? 'Dueño de la franquicia' : 'A quién'} value={other} set={(o) => set(iHolder ? { owner: o, sq: null } : { holder: o })} options={others} />
      <PropPicker G={G} owner={d.owner} multi={false} value={d.sq} set={(sq) => set({ sq, strike: sq != null ? Math.round(SQ[sq].price * 1.4 / 10) * 10 : d.strike })} label="Franquicia" allowLocked />
      <div className="row2">
        <Num label="Prima (ahora)" value={d.premium} set={(premium) => set({ premium })} step={10} />
        <Num label="Precio de compra" value={d.strike} set={(strike) => set({ strike })} step={10} min={1} />
      </div>
      <Num label="Plazo (rondas)" value={d.rounds} set={(rounds) => set({ rounds })} step={1} min={1} max={30} />
    </>
  );
}

function InstallForm({ G, d, set, me, others }) {
  const iBuyer = d.buyer === me; const other = iBuyer ? d.seller : d.buyer;
  return (
    <>
      <div className="field"><span className="flabel">Tú</span><Seg value={iBuyer ? 'b' : 's'} set={(v) => set(v === 'b' ? { buyer: me, seller: other, sq: null } : { buyer: other, seller: me, sq: null })} opts={[['b', 'Compras'], ['s', 'Vendes']]} /></div>
      <Who G={G} label={iBuyer ? 'Vendedor' : 'Comprador'} value={other} set={(o) => set(iBuyer ? { seller: o, sq: null } : { buyer: o })} options={others} />
      <PropPicker G={G} owner={d.seller} multi={false} value={d.sq} set={(sq) => set({ sq })} label="Franquicia" />
      <Num label="Entrada" value={d.down} set={(down) => set({ down })} step={10} />
      <div className="row2">
        <Num label="Cuota por ronda" value={d.per} set={(per) => set({ per })} step={10} min={1} />
        <Num label="Número de cuotas" value={d.n} set={(n) => set({ n })} step={1} min={1} max={20} />
      </div>
    </>
  );
}
