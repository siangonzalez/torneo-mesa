// ==================== JUGADORES ====================
// Cambiar el nombre de un jugador. El nombre es la "llave" del jugador en todos lados
// (lista de jugadores, partidas, equipos, torneos archivados, fotos y frases), así que hay
// que cambiarlo en cada lugar a la vez para que no pierda sus puntos ni su historial.
// Módulo puro (sin Firebase ni DOM), se prueba en tests/players.test.js.

import { encodeKey } from './sync.js';

const swap = (list, from, to) => (Array.isArray(list) ? list.map(x => (x === from ? to : x)) : list);

function renameInGame(g, from, to) {
  if (!g) return g;
  const out = { ...g };
  if (g.positions) out.positions = swap(g.positions, from, to);
  if (g.participants) out.participants = swap(g.participants, from, to);
  if (Array.isArray(g.teams)) out.teams = g.teams.map(t => swap(t, from, to));
  return out;
}

// ¿Aparece este nombre en algún lado (jugadores actuales, partidas o torneos archivados)?
export function nameInUse(state, name) {
  const s = state || {};
  const inGame = g => g && [g.positions, g.participants, ...(g.teams || [])].some(l => Array.isArray(l) && l.includes(name));
  return (s.players || []).includes(name)
    || (s.games || []).some(inGame)
    || (s.archive || []).some(t => (t.players || []).includes(name) || (t.games || []).some(inGame));
}

// Cambia `from` por `to` en todo el estado. Modifica `state` y devuelve {ok} o {ok:false, error}.
export function renamePlayer(state, from, to) {
  if (!state || !from || !to) return { ok: false, error: 'Falta el nombre' };
  if (from === to) return { ok: false, error: 'Es el mismo nombre' };
  if (!(state.players || []).includes(from)) return { ok: false, error: 'Ese jugador no existe' };
  if (nameInUse(state, to)) return { ok: false, error: 'Ya existe un jugador con ese nombre' };

  state.players = swap(state.players, from, to);
  if (Array.isArray(state.activePlayers)) state.activePlayers = swap(state.activePlayers, from, to);
  state.games = (state.games || []).map(g => renameInGame(g, from, to));
  state.archive = (state.archive || []).map(t => ({
    ...t,
    players: swap(t.players, from, to),
    games: (t.games || []).map(g => renameInGame(g, from, to)),
  }));

  if (state.playerPhotos && state.playerPhotos[from]) {
    state.playerPhotos = { ...state.playerPhotos, [to]: state.playerPhotos[from] };
    delete state.playerPhotos[from];
  }
  const kf = encodeKey(from), kt = encodeKey(to);
  if (state.quotes && state.quotes[kf] !== undefined) {
    state.quotes = { ...state.quotes, [kt]: state.quotes[kf] };
    delete state.quotes[kf];
  }
  return { ok: true };
}
