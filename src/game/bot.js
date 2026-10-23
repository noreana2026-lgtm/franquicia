// Bots y piloto automático (jugadores ausentes). Devuelven la siguiente acción a ejecutar o null.
import { SQ, groupSqs, GROUPS } from './data.js';
import { pk, isP, oNum, alive, rentOf, buildErr, sellErr, mortErr, unmortCost, houseCost, uteOpErr, getUte, hasGroup, transferErr } from './engine.js';

export const isAuto = (G, i) => !!(G.players[i] && !G.players[i].bankrupt && (G.players[i].bot || G.players[i].away));

const RESERVE = 150;

function ownedBy(G, o) { return Object.keys(G.props).map(Number).filter((k) => G.props[k].o === o); }

// ¿Comprar `sq` completaría un grupo para `i` o le quitaría el grupo a un rival?
function synergy(G, i, sq) {
  const s = SQ[sq]; if (s.t !== 'team') return 1;
  const gs = groupSqs(s.g).filter((j) => j !== sq);
  const owners = gs.map((j) => G.props[j]?.o || null);
  if (owners.every((o) => o === pk(i))) return 2;
  const others = owners.filter(Boolean);
  if (others.length === gs.length && new Set(others).size === 1) return 1.6;
  if (owners.some((o) => o === pk(i))) return 1.25;
  return 1;
}

function raiseFunds(G, i) {
  const P = G.players[i];
  const d = G.debts.find((x) => x.p === i);
  if (P.cash >= d.amt) return { t: 'pay_debt', by: i };
  const mine = ownedBy(G, pk(i));
  const sell = mine.filter((k) => G.props[k].lvl > 0 && !sellErr(G, pk(i), k)).sort((a, b) => G.props[b].lvl - G.props[a].lvl)[0];
  if (sell != null) return { t: 'sell', by: i, sq: sell };
  const mort = mine.filter((k) => !mortErr(G, pk(i), k)).sort((a, b) => synergy(G, i, a) - synergy(G, i, b) || SQ[a].price - SQ[b].price)[0];
  if (mort != null) return { t: 'mortgage', by: i, sq: mort };
  return { t: 'bankrupt', by: i };
}

function auctionValue(G, i, sq) { return Math.round(SQ[sq].price * Math.min(1.5, synergy(G, i, sq)) * (G.round < 6 ? 1.05 : 0.95)); }

const val = (G, sq, i) => (G.props[sq]?.mort ? SQ[sq].price / 2 : SQ[sq].price) * (i == null ? 1 : synergy(G, i, sq));

