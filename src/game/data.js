// Datos del tablero, cartas, edificios y contratos de Franquicia.
// Cifras en millones de dólares ($M). Precios y alquileres calcados de la escala clásica para que el equilibrio sea el de siempre.

export const GROUPS = {
  g1: { n: 'Mercado pequeño', c: '#9a6438', house: 50 },
  g2: { n: 'Medio Oeste', c: '#8fd0f2', house: 50 },
  g3: { n: 'Aspirantes', c: '#e0559f', house: 100 },
  g4: { n: 'Playoffs', c: '#f7931e', house: 100 },
  g5: { n: 'Contendientes', c: '#e53935', house: 150 },
  g6: { n: 'Gran mercado', c: '#fdd835', house: 150 },
  g7: { n: 'Historia', c: '#1fa75a', house: 200 },
  g8: { n: 'Las joyas', c: '#2457c5', house: 200 },
};

const T = (i, g, ab, n, city, price, rent, tc) => ({ i, t: 'team', g, ab, n, city, price, rent, tc });

// 40 casillas. Las 22 franquicias van ordenadas de menos a más valiosas (orden orientativo, inspirado en las valoraciones de mercado).
export const SQ = [
  { i: 0, t: 'go', n: 'Noche del Draft', s: 'Cobra al pasar' },
  T(1, 'g1', 'MEM', 'Grizzlies', 'Memphis', 60, [2, 10, 30, 90, 160, 250], '#5d76a9'),
  { i: 2, t: 'fo', n: 'Front Office' },
  T(3, 'g1', 'NOP', 'Pelicans', 'New Orleans', 60, [4, 20, 60, 180, 320, 450], '#85714d'),
  { i: 4, t: 'tax', n: 'Luxury Tax', v: 200 },
  { i: 5, t: 'tv', ab: 'TV', n: 'Derechos TV nacional', price: 200 },
  T(6, 'g2', 'UTA', 'Jazz', 'Utah', 100, [6, 30, 90, 270, 400, 550], '#753bbd'),
  { i: 7, t: 'td', n: 'Trade Deadline' },
  T(8, 'g2', 'IND', 'Pacers', 'Indiana', 100, [6, 30, 90, 270, 400, 550], '#fdbb30'),
  T(9, 'g2', 'MIN', 'Timberwolves', 'Minnesota', 120, [8, 40, 100, 300, 450, 600], '#236192'),
  { i: 10, t: 'jail', n: 'Sanción de la liga', s: 'Solo de visita' },
  T(11, 'g3', 'OKC', 'Thunder', 'Oklahoma City', 140, [10, 50, 150, 450, 625, 750], '#007ac1'),
  { i: 12, t: 'util', ab: 'CAM', n: 'Patrocinio de camiseta', price: 150 },
  T(13, 'g3', 'SAS', 'Spurs', 'San Antonio', 140, [10, 50, 150, 450, 625, 750], '#c4ced4'),
  T(14, 'g3', 'DEN', 'Nuggets', 'Denver', 160, [12, 60, 180, 500, 700, 900], '#fec524'),
  { i: 15, t: 'tv', ab: 'STR', n: 'Derechos de streaming', price: 200 },
  T(16, 'g4', 'MIL', 'Bucks', 'Milwaukee', 180, [14, 70, 200, 550, 750, 950], '#00471b'),
  { i: 17, t: 'fo', n: 'Front Office' },
  T(18, 'g4', 'PHX', 'Suns', 'Phoenix', 180, [14, 70, 200, 550, 750, 950], '#e56020'),
  T(19, 'g4', 'TOR', 'Raptors', 'Toronto', 200, [16, 80, 220, 600, 800, 1000], '#ce1141'),
  { i: 20, t: 'pot', n: 'All-Star Break', s: 'Bote de multas' },
  T(21, 'g5', 'MIA', 'Heat', 'Miami', 220, [18, 90, 250, 700, 875, 1050], '#98002e'),
  { i: 22, t: 'td', n: 'Trade Deadline' },
  T(23, 'g5', 'DAL', 'Mavericks', 'Dallas', 220, [18, 90, 250, 700, 875, 1050], '#00538c'),
  T(24, 'g5', 'PHI', '76ers', 'Philadelphia', 240, [20, 100, 300, 750, 925, 1100], '#006bb6'),
  { i: 25, t: 'tv', ab: 'REG', n: 'Canal regional', price: 200 },
  T(26, 'g6', 'CHI', 'Bulls', 'Chicago', 260, [22, 110, 330, 800, 975, 1150], '#ce1141'),
  T(27, 'g6', 'LAC', 'Clippers', 'Los Ángeles', 260, [22, 110, 330, 800, 975, 1150], '#c8102e'),
  { i: 28, t: 'util', ab: 'MER', n: 'Merchandising', price: 150 },
  T(29, 'g6', 'BKN', 'Nets', 'Brooklyn', 280, [24, 120, 360, 850, 1025, 1200], '#6b6b6b'),
  { i: 30, t: 'gojail', n: 'Expulsión', s: 'Doble técnica: a sanción' },
  T(31, 'g7', 'HOU', 'Rockets', 'Houston', 300, [26, 130, 390, 900, 1100, 1275], '#ce1141'),
  T(32, 'g7', 'BOS', 'Celtics', 'Boston', 300, [26, 130, 390, 900, 1100, 1275], '#007a33'),
  { i: 33, t: 'fo', n: 'Front Office' },
  T(34, 'g7', 'LAL', 'Lakers', 'Los Ángeles', 320, [28, 150, 450, 1000, 1200, 1400], '#552583'),
  { i: 35, t: 'tv', ab: 'INT', n: 'Derechos internacionales', price: 200 },
  { i: 36, t: 'td', n: 'Trade Deadline' },
  T(37, 'g8', 'NYK', 'Knicks', 'Nueva York', 350, [35, 175, 500, 1100, 1300, 1500], '#f58426'),
  { i: 38, t: 'tax', n: 'Multa de la liga', v: 100 },
  T(39, 'g8', 'GSW', 'Warriors', 'Golden State', 400, [50, 200, 600, 1400, 1700, 2000], '#1d428a'),
];

