// ==================== JUEGOS DISPONIBLES EN LA MESA ====================
// Cada jugador marca en su perfil los juegos que tiene (torneo_v2/collections, clave = nombre
// codificado). Al armar el torneo se elige el anfitrión: hay disponibles sus juegos más los que
// otros jugadores digan que trajeron. ¿Qué jugamos? sugiere solo esos.
// Módulo puro (sin Firebase ni DOM), se prueba en tests/table.test.js.

import { encodeKey } from './sync.js';

const uniq = list => [...new Set(list)];

// Juegos de un jugador, solo los que siguen en el catálogo y en el orden del catálogo.
export function collectionOf(collections, name, catalog) {
  const raw = (collections || {})[encodeKey(name)];
  const own = new Set(Array.isArray(raw) ? raw : Object.values(raw || {}));
  return (catalog || []).map(g => g.name).filter(n => own.has(n));
}

// Opciones para armar la mesa: juegos del anfitrión y, por cada otro jugador presente, los
// juegos que tiene y el anfitrión no (los que podría traer).
export function tableOptions({ collections, catalog, host, players }) {
  const hostGames = host ? collectionOf(collections, host, catalog) : [];
  const inHost = new Set(hostGames);
  const extras = (players || [])
    .filter(p => p !== host)
    .map(p => ({ owner: p, games: collectionOf(collections, p, catalog).filter(n => !inHost.has(n)) }))
    .filter(x => x.games.length);
  return { hostGames, extras };
}

// Lista final de juegos disponibles, o null si no hay restricción (sin anfitrión, o nadie
// marcó juegos): en ese caso se sugieren todos los del catálogo.
export function tableGames({ collections, catalog, host, brought }) {
  if (!host) return null;
  const valid = new Set((catalog || []).map(g => g.name));
  const list = uniq([...collectionOf(collections, host, catalog), ...(brought || []).filter(n => valid.has(n))]);
  return list.length ? list : null;
}

// Quién tiene cada juego entre los jugadores dados: {juego: [dueños]}
export function owners(collections, players, catalog) {
  const out = {};
  (players || []).forEach(p => collectionOf(collections, p, catalog).forEach(n => { (out[n] = out[n] || []).push(p); }));
  return out;
}
