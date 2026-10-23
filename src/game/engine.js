// Motor de Franquicia: reductor puro (estado + acción → estado nuevo). Lo usan igual la partida local, la online y los bots.
import { SQ, GROUPS, groupSqs, OWNABLE, TEAMS, RULESETS, PCOLS, BOT_NAMES, sqOf, cardOf, boardOf, SCORE, NBA_TEAMS } from './data.js';

let RNG = Math.random;
export const setRng = (f) => { RNG = f; };
const rint = (n) => Math.floor(RNG() * n);
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = rint(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const clone = (x) => JSON.parse(JSON.stringify(x));
const int = (v, d = 0) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : d; };

export const V = (G) => boardOf(G.settings);
export const pk = (i) => 'p' + i;
export const isP = (o) => typeof o === 'string' && o[0] === 'p';
export const isU = (o) => typeof o === 'string' && o[0] === 'u';
export const oNum = (o) => +String(o).slice(1);
export const money = (v) => `$${Math.round(v).toLocaleString('es-ES')}M`;

export const DEFAULT_SETTINGS = {
  board: 'liga', mode: 'estandar', contracts: true, build: 'infra', ruleset: 'caseras', rules: { ...RULESETS.caseras },
  maxRounds: 0, startCash: 1500, salary: 200, deal: 3,
};

export function cleanSettings(s = {}) {
  const o = { ...DEFAULT_SETTINGS, ...(s || {}) };
  o.board = o.board === 'franquicia' ? 'franquicia' : 'liga';
  o.mode = o.mode === 'rapida' ? 'rapida' : 'estandar';
  o.contracts = o.contracts !== false;
  o.build = o.build === 'plantilla' ? 'plantilla' : 'infra';
  o.ruleset = ['clasicas', 'caseras', 'personal'].includes(o.ruleset) ? o.ruleset : 'caseras';
  const base = RULESETS[o.ruleset] || RULESETS.caseras;
  o.rules = { ...base, ...(o.ruleset === 'personal' ? (s.rules || {}) : {}) };
  Object.keys(RULESETS.clasicas).forEach((k) => { o.rules[k] = !!o.rules[k]; });
  o.maxRounds = Math.max(0, Math.min(200, int(o.maxRounds)));
  if (o.mode === 'rapida' && !o.maxRounds) o.maxRounds = 20;
  o.startCash = Math.max(500, Math.min(5000, int(o.startCash, 1500)));
  o.salary = Math.max(50, Math.min(500, int(o.salary, 200)));
  o.deal = Math.max(0, Math.min(4, int(o.deal, 3)));
  return o;
}

// ---------- utilidades de lectura ----------
export const alive = (G) => G.players.map((_, i) => i).filter((i) => !G.players[i].bankrupt);
export const getUte = (G, id) => G.utes.find((u) => u.id === id && u.active);
export const ownerOf = (G, sq) => G.props[sq]?.o || null;
export const entName = (G, o) => (isP(o) ? G.players[oNum(o)]?.name : isU(o) ? (getUte(G, oNum(o))?.name || 'UTE') : o === 'pot' ? 'el bote' : 'la liga');
export const houseCost = (sq) => GROUPS[SQ[sq].g]?.house || 0;
export const mortValue = (sq) => Math.round(SQ[sq].price / 2);
export const unmortCost = (sq) => Math.round((SQ[sq].price / 2) * 1.1);
export const hasGroup = (G, o, g) => groupSqs(g).every((j) => G.props[j]?.o === o);
export const isHost = (G, by) => !!G.local || (G.players[by] && G.players[by].id === G.host);
const bankTo = (G) => (G.settings.rules.pot ? 'pot' : 'bank');

export function stock(G) {
  let h = 0; let a = 0;
  Object.values(G.props).forEach((p) => { if (p.lvl === 5) a++; else h += p.lvl; });
  return { h, a };
}

export function rentOf(G, sq, diceSum = 7) {
  const s = sqOf(G, sq); const p = G.props[sq];
  if (!p || p.mort) return 0;
  if (s.t === 'team') return p.lvl > 0 ? s.rent[p.lvl] : (hasGroup(G, p.o, s.g) ? s.rent[0] * 2 : s.rent[0]);
  const same = SQ.filter((x) => x.t === s.t && G.props[x.i]?.o === p.o).length;
  if (s.t === 'tv') return 25 * 2 ** (same - 1);
  if (s.t === 'util') return diceSum * (same === 2 ? 10 : 4);
  return 0;
}

export function propValue(G, sq) {
  const p = G.props[sq]; if (!p) return 0;
  const s = sqOf(G, sq);
  return (p.mort ? s.price / 2 : s.price) + (p.lvl ? p.lvl * houseCost(sq) : 0);
}

export function netWorth(G, i) {
  const P = G.players[i]; if (!P) return 0;
  let v = P.cash;
  Object.keys(G.props).forEach((k) => { if (G.props[k].o === pk(i)) v += propValue(G, +k); });
  G.utes.filter((u) => u.active).forEach((u) => {
    const m = u.members.find((x) => x.p === i); if (!m) return;
    let uv = u.caja;
    Object.keys(G.props).forEach((k) => { if (G.props[k].o === 'u' + u.id) uv += propValue(G, +k); });
    v += (uv * m.pct) / 100;
  });
  // deudas y préstamos pendientes
  G.contracts.forEach((c) => {
    if (c.k === 'loan') { if (c.lender === i) v += c.repay; if (c.borrower === i) v -= c.repay; }
    if (c.k === 'installment') { if (c.seller === i) v += c.per * c.left; if (c.buyer === i) v -= c.per * c.left; }
  });
  G.debts.forEach((d) => { if (d.p === i) v -= d.amt; });
  return Math.round(v);
}

// Valoración final: en el tablero liga es el patrimonio; en el tablero franquicia suma palmarés (grupos completos y anillos).
export function bonusOf(G, i) {
  if (G.settings?.board !== 'franquicia') return { groups: 0, rings: 0, v: 0 };
  let groups = 0; let rings = 0;
  const gs = [...new Set(TEAMS.map((sq) => SQ[sq].g))];
  gs.forEach((g) => { if (groupSqs(g).every((j) => G.props[j]?.o === pk(i))) groups++; });
  Object.values(G.props).forEach((p) => { if (p.o === pk(i) && p.lvl === 5) rings++; });
  return { groups, rings, v: groups * SCORE.group + rings * SCORE.ring };
}
export const scoreOf = (G, i) => netWorth(G, i) + bonusOf(G, i).v;

export function rank(G) {
  const rows = G.players.map((p, i) => ({ i, p, w: scoreOf(G, i) }));
  const outPos = (i) => (G.outOrder || []).indexOf(i);
  rows.sort((a, b) => (a.p.bankrupt - b.p.bankrupt) || (a.p.bankrupt ? outPos(b.i) - outPos(a.i) : b.w - a.w));
  return rows;
}

export function lockOf(G, sq) {
  return G.contracts.find((c) => (c.k === 'loan' && c.collateral === sq) || ((c.k === 'option' || c.k === 'installment') && c.sq === sq)) || null;
}

// ¿Puede la entidad `o` entregar la franquicia `sq` (traspaso, aporte a UTE, aval…)?
export function transferErr(G, o, sq, ignoreLock = null) {
  const p = G.props[sq];
  if (!p || p.o !== o) return `${sqOf(G, sq)?.n || 'Esa franquicia'} no es de ${entName(G, o)}`;
  const s = sqOf(G, sq);
  if (s.t === 'team' && groupSqs(s.g).some((j) => G.props[j]?.lvl > 0)) return `${s.n}: su grupo tiene mejoras; véndelas antes`;
  const l = lockOf(G, sq);
  if (l && l !== ignoreLock) return `${s.n} está bloqueada por un contrato`;
  return null;
}

