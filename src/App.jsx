import React, { useCallback, useEffect, useRef, useState } from 'react';
import { reduce, why, makeLobby, newLocalGame, cleanSettings, normalize, DEFAULT_SETTINGS } from './game/engine.js';
import { nextAutoAction, isAuto } from './game/bot.js';
import { MODES, BUILD_SETS } from './game/data.js';
import { createRoom, getRoom, updateRoom, subscribeRoom } from './lib/supabase.js';
import Game, { EndScreen } from './ui/Game.jsx';
import Rules from './ui/Rules.jsx';
import { SettingsForm, LocalPlayers } from './ui/Setup.jsx';
import { Dot } from './ui/common.jsx';

const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* nada */ } },
};
function guestId() {
  let id = ls.get('fq-guest', null);
  if (!id) { id = 'g-' + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)); ls.set('fq-guest', id); }
  return id;
}

function useToast() {
  const [msg, setMsg] = useState(null);
  const t = useRef(null);
  const show = useCallback((m) => { setMsg(m); clearTimeout(t.current); t.current = setTimeout(() => setMsg(null), 3200); }, []);
  return [msg, show];
}

function useOnlineRoom(code, toast) {
  const [room, setRoom] = useState(null);
  const [err, setErr] = useState(null);
  const ref = useRef(null);
  const apply = useCallback((r) => { if (!r) return; if (!ref.current || r.version > ref.current.version) { ref.current = r; setRoom(r); } }, []);
  useEffect(() => {
    if (!code) return undefined;
    let alive = true;
    ref.current = null; setRoom(null); setErr(null);
    getRoom(code).then((r) => { if (!alive) return; if (!r) setErr('No existe ninguna sala con ese código.'); else apply(r); }).catch(() => alive && setErr('No se pudo conectar con la sala.'));
    const unsub = subscribeRoom(code, (row) => apply({ code: row.code, version: row.version, state: row.state }));
    const iv = setInterval(() => { getRoom(code).then((r) => alive && apply(r)).catch(() => {}); }, 3500);
    return () => { alive = false; unsub(); clearInterval(iv); };
  }, [code, apply]);
  const dispatch = useCallback(async (a, quiet) => {
    for (let i = 0; i < 8; i++) {
      const cur = ref.current; if (!cur) return;
      const next = reduce(cur.state, a);
      if (!next) { const w = why(cur.state, a); if (!quiet && w && w !== 'nada') toast(w); return; }
      try {
        const v = await updateRoom(code, cur.version, next);
        if (v >= 0) { apply({ code, version: v, state: next }); return; }
        const fresh = await getRoom(code); if (fresh) { ref.current = fresh; setRoom(fresh); }
      } catch { await new Promise((r) => setTimeout(r, 400)); }
    }
    if (!quiet) toast('No se pudo guardar la jugada. Revisa la conexión.');
  }, [code, apply, toast]);
  return { room, dispatch, err };
}