export const OWNABLE = SQ.filter((s) => s.price).map((s) => s.i);
export const TEAMS = SQ.filter((s) => s.t === 'team').map((s) => s.i);
export const groupSqs = (g) => SQ.filter((s) => s.g === g).map((s) => s.i);
export const isOwnable = (i) => !!SQ[i]?.price;

export const BUILD_SETS = {
  infra: {
    n: 'Instalaciones',
    d: 'Mejoras del club: del centro de entrenamiento a una arena nueva.',
    lv: ['Sin mejoras', 'Centro de entrenamiento', 'Equipo G-League', 'Palcos VIP', 'Ampliación del pabellón', 'Arena nueva'],
    sh: ['', 'CE', 'GL', 'VIP', 'AMP', 'ARENA'],
  },
  plantilla: {
    n: 'Plantilla',
    d: 'Vas fichando jugadores; el último fichaje es la estrella.',
    lv: ['Sin fichajes', 'Rookie', 'Especialista 3&D', 'Titular', 'All-Star', 'Superestrella'],
    sh: ['', 'R', '3D', 'TIT', 'ASG', 'STAR'],
  },
};

export const PCOLS = ['#ff7a29', '#3ddc97', '#5ab0ff', '#ff5aa8', '#ffd23f', '#b48cff'];
export const BOT_NAMES = ['Bot Pick&Roll', 'Bot Triple', 'Bot Alley-oop', 'Bot Fadeaway', 'Bot Crossover', 'Bot Buzzer'];