// ---------- dinero ----------
export function splitPct(amt, members) {
  const tot = members.reduce((a, m) => a + m.pct, 0);
  if (!tot || amt <= 0) return members.map((m) => ({ p: m.p, v: 0 }));
  const raw = members.map((m) => ({ p: m.p, x: (amt * m.pct) / tot }));
  const out = raw.map((r) => ({ p: r.p, v: Math.floor(r.x), f: r.x - Math.floor(r.x) }));
  let rest = amt - out.reduce((a, r) => a + r.v, 0);
  [...out].sort((a, b) => b.f - a.f).forEach((r) => { if (rest > 0) { r.v++; rest--; } });
  return out.map(({ p, v }) => ({ p, v }));
}

function uteIncome(G, u, amt, ex = null) {
  if (amt <= 0) return;
  if (u.pay === 'caja') { u.caja += amt; return; }
  const ms = u.members.filter((m) => m.p !== ex);
  if (!ms.length) { u.caja += amt; return; }
  splitPct(amt, ms).forEach(({ p, v }) => { G.players[p].cash += v; });
}

function credit(G, to, amt, ex) {
  if (amt <= 0) return;
  if (to === 'pot') G.pot += amt;
  else if (isP(to)) { const P = G.players[oNum(to)]; if (P && !P.bankrupt) P.cash += amt; }
  else if (isU(to)) { const u = getUte(G, oNum(to)); if (u) uteIncome(G, u, amt, ex); }
}

// Cobra a `i` varias partidas. Si no llega, todo queda como deuda pendiente.
function charge(G, i, parts, why) {
  const ps = parts.filter((x) => x.amt > 0);
  const tot = ps.reduce((a, x) => a + x.amt, 0);
  if (!tot) return true;
  const P = G.players[i];
  if (P.cash >= tot) { P.cash -= tot; ps.forEach((x) => credit(G, x.to, x.amt, x.ex)); return true; }
  ps.forEach((x) => G.debts.push({ id: G.nextId++, p: i, to: x.to, amt: x.amt, ex: x.ex ?? null, why }));
  log(G, `${P.name} no tiene liquidez para pagar ${money(tot)} (${why}). Debe conseguir el dinero o declararse en quiebra.`);
  return false;
}

// Gasto de una UTE: primero caja, el resto por % de los socios. Devuelve error o null.
function uteSpendErr(G, u, cost) {
  if (u.caja >= cost) return null;
  const sh = splitPct(cost - u.caja, u.members);
  const poor = sh.find(({ p, v }) => G.players[p].cash < v);
  return poor ? `${G.players[poor.p].name} no tiene ${money(poor.v)} para su parte` : null;
}
function uteSpend(G, u, cost) {
  if (u.caja >= cost) { u.caja -= cost; return; }
  const need = cost - u.caja; u.caja = 0;
  splitPct(need, u.members).forEach(({ p, v }) => { G.players[p].cash -= v; });
}
function gain(G, o, amt) { if (isP(o)) G.players[oNum(o)].cash += amt; else if (isU(o)) { const u = getUte(G, oNum(o)); if (u) uteIncome(G, u, amt); } }

function log(G, t) { G.log.push({ r: G.round || 0, t }); if (G.log.length > 90) G.log.splice(0, G.log.length - 90); }

// ---------- creación ----------
function mkPlayer(p, i) { return { id: p.id, name: p.name, bot: !!p.bot, col: PCOLS[i % PCOLS.length], away: false, team: p.team || null }; }

export function makeLobby(settings, host) {
  return { v: 1, seq: 0, status: 'lobby', host: host.id, settings: cleanSettings(settings), players: [mkPlayer(host, 0)], log: [] };
}

export function newLocalGame(settings, list) {
  const G = makeLobby(settings, { id: 'l0', name: list[0].name, bot: list[0].bot, team: list[0].team });
  list.slice(1).forEach((p, i) => G.players.push(mkPlayer({ id: 'l' + (i + 1), name: p.name, bot: p.bot, team: p.team }, i + 1)));
  G.local = true;
  startGame(G);
  return G;
}

function startGame(G) {
  const S = G.settings = cleanSettings(G.settings);
  const order = shuffle(G.players.map((p) => ({ id: p.id, name: p.name, bot: p.bot, team: p.team || null })));
  if (S.board === 'franquicia') {
    const used = new Set(order.map((p) => p.team).filter(Boolean));
    const seen = new Set();
    order.forEach((p) => {
      if (!p.team || seen.has(p.team)) { p.team = shuffle(NBA_TEAMS.map((t) => t[0]).filter((c) => !used.has(c)))[0]; used.add(p.team); }
      seen.add(p.team);
    });
  }
  G.players = order.map((p, i) => ({ ...mkPlayer(p, i), cash: S.startCash, pos: 0, inJail: false, jailTries: 0, jailFree: [], bankrupt: false }));
  Object.assign(G, {
    status: 'playing', props: {}, utes: [], contracts: [], proposals: [], votes: [], debts: [], pot: 0,
    round: 1, turn: 0, phase: 'roll', dice: null, doubles: 0, again: false, rollSeq: 0,
    decks: { td: shuffle([...Array(16).keys()]), fo: shuffle([...Array(16).keys()]) }, card: null,
    auction: null, pending: null, limit: false, nextId: 1, log: [], outOrder: [], endReason: null, maxRounds: S.maxRounds,
  });
  if (S.mode === 'rapida' && S.deal) {
    const pool = shuffle(TEAMS);
    G.players.forEach((_, i) => { for (let k = 0; k < S.deal; k++) { const sq = pool.pop(); G.props[sq] = { o: pk(i), lvl: 0, mort: false }; } });
    log(G, `Reparto inicial: ${S.deal} ${V(G).ownWordPl} al azar para cada uno.`);
  }
  log(G, `Empieza la partida. Abre ${G.players[0].name}.`);
  return true;
}

// ---------- movimiento ----------
function passGo(G, i, exact) {
  const P = G.players[i]; const S = G.settings;
  const v = S.salary * (exact && S.rules.doubleGo ? 2 : 1);
  P.cash += v;
  log(G, `${P.name} pasa por ${sqOf(G, 0).n}: cobra ${money(v)}${exact && S.rules.doubleGo ? ' (doble por caer justo)' : ''}.`);
}
function advance(G, i, steps) {
  const P = G.players[i]; const np = P.pos + steps;
  if (np >= 40) passGo(G, i, np % 40 === 0);
  P.pos = np % 40; land(G, i);
}
function moveTo(G, i, to, mod) {
  const P = G.players[i];
  if (to <= P.pos) passGo(G, i, to === 0);
  P.pos = to; land(G, i, mod);
}
function toJail(G, i) {
  const P = G.players[i];
  P.pos = 10; P.inJail = true; P.jailTries = 0;
  if (G.turn === i) { G.again = false; G.doubles = 0; }
  log(G, `${P.name} va a la ${V(G).jail}.`);
}

function land(G, i, mod) {
  const P = G.players[i]; const s = sqOf(G, P.pos);
  switch (s.t) {
    case 'team': case 'tv': case 'util': {
      if (!G.props[s.i]) { G.phase = 'buy'; G.pending = { sq: s.i }; return; }
      payRent(G, i, s.i, mod); return;
    }
    case 'tax': {
      const ok = charge(G, i, [{ to: bankTo(G), amt: s.v }], s.n);
      if (ok) log(G, `${P.name} paga ${money(s.v)} de ${s.n}${G.settings.rules.pot ? ' (al bote)' : ''}.`);
      return;
    }
    case 'td': case 'fo': drawCard(G, i, s.t); return;
    case 'gojail': log(G, `${P.name}: ¡expulsado por doble técnica!`); toJail(G, i); return;
    case 'pot': {
      if (G.settings.rules.pot && G.pot > 0) { log(G, `${P.name} se lleva el bote del All-Star: ${money(G.pot)}.`); P.cash += G.pot; G.pot = 0; }
      return;
    }
    default:
  }
}