// Ejecuta bots y piloto automático. En online solo lo hace el anfitrión para no duplicar jugadas.
function useAutoplay(G, dispatch, enabled) {
  const busy = useRef(false);
  useEffect(() => {
    if (!enabled || !G || G.status !== 'playing') return undefined;
    const a = nextAutoAction(G);
    if (!a || busy.current) return undefined;
    const slow = ['roll', 'end_turn', 'buy', 'decline'].includes(a.t);
    const t = setTimeout(async () => { busy.current = true; try { await dispatch(a, true); } finally { busy.current = false; } }, slow ? 900 : 450);
    return () => clearTimeout(t);
  }, [G?.seq, enabled]);
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const [toastMsg, toast] = useToast();
  const [name, setNameState] = useState(() => ls.get('fq-name', ''));
  const setName = (n) => { setNameState(n); ls.set('fq-name', n); };
  const [screen, setScreen] = useState(() => (params.get('sala') ? 'room' : 'home'));
  const [code, setCode] = useState(() => (params.get('sala') || '').toUpperCase());
  const [settings, setSettings] = useState(() => cleanSettings(ls.get('fq-settings', DEFAULT_SETTINGS)));
  const [localPlayers, setLocalPlayers] = useState(() => ls.get('fq-players', [{ name: '', bot: false }, { name: '', bot: false }]));
  const [localG, setLocalG] = useState(() => { try { return normalize(ls.get('fq-local', null)); } catch { return null; } });
  const [busy, setBusy] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [msg, setMsg] = useState('');
  const [actor, setActor] = useState(null);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => { ls.set('fq-settings', settings); }, [settings]);
  useEffect(() => { ls.set('fq-players', localPlayers); }, [localPlayers]);
  useEffect(() => { if (localG) ls.set('fq-local', localG); }, [localG]);

  const myId = guestId();
  const myName = (name || '').trim();
  const { room, dispatch: onlineDispatch, err } = useOnlineRoom(screen === 'room' ? code : null, toast);
  const G = room?.state || null;

  // entrar automáticamente en el lobby
  useEffect(() => {
    if (!G || G.status !== 'lobby' || !myName) return;
    const me = G.players.find((p) => p.id === myId);
    if (!me || me.name !== myName) onlineDispatch({ t: 'join', player: { id: myId, name: myName } }, true);
  }, [G?.status, G?.players?.length, myName]);
  useEffect(() => { if (screen === 'room' && code) { ls.set('fq-room', code); const u = new URL(window.location.href); u.searchParams.set('sala', code); window.history.replaceState(null, '', u); } }, [screen, code]);

  const localDispatch = useCallback((a) => {
    setLocalG((s) => { const n = reduce(s, a); if (!n) { const w = why(s, a); if (w && w !== 'nada') setTimeout(() => toast(w), 0); return s; } return n; });
  }, [toast]);

  const onlineMyIdx = G ? G.players.findIndex((p) => p.id === myId) : -1;
  const hostHere = G && G.players.find((p) => p.id === G.host)?.id === myId;
  useAutoplay(localG && screen === 'local' ? localG : null, localDispatch, screen === 'local');
  useAutoplay(screen === 'room' ? G : null, onlineDispatch, screen === 'room' && !!hostHere);

  // En local, gestionar por defecto como el jugador humano que tiene el turno.
  useEffect(() => {
    if (screen !== 'local' || !localG || localG.status !== 'playing') return;
    const t = localG.turn;
    if (!localG.players[t].bot) setActor(t);
    else if (actor == null || localG.players[actor]?.bot || localG.players[actor]?.bankrupt) setActor(localG.players.findIndex((p) => !p.bot && !p.bankrupt));
  }, [localG?.turn, screen]);

  const goHome = () => { const u = new URL(window.location.href); u.searchParams.delete('sala'); window.history.replaceState(null, '', u); setScreen('home'); setCode(''); };

  const create = async () => {
    if (!myName) { setMsg('Pon tu nombre para crear la sala.'); return; }
    setBusy(true); setMsg('');
    try { const c = await createRoom(myId, makeLobby(settings, { id: myId, name: myName })); setCode(c); setScreen('room'); }
    catch { setMsg('No se pudo crear la sala. Inténtalo de nuevo.'); }
    setBusy(false);
  };
  const join = () => {
    const c = joinCode.trim().toUpperCase();
    if (c.length !== 4) { setMsg('El código tiene 4 letras.'); return; }
    if (!myName) { setMsg('Pon tu nombre para entrar.'); return; }
    setMsg(''); setCode(c); setScreen('room');
  };

  const toastEl = toastMsg ? <div className="toast" role="status">{toastMsg}</div> : null;

  // ----- partida local -----
  if (screen === 'local' && localG) {
    if (localG.status === 'ended') {
      return <>{toastEl}<EndScreen G={localG} onRematch={() => setLocalG(newLocalGame(localG.settings, localG.players.map((p) => ({ name: p.name, bot: p.bot }))))} onHome={() => { setLocalG(null); ls.del('fq-local'); goHome(); }} /></>;
    }
    const ctx = { G: localG, dispatch: localDispatch, can: (i) => !!localG.players[i] && !localG.players[i].bot && !localG.players[i].bankrupt, local: true, actor, setActor, isHost: true, hostIdx: localG.players.findIndex((p) => !p.bot) };
    return <>{toastEl}<Game ctx={ctx} onExit={() => setScreen('home')} /></>;
  }

  // ----- partida online -----
  if (screen === 'room') {
    if (err) return <Shell>{toastEl}<p className="note">{err}</p><button className="btn" onClick={goHome}>Volver</button></Shell>;
    if (!myName) return <Shell><EnterName code={code} onDone={setName} /></Shell>;
    if (!G) return <Shell><p className="wait">Conectando con la sala {code}…</p></Shell>;
    const me = onlineMyIdx >= 0 ? onlineMyIdx : null;
    const meAway = me !== null && !!G.players[me].away;
    const leaveRoom = () => {
      if (me === null || G.status === 'ended' || (G.status === 'playing' && meAway)) { goHome(); return; }
      Promise.race([onlineDispatch(G.status === 'lobby' ? { t: 'leave', id: myId } : { t: 'leave', by: me }, true), new Promise((r) => setTimeout(r, 2500))]).finally(goHome);
    };
    if (G.status === 'lobby') return <>{toastEl}<Lobby G={G} code={code} isHost={G.host === myId} dispatch={onlineDispatch} onExit={leaveRoom} /></>;
    if (G.status === 'ended') return <>{toastEl}<EndScreen G={G} onRematch={G.host === myId ? () => onlineDispatch({ t: 'rematch', by: me }) : null} onHome={goHome} /></>;
    const ctx = {
      G, dispatch: onlineDispatch, local: false,
      can: (i) => i === me && !meAway && !G.players[i]?.bankrupt,
      actor: me !== null && !G.players[me].bankrupt ? me : null, setActor: () => {}, isHost: G.host === myId, hostIdx: me,
    };
    return (
      <>
        {toastEl}
        {meAway && <div className="awaybar"><span>Estás ausente: el piloto automático juega por ti.</span><button className="mini gold" onClick={() => onlineDispatch({ t: 'back', by: me })}>Volver a jugar</button></div>}
        {me === null && <div className="awaybar"><span>Estás viendo la partida: empezó sin ti.</span></div>}
        <Game ctx={ctx} roomCode={code} onExit={leaveRoom} />
      </>
    );
  }

  // ----- configuración -----
  if (screen === 'setup-local' || screen === 'setup-online') {
    const online = screen === 'setup-online';
    const humans = localPlayers.filter((p) => !p.bot).length;
    return (
      <Shell>
        <button className="mini back" onClick={() => setScreen('home')}>← Inicio</button>
        <h2 className="h2">{online ? 'Nueva partida online' : 'Partida en este móvil'}</h2>
        {!online && <LocalPlayers list={localPlayers} set={setLocalPlayers} />}
        <SettingsForm s={settings} set={setSettings} />
        {msg && <p className="note">{msg}</p>}
        {online && <p className="hint">Los bots se añaden en la sala, antes de empezar.</p>}
        <button className="cta" disabled={busy || (!online && (localPlayers.length < 2 || humans < 1))}
          onClick={() => {
            if (online) create();
            else {
              const list = localPlayers.map((p, i) => ({ name: (p.name || '').trim() || `Jugador ${i + 1}`, bot: !!p.bot }));
              setLocalG(newLocalGame(cleanSettings(settings), list)); setActor(null); setScreen('local');
            }
          }}>{online ? (busy ? 'Creando…' : 'Crear sala') : 'Empezar partida'}</button>
      </Shell>
    );
  }

  // ----- inicio -----
  const lastRoom = ls.get('fq-room', null);
  return (
    <Shell>
      {toastEl}
      <p className="intro">El juego de las franquicias NBA: compra equipos, mejóralos hasta la arena nueva, monta UTE con tus amigos y llévalos a la quiebra.</p>
      <div className="field"><label className="flabel" htmlFor="myname">Tu nombre</label>
        <input id="myname" value={name} maxLength={14} placeholder="Cómo te verán los demás" onChange={(e) => setName(e.target.value)} />
      </div>
      <section className="block">
        <h3 className="h3">Online, cada uno en su móvil</h3>
        <button className="cta" onClick={() => { setMsg(''); setScreen('setup-online'); }}>Crear sala</button>
        <div className="joinrow">
          <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))} placeholder="CÓDIGO" aria-label="Código de sala" className="codein" />
          <button className="btn" onClick={join}>Unirme</button>
        </div>
        {lastRoom && <button className="btn ghost" onClick={() => { setCode(lastRoom); setScreen('room'); }}>Volver a la sala {lastRoom}</button>}
      </section>
      <section className="block">
        <h3 className="h3">Un solo móvil</h3>
        <button className="btn" onClick={() => setScreen('setup-local')}>Partida en este móvil</button>
        {localG && localG.status === 'playing' && <button className="btn ghost" onClick={() => setScreen('local')}>Seguir la partida guardada (ronda {localG.round})</button>}
      </section>
      {msg && <p className="note">{msg}</p>}
      <button className="btn ghost" onClick={() => setShowRules((v) => !v)}>{showRules ? 'Ocultar reglas' : 'Ver reglas y contratos'}</button>
      {showRules && <Rules settings={cleanSettings(settings)} />}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="app">
      <div className="brand"><h1 className="logo">Franquicia</h1><span className="tag">NBA edition</span></div>
      {children}
    </div>
  );
}

