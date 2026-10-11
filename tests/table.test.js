import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectionOf, tableOptions, tableGames, owners } from '../js/table.js';
import { encodeKey } from '../js/sync.js';

const catalog = [{ name: 'Catan' }, { name: 'UNO' }, { name: 'Betrayal' }, { name: 'Codenames' }];
const collections = {
  [encodeKey('Sian')]: ['UNO', 'Catan', 'Borrado'],
  [encodeKey('Biku')]: { 0: 'Catan', 1: 'Betrayal' }, // Firebase puede devolver objeto
  [encodeKey('Nicolás')]: ['Codenames'],
};

test('collectionOf: solo juegos del catálogo, en su orden, y acepta objeto', () => {
  assert.deepEqual(collectionOf(collections, 'Sian', catalog), ['Catan', 'UNO']);
  assert.deepEqual(collectionOf(collections, 'Biku', catalog), ['Catan', 'Betrayal']);
  assert.deepEqual(collectionOf(collections, 'Ana', catalog), []);
  assert.deepEqual(collectionOf(undefined, 'Ana', catalog), []);
});

test('tableOptions: juegos del anfitrión y lo que otros podrían traer', () => {
  const o = tableOptions({ collections, catalog, host: 'Sian', players: ['Sian', 'Biku', 'Nicolás', 'Ana'] });
  assert.deepEqual(o.hostGames, ['Catan', 'UNO']);
  assert.deepEqual(o.extras, [{ owner: 'Biku', games: ['Betrayal'] }, { owner: 'Nicolás', games: ['Codenames'] }]);
  const none = tableOptions({ collections, catalog, host: null, players: ['Sian'] });
  assert.deepEqual(none.hostGames, []);
});

test('tableGames: anfitrión + traídos; null si no hay restricción', () => {
  assert.deepEqual(tableGames({ collections, catalog, host: 'Sian', brought: ['Betrayal', 'UNO', 'NoExiste'] }), ['Catan', 'UNO', 'Betrayal']);
  assert.equal(tableGames({ collections, catalog, host: null, brought: ['UNO'] }), null);
  assert.equal(tableGames({ collections, catalog, host: 'Ana', brought: [] }), null);
  assert.deepEqual(tableGames({ collections, catalog, host: 'Ana', brought: ['UNO'] }), ['UNO']);
});

test('owners: quién tiene cada juego', () => {
  assert.deepEqual(owners(collections, ['Sian', 'Biku'], catalog), { Catan: ['Sian', 'Biku'], UNO: ['Sian'], Betrayal: ['Biku'] });
});