function payRent(G, i, sq, mod) {
  const P = G.players[i]; const pr = G.props[sq]; const s = sqOf(G, sq);
  const o = pr.o;
  if (o === pk(i)) return;
  if (pr.mort) { log(G, `${s.n} está hipotecada: ${P.name} no paga.`); return; }
  let base;
  if (mod === 'util10') { const d = [1 + rint(6), 1 + rint(6)]; G.cardDice = d; base = (d[0] + d[1]) * 10; }
  else base = rentOf(G, sq, G.dice ? G.dice[0] + G.dice[1] : 7) * (mod === 'tv2' ? 2 : 1);
  let parts;
  if (isP(o)) {
    const ow = oNum(o);
    if (G.players[ow].inJail && !G.settings.rules.jailRent) { log(G, `${G.players[ow].name} está ${V(G).jailed} y no cobra ${s.n}.`); return; }
    const disc = G.contracts.filter((c) => c.k === 'discount' && c.owner === ow && c.tenant === i && (c.sqs === 'all' || c.sqs.includes(sq)));
    const pct = disc.reduce((a, c) => Math.max(a, c.pct), 0);
    if (pct) base = Math.round((base * (100 - pct)) / 100);
    if (!base) { log(G, `${P.name} cae en ${s.n} con pase VIP: no paga.`); return; }
    parts = []; let rest = base;
    G.contracts.filter((c) => c.k === 'cession' && c.sq === sq && c.owner === ow).forEach((c) => {
      const v = Math.round((base * c.pct) / 100); rest -= v;
      if (c.benef !== i) parts.push({ to: pk(c.benef), amt: v });
    });
    parts.push({ to: o, amt: rest });
    const paid = parts.reduce((a, x) => a + x.amt, 0);
    if (charge(G, i, parts, `alquiler de ${s.n}`)) log(G, `${P.name} paga ${money(paid)} a ${G.players[ow].name} por ${s.n}${pct ? ` (pase VIP −${pct}%)` : ''}.`);
  } else {
    const u = getUte(G, oNum(o)); if (!u) return;
    const m = u.members.find((x) => x.p === i);
    const amt = m ? Math.round((base * (100 - m.pct)) / 100) : base;
    parts = [{ to: o, amt, ex: m ? i : null }];
    if (charge(G, i, parts, `alquiler de ${s.n}`)) log(G, `${P.name} paga ${money(amt)} a la UTE ${u.name} por ${s.n}${m ? ' (descontada su parte)' : ''}.`);
  }
}

function drawCard(G, i, deck) {
  const P = G.players[i];
  const id = G.decks[deck].shift(); const c = cardOf(G.settings, deck, id);
  if (c.fx.k !== 'jailfree') G.decks[deck].push(id);
  G.card = { deck, id, p: i, seq: (G.card?.seq || 0) + 1 };
  log(G, `${P.name} roba ${deck === 'td' ? 'Trade Deadline' : 'Front Office'}: «${c.n}».`);
  const fx = c.fx;
  switch (fx.k) {
    case 'goto': moveTo(G, i, fx.to); return;
    case 'cash': if (fx.v > 0) P.cash += fx.v; else charge(G, i, [{ to: bankTo(G), amt: -fx.v }], c.n); return;
    case 'jailfree': P.jailFree.push(`${deck}:${id}`); return;
    case 'back': P.pos = (P.pos - fx.v + 40) % 40; land(G, i); return;
    case 'jail': toJail(G, i); return;
    case 'repairs': {
      let h = 0; let a = 0;
      Object.values(G.props).forEach((p) => { if (p.o === pk(i)) { if (p.lvl === 5) a++; else h += p.lvl; } });
      const v = h * fx.h + a * fx.a;
      if (v) charge(G, i, [{ to: bankTo(G), amt: v }], c.n);
      return;
    }
    case 'each': {
      const others = alive(G).filter((j) => j !== i);
      if (fx.v < 0) charge(G, i, others.map((j) => ({ to: pk(j), amt: -fx.v })), c.n);
      else others.forEach((j) => charge(G, j, [{ to: pk(i), amt: fx.v }], c.n));
      return;
    }
    case 'nearest': {
      let to = P.pos; do { to = (to + 1) % 40; } while (sqOf(G, to).t !== fx.t);
      moveTo(G, i, to, fx.t === 'tv' ? 'tv2' : 'util10');
      return;
    }
    default:
  }
}

// ---------- turnos y rondas ----------
function nextTurn(G) {
  const al = alive(G);
  if (al.length <= 1) { finish(G, 'last'); return; }
  let n = G.turn;
  do { n = (n + 1) % G.players.length; } while (G.players[n].bankrupt);
  G.phase = 'roll'; G.doubles = 0; G.again = false; G.pending = null; G.card = null; G.cardDice = null;
  if (n <= G.turn) { G.turn = n; newRound(G); } else G.turn = n;
}

function newRound(G) {
  G.round++;
  log(G, `— Ronda ${G.round} —`);
  const keep = [];
  G.contracts.forEach((c) => {
    if (c.k === 'loan') {
      if (G.round < c.due) { keep.push(c); return; }
      const B = G.players[c.borrower]; const L = G.players[c.lender];
      if (B.bankrupt || L.bankrupt) return;
      if (B.cash >= c.repay) { B.cash -= c.repay; L.cash += c.repay; log(G, `${B.name} devuelve el préstamo a ${L.name}: ${money(c.repay)}.`); return; }
      if (c.collateral != null && G.props[c.collateral]?.o === pk(c.borrower)) {
        liquidateGroup(G, c.collateral);
        G.props[c.collateral].o = pk(c.lender);
        log(G, `${B.name} no puede devolver el préstamo: el aval (${sqOf(G, c.collateral).n}) pasa a ${L.name}.`);
        return;
      }
      log(G, `Vence el préstamo de ${L.name} a ${B.name} y no hay liquidez: queda como deuda.`);
      G.debts.push({ id: G.nextId++, p: c.borrower, to: pk(c.lender), amt: c.repay, ex: null, why: 'préstamo vencido' });
      return;
    }
    if (c.k === 'installment') {
      const B = G.players[c.buyer]; const Se = G.players[c.seller];
      if (B.bankrupt || Se.bankrupt || G.props[c.sq]?.o !== pk(c.buyer)) return;
      if (B.cash >= c.per) {
        B.cash -= c.per; Se.cash += c.per; c.left--;
        log(G, `${B.name} paga la cuota de ${sqOf(G, c.sq).n} a ${Se.name} (${money(c.per)}; ${c.left ? `quedan ${c.left}` : 'última'}).`);
        if (c.left > 0) keep.push(c);
        return;
      }
      liquidateGroup(G, c.sq);
      G.props[c.sq].o = pk(c.seller);
      log(G, `${B.name} no paga la cuota: ${sqOf(G, c.sq).n} vuelve a ${Se.name}.`);
      return;
    }
    if (c.end && G.round > c.end) { log(G, `Caduca un contrato: ${contractTitle(G, c)}.`); return; }
    keep.push(c);
  });
  G.contracts = keep;
  G.utes.filter((u) => u.active && u.end && G.round > u.end).forEach((u) => { log(G, `La UTE ${u.name} llega a su fin.`); dissolve(G, u); });
  if (G.maxRounds && G.round > G.maxRounds) { G.limit = true; log(G, `Se ha llegado al límite de ${G.maxRounds} rondas.`); }
}

export function contractTitle(G, c) {
  const n = (i) => G.players[i]?.name;
  switch (c.k) {
    case 'loan': return `Préstamo de ${n(c.lender)} a ${n(c.borrower)}`;
    case 'discount': return `Pase VIP de ${n(c.owner)} a ${n(c.tenant)}`;
    case 'cession': return `Cesión de ${sqOf(G, c.sq).n} a ${n(c.benef)}`;
    case 'option': return `Opción de ${n(c.holder)} sobre ${sqOf(G, c.sq).n}`;
    case 'installment': return `Plazos de ${sqOf(G, c.sq).n} (${n(c.buyer)})`;
    default: return 'Contrato';
  }
}

