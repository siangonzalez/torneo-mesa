import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normName, cleanQuote, seedQuotesFor, statFacts, pickSplash, restrictPool, SEED_QUOTES } from '../js/quotes.js';

test('las frases iniciales se asocian sin importar mayúsculas ni tildes', () => {
  const s = seedQuotesFor(['DANIEL', 'Biku', 'Sian', 'Nicolás', 'Ana']);
  assert.deepEqual(Object.keys(s).sort(), ['Biku', 'DANIEL', 'Nicolás', 'Sian']);
  assert.deepEqual(s['Nicolás'], ['The lord of the rules']);
  assert.equal(s.Sian[0], 'El único veneno\nque viene con encanto.');
  assert.equal(normName('  NICOLÁS '), 'nicolas');
  s.Biku.push('otra');
  assert.deepEqual(SEED_QUOTES.biku, ['NOSCU'], 'no se modifican las semillas');
});

test('limpieza de frases conserva saltos de línea y quita lo peligroso', () => {
  assert.equal(cleanQuote('  Hola <b>mundo</b>  '), 'Hola bmundo/b');
  assert.equal(cleanQuote('línea 1 \n\n\n\n línea 2'), 'línea 1\n\nlínea 2');
  assert.equal(cleanQuote('"No hay con quién."'), '"No hay con quién."');
  assert.equal(cleanQuote('x'.repeat(300)).length, 140);
});

test('datos curiosos a partir de estadísticas', () => {
  const facts = statFacts({
    standings: [{ name: 'Ana', pts: 300 }, { name: 'Beto', pts: 200 }],
    streaks: { Ana: 3 },
    kings: { Catan: { Ana: 2, Beto: 1 }, UNO: { Ana: 1, Beto: 1 } },
    titles: { Beto: 2 },
    lastChampion: { name: 'Beto', tournament: 'Juegolimpiadas' },
  }).map(f => f.text);
  assert.ok(facts.includes('Ana lleva 3 victorias seguidas'));
  assert.ok(facts.includes('Ana va primero con 300 pts'));
  assert.ok(facts.includes('Ana es el rey de Catan: 2 victorias'));
  assert.ok(!facts.some(t => t.includes('UNO')), 'empates en el rey no generan dato');
  assert.ok(facts.includes('Beto tiene 2 títulos'));
  assert.ok(facts.includes('Beto ganó «Juegolimpiadas»'));
  assert.ok(!statFacts({ standings: [{ name: 'A', pts: 100 }, { name: 'B', pts: 100 }] }).length, 'empate en el primer puesto no genera dato');
});

test('elige frase o dato, y nada si no hay', () => {
  const quotes = { Ana: ['Hola'] }, facts = [{ name: 'Beto', icon: '🏆', text: 'dato' }];
  assert.equal(pickSplash({ quotes, facts, rng: () => 0.1 }).type, 'quote');
  assert.equal(pickSplash({ quotes, facts, rng: () => 0.9 }).type, 'fact');
  assert.equal(pickSplash({ quotes: {}, facts, rng: () => 0.1 }).type, 'fact');
  assert.equal(pickSplash({ quotes, facts: [], rng: () => 0.9 }).text, 'Hola');
  assert.equal(pickSplash({}), null);
});

test('solo frases y datos de los jugadores permitidos', () => {
  const pool = { quotes: { Ana: ['a'], Beto: ['b'] }, facts: [{ name: 'Ana', text: 'x' }, { name: 'Caro', text: 'y' }] };
  const r = restrictPool(pool, ['Ana']);
  assert.deepEqual(Object.keys(r.quotes), ['Ana']);
  assert.deepEqual(r.facts.map(f => f.name), ['Ana']);
  assert.deepEqual(restrictPool(pool, null), pool);
  assert.equal(pickSplash({ ...restrictPool(pool, ['Caro']), rng: () => 0.1 }).text, 'y');
});