// Cartas. fx: goto(to), cash(v), jailfree, back(v), jail, repairs(h,a), each(v: + cobras de cada uno / - pagas a cada uno), nearest(t)
export const CARDS = {
  td: [
    { n: 'Te llaman al Draft', tx: 'Avanza hasta la Noche del Draft y cobra el salario.', fx: { k: 'goto', to: 0 } },
    { n: 'Gira por la Costa Oeste', tx: 'Avanza hasta los Warriors. Si pasas por el Draft, cobras.', fx: { k: 'goto', to: 39 } },
    { n: 'Partido en Hollywood', tx: 'Avanza hasta los Lakers. Si pasas por el Draft, cobras.', fx: { k: 'goto', to: 34 } },
    { n: 'Viaje a South Beach', tx: 'Avanza hasta los Heat. Si pasas por el Draft, cobras.', fx: { k: 'goto', to: 21 } },
    { n: 'Back-to-back televisado', tx: 'Avanza a los siguientes derechos de TV. Si tienen dueño, le pagas el doble.', fx: { k: 'nearest', t: 'tv' } },
    { n: 'Partido nacional en prime time', tx: 'Avanza a los siguientes derechos de TV. Si tienen dueño, le pagas el doble.', fx: { k: 'nearest', t: 'tv' } },
    { n: 'Renovación de patrocinio', tx: 'Avanza al siguiente patrocinio. Si tiene dueño, tira los dados y paga 10 veces el resultado.', fx: { k: 'nearest', t: 'util' } },
    { n: 'Dividendos de la liga', tx: 'El reparto de beneficios te deja 50.', fx: { k: 'cash', v: 50 } },
    { n: 'Recurso aprobado', tx: 'Guárdala: sales de la sanción gratis cuando quieras.', fx: { k: 'jailfree' } },
    { n: 'Airball', tx: 'Retrocede 3 casillas.', fx: { k: 'back', v: 3 } },
    { n: 'Expulsado por doble técnica', tx: 'Vas directo a la sanción. No pasas por el Draft ni cobras.', fx: { k: 'jail' } },
    { n: 'Auditoría de instalaciones', tx: 'Paga 25 por cada mejora (niveles 1-4) y 100 por cada nivel máximo.', fx: { k: 'repairs', h: 25, a: 100 } },
    { n: 'Multa por flopping', tx: 'Paga 15.', fx: { k: 'cash', v: -15 } },
    { n: 'Vuelo chárter', tx: 'Avanza a los derechos de TV nacional. Si pasas por el Draft, cobras.', fx: { k: 'goto', to: 5 } },
    { n: 'Capitán del All-Star', tx: 'Invitas a todos: paga 50 a cada jugador.', fx: { k: 'each', v: -50 } },
    { n: 'Bonus por playoffs', tx: 'Cobra 150.', fx: { k: 'cash', v: 150 } },
  ],
  fo: [
    { n: 'Primera elección del Draft', tx: 'Avanza hasta la Noche del Draft y cobra el salario.', fx: { k: 'goto', to: 0 } },
    { n: 'Error contable de la liga', tx: 'A tu favor: cobra 200.', fx: { k: 'cash', v: 200 } },
    { n: 'Esguince de tobillo', tx: 'Gastos médicos: paga 50.', fx: { k: 'cash', v: -50 } },
    { n: 'Camisetas retro agotadas', tx: 'Cobra 50.', fx: { k: 'cash', v: 50 } },
    { n: 'Recurso aprobado', tx: 'Guárdala: sales de la sanción gratis cuando quieras.', fx: { k: 'jailfree' } },
    { n: 'Pillado saltándose el protocolo', tx: 'Vas directo a la sanción. No pasas por el Draft ni cobras.', fx: { k: 'jail' } },
    { n: 'Retirada de camiseta', tx: 'Ceremonia en tu pabellón: cada jugador te paga 50.', fx: { k: 'each', v: 50 } },
    { n: 'Fondo de reparto de la liga', tx: 'Cobra 100.', fx: { k: 'cash', v: 100 } },
    { n: 'Devolución de impuestos', tx: 'Cobra 20.', fx: { k: 'cash', v: 20 } },
    { n: 'Cumpleaños del propietario', tx: 'Cada jugador te regala 10.', fx: { k: 'each', v: 10 } },
    { n: 'Seguro de lesiones', tx: 'Cobra 100.', fx: { k: 'cash', v: 100 } },
    { n: 'Rehabilitación de rodilla', tx: 'Paga 100.', fx: { k: 'cash', v: -100 } },
    { n: 'Comisión de agentes', tx: 'Paga 50.', fx: { k: 'cash', v: -50 } },
    { n: 'Rookie del Año', tx: 'Cobra 25.', fx: { k: 'cash', v: 25 } },
    { n: 'Obras en el pabellón', tx: 'Paga 40 por cada mejora (niveles 1-4) y 115 por cada nivel máximo.', fx: { k: 'repairs', h: 40, a: 115 } },
    { n: 'Gana el concurso de mates', tx: 'Cobra 10.', fx: { k: 'cash', v: 10 } },
  ],
};

export const RULESETS = {
  clasicas: { auction: true, pot: false, doubleGo: false, evenBuild: true, bankLimit: true, jailRent: true },
  caseras: { auction: false, pot: true, doubleGo: true, evenBuild: false, bankLimit: false, jailRent: false },
};