function liquidateGroup(G, sq) {
  const s = sqOf(G, sq); if (s.t !== 'team') return;
  groupSqs(s.g).forEach((j) => { const p = G.props[j]; if (p && p.lvl > 0) { gain(G, p.o, Math.round((p.lvl * houseCost(j)) / 2)); p.lvl = 0; } });
}

function finish(G, reason) {
  G.status = 'ended'; G.endReason = reason; G.phase = null; G.auction = null;
  const r = rank(G);
  log(G, `Fin de la partida. Gana ${r[0].p.name} con un patrimonio de ${money(r[0].w)}.`);
}

// ---------- UTE ----------
function normalizePct(members) {
  const sh = splitPct(100, members);
  return members.map((m) => ({ p: m.p, pct: sh.find((x) => x.p === m.p).v })).filter((m) => m.pct > 0);
}

function dissolve(G, u) {
  const key = 'u' + u.id;
  Object.keys(G.props).forEach((k) => {
    const p = G.props[k]; if (p.o !== key) return;
    if (p.lvl) { u.caja += Math.round((p.lvl * houseCost(+k)) / 2); p.lvl = 0; }
  });
  const big = [...u.members].sort((a, b) => b.pct - a.pct)[0];
  Object.keys(G.props).forEach((k) => {
    const p = G.props[k]; if (p.o !== key) return;
    const orig = u.origin[k];
    const to = orig != null && !G.players[orig].bankrupt ? orig : big?.p;
    if (to == null) delete G.props[k]; else p.o = pk(to);
  });
  if (u.caja > 0 && u.members.length) splitPct(u.caja, u.members).forEach(({ p, v }) => { G.players[p].cash += v; });
  u.caja = 0; u.active = false;
  G.votes = G.votes.filter((v) => v.uid !== u.id);
  log(G, `UTE ${u.name} disuelta: cada casilla vuelve a quien la aportó y la caja se reparte.`);
}

export function uteOpErr(G, u, op) {
  const key = 'u' + u.id;
  switch (op.k) {
    case 'build': { const e = buildErr(G, key, op.sq); if (e) return e; return uteSpendErr(G, u, houseCost(op.sq)); }
    case 'sell': return sellErr(G, key, op.sq);
    case 'mortgage': return mortErr(G, key, op.sq);
    case 'unmortgage': { const p = G.props[op.sq]; if (!p || p.o !== key || !p.mort) return 'No está hipotecada'; return uteSpendErr(G, u, unmortCost(op.sq)); }
    case 'dividend': { const a = int(op.amt); if (a <= 0) return 'Importe no válido'; if (a > u.caja) return 'No hay tanto en la caja'; return null; }
    case 'dissolve': return null;
    default: return 'Operación desconocida';
  }
}

function uteOpRun(G, u, op) {
  const key = 'u' + u.id;
  switch (op.k) {
    case 'build': uteSpend(G, u, houseCost(op.sq)); G.props[op.sq].lvl++; log(G, `UTE ${u.name} mejora ${sqOf(G, op.sq).n} (nivel ${G.props[op.sq].lvl}).`); break;
    case 'sell': G.props[op.sq].lvl--; uteIncome(G, u, Math.round(houseCost(op.sq) / 2)); log(G, `UTE ${u.name} vende una mejora de ${sqOf(G, op.sq).n}.`); break;
    case 'mortgage': G.props[op.sq].mort = true; uteIncome(G, u, mortValue(op.sq)); log(G, `UTE ${u.name} hipoteca ${sqOf(G, op.sq).n}.`); break;
    case 'unmortgage': uteSpend(G, u, unmortCost(op.sq)); G.props[op.sq].mort = false; log(G, `UTE ${u.name} levanta la hipoteca de ${sqOf(G, op.sq).n}.`); break;
    case 'dividend': { const a = int(op.amt); u.caja -= a; splitPct(a, u.members).forEach(({ p, v }) => { G.players[p].cash += v; }); log(G, `UTE ${u.name} reparte ${money(a)} en dividendos.`); break; }
    case 'dissolve': dissolve(G, u); break;
    default:
  }
  void key;
}

export const OP_TXT = { build: 'Mejorar', sell: 'Vender mejora', mortgage: 'Hipotecar', unmortgage: 'Levantar hipoteca', dividend: 'Repartir dividendos', dissolve: 'Disolver la UTE' };

function evalVote(G, v) {
  const u = getUte(G, v.uid);
  if (!u) { G.votes = G.votes.filter((x) => x !== v); return; }
  const pctOf = (arr) => u.members.filter((m) => arr.includes(m.p)).reduce((a, m) => a + m.pct, 0);
  let pass = false; let fail = false;
  if (u.gov === 'unanimidad') { pass = u.members.every((m) => v.yes.includes(m.p)); fail = u.members.some((m) => v.no.includes(m.p)); }
  else { pass = pctOf(v.yes) > 50; fail = pctOf(v.no) >= 50; }
  if (!pass && !fail) return;
  G.votes = G.votes.filter((x) => x.id !== v.id);
  if (fail) { log(G, `UTE ${u.name}: rechazada la propuesta «${OP_TXT[v.op.k]}${v.op.sq != null ? ' ' + sqOf(G, v.op.sq).n : ''}».`); return; }
  const e = uteOpErr(G, u, v.op);
  if (e) { log(G, `UTE ${u.name}: aprobada pero no se puede ejecutar (${e}).`); return; }
  uteOpRun(G, u, v.op);
}

// ---------- construcción e hipotecas ----------
export function buildErr(G, o, sq) {
  const s = sqOf(G, sq); if (!s || s.t !== 'team') return 'Solo se mejoran franquicias';
  const pr = G.props[sq]; if (!pr || pr.o !== o) return 'No es tuya';
  const gs = groupSqs(s.g);
  if (!gs.every((j) => G.props[j]?.o === o)) return 'Necesitas el grupo completo';
  if (gs.some((j) => G.props[j].mort)) return 'Hay franquicias hipotecadas en el grupo';
  if (pr.lvl >= 5) return 'Ya está al máximo';
  if (G.settings.rules.evenBuild && pr.lvl > Math.min(...gs.map((j) => G.props[j].lvl))) return 'Construcción pareja: mejora antes las otras del grupo';
  if (G.settings.rules.bankLimit) {
    const st = stock(G);
    if (pr.lvl < 4 && st.h >= 32) return 'La liga no tiene más mejoras disponibles';
    if (pr.lvl === 4 && st.a >= 12) return 'La liga no tiene más niveles máximos disponibles';
  }
  return null;
}
export function sellErr(G, o, sq) {
  const pr = G.props[sq]; if (!pr || pr.o !== o) return 'No es tuya';
  if (!pr.lvl) return 'No tiene mejoras';
  const gs = groupSqs(sqOf(G, sq).g);
  if (G.settings.rules.evenBuild && pr.lvl < Math.max(...gs.map((j) => G.props[j]?.lvl || 0))) return 'Construcción pareja: vende antes en las otras del grupo';
  return null;
}
export function mortErr(G, o, sq) {
  const pr = G.props[sq]; if (!pr || pr.o !== o) return 'No es tuya';
  if (pr.mort) return 'Ya está hipotecada';
  if (sqOf(G, sq).t === 'team' && groupSqs(sqOf(G, sq).g).some((j) => G.props[j]?.lvl > 0)) return 'Vende antes las mejoras del grupo';
  return null;
}

// ---------- contratos ----------
const okP = (G, i) => Number.isInteger(i) && G.players[i] && !G.players[i].bankrupt;

export function contractParties(kind, d) {
  switch (kind) {
    case 'trade': return [d.a, d.b];
    case 'ute': return d.members;
    case 'loan': return [d.lender, d.borrower];
    case 'discount': return [d.owner, d.tenant];
    case 'cession': return [d.owner, d.benef];
    case 'option': return [d.owner, d.holder];
    case 'installment': return [d.seller, d.buyer];
    default: return [];
  }
}