function acceptProposal(G, pr, q) {
  const d = pr.data; const P = G.players[q];
  switch (pr.kind) {
    case 'trade': {
      const mineIsA = d.a === q;
      const give = mineIsA ? d.ga : d.gb; const get = mineIsA ? d.gb : d.ga; const other = mineIsA ? d.b : d.a;
      const price = (sq) => (G.props[sq]?.mort ? SQ[sq].price / 2 : SQ[sq].price);
      const gain = (get.props || []).reduce((a, sq) => a + price(sq) * synergy(G, q, sq), 0) + (+get.cash || 0) + (+get.jf || 0) * 50;
      const loss = (give.props || []).reduce((a, sq) => {
        let v = price(sq);
        if (synergy(G, other, sq) >= 2) v += 0.6 * SQ[sq].price; // completa el grupo del rival
        const s = SQ[sq];
        if (s.t === 'team' && groupSqs(s.g).every((j) => G.props[j]?.o === pk(q))) v += 1.5 * SQ[sq].price; // rompe mi grupo
        return a + v;
      }, 0) + (+give.cash || 0) + (+give.jf || 0) * 50;
      return gain >= loss && P.cash - (+give.cash || 0) >= 50;
    }
    case 'ute': {
      let tot = 0; let mine = 0;
      d.members.forEach((m) => {
        const v = (d.props?.[m] || []).reduce((a, sq) => a + val(G, sq), 0) + (+d.cash?.[m] || 0);
        tot += v; if (m === q) mine += v;
      });
      const all = d.members.flatMap((m) => d.props?.[m] || []);
      const groups = new Set(all.filter((sq) => SQ[sq].t === 'team').map((sq) => SQ[sq].g));
      let bonus = 1;
      groups.forEach((g) => { if (groupSqs(g).every((j) => all.includes(j))) bonus = 1.5; });
      return (tot * bonus * (+d.pct[q] || 0)) / 100 >= mine && P.cash - (+d.cash?.[q] || 0) >= 50;
    }
    case 'loan':
      if (d.lender === q) return +d.amount <= P.cash - 200 && +d.repay >= +d.amount * 1.15 && +d.rounds <= 12;
      return +d.repay <= +d.amount * 1.3;
    case 'discount': {
      const sqs = d.sqs === 'all' ? ownedBy(G, pk(d.owner)) : d.sqs;
      const est = Math.max(20, sqs.reduce((a, sq) => a + rentOf(G, sq), 0) * (+d.pct / 100) * (+d.rounds) * 0.1);
      return d.owner === q ? +d.price >= est : +d.price <= est * 0.8 && P.cash - +d.price >= 100;
    }
    case 'cession': {
      const est = Math.max(20, rentOf(G, d.sq) * (+d.pct / 100) * (+d.rounds || 20) * 0.12);
      return d.owner === q ? +d.price >= est : +d.price <= est * 0.8 && P.cash - +d.price >= 100;
    }
    case 'option': {
      const pr0 = SQ[d.sq].price;
      return d.owner === q ? +d.premium >= pr0 * 0.1 && +d.strike >= pr0 * 1.4 : +d.premium <= pr0 * 0.15 && +d.strike <= pr0 * 1.3;
    }
    case 'installment': {
      const tot = (+d.down || 0) + (+d.per) * (+d.n); const pr0 = SQ[d.sq].price * synergy(G, d.buyer, d.sq);
      return d.seller === q ? tot >= SQ[d.sq].price * 1.25 : tot <= pr0 * 1.15 && +d.per <= P.cash / 4;
    }
    default: return false;
  }
}

function turnAction(G, i) {
  const P = G.players[i];
  if (G.phase === 'roll') {
    if (P.inJail) {
      if (P.jailFree.length) return { t: 'jail_card', by: i };
      const free = Object.keys(SQ).filter((k) => SQ[k].price && !G.props[k]).length;
      if (P.cash > 400 && free > 6) return { t: 'jail_pay', by: i };
    }
    return { t: 'roll', by: i };
  }
  if (G.phase === 'buy' && G.pending) {
    const sq = G.pending.sq; const pr = SQ[sq].price; const syn = synergy(G, i, sq);
    if (P.cash >= pr && (syn >= 1.6 || P.cash - pr >= RESERVE)) return { t: 'buy', by: i };
    return { t: 'decline', by: i };
  }
  if (G.phase === 'end') {
    // mejorar grupos completos
    const groups = Object.keys(GROUPS).filter((g) => hasGroup(G, pk(i), g)).sort((a, b) => GROUPS[b].house - GROUPS[a].house);
    for (const g of groups) {
      const gs = groupSqs(g).sort((a, b) => G.props[a].lvl - G.props[b].lvl);
      for (const sq of gs) {
        if (!buildErr(G, pk(i), sq) && P.cash - houseCost(sq) >= 200) return { t: 'build', by: i, sq };
      }
      const mort = gs.find((sq) => G.props[sq].mort);
      if (mort != null && P.cash - unmortCost(mort) >= 250) return { t: 'unmortgage', by: i, sq: mort };
    }
    if (P.cash > 700) {
      const m = ownedBy(G, pk(i)).filter((k) => G.props[k].mort).sort((a, b) => unmortCost(a) - unmortCost(b))[0];
      if (m != null && P.cash - unmortCost(m) >= 450) return { t: 'unmortgage', by: i, sq: m };
    }
    // gestor de UTE: mejorar si puede pagar
    for (const u of G.utes.filter((x) => x.active && x.gov === 'gestor' && x.gestor === i)) {
      const key = 'u' + u.id;
      for (const g of Object.keys(GROUPS).filter((x) => hasGroup(G, key, x))) {
        const sq = groupSqs(g).sort((a, b) => G.props[a].lvl - G.props[b].lvl)[0];
        if (!uteOpErr(G, u, { k: 'build', sq }) && u.members.every((m) => G.players[m.p].cash > 300 || u.caja > houseCost(sq))) return { t: 'ute_op', by: i, uid: u.id, op: { k: 'build', sq } };
      }
    }
    const tp = G.settings.contracts ? botTradeProposal(G, i) : null;
    if (tp) return tp;
    return { t: 'end_turn', by: i };
  }
  return null;
}

