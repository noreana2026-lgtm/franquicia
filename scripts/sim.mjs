// Simulador: partidas completas solo con bots + contratos aleatorios inyectados. Comprueba invariantes en cada paso.
import { newLocalGame, reduce, why, alive, pk, contractErr, getUte } from '../src/game/engine.js';
import { nextAutoAction } from '../src/game/bot.js';
import { SQ, groupSqs, RULESETS } from '../src/game/data.js';

const N = +(process.argv[2] || 300);
let seed = +(process.argv[3] || 1);
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const ri = (n) => Math.floor(rnd() * n);
const pick = (a) => a[ri(a.length)];

const stats = { games: 0, steps: 0, ends: {}, contracts: {}, contractsOk: {}, uteOps: 0, bankrupt: 0, rounds: 0, errors: 0, auctions: 0 };

function check(G, ctx) {
  const errs = [];
  G.players.forEach((p, i) => { if (!p.bankrupt && p.cash < 0) errs.push(`cash<0 p${i} ${p.cash}`); if (!Number.isFinite(p.cash)) errs.push('cash NaN'); });
  Object.entries(G.props).forEach(([k, p]) => {
    if (p.o[0] === 'p') { const P = G.players[+p.o.slice(1)]; if (!P || P.bankrupt) errs.push(`prop ${k} de jugador en quiebra`); }
    else if (p.o[0] === 'u') { if (!getUte(G, +p.o.slice(1))) errs.push(`prop ${k} de UTE inactiva`); }
    else errs.push('owner raro');
    if (p.lvl < 0 || p.lvl > 5) errs.push('lvl fuera');
    if (p.lvl && SQ[k].t !== 'team') errs.push('lvl en no-equipo');
    if (p.lvl && groupSqs(SQ[k].g).some((j) => G.props[j]?.o !== p.o)) errs.push(`mejora sin grupo completo ${k}`);
    if (p.mort && SQ[k].t === 'team' && groupSqs(SQ[k].g).some((j) => G.props[j]?.lvl)) errs.push('hipoteca con mejoras en grupo');
  });
  G.utes.filter((u) => u.active).forEach((u) => {
    const s = u.members.reduce((a, m) => a + m.pct, 0);
    if (s !== 100) errs.push(`UTE ${u.id} pct ${s}`);
    if (u.members.length < 2) errs.push('UTE con <2 socios');
    if (u.members.some((m) => G.players[m.p].bankrupt)) errs.push('socio en quiebra');
    if (u.caja < 0) errs.push('caja<0');
  });
  if (G.debts.some((d) => G.players[d.p].bankrupt)) errs.push('deuda de quebrado');
  if (G.status === 'playing' && G.players[G.turn].bankrupt) errs.push('turno de quebrado');
  if (errs.length) { console.error('INVARIANTE', ctx, errs.slice(0, 5)); stats.errors++; return false; }
  return true;
}

function own(G, i) { return Object.keys(G.props).map(Number).filter((k) => G.props[k].o === pk(i)); }

function randomProposal(G) {
  const al = alive(G); if (al.length < 2) return null;
  const a = pick(al); let b = pick(al.filter((x) => x !== a));
  const kinds = ['trade', 'ute', 'loan', 'discount', 'cession', 'option', 'installment'];
  const kind = pick(kinds);
  const mine = own(G, a); const theirs = own(G, b);
  let data;
  switch (kind) {
    case 'trade': data = { a, b, ga: { props: mine.slice(0, ri(2)), cash: ri(3) * 50, jf: 0 }, gb: { props: theirs.slice(0, ri(2)), cash: ri(2) * 50, jf: 0 } }; break;
    case 'ute': {
      const mem = rnd() < 0.7 ? [a, b] : al.slice(0, 3);
      const props = {}; const cash = {}; const pct = {};
      mem.forEach((m) => { props[m] = own(G, m).filter((sq) => !G.props[sq].lvl).slice(0, 1 + ri(2)); cash[m] = ri(3) * 50; });
      let left = 100; mem.forEach((m, k) => { pct[m] = k === mem.length - 1 ? left : Math.max(1, Math.floor(100 / mem.length)); left -= pct[m]; });
      data = { name: 'UTE ' + ri(99), members: mem, pct, props, cash, gov: pick(['gestor', 'mayoria', 'unanimidad']), gestor: mem[0], pay: pick(['directo', 'caja']), rounds: pick([0, 5, 10]), exitFee: pick([0, 50, 100]) };
      break;
    }
    case 'loan': data = { lender: a, borrower: b, amount: 100 + ri(3) * 50, repay: 200 + ri(3) * 50, rounds: 2 + ri(6), collateral: theirs.length && rnd() < 0.5 ? theirs[0] : null }; break;
    case 'discount': data = { owner: a, tenant: b, pct: pick([50, 100]), sqs: rnd() < 0.5 ? 'all' : mine.slice(0, 2), rounds: 3 + ri(5), price: ri(4) * 25 }; break;
    case 'cession': data = { owner: a, benef: b, sq: mine[0], pct: pick([20, 40]), rounds: pick([0, 6]), price: ri(4) * 25 }; break;
    case 'option': data = { owner: a, holder: b, sq: mine[0], premium: ri(4) * 20, strike: 200 + ri(5) * 50, rounds: 3 + ri(6) }; break;
    case 'installment': data = { seller: a, buyer: b, sq: mine[0], down: ri(3) * 20, per: 30 + ri(4) * 10, n: 2 + ri(5) }; break;
    default:
  }
  if (data && (kind === 'cession' || kind === 'option' || kind === 'installment') && data.sq == null) return null;
  return { t: 'propose', by: a, kind, data };
}