export function contractErr(G, kind, d) {
  if (!d || typeof d !== 'object') return 'Contrato vacío';
  const parties = contractParties(kind, d);
  if (!Array.isArray(parties) || parties.length < 2) return 'Faltan partes';
  if (new Set(parties).size !== parties.length) return 'Las partes tienen que ser distintas';
  if (!parties.every((i) => okP(G, i))) return 'Hay una parte que ya no está en juego';
  const cashOk = (i, v) => int(v) >= 0 && G.players[i].cash >= int(v);
  const ownSq = (i, sq) => G.props[sq]?.o === pk(i);
  switch (kind) {
    case 'trade': {
      for (const [who, g] of [[d.a, d.ga], [d.b, d.gb]]) {
        if (!g) return 'Faltan datos';
        for (const sq of g.props || []) { const e = transferErr(G, pk(who), sq); if (e) return e; }
        if (!cashOk(who, g.cash || 0)) return `${G.players[who].name} no tiene ese dinero`;
        if (int(g.jf) < 0 || int(g.jf) > G.players[who].jailFree.length) return `${G.players[who].name} no tiene esas cartas`;
      }
      const empty = (g) => !(g.props || []).length && !int(g.cash) && !int(g.jf);
      if (empty(d.ga) && empty(d.gb)) return 'El traspaso está vacío';
      return null;
    }
    case 'ute': {
      if (d.members.length > 6) return 'Máximo 6 socios';
      const name = String(d.name || '').trim(); if (!name || name.length > 24) return 'Ponle nombre a la UTE (máx. 24 letras)';
      const pcts = d.members.map((m) => int(d.pct?.[m]));
      if (pcts.some((x) => x < 1)) return 'Cada socio necesita al menos un 1 %';
      if (pcts.reduce((a, b) => a + b, 0) !== 100) return 'Los porcentajes tienen que sumar 100';
      let nprops = 0;
      for (const m of d.members) {
        for (const sq of d.props?.[m] || []) { nprops++; const e = transferErr(G, pk(m), sq); if (e) return e; }
        if (!cashOk(m, d.cash?.[m] || 0)) return `${G.players[m].name} no tiene ese dinero`;
      }
      if (!nprops) return 'La UTE necesita al menos una franquicia';
      if (!['gestor', 'mayoria', 'unanimidad'].includes(d.gov)) return 'Elige cómo se toman las decisiones';
      if (d.gov === 'gestor' && !d.members.includes(d.gestor)) return 'El gestor tiene que ser socio';
      if (!['directo', 'caja'].includes(d.pay)) return 'Elige cómo se reparten los ingresos';
      if (int(d.rounds) < 0 || int(d.rounds) > 100) return 'Duración no válida';
      if (int(d.exitFee) < 0) return 'Cláusula de salida no válida';
      return null;
    }
    case 'loan': {
      const a = int(d.amount); const r = int(d.repay);
      if (a < 10) return 'Importe mínimo 10';
      if (!cashOk(d.lender, a)) return `${G.players[d.lender].name} no tiene ese dinero`;
      if (r < a) return 'Hay que devolver al menos lo prestado';
      if (int(d.rounds) < 1 || int(d.rounds) > 30) return 'Plazo entre 1 y 30 rondas';
      if (d.collateral != null) { const e = transferErr(G, pk(d.borrower), d.collateral); if (e) return 'Aval: ' + e; }
      return null;
    }
    case 'discount': {
      if (int(d.pct) < 10 || int(d.pct) > 100) return 'Descuento entre 10 % y 100 %';
      if (int(d.rounds) < 1 || int(d.rounds) > 30) return 'Duración entre 1 y 30 rondas';
      if (d.sqs !== 'all') { if (!Array.isArray(d.sqs) || !d.sqs.length) return 'Elige franquicias'; if (!d.sqs.every((sq) => ownSq(d.owner, sq))) return 'Alguna franquicia no es del dueño'; }
      if (!cashOk(d.tenant, d.price || 0)) return `${G.players[d.tenant].name} no tiene ese dinero`;
      return null;
    }
    case 'cession': {
      if (!ownSq(d.owner, d.sq)) return 'La franquicia no es del cedente';
      if (int(d.pct) < 5 || int(d.pct) > 90) return 'Cesión entre 5 % y 90 %';
      const used = G.contracts.filter((c) => c.k === 'cession' && c.sq === d.sq && c.owner === d.owner).reduce((a, c) => a + c.pct, 0);
      if (used + int(d.pct) > 90) return `Ya hay ${used} % cedido en esa franquicia (máx. 90 %)`;
      if (int(d.rounds) < 0 || int(d.rounds) > 60) return 'Duración no válida';
      if (!cashOk(d.benef, d.price || 0)) return `${G.players[d.benef].name} no tiene ese dinero`;
      return null;
    }
    case 'option': {
      const e = transferErr(G, pk(d.owner), d.sq, null); if (e && !e.includes('mejoras')) return e;
      if (int(d.strike) < 1) return 'Pon un precio de ejercicio';
      if (int(d.rounds) < 1 || int(d.rounds) > 30) return 'Plazo entre 1 y 30 rondas';
      if (!cashOk(d.holder, d.premium || 0)) return `${G.players[d.holder].name} no tiene para la prima`;
      return null;
    }
    case 'installment': {
      const e = transferErr(G, pk(d.seller), d.sq); if (e) return e;
      if (int(d.per) < 1) return 'Pon el importe de la cuota';
      if (int(d.n) < 1 || int(d.n) > 20) return 'Entre 1 y 20 cuotas';
      if (!cashOk(d.buyer, d.down || 0)) return `${G.players[d.buyer].name} no tiene para la entrada`;
      return null;
    }
    default: return 'Tipo de contrato desconocido';
  }
}

function pay(G, from, to, v) { v = int(v); if (v > 0) { G.players[from].cash -= v; G.players[to].cash += v; } }

function execContract(G, kind, d) {
  const n = (i) => G.players[i].name;
  switch (kind) {
    case 'trade': {
      const move = (from, to, g) => {
        (g.props || []).forEach((sq) => { G.props[sq].o = pk(to); });
        pay(G, from, to, g.cash);
        for (let k = 0; k < int(g.jf); k++) G.players[to].jailFree.push(G.players[from].jailFree.pop());
      };
      move(d.a, d.b, d.ga); move(d.b, d.a, d.gb);
      log(G, `Traspaso firmado entre ${n(d.a)} y ${n(d.b)}.`);
      return;
    }
    case 'ute': {
      const id = G.nextId++;
      const u = { id, name: String(d.name).trim(), members: d.members.map((m) => ({ p: m, pct: int(d.pct[m]) })), gov: d.gov, gestor: d.gov === 'gestor' ? d.gestor : null, pay: d.pay, caja: 0, end: int(d.rounds) ? G.round + int(d.rounds) - 1 : 0, exitFee: int(d.exitFee), origin: {}, active: true, since: G.round };
      d.members.forEach((m) => {
        (d.props?.[m] || []).forEach((sq) => { G.props[sq].o = 'u' + id; u.origin[sq] = m; });
        const c = int(d.cash?.[m]); if (c > 0) { G.players[m].cash -= c; u.caja += c; }
      });
      G.utes.push(u);
      log(G, `Nace la UTE ${u.name}: ${u.members.map((m) => `${n(m.p)} ${m.pct}%`).join(', ')}.`);
      return;
    }
    case 'loan':
      pay(G, d.lender, d.borrower, d.amount);
      G.contracts.push({ id: G.nextId++, k: 'loan', lender: d.lender, borrower: d.borrower, amount: int(d.amount), repay: int(d.repay), due: G.round + int(d.rounds), collateral: d.collateral ?? null });
      log(G, `${n(d.lender)} presta ${money(d.amount)} a ${n(d.borrower)} (devuelve ${money(d.repay)} en la ronda ${G.round + int(d.rounds)}).`);
      return;
    case 'discount':
      pay(G, d.tenant, d.owner, d.price);
      G.contracts.push({ id: G.nextId++, k: 'discount', owner: d.owner, tenant: d.tenant, pct: int(d.pct), sqs: d.sqs, end: G.round + int(d.rounds) - 1 });
      log(G, `${n(d.owner)} da a ${n(d.tenant)} un pase VIP del ${int(d.pct)} % durante ${int(d.rounds)} rondas.`);
      return;
    case 'cession':
      pay(G, d.benef, d.owner, d.price);
      G.contracts.push({ id: G.nextId++, k: 'cession', owner: d.owner, benef: d.benef, sq: d.sq, pct: int(d.pct), end: int(d.rounds) ? G.round + int(d.rounds) - 1 : 0 });
      log(G, `${n(d.owner)} cede a ${n(d.benef)} el ${int(d.pct)} % de los ingresos de ${sqOf(G, d.sq).n}.`);
      return;
    case 'option':
      pay(G, d.holder, d.owner, d.premium);
      G.contracts.push({ id: G.nextId++, k: 'option', owner: d.owner, holder: d.holder, sq: d.sq, strike: int(d.strike), end: G.round + int(d.rounds) - 1 });
      log(G, `${n(d.holder)} compra una opción sobre ${sqOf(G, d.sq).n} a ${money(d.strike)}.`);
      return;
    case 'installment':
      pay(G, d.buyer, d.seller, d.down);
      G.props[d.sq].o = pk(d.buyer);
      G.contracts.push({ id: G.nextId++, k: 'installment', seller: d.seller, buyer: d.buyer, sq: d.sq, per: int(d.per), left: int(d.n) });
      log(G, `${n(d.buyer)} compra ${sqOf(G, d.sq).n} a plazos a ${n(d.seller)}.`);
      return;
    default:
  }
}

