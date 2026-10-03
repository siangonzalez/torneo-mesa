import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renamePlayer, nameInUse } from '../js/players.js';
import { computeScores } from '../js/scoring.js';
import { encodeKey } from '../js/sync.js';

function sample() {
  return {
    players: ['Nico', 'Sian', 'Biku'],
    activePlayers: ['Nico', 'Sian'],
    games: [
      { _key: 'k1', name: 'Catan', positions: ['Nico', 'Sian'], participants: ['Nico', 'Sian', 'Biku'], date: '2026-01-01' },
      { _key: 'k2', name: 'Codenames', positions: ['Sian', 'Biku', 'Nico'], participants: ['Sian', 'Biku', 'Nico'], teams: [['Sian', 'Biku'], ['Nico']] },
    ],
    archive: [{ _key: 'a1', name: 'T1', players: ['Nico', 'Sian'], games: [{ name: 'Uno', positions: ['Nico'], participants: ['Nico', 'Sian'] }] }],
    playerPhotos: { Nico: 'data:img', Sian: 'data:s' },
    quotes: { [encodeKey('Nico')]: ['The lord of the rules'], Sian: ['x'] },
  };
}

test('renombra en jugadores, partidas, equipos, archivo, fotos y frases', () => {
  const s = sample();
  const before = computeScores(s.games, { players: s.players }).find(p => p.name === 'Nico').pts;
  const r = renamePlayer(s, 'Nico', 'Nicolás');
  assert.equal(r.ok, true);
  assert.deepEqual(s.players, ['Nicolás', 'Sian', 'Biku']);
  assert.deepEqual(s.activePlayers, ['Nicolás', 'Sian']);
  assert.deepEqual(s.games[0].positions, ['Nicolás', 'Sian']);
  assert.deepEqual(s.games[0].participants, ['Nicolás', 'Sian', 'Biku']);
  assert.deepEqual(s.games[1].teams, [['Sian', 'Biku'], ['Nicolás']]);
  assert.equal(s.games[0]._key, 'k1');
  assert.deepEqual(s.archive[0].players, ['Nicolás', 'Sian']);
  assert.deepEqual(s.archive[0].games[0].participants, ['Nicolás', 'Sian']);
  assert.equal(s.archive[0]._key, 'a1');
  assert.equal(s.playerPhotos['Nicolás'], 'data:img');
  assert.equal(s.playerPhotos.Nico, undefined);
  assert.deepEqual(s.quotes[encodeKey('Nicolás')], ['The lord of the rules']);
  assert.equal(s.quotes.Nico, undefined);
  assert.equal(nameInUse(s, 'Nico'), false);
  // conserva sus puntos
  assert.equal(computeScores(s.games, { players: s.players }).find(p => p.name === 'Nicolás').pts, before);
});

test('codifica la clave de frases (puntos y tildes)', () => {
  const s = { players: ['A'], quotes: { A: ['hola'] } };
  renamePlayer(s, 'A', 'A.B');
  assert.deepEqual(s.quotes[encodeKey('A.B')], ['hola']);
  assert.equal(s.quotes.A, undefined);
});

test('no permite nombres que ya existen, aunque solo estén en el archivo', () => {
  const s = sample();
  assert.equal(renamePlayer(s, 'Nico', 'Sian').ok, false);
  s.archive[0].players.push('Viejo');
  assert.equal(renamePlayer(s, 'Nico', 'Viejo').ok, false);
  assert.equal(renamePlayer(s, 'Nadie', 'Otro').ok, false);
  assert.equal(renamePlayer(s, 'Nico', 'Nico').ok, false);
  assert.deepEqual(s.players, ['Nico', 'Sian', 'Biku']);
});

test('funciona sin fotos, frases ni archivo', () => {
  const s = { players: ['A', 'B'], games: [] };
  assert.equal(renamePlayer(s, 'A', 'C').ok, true);
  assert.deepEqual(s.players, ['C', 'B']);
});
