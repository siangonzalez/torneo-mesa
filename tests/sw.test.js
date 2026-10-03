// Comprueba que el service worker guarda exactamente la versión que usa la app.
// Si alguien sube la versión en index.html y olvida sw.js (o al revés), esta prueba falla.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const sw = read('sw.js');
const swVersion = sw.match(/APP_VERSION = '([\d.]+)'/)[1];

test('index.html y app.js usan la misma versión que sw.js', () => {
  const versions = new Set([
    ...[...read('index.html').matchAll(/\?v=([\d.]+)/g)].map(m => m[1]),
    ...[...read('js/app.js').matchAll(/\.js\?v=([\d.]+)"/g)].map(m => m[1]),
  ]);
  assert.deepEqual([...versions], [swVersion]);
});

test('todos los archivos que guarda el service worker existen', () => {
  const list = sw.match(/const SHELL_FILES = \[([\s\S]*?)\];/)[1];
  const files = [...list.matchAll(/['`]([^'`]+)['`]/g)].map(m => m[1].replace('${V}', '').split('?')[0]);
  assert.ok(files.length > 5);
  for (const f of files) {
    if (f === './') continue;
    assert.ok(existsSync(new URL('../' + f, import.meta.url)), `falta ${f}`);
  }
});

test('todos los módulos que importa app.js están en la lista del service worker', () => {
  const imports = [...read('js/app.js').matchAll(/from"\.\/([a-z]+\.js)\?v=/g)].map(m => m[1]);
  for (const m of imports) assert.ok(sw.includes(`js/${m}\${V}`), `sw.js no guarda js/${m}`);
});
