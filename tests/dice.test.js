import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dieSVG, rollValues, dieBadge, PIPS, DIE_STYLES } from '../js/dice.js';

test('el d6 dibuja tantos puntos como su valor', () => {
  for (let v = 1; v <= 6; v++) {
    assert.equal((dieSVG(6, v).match(/<circle/g) || []).length, v);
    assert.equal(PIPS[v].length, v);
  }
});

test('los demás dados muestran el número y su forma', () => {
  for (const f of [4, 8, 10, 12, 20, 100]) {
    const svg = dieSVG(f, f);
    assert.match(svg, new RegExp(`>${f}</text>`));
    assert.ok(svg.includes(DIE_STYLES[f].fill), `color del d${f}`);
    assert.equal((svg.match(/<circle/g) || []).length, 0);
  }
});

test('el SVG no deja pasar texto que no sea un número', () => {
  assert.ok(!dieSVG(8, '<b>x</b>').includes('<b>'));
});

test('las tiradas quedan siempre entre 1 y las caras', () => {
  assert.deepEqual(rollValues(3, 6, () => 0), [1, 1, 1]);
  assert.deepEqual(rollValues(2, 20, () => 0.9999), [20, 20]);
  for (const v of rollValues(500, 12)) assert.ok(v >= 1 && v <= 12);
});

test('etiquetas especiales', () => {
  assert.equal(dieBadge(20, 20).label, '¡CRÍTICO!');
  assert.equal(dieBadge(20, 1).label, '¡PIFIA!');
  assert.equal(dieBadge(6, 6).cls, 'die-max');
  assert.equal(dieBadge(6, 3), null);
  assert.equal(dieBadge(20, 19), null);
});
