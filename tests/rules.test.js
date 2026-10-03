// Pruebas de database.rules.json con targaryen (intérprete del lenguaje de reglas de Realtime
// Database). Requiere `npm install` (dependencia de desarrollo); si no está instalado se omite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
let targaryen = null;
try { targaryen = require('targaryen'); } catch {}
const rules = JSON.parse(readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8'));

test('reglas de acceso de Firebase', { skip: !targaryen && 'falta instalar targaryen (npm install)' }, () => {
const base = {
  admins: { 'sian,gonzalez@gmail,com': true },
  allowed: { 'sian,gonzalez@gmail,com': true, 'ana,maria@gmail,com': true },
  torneo_v2: { name: 'T', games: { a: { name: 'UNO' } } },
  torneo_photos: { Ana: 'data:x' },
  torneo: { old: 1 },
};
const u = (uid, email, verified = true) => ({ uid, provider: 'google', token: { email, email_verified: verified } });
const NADIE = null, PEPE = u('u-x', 'pepe@gmail.com'), ANA_SV = u('u-v', 'ana.maria@gmail.com', false),
      ANA = u('u-ana', 'ana.maria@gmail.com'), SIAN = u('u-sian', 'sian.gonzalez@gmail.com');
const out = []; let ok = 0;
function db(data = base) { return targaryen.database(rules, data); }
function expect(label, res, allowed) {
  const good = res.allowed === allowed; if (good) ok++;
  out.push((good ? '✓ ' : '✗ ') + label + (good ? '' : `  (esperado ${allowed ? 'permitido' : 'negado'})\n${res.info}`));
}
const R = (who, path, allowed, label) => expect(label || `${who ? who.token.email : 'sin sesión'} ${allowed ? 'lee' : 'NO lee'} ${path}`, db().as(who).read(path), allowed);
const W = (who, path, val, allowed, label) => expect(label, db().as(who).write(path, val), allowed);
const U = (who, path, patch, allowed, label) => expect(label, db().as(who).update(path, patch), allowed);

for (const p of ['/', 'torneo_v2', 'torneo_photos', 'torneo', 'allowed', 'requests', 'admins']) R(NADIE, p, false);
W(NADIE, 'torneo_v2/name', 'X', false, 'sin sesión no escribe torneo_v2');

R(PEPE, 'torneo_v2', false); W(PEPE, 'torneo_v2/name', 'X', false, 'no aprobado no escribe torneo_v2');
R(PEPE, 'allowed', false); R(PEPE, 'allowed/pepe@gmail,com', true, 'no aprobado ve si él mismo está autorizado');
W(PEPE, 'allowed/pepe@gmail,com', true, false, 'no aprobado no se autoriza solo');
W(PEPE, 'admins/pepe@gmail,com', true, false, 'no aprobado no se hace admin');
W(PEPE, 'requests/u-x', { email: 'pepe@gmail.com', name: 'Pepe', at: 1 }, true, 'no aprobado envía su solicitud');
W(PEPE, 'requests/u-otro', { email: 'pepe@gmail.com', at: 1 }, false, 'no aprobado no envía solicitud por otro');
W(PEPE, 'requests/u-x', { email: 'sian.gonzalez@gmail.com', at: 1 }, false, 'no aprobado no falsea el correo');
R(PEPE, 'requests', false);

R(ANA_SV, 'torneo_v2', false, 'correo sin verificar NO lee torneo_v2');

R(ANA, 'torneo_v2', true);
U(ANA, '/', { 'torneo_v2/games/b': { name: 'Catan' } }, true, 'aprobado registra una partida');
W(ANA, 'torneo_photos/Ana', 'data:y', true, 'aprobado cambia una foto');
R(ANA, 'torneo', true); W(ANA, 'torneo/old', 2, false, 'aprobado no modifica datos v1');
W(ANA, 'allowed/pepe@gmail,com', true, false, 'aprobado no gestiona accesos');
R(ANA, 'requests', false); W(ANA, 'otra_cosa', 1, false, 'aprobado no escribe fuera de sus nodos');
R(ANA, 'admins/ana,maria@gmail,com', true, 'aprobado lee su propia marca de admin');
R(ANA, 'admins/sian,gonzalez@gmail,com', false, 'aprobado no lee la marca de admin de otro');

R(SIAN, 'allowed', true); R(SIAN, 'requests', true);
U(SIAN, '/', { 'allowed/pepe@gmail,com': true, 'requests/u-x': null }, true, 'admin aprueba y borra la solicitud a la vez');
expect('después de aprobado, Pepe lee torneo_v2', targaryen.database(rules, { ...base, allowed: { ...base.allowed, 'pepe@gmail,com': true } }).as(PEPE).read('torneo_v2'), true);
W(SIAN, 'allowed/ana,maria@gmail,com', null, true, 'admin quita el acceso');
W(SIAN, 'allowed/x@y,com', 'si', false, 'el valor de autorizado debe ser booleano');
W(SIAN, 'admins/ana,maria@gmail,com', true, false, 'admin no crea admins desde la app');
  assert.deepEqual(out.filter(l => l.startsWith('✗')), []);
  assert.equal(ok, 36);
});