// ---------- quiebra ----------
function bankrupt(G, i) {
  const P = G.players[i];
  const d = G.debts.find((x) => x.p === i);
  const cred = d ? d.to : 'bank';
  Object.keys(G.props).forEach((k) => { const p = G.props[k]; if (p.o === pk(i) && p.lvl) { P.cash += Math.round((p.lvl * houseCost(+k)) / 2); p.lvl = 0; } });
  const cash = Math.max(0, P.cash); P.cash = 0;
  const ci = isP(cred) && okP(G, oNum(cred)) ? oNum(cred) : null;
  if (ci !== null) {
    const C = G.players[ci];
    C.cash += cash;
    Object.values(G.props).forEach((p) => { if (p.o === pk(i)) p.o = pk(ci); });
    C.jailFree.push(...P.jailFree);
    log(G, `${P.name} quiebra. ${C.name} se queda con todo su patrimonio.`);
  } else {
    if (cred === 'pot') G.pot += cash; else if (isU(cred)) credit(G, cred, cash);
    Object.keys(G.props).forEach((k) => { if (G.props[k].o === pk(i)) delete G.props[k]; });
    P.jailFree.forEach((s) => { const [dk, id] = s.split(':'); G.decks[dk].push(+id); });
    log(G, `${P.name} quiebra. Sus ${V(G).ownWordPl} vuelven a la liga.`);
  }
  P.jailFree = [];
  G.utes.filter((u) => u.active).forEach((u) => {
    const m = u.members.find((x) => x.p === i); if (!m) return;
    if (ci !== null) {
      const ex = u.members.find((x) => x.p === ci);
      if (ex) ex.pct += m.pct; else u.members.push({ p: ci, pct: m.pct });
      u.members = u.members.filter((x) => x.p !== i);
      if (u.gestor === i) u.gestor = ci;
    } else {
      u.members = normalizePct(u.members.filter((x) => x.p !== i));
      if (u.gestor === i) u.gestor = [...u.members].sort((a, b) => b.pct - a.pct)[0]?.p ?? null;
    }
    Object.keys(u.origin).forEach((k) => { if (u.origin[k] === i) u.origin[k] = ci; });
    if (u.members.length < 2) dissolve(G, u);
  });
  const involved = (c) => [c.lender, c.borrower, c.owner, c.tenant, c.benef, c.holder, c.seller, c.buyer].includes(i);
  G.contracts = G.contracts.filter((c) => !involved(c));
  G.proposals = G.proposals.filter((p) => !p.parties.includes(i));
  G.votes.forEach((v) => { v.yes = v.yes.filter((x) => x !== i); v.no = v.no.filter((x) => x !== i); });
  [...G.votes].forEach((v) => evalVote(G, v));
  G.debts = G.debts.filter((x) => x.p !== i && x.to !== pk(i));
  P.bankrupt = true; P.inJail = false; G.outOrder.push(i);
  if (G.auction) { if (!G.auction.out.includes(i)) G.auction.out.push(i); checkAuction(G); }
  if (alive(G).length <= 1) { finish(G, 'last'); return; }
  if (G.turn === i) { G.auction = null; nextTurn(G); }
}

// ---------- subasta ----------
function checkAuction(G) {
  const A = G.auction; if (!A) return;
  const act = alive(G).filter((j) => !A.out.includes(j));
  const s = sqOf(G, A.sq);
  if (A.lead !== null && act.every((j) => j === A.lead)) {
    const W = G.players[A.lead];
    if (W.bankrupt || W.cash < A.bid) { G.auction = null; G.phase = 'end'; return; }
    W.cash -= A.bid; G.props[A.sq] = { o: pk(A.lead), lvl: 0, mort: false };
    log(G, `${W.name} gana la subasta de ${s.n} por ${money(A.bid)}.`);
    G.auction = null; G.phase = 'end';
  } else if (A.lead === null && act.length === 0) {
    log(G, `Nadie puja por ${s.n}: sigue libre.`);
    G.auction = null; G.phase = 'end';
  }
}

// ---------- normalización de estados guardados ----------
export function normalize(G) {
  if (!G || typeof G !== 'object') return null;
  return G;
}

// ---------- reductor ----------
export function reduce(G0, a) {
  if (!G0 || !a) return null;
  const G = clone(G0);
  const r = step(G, a);
  if (r !== true) return null;
  G.seq = (G.seq || 0) + 1;
  return G;
}
export function why(G0, a) { if (!G0 || !a) return 'Sin partida'; const r = step(clone(G0), a); return r === true ? null : (r || 'No se puede'); }