function EnterName({ code, onDone }) {
  const [v, setV] = useState('');
  const go = (e) => { e.preventDefault(); if (v.trim()) onDone(v.trim()); };
  return (
    <form className="form" onSubmit={go}>
      <h2 className="h2">Sala {code}</h2>
      <label className="flabel" htmlFor="enter-name">Tu nombre en la partida</label>
      <input id="enter-name" value={v} maxLength={14} placeholder="Tu nombre" onChange={(e) => setV(e.target.value)} autoFocus />
      <button className="cta" type="submit" disabled={!v.trim()}>Entrar en la sala</button>
    </form>
  );
}

function Lobby({ G, code, isHost, dispatch, onExit }) {
  const [copied, setCopied] = useState(false);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(G.settings);
  const link = `${window.location.origin}${window.location.pathname}?sala=${code}`;
  const s = G.settings;
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); } };
  return (
    <div className="app">
      <div className="brand"><h1 className="logo">Franquicia</h1><button className="mini" onClick={onExit}>Salir</button></div>
      <div className="roomcode"><span>Código de sala</span><b>{code}</b></div>
      <div className="linkrow"><input readOnly value={link} aria-label="Enlace de la sala" onFocus={(e) => e.target.select()} /><button className="mini gold" onClick={copy}>{copied ? 'Copiado' : 'Copiar enlace'}</button></div>
      <section className="block">
        <h3 className="h3">Jugadores ({G.players.length}/6)</h3>
        <ul className="plist">
          {G.players.map((p) => (
            <li key={p.id}><Dot col={p.col} /><b>{p.name}</b><span>{p.bot ? 'bot' : p.id === G.host ? 'anfitrión' : ''}</span>
              {isHost && p.id !== G.host && <button className="mini" onClick={() => dispatch({ t: 'kick', id: p.id })}>Quitar</button>}</li>
          ))}
        </ul>
        {isHost && G.players.length < 6 && <button className="btn ghost" onClick={() => dispatch({ t: 'add_bot' })}>+ Añadir bot</button>}
      </section>
      <section className="block">
        <h3 className="h3">Ajustes</h3>
        <p className="hint">{MODES[s.mode].n}{s.maxRounds ? `, ${s.maxRounds} rondas` : ', sin límite'} · {s.contracts ? 'con contratos' : 'sin contratos'} · se construyen {BUILD_SETS[s.build].n.toLowerCase()} · reglas {s.ruleset === 'personal' ? 'a medida' : s.ruleset} · {s.startCash} iniciales</p>
        {isHost && !edit && <button className="btn ghost" onClick={() => { setDraft(G.settings); setEdit(true); }}>Cambiar ajustes</button>}
        {edit && <><SettingsForm s={draft} set={setDraft} /><button className="btn" onClick={() => { dispatch({ t: 'settings', settings: draft }); setEdit(false); }}>Guardar ajustes</button></>}
      </section>
      {isHost ? <button className="cta" disabled={G.players.length < 2} onClick={() => dispatch({ t: 'start' })}>{G.players.length < 2 ? 'Esperando jugadores…' : 'Empezar partida'}</button>
        : <p className="wait">Esperando a que el anfitrión empiece…</p>}
    </div>
  );
}

export { isAuto };
