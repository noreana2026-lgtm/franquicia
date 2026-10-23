import React, { useEffect, useRef } from 'react';
import { CONTRACTS, CONTRACT_ORDER, RULE_INFO, MODES, GROUPS, groupSqs, boardSQ, boardOf, buildSet, SCORE } from '../game/data.js';
import { money } from '../game/engine.js';

export default function Rules({ settings, focus }) {
  const ref = useRef(null);
  useEffect(() => { if (focus && ref.current) ref.current.scrollIntoView({ block: 'start' }); }, [focus]);
  const s = settings;
  const bs = buildSet(s); const SQB = boardSQ(s?.board); const W = boardOf(s); const fr = s?.board === 'franquicia';
  return (
    <div className="rulesdoc">
      <section>
        <h3>De qué va</h3>
        {fr ? (
          <p>Cada uno dirige una franquicia NBA. Las casillas son jugadores ({SQB.filter((x) => x.t === 'team').length}: actuales e históricos, más caros cuanto mayor es su legado). Los fichas, completas grupos, los haces progresar hasta el anillo y cobras a quien caiga en ellos. Gana la franquicia mejor valorada: patrimonio + {SCORE.group} por cada grupo completo + {SCORE.ring} por cada anillo. Si alguien deja a todos en quiebra, gana directamente.</p>
        ) : (
          <p>Compras franquicias NBA, completas grupos de color, las mejoras y cobras a quien caiga en ellas. Gana el último que no quiebre o, si hay límite de rondas, el mayor patrimonio (dinero + franquicias + mejoras + su parte de las UTE).</p>
        )}
      </section>
      <section>
        <h3>Tu turno</h3>
        <ul>
          <li>Tira dos dados y avanza. Con dobles vuelves a tirar; con tres dobles seguidos vas a la {W.jail}.</li>
          <li>Si caes en una casilla libre, la compras o la dejas{s?.rules?.auction ? ' (entonces se subasta entre todos)' : ''}.</li>
          <li>Si tiene dueño, pagas el alquiler. Hipotecada, no se paga.</li>
          <li>Cuando quieras, también fuera de tu turno: mejorar, vender mejoras, hipotecar y proponer contratos.</li>
          <li>Si no puedes pagar algo, queda como deuda: vende mejoras, hipoteca, pide un préstamo o declárate en quiebra.</li>
        </ul>
      </section>
      <section>
        <h3>Casillas especiales</h3>
        <dl className="rtab">
          <dt>{SQB[0].n}</dt><dd>Cobras {money(s?.salary || 200)} al pasar</dd>
          <dt>Trade Deadline y Front Office</dt><dd>Cartas</dd>
          <dt>{SQB[4].n} · {SQB[38].n}</dt><dd>200 · 100</dd>
          <dt>{SQB[10].n}</dt><dd>Visita o castigo</dd>
          <dt>{SQB[30].n}</dt><dd>A la {W.jail} directo</dd>
          <dt>{SQB[20].n}</dt><dd>{s?.rules?.pot ? 'Te llevas el bote' : 'Descanso'}</dd>
          <dt>{W.tvName} (4)</dt><dd>25 · 50 · 100 · 200</dd>
          <dt>{W.utilName} (2)</dt><dd>4× o 10× los dados</dd>
        </dl>
      </section>
      <section>
        <h3>{fr ? 'Progresión de los jugadores' : `Mejoras: ${bs.n.toLowerCase()}`}</h3>
        <p>{bs.d} Con el grupo completo cobras el doble aunque no tengas mejoras. Cada nivel se paga al precio de mejora del grupo; venderlo devuelve la mitad.</p>
        <ol className="lv">{bs.lv.slice(1).map((l, k) => <li key={k}>{l}</li>)}</ol>
        <dl className="rtab">{Object.entries(GROUPS).map(([g, x]) => <React.Fragment key={g}><dt><i className="pdot" style={{ background: x.c }} /> {groupSqs(g).map((j) => SQB[j].n).join(', ')}</dt><dd>{x.house} por nivel</dd></React.Fragment>)}</dl>
      </section>
      <section>
        <h3>Reglas de esta partida</h3>
        <ul>{Object.entries(RULE_INFO).map(([k, r]) => <li key={k}><b>{r.n}: {s?.rules?.[k] ? 'sí' : 'no'}.</b> {r.d}</li>)}</ul>
        <p className="hint">Modo {MODES[s?.mode || 'estandar'].n}: {MODES[s?.mode || 'estandar'].d}</p>
      </section>
      <section ref={focus === 'contratos' ? ref : null}>
        <h3>Contratos</h3>
        <p>La negociación es libre: habladlo en la mesa o por el grupo. Cuando haya trato, una parte lo da de alta y las demás lo firman en su móvil. Se ejecuta en cuanto firman todos y el juego vigila que se cumpla.</p>
        {CONTRACT_ORDER.map((k) => {
          const c = CONTRACTS[k];
          return (
            <article key={k} className="kdoc">
              <h4>{c.n} <small>{c.k}</small></h4>
              <p>{c.short}</p>
              <ul>{c.how.map((l, i) => <li key={i}>{l}</li>)}</ul>
              {c.gov && <ul>{Object.values(c.gov).map((l, i) => <li key={i}>{l}</li>)}</ul>}
              <ul className="fine">{c.rules.map((l, i) => <li key={i}>{l}</li>)}</ul>
              <p className="ex">Ejemplo: {c.ex}</p>
            </article>
          );
        })}
      </section>
    </div>
  );
}
