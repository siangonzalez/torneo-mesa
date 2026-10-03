// Pruebas de la capa de sincronización. Usa una base de datos falsa en memoria que aplica
// las escrituras igual que Firebase Realtime Database (update con varias rutas a la vez).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOT_PATH, PHOTOS_PATH, clean, normalizeList, normalizeRemote, computeUpdates,
  encodeKey, decodeKey, photosFromRemote, computePhotoUpdates, photoMigrationUpdates,
} from '../js/sync.js';

// ---- Base de datos falsa ----
// Firebase guarda todo como objetos con claves: un arreglo [a,b] queda como {"0":a,"1":b}
const toObj = v => (v && typeof v === 'object')
  ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null).map(([k, x]) => [k, toObj(x)]))
  : v;
function fakeDb(initial) {
  const data = toObj(JSON.parse(JSON.stringify(initial || {})));
  return {
    data,
    update(updates) {
      const paths = Object.keys(updates);
      // Firebase rechaza escribir una ruta y otra que la contiene en la misma actualización
      paths.forEach(a => paths.forEach(b => {
        if (a !== b && b.startsWith(a + '/')) throw new Error(`rutas en conflicto: ${a} y ${b}`);
      }));
      for (const [path, value] of Object.entries(updates)) {
        const parts = path.split('/');
        let node = data;
        for (const p of parts.slice(0, -1)) { if (node[p] == null || typeof node[p] !== 'object') node[p] = {}; node = node[p]; }
        const last = parts.at(-1);
        if (value === null) delete node[last]; else node[last] = toObj(JSON.parse(JSON.stringify(value)));
      }
    },
  };
}
let counter = 0;
const newKey = () => '-k' + String(++counter).padStart(6, '0'); // ordenadas como las de push
// Al leer, Firebase devuelve como arreglo los objetos cuyas claves son todas 0,1,2…
// (si más de la mitad de las posiciones existen), igual que snapshot.val()
const fromObj = v => {
  if (!v || typeof v !== 'object') return v;
  const keys = Object.keys(v);
  const out = Object.fromEntries(keys.map(k => [k, fromObj(v[k])]));
  if (keys.length && keys.every(k => /^\d+$/.test(k))) {
    const max = Math.max(...keys.map(Number));
    if (keys.length > (max + 1) / 2) { const arr = []; keys.forEach(k => { arr[Number(k)] = out[k]; }); return arr; }
  }
  return out;
};
const load = db => normalizeRemote(fromObj(db.data)[ROOT_PATH]).state;
const copy = v => JSON.parse(JSON.stringify(v));

test('lee listas viejas (arreglo) y nuevas (con claves) en el orden correcto', () => {
  const list = normalizeList({ '-k000002': { n: 'd' }, '1': { n: 'b' }, '0': { n: 'a' }, '-k000001': { n: 'c' }, '2': null });
  assert.deepEqual(list.map(x => x.n), ['a', 'b', 'c', 'd']);
  assert.deepEqual(list.map(x => x._key), ['0', '1', '-k000001', '-k000002']);
  assert.deepEqual(normalizeList([{ n: 'a' }, null, { n: 'c' }]).map(x => x._key), ['0', '2']);
  assert.deepEqual(normalizeList(undefined), []);
});

test('clean quita la clave interna y deja el resto igual', () => {
  assert.deepEqual(clean({ a: 1, _key: 'x', b: [{ _key: 'y', c: 2 }], _tournamentStarted: true }),
    { a: 1, b: [{ c: 2 }], _tournamentStarted: true });
  assert.equal(clean(undefined), null);
});

test('sin cambios no se escribe nada', () => {
  const s = load(fakeDb({ [ROOT_PATH]: { name: 'T', games: [{ name: 'UNO' }] } }));
  assert.deepEqual(computeUpdates(copy(s), s, newKey), {});
});

test('registrar una partida escribe solo esa partida', () => {
  const db = fakeDb({ [ROOT_PATH]: { name: 'T', players: ['A', 'B'], games: [{ name: 'UNO', positions: ['A'] }] } });
  const prev = load(db), s = copy(prev);
  s.games.push({ name: 'Catan', positions: ['B', 'A'] });
  const up = computeUpdates(prev, s, newKey);
  assert.equal(Object.keys(up).length, 1);
  const [path] = Object.keys(up);
  assert.match(path, new RegExp(`^${ROOT_PATH}/games/-k`));
  assert.equal(up[path]._key, undefined);
  assert.ok(s.games[1]._key, 'la partida nueva recuerda su clave');
  db.update(up);
  assert.deepEqual(load(db).games.map(g => g.name), ['UNO', 'Catan']);
});

