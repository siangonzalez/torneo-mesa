// ==================== SINCRONIZACIÓN CON FIREBASE ====================
// Módulo puro (sin Firebase ni DOM) que decide QUÉ escribir; app.js hace la escritura.
//
// Antes cada guardado reemplazaba todo el torneo (set de torneo_v2 completo, fotos incluidas):
// si dos personas registraban a la vez, la última borraba lo de la otra, y cada partida
// reenviaba todas las fotos. Ahora:
//   - Se escriben solo las rutas que cambiaron, en una sola actualización atómica (update).
//   - Partidas y torneos archivados se guardan con una clave única por elemento (como las de
//     push), así dos registros simultáneos nunca caen en la misma posición.
//   - Las fotos viven en otro nodo (torneo_photos), una entrada por jugador.
// Los datos viejos (listas guardadas como arreglo, fotos dentro de torneo_v2) se leen igual y
// se van migrando solos, sin un paso manual.

export const ROOT_PATH = 'torneo_v2';
export const PHOTOS_PATH = 'torneo_photos';
// Listas que se guardan elemento por elemento con clave única
export const KEYED_LISTS = ['games', 'archive'];

// Copia lista para Firebase: sin la propiedad interna _key y sin valores undefined
export function clean(v) {
  if (v === undefined) return null;
  return JSON.parse(JSON.stringify(v, (k, val) => (k === '_key' ? undefined : val)));
}

const isIndex = k => /^\d+$/.test(k);
const asArray = v => (Array.isArray(v) ? v : Object.values(v || {})).filter(x => x !== null && x !== undefined);

// Convierte una lista de Firebase (arreglo viejo u objeto con claves) en arreglo ordenado.
// Cada elemento lleva su clave en _key. Orden: primero las posiciones viejas 0,1,2…
// y después las claves nuevas, que ya vienen ordenadas por fecha de creación.
export function normalizeList(raw) {
  if (!raw) return [];
  const entries = Array.isArray(raw) ? raw.map((v, i) => [String(i), v]) : Object.entries(raw);
  return entries
    .filter(([, v]) => v !== null && v !== undefined)
    .sort(([a], [b]) => {
      const na = isIndex(a), nb = isIndex(b);
      if (na && nb) return Number(a) - Number(b);
      if (na) return -1;
      if (nb) return 1;
      return a < b ? -1 : a > b ? 1 : 0;
    })
    .map(([k, v]) => ({ ...v, _key: k }));
}

// Lo que llega de torneo_v2 → estado de la app. Las fotos viejas se devuelven aparte para migrarlas.
export function normalizeRemote(d) {
  const { playerPhotos, ...rest } = d || {};
  const state = { ...rest };
  KEYED_LISTS.forEach(name => { state[name] = normalizeList(rest[name]); });
  // Las partidas dentro de un torneo archivado se guardan como lista simple; Firebase puede
  // devolverla como arreglo (con huecos) o como objeto, así que se deja siempre como arreglo.
  state.archive.forEach(t => { t.games = asArray(t.games); });
  const legacyPhotos = playerPhotos && Object.keys(playerPhotos).length ? playerPhotos : null;
  return { state, legacyPhotos };
}

// Rutas a escribir para pasar de `prev` (lo último que tiene el servidor) a `next`.
// `newKey(lista)` genera claves únicas para elementos nuevos (en la app: push(ref).key) y
// se guarda en el elemento para que los siguientes guardados lo reconozcan.
export function computeUpdates(prev, next, newKey) {
  prev = prev || {};
  const up = {};
  const fields = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const f of fields) {
    if (f === 'playerPhotos') continue;
    if (KEYED_LISTS.includes(f)) { diffList(f, prev[f] || [], next[f] || [], newKey, up); continue; }
    const after = clean(next[f]);
    if (JSON.stringify(clean(prev[f])) !== JSON.stringify(after)) up[`${ROOT_PATH}/${f}`] = after;
  }
  return up;
}

function diffList(name, prevList, nextList, newKey, up) {
  const before = {};
  prevList.forEach(it => { if (it && it._key) before[it._key] = JSON.stringify(clean(it)); });
  const seen = new Set();
  nextList.forEach(it => {
    if (!it) return;
    if (!it._key) it._key = newKey(name);
    seen.add(it._key);
    const s = JSON.stringify(clean(it));
    if (before[it._key] !== s) up[`${ROOT_PATH}/${name}/${it._key}`] = clean(it);
  });
  Object.keys(before).forEach(k => { if (!seen.has(k)) up[`${ROOT_PATH}/${name}/${k}`] = null; });
}

// ---------- Fotos ----------
// Las claves de Firebase no admiten . $ # [ ] / — el nombre del jugador se codifica.
export function encodeKey(name) { return encodeURIComponent(name).replace(/\./g, '%2E'); }
export function decodeKey(key) { return decodeURIComponent(key); }

export function photosFromRemote(raw) {
  const out = {};
  Object.entries(raw || {}).forEach(([k, v]) => { if (typeof v === 'string') out[decodeKey(k)] = v; });
  return out;
}

export function computePhotoUpdates(prev, next) {
  prev = prev || {}; next = next || {};
  const up = {};
  new Set([...Object.keys(prev), ...Object.keys(next)]).forEach(name => {
    if (prev[name] !== next[name]) up[`${PHOTOS_PATH}/${encodeKey(name)}`] = next[name] || null;
  });
  return up;
}

// Mueve las fotos guardadas dentro de torneo_v2 al nodo nuevo y borra las viejas, en una sola
// escritura. Si un jugador ya tiene foto en el nodo nuevo, esa se respeta (es la más reciente).
export function photoMigrationUpdates(legacyPhotos, currentPhotos) {
  if (!legacyPhotos || !Object.keys(legacyPhotos).length) return {};
  const up = {};
  Object.entries(legacyPhotos).forEach(([name, data]) => {
    if (!(currentPhotos || {})[name] && typeof data === 'string') up[`${PHOTOS_PATH}/${encodeKey(name)}`] = data;
  });
  up[`${ROOT_PATH}/playerPhotos`] = null;
  return up;
}