export const RULE_INFO = {
  auction: { n: 'Subasta si no compras', d: 'Si quien cae en una franquicia libre no la compra, se subasta entre todos.' },
  pot: { n: 'Bote del All-Star', d: 'Impuestos, multas y cartas de pago van a un bote que se lleva quien caiga en All-Star Break.' },
  doubleGo: { n: 'Draft doble', d: 'Si caes justo en la Noche del Draft cobras el doble.' },
  evenBuild: { n: 'Construcción pareja', d: 'Hay que mejorar las franquicias de un grupo de forma uniforme: ninguna puede sacar más de un nivel a otra.' },
  bankLimit: { n: 'Límite de la liga', d: 'Solo existen 32 mejoras intermedias y 12 de nivel máximo. Si se agotan, nadie más construye.' },
  jailRent: { n: 'Cobrar sancionado', d: 'Si estás en sanción sigues cobrando alquileres. Desactivado: el sancionado no cobra.' },
};

export const MODES = {
  rapida: { n: 'Rápida', d: 'Cada jugador empieza con 2 franquicias al azar y la partida tiene un número de rondas. Al llegar al final podéis ampliarla o cerrarla: gana el mayor patrimonio.' },
  estandar: { n: 'Estándar', d: 'Partida clásica: compra, construye y arruina a los demás. Puedes poner un límite de rondas opcional.' },
};