function humanish(G) {
  // acciones extra que haría un humano: contratos, ejecutar opciones, devolver préstamos, operar UTEs
  const r = rnd();
  if (r < 0.04) { const p = randomProposal(G); if (p) { stats.contracts[p.kind] = (stats.contracts[p.kind] || 0) + 1; return p; } }
  if (r < 0.05) { const c = G.contracts.find((x) => x.k === 'option'); if (c) return { t: 'option_exercise', by: c.holder, id: c.id }; }
  if (r < 0.06) { const c = G.contracts.find((x) => x.k === 'loan'); if (c) return { t: 'loan_repay', by: c.borrower, id: c.id }; }
  if (r < 0.08) {
    const u = G.utes.find((x) => x.active); if (u) {
      const m = pick(u.members).p; const key = 'u' + u.id; const props = Object.keys(G.props).map(Number).filter((k) => G.props[k].o === key);
      const k = pick(['build', 'build', 'sell', 'mortgage', 'unmortgage', 'dividend', 'deposit', 'leave', 'dissolve']);
      stats.uteOps++;
      if (k === 'deposit') return { t: 'ute_deposit', by: m, uid: u.id, amt: 50 };
      if (k === 'leave') return { t: 'ute_leave', by: m, uid: u.id };
      if (k === 'dividend') return { t: 'ute_op', by: m, uid: u.id, op: { k, amt: Math.max(1, u.caja) } };
      if (k === 'dissolve') return { t: 'ute_op', by: m, uid: u.id, op: { k } };
      if (props.length) return { t: 'ute_op', by: m, uid: u.id, op: { k, sq: pick(props) } };
    }
  }
  if (r < 0.09) { const v = G.votes[0]; if (v) { const u = getUte(G, v.uid); const m = u?.members.find((x) => !v.yes.includes(x.p) && !v.no.includes(x.p)); if (m) return { t: 'ute_vote', by: m.p, id: v.id, yes: rnd() < 0.7 }; } }
  return null;
}

for (let g = 0; g < N; g++) {
  const n = 2 + ri(5);
  const ruleset = pick(['clasicas', 'caseras', 'personal']);
  const rules = {}; Object.keys(RULESETS.clasicas).forEach((k) => { rules[k] = rnd() < 0.5; });
  const settings = { mode: pick(['rapida', 'estandar']), contracts: true, build: pick(['infra', 'plantilla']), ruleset, rules, maxRounds: pick([0, 30, 60]) };
  if (!settings.maxRounds && settings.mode === 'estandar') settings.maxRounds = 120;
  let G = newLocalGame(settings, Array.from({ length: n }, (_, i) => ({ name: 'B' + i, bot: true })));
  let steps = 0; let extended = 0; let lastSig = ''; let same = 0;
  while (G.status === 'playing' && steps < 40000) {
    steps++;
    let a = null;
    if (G.limit) { a = extended < 1 && rnd() < 0.5 ? { t: 'extend', by: 0, n: 5 } : { t: 'finish', by: 0 }; if (a.t === 'extend') extended++; }
    if (!a) a = humanish(G);
    let byBot = false;
    if (!a) { a = nextAutoAction(G); byBot = true; }
    if (!a) { console.error('ATASCO', { phase: G.phase, turn: G.turn, debts: G.debts.length, auction: G.auction, limit: G.limit }); stats.errors++; break; }
    const N2 = reduce(G, a);
    if (!N2) {
      if (byBot) { console.error('BOT ACCIÓN INVÁLIDA', a, why(G, a), G.phase); stats.errors++; break; }
      continue;
    }
    if (a.t === 'sign' && !N2.proposals.find((p) => p.id === a.id)) stats.contractsOk[G.proposals.find((p) => p.id === a.id).kind] = (stats.contractsOk[G.proposals.find((p) => p.id === a.id).kind] || 0) + 1;
    if (a.t === 'decline' && N2.auction) stats.auctions++;
    G = N2;
    JSON.stringify(G);
    if (!check(G, { g, steps, a })) break;
    const sig = `${G.turn}|${G.phase}|${G.round}|${G.players.map((p) => p.cash).join(',')}`;
    if (sig === lastSig) { same++; if (same > 400) { console.error('BUCLE', a, G.phase); stats.errors++; break; } } else { same = 0; lastSig = sig; }
  }
  if (G.status === 'playing') { console.error('NO TERMINA', { g, steps, round: G.round, phase: G.phase }); stats.errors++; }
  stats.games++; stats.steps += steps; stats.rounds += G.round;
  stats.ends[G.endReason] = (stats.ends[G.endReason] || 0) + 1;
  stats.bankrupt += G.players.filter((p) => p.bankrupt).length;
}
console.log(JSON.stringify({ ...stats, avgRounds: (stats.rounds / stats.games).toFixed(1), avgSteps: Math.round(stats.steps / stats.games) }, null, 1));
void contractErr;