function step(G, a) {
  const P = G.players;
  const by = a.by;
  const me = Number.isInteger(by) ? P[by] : null;
  switch (a.t) {
    // ----- sala -----
    case 'join': {
      if (G.status !== 'lobby') return 'La partida ya empezó';
      const ex = P.find((x) => x.id === a.player.id);
      if (ex) { if (ex.name === a.player.name) return 'nada'; ex.name = a.player.name; return true; }
      if (P.length >= 6) return 'Sala llena';
      P.push(mkPlayer(a.player, P.length)); if (P.length === 1) G.host = a.player.id;
      return true;
    }
    case 'pick_team': {
      if (G.status !== 'lobby') return 'La partida ya empezó';
      const pl = P.find((x) => x.id === a.id); if (!pl) return 'No';
      if (a.team && !NBA_TEAMS.some((t) => t[0] === a.team)) return 'No';
      if (a.team && P.some((x) => x !== pl && x.team === a.team)) return 'Esa franquicia ya la ha cogido otro';
      pl.team = a.team || null; return true;
    }
    case 'add_bot': {
      if (G.status !== 'lobby' || P.length >= 6) return 'Sala llena';
      const used = new Set(P.map((x) => x.name));
      const name = BOT_NAMES.find((b) => !used.has(b)) || `Bot ${P.length + 1}`;
      P.push(mkPlayer({ id: 'bot-' + Date.now().toString(36) + rint(1000), name, bot: true }, P.length));
      return true;
    }
    case 'kick': {
      if (G.status !== 'lobby') return 'No';
      G.players = P.filter((x) => x.id !== a.id).map((x, i) => ({ ...x, col: PCOLS[i] }));
      return true;
    }
    case 'settings': if (G.status !== 'lobby') return 'No'; G.settings = cleanSettings(a.settings); return true;
    case 'start': if (G.status !== 'lobby') return 'No'; if (P.length < 2) return 'Hacen falta al menos 2 jugadores'; return startGame(G);
    case 'rematch': if (G.status !== 'ended') return 'No'; return startGame(G);
    case 'leave': {
      if (G.status === 'lobby') {
        const id = a.id ?? me?.id; G.players = P.filter((x) => x.id !== id).map((x, i) => ({ ...x, col: PCOLS[i] }));
        if (G.host === id) { const h = G.players.find((x) => !x.bot); if (h) G.host = h.id; }
        return true;
      }
      if (!me || me.away) return 'No';
      me.away = true; log(G, `${me.name} se ausenta: el piloto automático juega por él hasta que vuelva.`);
      if (G.host === me.id) { const h = P.find((x) => !x.bot && !x.away && !x.bankrupt); if (h) G.host = h.id; }
      return true;
    }
    case 'back': {
      if (!me || !me.away) return 'No';
      me.away = false; log(G, `${me.name} vuelve a la partida.`);
      const h = P.find((x) => x.id === G.host); if (!h || h.away || h.bot) G.host = me.id;
      return true;
    }
    default:
  }
  if (G.status !== 'playing') return 'La partida no está en juego';
  if (!me) return 'Jugador no válido';
  if (me.bankrupt && !['finish'].includes(a.t)) return 'Estás en quiebra';
  const myTurn = by === G.turn;
  const blocked = G.debts.length > 0 || G.limit;

  switch (a.t) {
    case 'roll': {
      if (!myTurn || G.phase !== 'roll') return 'No es momento de tirar';
      if (blocked) return G.limit ? 'Hay que decidir si se amplía la partida' : 'Hay deudas pendientes';
      const d = [1 + rint(6), 1 + rint(6)]; const sum = d[0] + d[1]; const dbl = d[0] === d[1];
      G.dice = d; G.rollSeq++; G.card = null; G.cardDice = null; G.pending = null;
      log(G, `${me.name} saca ${d[0]} y ${d[1]}${dbl ? ' (dobles)' : ''}.`);
      G.phase = 'end';
      if (me.inJail) {
        if (dbl) { me.inJail = false; me.jailTries = 0; G.again = false; log(G, `${me.name} sale de la ${V(G).jail} con dobles.`); advance(G, by, sum); }
        else {
          me.jailTries++;
          if (me.jailTries >= 3) {
            charge(G, by, [{ to: bankTo(G), amt: 50 }], 'salida de la ' + V(G).jail);
            me.inJail = false; me.jailTries = 0; G.again = false;
            log(G, `${me.name} agota los intentos: paga 50 y sale de la ${V(G).jail}.`); advance(G, by, sum);
          } else { G.again = false; log(G, `${me.name} sigue ${V(G).jailed} (intento ${me.jailTries} de 3).`); }
        }
        return true;
      }
      if (dbl) { G.doubles++; if (G.doubles >= 3) { log(G, `${me.name}: tres dobles seguidos.`); toJail(G, by); return true; } G.again = true; } else G.again = false;
      advance(G, by, sum);
      return true;
    }
    case 'jail_pay': {
      if (!myTurn || G.phase !== 'roll' || !me.inJail) return 'No';
      if (me.cash < 50) return 'No tienes 50';
      me.cash -= 50; credit(G, bankTo(G), 50); me.inJail = false; me.jailTries = 0;
      log(G, `${me.name} paga 50 y sale de la ${V(G).jail}.`); return true;
    }
    case 'jail_card': {
      if (!myTurn || G.phase !== 'roll' || !me.inJail || !me.jailFree.length) return 'No';
      const [dk, id] = me.jailFree.pop().split(':'); G.decks[dk].push(+id);
      me.inJail = false; me.jailTries = 0; log(G, `${me.name} usa «${G.settings.board === 'franquicia' ? 'Alta médica' : 'Recurso aprobado'}» y sale de la ${V(G).jail}.`); return true;
    }
    case 'buy': {
      if (!myTurn || G.phase !== 'buy' || !G.pending) return 'No';
      const s = sqOf(G, G.pending.sq);
      if (me.cash < s.price) return 'No tienes dinero suficiente';
      me.cash -= s.price; G.props[s.i] = { o: pk(by), lvl: 0, mort: false };
      log(G, `${me.name} compra ${s.n} por ${money(s.price)}.`);
      G.pending = null; G.phase = 'end'; return true;
    }
    case 'decline': {
      if (!myTurn || G.phase !== 'buy' || !G.pending) return 'No';
      const sq = G.pending.sq; G.pending = null;
      if (G.settings.rules.auction) {
        G.auction = { sq, bid: 0, lead: null, out: [] }; G.phase = 'auction';
        log(G, `${sqOf(G, sq).n} sale a subasta.`);
        G.auction.out.push(...alive(G).filter((j) => P[j].cash < 1));
        checkAuction(G);
      } else { G.phase = 'end'; log(G, `${me.name} no compra ${sqOf(G, sq).n}.`); }
      return true;
    }
    case 'bid': {
      const A = G.auction; if (!A) return 'No hay subasta';
      if (A.out.includes(by)) return 'Ya te has retirado';
      const v = int(a.amt);
      if (v <= A.bid) return 'Tienes que superar la puja';
      if (v > me.cash) return 'No tienes tanto';
      A.bid = v; A.lead = by; checkAuction(G); return true;
    }
    case 'fold': {
      const A = G.auction; if (!A) return 'No hay subasta';
      if (A.out.includes(by)) return 'Ya te has retirado';
      if (A.lead === by) return 'Vas ganando: no puedes retirarte';
      A.out.push(by); checkAuction(G); return true;
    }
    case 'end_turn': {
      if (!myTurn || G.phase !== 'end') return 'No';
      if (blocked) return G.limit ? 'Hay que decidir si se amplía la partida' : 'Hay deudas pendientes';
      if (G.again && !me.inJail) { G.phase = 'roll'; G.again = false; G.card = null; return true; }
      nextTurn(G); return true;
    }
    // ----- gestión propia -----
    case 'build': {
      const e = buildErr(G, pk(by), a.sq); if (e) return e;
      const c = houseCost(a.sq); if (me.cash < c) return 'No tienes dinero suficiente';
      me.cash -= c; G.props[a.sq].lvl++;
      log(G, `${me.name} mejora ${sqOf(G, a.sq).n} (nivel ${G.props[a.sq].lvl}).`); return true;
    }
    case 'sell': {
      const e = sellErr(G, pk(by), a.sq); if (e) return e;
      G.props[a.sq].lvl--; me.cash += Math.round(houseCost(a.sq) / 2);
      log(G, `${me.name} vende una mejora de ${sqOf(G, a.sq).n}.`); return true;
    }
    case 'mortgage': {
      const e = mortErr(G, pk(by), a.sq); if (e) return e;
      G.props[a.sq].mort = true; me.cash += mortValue(a.sq);
      log(G, `${me.name} hipoteca ${sqOf(G, a.sq).n} (+${money(mortValue(a.sq))}).`); return true;
    }
    case 'unmortgage': {
      const p = G.props[a.sq]; if (!p || p.o !== pk(by) || !p.mort) return 'No está hipotecada';
      const c = unmortCost(a.sq); if (me.cash < c) return 'No tienes dinero suficiente';
      me.cash -= c; p.mort = false; log(G, `${me.name} levanta la hipoteca de ${sqOf(G, a.sq).n}.`); return true;
    }
    // ----- deudas -----
    case 'pay_debt': {
      const d = G.debts.find((x) => x.p === by); if (!d) return 'No tienes deudas';
      if (me.cash < d.amt) return 'Aún no tienes suficiente';
      me.cash -= d.amt; credit(G, d.to, d.amt, d.ex);
      G.debts = G.debts.filter((x) => x.id !== d.id);
      log(G, `${me.name} paga ${money(d.amt)} a ${entName(G, d.to)} (${d.why}).`); return true;
    }
    case 'bankrupt': {
      if (!G.debts.some((x) => x.p === by)) return 'Solo con deudas pendientes';
      bankrupt(G, by); return true;
    }
    case 'set_away': {
      if (!isHost(G, by)) return 'Solo el anfitrión';
      const T = P[a.target]; if (!T || T.bot || T.away || T.bankrupt || a.target === by) return 'No';
      T.away = true; log(G, `${T.name} pasa a piloto automático hasta que vuelva.`); return true;
    }
    // ----- límite de rondas -----
    case 'extend': {
      if (!isHost(G, by)) return 'Solo el anfitrión';
      const n = int(a.n); if (n < 1 || n > 100) return 'No';
      G.maxRounds = Math.max(G.maxRounds || 0, G.round - 1) + n; G.limit = false;
      log(G, `Se amplía la partida ${n} rondas (hasta la ${G.maxRounds}).`); return true;
    }
    case 'finish': {
      if (!isHost(G, by)) return 'Solo el anfitrión';
      finish(G, G.limit ? 'limit' : 'host'); return true;
    }
    // ----- contratos -----
    case 'propose': {
      if (!G.settings.contracts) return 'Los contratos están desactivados en esta partida';
      if (G.proposals.length >= 20) return 'Demasiadas propuestas abiertas';
      const parties = contractParties(a.kind, a.data);
      if (!parties.includes(by)) return 'Tienes que ser parte del contrato';
      const e = contractErr(G, a.kind, a.data); if (e) return e;
      const pr = { id: G.nextId++, kind: a.kind, by, parties, signed: [by], data: a.data, r: G.round };
      if (a.ask) { G.botAsk = G.botAsk || {}; G.botAsk[a.ask] = G.round; }
      G.proposals.push(pr);
      log(G, `${me.name} propone un contrato: ${a.kind === 'ute' ? 'UTE ' + a.data.name : a.kind}.`);
      return true;
    }
    case 'sign': {
      const pr = G.proposals.find((x) => x.id === a.id); if (!pr) return 'Esa propuesta ya no existe';
      if (!pr.parties.includes(by) || pr.signed.includes(by)) return 'No';
      pr.signed.push(by);
      if (pr.parties.every((p) => pr.signed.includes(p))) {
        G.proposals = G.proposals.filter((x) => x.id !== pr.id);
        const e = contractErr(G, pr.kind, pr.data);
        if (e) { log(G, `El contrato no se puede ejecutar: ${e}.`); return true; }
        execContract(G, pr.kind, pr.data);
      }
      return true;
    }
    case 'reject': {
      const pr = G.proposals.find((x) => x.id === a.id); if (!pr) return 'Esa propuesta ya no existe';
      if (!pr.parties.includes(by)) return 'No';
      G.proposals = G.proposals.filter((x) => x.id !== pr.id);
      log(G, `${me.name} ${pr.by === by ? 'retira' : 'rechaza'} la propuesta de contrato.`); return true;
    }
    case 'loan_repay': {
      const c = G.contracts.find((x) => x.id === a.id && x.k === 'loan'); if (!c || c.borrower !== by) return 'No';
      if (me.cash < c.repay) return 'No tienes suficiente';
      pay(G, by, c.lender, c.repay); G.contracts = G.contracts.filter((x) => x !== c);
      log(G, `${me.name} devuelve por adelantado el préstamo a ${P[c.lender].name}.`); return true;
    }
    case 'option_exercise': {
      const c = G.contracts.find((x) => x.id === a.id && x.k === 'option'); if (!c || c.holder !== by) return 'No';
      const e = transferErr(G, pk(c.owner), c.sq, c); if (e) return e;
      if (me.cash < c.strike) return 'No tienes suficiente';
      pay(G, by, c.owner, c.strike); G.props[c.sq].o = pk(by);
      G.contracts = G.contracts.filter((x) => x !== c);
      log(G, `${me.name} ejecuta su opción y compra ${sqOf(G, c.sq).n} por ${money(c.strike)}.`); return true;
    }
    case 'release': {
      const c = G.contracts.find((x) => x.id === a.id); if (!c) return 'No';
      const who = { loan: c.lender, discount: c.tenant, cession: c.benef, option: c.holder, installment: c.seller }[c.k];
      if (who !== by) return 'Solo puede liberarlo quien sale ganando';
      G.contracts = G.contracts.filter((x) => x !== c);
      log(G, `${me.name} libera el contrato: ${contractTitle(G, c)}.`); return true;
    }
    // ----- UTE -----
    case 'ute_op': {
      const u = getUte(G, a.uid); if (!u) return 'Esa UTE ya no existe';
      if (!u.members.some((m) => m.p === by)) return 'No eres socio';
      const e = uteOpErr(G, u, a.op); if (e) return e;
      if (u.gov === 'gestor') { if (u.gestor !== by) return 'Solo decide el gestor'; uteOpRun(G, u, a.op); return true; }
      if (G.votes.some((v) => v.uid === u.id && v.op.k === a.op.k && v.op.sq === a.op.sq)) return 'Ya hay una votación igual abierta';
      const v = { id: G.nextId++, uid: u.id, op: { k: a.op.k, sq: a.op.sq ?? null, amt: a.op.amt ?? null }, by, yes: [by], no: [] };
      G.votes.push(v);
      log(G, `${me.name} propone en la UTE ${u.name}: ${OP_TXT[a.op.k]}${a.op.sq != null ? ' ' + sqOf(G, a.op.sq).n : ''}${a.op.amt ? ' ' + money(a.op.amt) : ''}.`);
      evalVote(G, v); return true;
    }
    case 'ute_vote': {
      const v = G.votes.find((x) => x.id === a.id); if (!v) return 'Esa votación ya se cerró';
      const u = getUte(G, v.uid); if (!u || !u.members.some((m) => m.p === by)) return 'No eres socio';
      if (v.yes.includes(by) || v.no.includes(by)) return 'Ya has votado';
      (a.yes ? v.yes : v.no).push(by); evalVote(G, v); return true;
    }
    case 'ute_deposit': {
      const u = getUte(G, a.uid); if (!u || !u.members.some((m) => m.p === by)) return 'No eres socio';
      const v = int(a.amt); if (v < 1 || v > me.cash) return 'Importe no válido';
      me.cash -= v; u.caja += v; log(G, `${me.name} ingresa ${money(v)} en la caja de la UTE ${u.name}.`); return true;
    }
    case 'ute_leave': {
      const u = getUte(G, a.uid); if (!u) return 'Esa UTE ya no existe';
      const m = u.members.find((x) => x.p === by); if (!m) return 'No eres socio';
      const rest = u.members.filter((x) => x.p !== by);
      if (me.cash < u.exitFee) return `La cláusula de salida es de ${money(u.exitFee)}`;
      me.cash -= u.exitFee; splitPct(u.exitFee, rest).forEach(({ p, v }) => { P[p].cash += v; });
      u.members = normalizePct(rest);
      Object.keys(u.origin).forEach((k) => { if (u.origin[k] === by) u.origin[k] = null; });
      if (u.gestor === by) u.gestor = [...u.members].sort((x, y) => y.pct - x.pct)[0]?.p ?? null;
      G.votes.filter((v) => v.uid === u.id).forEach((v) => { v.yes = v.yes.filter((x) => x !== by); v.no = v.no.filter((x) => x !== by); });
      log(G, `${me.name} sale de la UTE ${u.name}${u.exitFee ? ` pagando ${money(u.exitFee)}` : ''}.`);
      if (u.members.length < 2) dissolve(G, u); else [...G.votes].filter((v) => v.uid === u.id).forEach((v) => evalVote(G, v));
      return true;
    }
    default: return 'Acción desconocida';
  }
}