// ---------- Contratos ----------
export const CONTRACTS = {
  trade: {
    n: 'Traspaso',
    k: 'Intercambio inmediato',
    short: 'Cambias franquicias, dinero y cartas de recurso con otro jugador en el acto.',
    how: [
      'Cada parte elige qué entrega: franquicias, dinero y cartas de «Recurso aprobado».',
      'Se ejecuta en cuanto los dos firman. No queda nada pendiente.',
      'Las franquicias hipotecadas pasan hipotecadas: el nuevo dueño paga después el levantamiento.',
    ],
    rules: [
      'No se puede traspasar una franquicia si su grupo tiene mejoras construidas: hay que venderlas antes.',
      'No se pueden traspasar franquicias bloqueadas por otro contrato (aval de un préstamo, opción de compra o compra a plazos).',
    ],
    ex: 'Te doy los Bulls y 100 por los Nets: tú completas el amarillo y yo me quito un rival.',
  },
  ute: {
    n: 'UTE',
    k: 'Unión Temporal de Empresas',
    short: 'Dos o más jugadores ponen franquicias y dinero en común y las explotan juntos, con su % de participación.',
    how: [
      'Cada socio aporta franquicias y/o dinero. Las franquicias pasan a ser de la UTE y el dinero va a su caja.',
      'Se pacta el % de cada socio (suma 100). Hay un botón que lo calcula según lo que aporta cada uno.',
      'Si entre todos completáis un grupo de color, la UTE tiene el grupo completo: cobra doble y puede construir.',
      'Ingresos: en «Reparto directo» cada alquiler se reparte al momento según el %. En «Caja común» se acumula en la caja de la UTE y se reparte con dividendos.',
      'Gastos (mejoras, levantar hipotecas): salen primero de la caja; lo que falte lo pone cada socio según su %. Si alguno no tiene dinero para su parte, no se puede hacer.',
      'Si un socio cae en una franquicia de su propia UTE, solo paga la parte de los demás (el alquiler menos su %).',
    ],
    gov: {
      gestor: 'Gestor único: un socio decide solo construir, vender, hipotecar, repartir o disolver.',
      mayoria: 'Mayoría: cualquier socio propone y se aprueba con más del 50 % de participación a favor.',
      unanimidad: 'Unanimidad: todos los socios tienen que votar a favor.',
    },
    rules: [
      'Duración: indefinida o un número de rondas. Al terminar se disuelve sola.',
      'Disolución: las mejoras se venden a la liga a mitad de precio, cada franquicia vuelve a quien la aportó y la caja se reparte según el %.',
      'Salida anticipada: un socio puede irse pagando la cláusula de salida a los demás. Su % se reparte entre los que quedan. Si queda uno solo, la UTE se disuelve.',
      'Quiebra de un socio: su participación pasa a su acreedor si es un jugador; si no, se reparte entre el resto de socios.',
      'Para aportar una franquicia, su grupo no puede tener mejoras.',
    ],
    ex: 'Tú tienes Bucks y Suns, yo los Raptors: montamos una UTE 60/40, completamos el naranja y construimos a medias.',
  },
  loan: {
    n: 'Préstamo',
    k: 'Financiación con interés',
    short: 'Un jugador presta dinero ahora y el otro devuelve una cantidad mayor en un plazo de rondas.',
    how: [
      'El prestamista entrega el importe en cuanto se firma.',
      'El prestatario devuelve el total pactado (principal + intereses) al vencer el plazo. Puede devolverlo antes sin penalización.',
      'Opcional: un aval. Es una franquicia del prestatario que queda bloqueada mientras dure el préstamo.',
    ],
    rules: [
      'Al vencer, si el prestatario no tiene el dinero y hay aval, el aval pasa al prestamista y la deuda queda saldada (las mejoras de ese grupo se venden a la liga).',
      'Sin aval, el impago se convierte en deuda: hay que hipotecar o vender para pagar, o quebrar a favor del prestamista.',
    ],
    ex: 'Te presto 300 y me devuelves 390 en 6 rondas, con los Spurs como aval.',
  },
  discount: {
    n: 'Pase VIP',
    k: 'Descuento de alquiler',
    short: 'Pagas ahora a un dueño para pagar menos (o nada) cuando caigas en sus franquicias durante unas rondas.',
    how: [
      'Se pacta el % de descuento (100 % = no pagas nada), qué franquicias cubre (todas o algunas) y cuántas rondas dura.',
      'El beneficiario paga el precio del pase al firmar.',
    ],
    rules: [
      'Solo cubre franquicias de un jugador, no de una UTE.',
      'Si la franquicia cambia de dueño, el pase deja de aplicarse en ella.',
    ],
    ex: 'Te pago 150 y durante 8 rondas no te pago alquiler en las verdes.',
  },
  cession: {
    n: 'Cesión de ingresos',
    k: 'Derechos de cobro',
    short: 'Vendes un % de lo que cobra una franquicia: el comprador paga ahora y recibe esa parte de cada alquiler.',
    how: [
      'El dueño cede un % de los alquileres de una franquicia concreta a otro jugador.',
      'El cesionario paga el precio al firmar y después cobra su % cada vez que alguien paga alquiler ahí.',
      'Duración: un número de rondas o permanente (mientras el dueño la conserve).',
    ],
    rules: [
      'Se acaba si la franquicia cambia de dueño.',
      'Si el propio cesionario cae en ella, paga el alquiler completo y recibe su parte de vuelta.',
    ],
    ex: 'Me pagas 200 y te llevas el 30 % de lo que cobren los Warriors durante 15 rondas.',
  },
  option: {
    n: 'Opción de compra',
    k: 'Derecho a comprar más tarde',
    short: 'Pagas una prima por el derecho a comprar una franquicia a un precio fijado, cuando tú quieras durante unas rondas.',
    how: [
      'El comprador paga la prima al firmar (no se devuelve).',
      'Mientras dure, puede ejecutar la opción: paga el precio pactado y la franquicia pasa a ser suya.',
      'El dueño no puede traspasarla ni aportarla a una UTE mientras la opción esté viva.',
    ],
    rules: [
      'Solo se puede ejecutar si el grupo de la franquicia no tiene mejoras en ese momento.',
      'Si no se ejecuta antes de que acabe el plazo, caduca.',
    ],
    ex: 'Te pago 40 ahora por poder comprarte los Celtics a 450 durante 10 rondas.',
  },
  installment: {
    n: 'Compra a plazos',
    k: 'Pago aplazado',
    short: 'Te quedas una franquicia ya y la pagas en cuotas cada ronda. Si fallas una cuota, vuelve al vendedor.',
    how: [
      'El comprador paga una entrada al firmar (puede ser 0) y recibe la franquicia en el acto.',
      'Al empezar cada ronda paga la cuota pactada al vendedor, hasta completar el número de cuotas.',
      'Mientras haya cuotas pendientes, no puede traspasarla ni aportarla a una UTE.',
    ],
    rules: [
      'Si al empezar una ronda no tiene para la cuota, la franquicia vuelve al vendedor (las mejoras de ese grupo se venden a la liga) y lo pagado no se devuelve.',
    ],
    ex: 'Me quedo los Knicks: 50 de entrada y 6 cuotas de 60.',
  },
};

export const CONTRACT_ORDER = ['ute', 'trade', 'loan', 'discount', 'cession', 'option', 'installment'];