// Un bot propone traspasos para completar grupos: intercambio de piezas si le sirve al otro, o dinero.
function botTradeProposal(G, i) {
  if (G.proposals.some((p) => p.by === i)) return null;
  const P = G.players[i]; const asked = G.botAsk || {};
  for (const g of Object.keys(GROUPS)) {
    const gs = groupSqs(g);
    const mine = gs.filter((j) => G.props[j]?.o === pk(i));
    const miss = gs.filter((j) => G.props[j]?.o !== pk(i));
    if (!mine.length || miss.length !== 1) continue;
    const sq = miss[0]; const o = G.props[sq]?.o;
    if (!o || !isP(o)) continue;
    const x = oNum(o);
    if (G.players[x].bankrupt || transferErr(G, o, sq)) continue;
    const key = `${i}-${sq}`;
    if (asked[key] && G.round - asked[key] < 6) continue;
    // ¿tengo una pieza que le complete un grupo a él?
    const swap = Object.keys(G.props).map(Number).find((k) => G.props[k].o === pk(i) && SQ[k].t === 'team' && SQ[k].g !== g && synergy(G, x, k) >= 2 && !transferErr(G, pk(i), k));
    if (swap != null) return { t: 'propose', by: i, kind: 'trade', ask: key, data: { a: i, b: x, ga: { props: [swap], cash: 0, jf: 0 }, gb: { props: [sq], cash: 0, jf: 0 } } };
    const offer = Math.round((SQ[sq].price * 1.7) / 10) * 10;
    if (P.cash - offer >= 250) return { t: 'propose', by: i, kind: 'trade', ask: key, data: { a: i, b: x, ga: { props: [], cash: offer, jf: 0 }, gb: { props: [sq], cash: 0, jf: 0 } } };
  }
  return null;
}

export function nextAutoAction(G) {
  if (!G || G.status !== 'playing') return null;
  // 1. deudas
  const deb = G.debts.find((d) => isAuto(G, d.p));
  if (deb) return raiseFunds(G, deb.p);
  if (G.debts.length) return null;
  // 2. subasta
  if (G.auction) {
    const A = G.auction;
    const cand = alive(G).filter((j) => isAuto(G, j) && !A.out.includes(j) && A.lead !== j);
    if (cand.length) {
      const j = cand[0]; const v = auctionValue(G, j, A.sq);
      const stepV = A.bid < 100 ? 10 : 20;
      const next = A.bid + stepV;
      if (next <= v && next <= G.players[j].cash - 60) return { t: 'bid', by: j, amt: next };
      return { t: 'fold', by: j };
    }
    return null;
  }
  // 3. propuestas de contrato
  for (const pr of G.proposals) {
    const q = pr.parties.find((p) => !pr.signed.includes(p) && isAuto(G, p));
    if (q != null) return acceptProposal(G, pr, q) ? { t: 'sign', by: q, id: pr.id } : { t: 'reject', by: q, id: pr.id };
  }
  // 4. votaciones de UTE
  for (const v of G.votes) {
    const u = getUte(G, v.uid); if (!u) continue;
    const m = u.members.find((x) => isAuto(G, x.p) && !v.yes.includes(x.p) && !v.no.includes(x.p));
    if (m) {
      const yes = !uteOpErr(G, u, v.op) && v.op.k !== 'dissolve' ? true : v.op.k === 'dissolve' ? G.players[m.p].cash < 200 : false;
      return { t: 'ute_vote', by: m.p, id: v.id, yes };
    }
  }
  if (G.limit) return null;
  // 5. turno
  if (isAuto(G, G.turn)) return turnAction(G, G.turn);
  return null;
}

export const isPlayerOwner = (o) => isP(o);
export const ownerIdx = (o) => oNum(o);