test('borrar una partida y cambiar ajustes escribe solo eso', () => {
  const db = fakeDb({ [ROOT_PATH]: { name: 'T', system: 'rivals', games: [{ name: 'UNO' }, { name: 'Hive' }, { name: 'Dixit' }] } });
  const prev = load(db), s = copy(prev);
  s.games.splice(1, 1); s.name = 'Nuevo'; s.bestN = 3;
  const up = computeUpdates(prev, s, newKey);
  assert.deepEqual(up, { [`${ROOT_PATH}/games/1`]: null, [`${ROOT_PATH}/name`]: 'Nuevo', [`${ROOT_PATH}/bestN`]: 3 });
  db.update(up);
  assert.deepEqual(load(db).games.map(g => g.name), ['UNO', 'Dixit']);
});

test('cerrar un torneo: archiva y vacía las partidas en una sola escritura', () => {
  const db = fakeDb({ [ROOT_PATH]: { name: 'T', _tournamentStarted: true, games: [{ name: 'UNO' }, { name: 'Hive' }], archive: [{ name: 'Viejo', games: [] }] } });
  const prev = load(db), s = copy(prev);
  s.archive.push({ name: s.name, games: s.games, system: 'rivals' });
  s.games = []; s._tournamentStarted = false; s.activePlayers = null;
  const up = computeUpdates(prev, s, newKey);
  db.update(up); // no debe haber rutas en conflicto
  const after = load(db);
  assert.equal(after.games.length, 0);
  assert.deepEqual(after.archive.map(t => t.name), ['Viejo', 'T']);
  assert.deepEqual(after.archive[1].games.map(g => g.name), ['UNO', 'Hive']);
  assert.ok(!JSON.stringify(db.data).includes('_key'), 'no se guardan claves internas');
  assert.equal(after._tournamentStarted, false);
});

test('dos celulares registran a la vez y no se pierde ninguna partida', () => {
  const db = fakeDb({ [ROOT_PATH]: { name: 'T', players: ['A', 'B', 'C'], games: [{ name: 'UNO', positions: ['A'] }] } });
  const base = load(db);
  const phoneA = copy(base), phoneB = copy(base); // ambos vieron el mismo estado
  phoneA.games.push({ name: 'Catan', positions: ['B'] });
  phoneB.games.push({ name: 'Hive', positions: ['C'] });
  db.update(computeUpdates(base, phoneA, newKey));
  db.update(computeUpdates(base, phoneB, newKey));
  assert.deepEqual(load(db).games.map(g => g.name).sort(), ['Catan', 'Hive', 'UNO']);
});

test('dos celulares: uno registra y el otro cambia el nombre, se conservan ambos cambios', () => {
  const db = fakeDb({ [ROOT_PATH]: { name: 'T', games: [] } });
  const base = load(db);
  const phoneA = copy(base), phoneB = copy(base);
  phoneA.games.push({ name: 'Catan' });
  phoneB.name = 'Juegolimpiadas';
  db.update(computeUpdates(base, phoneA, newKey));
  db.update(computeUpdates(base, phoneB, newKey));
  const s = load(db);
  assert.equal(s.name, 'Juegolimpiadas');
  assert.deepEqual(s.games.map(g => g.name), ['Catan']);
});

test('nombres de jugador como clave de foto', () => {
  for (const n of ["D'Angelo", 'Juan.Pablo', 'A/B', 'Ñoño #1', 'x$[y]']) {
    const k = encodeKey(n);
    assert.ok(!/[.$#\[\]\/]/.test(k), `clave inválida para ${n}: ${k}`);
    assert.equal(decodeKey(k), n);
  }
});

test('fotos: solo se escribe la del jugador que cambió', () => {
  const up = computePhotoUpdates({ Ana: 'a1', Beto: 'b1' }, { Ana: 'a2', Beto: 'b1', 'Juan.P': 'j1' });
  assert.deepEqual(up, { [`${PHOTOS_PATH}/Ana`]: 'a2', [`${PHOTOS_PATH}/Juan%2EP`]: 'j1' });
  assert.deepEqual(computePhotoUpdates({ Ana: 'a1' }, {}), { [`${PHOTOS_PATH}/Ana`]: null });
});

test('las fotos nunca viajan dentro del torneo', () => {
  const up = computeUpdates({ name: 'T' }, { name: 'T', playerPhotos: { Ana: 'x' } }, newKey);
  assert.deepEqual(up, {});
});

test('migración de fotos viejas al nodo nuevo', () => {
  const db = fakeDb({ [ROOT_PATH]: { name: 'T', playerPhotos: { Ana: 'vieja', 'Juan.P': 'jp' } }, [PHOTOS_PATH]: { Ana: 'nueva' } });
  const { legacyPhotos } = normalizeRemote(db.data[ROOT_PATH]);
  db.update(photoMigrationUpdates(legacyPhotos, photosFromRemote(db.data[PHOTOS_PATH])));
  assert.equal(db.data[ROOT_PATH].playerPhotos, undefined);
  assert.deepEqual(photosFromRemote(db.data[PHOTOS_PATH]), { Ana: 'nueva', 'Juan.P': 'jp' });
  assert.deepEqual(photoMigrationUpdates(null, {}), {});
});
