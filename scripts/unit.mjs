// Pruebas dirigidas de reglas concretas.
import assert from 'node:assert/strict';
import { newLocalGame, reduce, why, rentOf, setRng, netWorth } from '../src/game/engine.js';

let fails = 0; let n = 0;
const T = (name, fn) => { n++; try { fn(); } catch (e) { fails++; console.error('✗', name, '\n ', e.message); } };
const base = (extra = {}) => {
  setRng(() => 0.5);
  const G = newLocalGame({ mode: 'estandar', ruleset: 'clasicas', ...extra }, [{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
  G.players.forEach((p, i) => { p.name = 'ABC'[i]; }); // orden fijo de nombres
  G.log = []; return G;
};
const R = (G, a) => { const N = reduce(G, a); if (!N) throw new Error(`acción rechazada ${JSON.stringify(a)}: ${why(G, a)}`); return N; };
// fuerza dados: la siguiente tirada saca d1,d2
const dice = (d1, d2) => { const q = [(d1 - 1) / 6 + 0.01, (d2 - 1) / 6 + 0.01]; setRng(() => (q.length ? q.shift() : 0.5)); };

T('compra y alquiler simple + doble con grupo', () => {
  let G = base(); G.turn = 0; G.players[0].pos = 0;
  dice(1, 2); G = R(G, { t: 'roll', by: 0 }); // cae en 3 NOP
  assert.equal(G.players[0].pos, 3); assert.equal(G.phase, 'buy');
  G = R(G, { t: 'buy', by: 0 }); assert.equal(G.players[0].cash, 1440);
  assert.equal(rentOf(G, 3), 4);
  G.props[1] = { o: 'p0', lvl: 0, mort: false };
  assert.equal(rentOf(G, 3), 8);
  G = R(G, { t: 'end_turn', by: 0 });
  assert.equal(G.turn, 1);
  G.players[1].pos = 0; dice(1, 2); G = R(G, { t: 'roll', by: 1 });
  assert.equal(G.players[1].cash, 1500 - 8); assert.equal(G.players[0].cash, 1440 + 8);
});

T('subasta clásica', () => {
  let G = base(); G.players[0].pos = 0; dice(1, 2); G = R(G, { t: 'roll', by: 0 });
  G = R(G, { t: 'decline', by: 0 }); assert.ok(G.auction);
  G = R(G, { t: 'bid', by: 1, amt: 30 }); G = R(G, { t: 'bid', by: 2, amt: 40 });
  G = R(G, { t: 'fold', by: 0 }); G = R(G, { t: 'fold', by: 1 });
  assert.equal(G.auction, null); assert.equal(G.props[3].o, 'p2'); assert.equal(G.players[2].cash, 1460);
});

T('caseras: sin subasta, bote, draft doble, sancionado no cobra', () => {
  let G = base({ ruleset: 'caseras' }); G.players[0].pos = 0; dice(1, 3); G = R(G, { t: 'roll', by: 0 }); // 4 luxury tax
  assert.equal(G.pot, 200);
  G = R(G, { t: 'end_turn', by: 0 });
  G.players[1].pos = 16; dice(1, 3); G = R(G, { t: 'roll', by: 1 }); // 20 all-star
  assert.equal(G.players[1].cash, 1700); assert.equal(G.pot, 0);
  G.phase = 'roll'; G.players[1].pos = 36; dice(1, 3); G = R(G, { t: 'roll', by: 1 }); // cae justo en 0
  assert.equal(G.players[1].cash, 2100);
  G.props[6] = { o: 'p0', lvl: 0, mort: false }; G.players[0].inJail = true;
  G = R(G, { t: 'end_turn', by: 1 });
  G.players[2].pos = 4; dice(1, 1); const before = G.players[2].cash; G = R(G, { t: 'roll', by: 2 });
  assert.equal(G.players[2].cash, before);
});

T('UTE: alquiler repartido, socio paga solo la parte ajena, grupo completo', () => {
  let G = base(); G.props[1] = { o: 'p0', lvl: 0, mort: false }; G.props[3] = { o: 'p1', lvl: 0, mort: false };
  const data = { name: 'Sur', members: [0, 1], pct: { 0: 60, 1: 40 }, props: { 0: [1], 1: [3] }, cash: { 0: 100, 1: 0 }, gov: 'mayoria', gestor: 0, pay: 'directo', rounds: 0, exitFee: 50 };
  G = R(G, { t: 'propose', by: 0, kind: 'ute', data }); G = R(G, { t: 'sign', by: 1, id: G.proposals[0].id });
  const u = G.utes[0]; assert.equal(G.props[1].o, 'u' + u.id); assert.equal(u.caja, 100);
  assert.equal(rentOf(G, 3), 8); // grupo completo: doble
  // C cae en 3 → 8: 60% a A (5), 40% a B (3)
  G.turn = 2; G.players[2].pos = 0; const a0 = G.players[0].cash; const b0 = G.players[1].cash;
  dice(1, 2); G = R(G, { t: 'roll', by: 2 });
  assert.equal(G.players[0].cash - a0 + G.players[1].cash - b0, 8);
  assert.equal(G.players[0].cash - a0, 5);
  // A (60%) cae en 3 → paga 40% de 8 = 3 a B
  G = R(G, { t: 'end_turn', by: 2 }); G.turn = 0; G.phase = 'roll'; G.players[0].pos = 0;
  const a1 = G.players[0].cash; const b1 = G.players[1].cash;
  dice(1, 2); G = R(G, { t: 'roll', by: 0 });
  assert.equal(a1 - G.players[0].cash, 3); assert.equal(G.players[1].cash - b1, 3);
  // construir por mayoría: A tiene 60% → se aprueba solo; coste 50 sale de caja
  G = R(G, { t: 'ute_op', by: 0, uid: u.id, op: { k: 'build', sq: 1 } });
  assert.equal(G.props[1].lvl, 1); assert.equal(G.utes[0].caja, 50);
  // B propone (40%) → queda pendiente; A vota sí
  G = R(G, { t: 'ute_op', by: 1, uid: u.id, op: { k: 'build', sq: 3 } });
  assert.equal(G.votes.length, 1); assert.equal(G.props[3].lvl, 0);
  G = R(G, { t: 'ute_vote', by: 0, id: G.votes[0].id, yes: true });
  assert.equal(G.props[3].lvl, 1); assert.equal(G.utes[0].caja, 0);
  // siguiente mejora: caja vacía → 60/40 de 50 = 30/20
  const a2 = G.players[0].cash; const b2 = G.players[1].cash;
  G = R(G, { t: 'ute_op', by: 0, uid: u.id, op: { k: 'build', sq: 1 } });
  assert.equal(a2 - G.players[0].cash, 30); assert.equal(b2 - G.players[1].cash, 20);
  // salida de B: paga 50 a A, UTE se disuelve, las franquicias vuelven (la de B → al mayor)
  G = R(G, { t: 'ute_leave', by: 1, uid: u.id });
  assert.equal(G.utes[0].active, false); assert.equal(G.props[1].o, 'p0'); assert.equal(G.props[1].lvl, 0);
});

T('UTE unanimidad: un no la tumba', () => {
  let G = base(); G.props[1] = { o: 'p0', lvl: 0, mort: false }; G.props[3] = { o: 'p1', lvl: 0, mort: false };
  G = R(G, { t: 'propose', by: 0, kind: 'ute', data: { name: 'X', members: [0, 1], pct: { 0: 90, 1: 10 }, props: { 0: [1], 1: [3] }, cash: {}, gov: 'unanimidad', pay: 'caja', rounds: 3, exitFee: 0 } });
  G = R(G, { t: 'sign', by: 1, id: G.proposals[0].id });
  G = R(G, { t: 'ute_op', by: 0, uid: G.utes[0].id, op: { k: 'mortgage', sq: 1 } });
  assert.equal(G.props[1].mort, false);
  G = R(G, { t: 'ute_vote', by: 1, id: G.votes[0].id, yes: false });
  assert.equal(G.votes.length, 0); assert.equal(G.props[1].mort, false);
});

T('préstamo con aval impagado', () => {
  let G = base(); G.props[11] = { o: 'p1', lvl: 0, mort: false };
  G = R(G, { t: 'propose', by: 0, kind: 'loan', data: { lender: 0, borrower: 1, amount: 300, repay: 400, rounds: 1, collateral: 11 } });
  G = R(G, { t: 'sign', by: 1, id: G.proposals[0].id });
  assert.equal(G.players[1].cash, 1800);
  assert.ok(why(G, { t: 'propose', by: 1, kind: 'trade', data: { a: 1, b: 2, ga: { props: [11] }, gb: { cash: 10 } } }));
  G.players[1].cash = 100;
  G.phase = 'end'; G.turn = 2; G = R(G, { t: 'end_turn', by: 2 }); // nueva ronda
  assert.equal(G.round, 2); assert.equal(G.props[11].o, 'p0'); assert.equal(G.contracts.length, 0);
});

T('pase VIP y cesión de ingresos', () => {
  let G = base(); G.props[39] = { o: 'p0', lvl: 0, mort: false };
  G = R(G, { t: 'propose', by: 0, kind: 'cession', data: { owner: 0, benef: 2, sq: 39, pct: 30, rounds: 0, price: 100 } });
  G = R(G, { t: 'sign', by: 2, id: G.proposals[0].id });
  G = R(G, { t: 'propose', by: 1, kind: 'discount', data: { owner: 0, tenant: 1, pct: 50, sqs: 'all', rounds: 5, price: 20 } });
  G = R(G, { t: 'sign', by: 0, id: G.proposals[0].id });
  // B cae en 39: 50 * 50% = 25; 30% de 25 = 8 a C, 17 a A
  G.turn = 1; G.phase = 'roll'; G.players[1].pos = 36; const a = G.players[0].cash; const c = G.players[2].cash; const b = G.players[1].cash;
  dice(1, 2); G = R(G, { t: 'roll', by: 1 });
  assert.equal(b - G.players[1].cash, 25); assert.equal(G.players[2].cash - c, 8); assert.equal(G.players[0].cash - a, 17);
});

T('opción de compra y compra a plazos con impago', () => {
  let G = base(); G.props[32] = { o: 'p0', lvl: 0, mort: false }; G.props[21] = { o: 'p1', lvl: 0, mort: false };
  G = R(G, { t: 'propose', by: 2, kind: 'option', data: { owner: 0, holder: 2, sq: 32, premium: 40, strike: 450, rounds: 5 } });
  G = R(G, { t: 'sign', by: 0, id: G.proposals[0].id });
  G = R(G, { t: 'option_exercise', by: 2, id: G.contracts[0].id });
  assert.equal(G.props[32].o, 'p2'); assert.equal(G.players[0].cash, 1500 + 40 + 450);
  G = R(G, { t: 'propose', by: 2, kind: 'installment', data: { seller: 1, buyer: 2, sq: 21, down: 20, per: 60, n: 3 } });
  G = R(G, { t: 'sign', by: 1, id: G.proposals[0].id });
  assert.equal(G.props[21].o, 'p2');
  G.players[2].cash = 10; G.phase = 'end'; G.turn = 2; G = R(G, { t: 'end_turn', by: 2 });
  assert.equal(G.props[21].o, 'p1');
});

T('deuda y quiebra a favor del acreedor', () => {
  let G = base(); G.props[39] = { o: 'p0', lvl: 5, mort: false }; G.props[37] = { o: 'p0', lvl: 5, mort: false };
  G.props[1] = { o: 'p1', lvl: 0, mort: false };
  G.turn = 1; G.players[1].pos = 36; G.players[1].cash = 100; dice(1, 2);
  G = R(G, { t: 'roll', by: 1 });
  assert.equal(G.debts.length, 1); assert.ok(why(G, { t: 'end_turn', by: 1 }));
  G = R(G, { t: 'bankrupt', by: 1 });
  assert.equal(G.players[1].bankrupt, true); assert.equal(G.props[1].o, 'p0'); assert.equal(G.turn, 2);
  assert.equal(G.players[0].cash, 1600);
});

T('construcción pareja y grupo', () => {
  let G = base(); G.props[1] = { o: 'p0', lvl: 0, mort: false };
  assert.ok(why(G, { t: 'build', by: 0, sq: 1 }));
  G.props[3] = { o: 'p0', lvl: 0, mort: false };
  G = R(G, { t: 'build', by: 0, sq: 1 });
  assert.ok(why(G, { t: 'build', by: 0, sq: 1 }));
  G = R(G, { t: 'build', by: 0, sq: 3 }); G = R(G, { t: 'build', by: 0, sq: 1 });
  assert.equal(rentOf(G, 1), 30);
  assert.ok(why(G, { t: 'mortgage', by: 0, sq: 3 }));
});

T('límite de rondas y ampliación', () => {
  let G = base({ mode: 'rapida', maxRounds: 1 });
  assert.equal(Object.keys(G.props).length, 6);
  G.phase = 'end'; G.turn = 2; G = R(G, { t: 'end_turn', by: 2 });
  assert.equal(G.limit, true); assert.ok(why(G, { t: 'roll', by: G.turn }));
  G = R(G, { t: 'extend', by: 0, n: 5 }); assert.equal(G.maxRounds, 6); assert.equal(G.limit, false);
  G = R(G, { t: 'finish', by: 0 }); assert.equal(G.status, 'ended');
  assert.ok(netWorth(G, 0) > 0);
});

T('tres dobles → sanción; salir con dobles', () => {
  let G = base(); G.players[0].pos = 0;
  for (let k = 0; k < 2; k++) { dice(1, 1); G = R(G, { t: 'roll', by: 0 }); if (G.phase === 'buy') G = R(G, { t: 'decline', by: 0 }); while (G.auction) { const j = [0, 1, 2].find((x) => !G.auction.out.includes(x)); G = R(G, { t: 'fold', by: j }); } G = R(G, { t: 'end_turn', by: 0 }); }
  dice(2, 2); G = R(G, { t: 'roll', by: 0 }); assert.equal(G.players[0].inJail, true); assert.equal(G.players[0].pos, 10);
});

console.log(`${n - fails}/${n} pruebas OK`);
process.exit(fails ? 1 : 0);
