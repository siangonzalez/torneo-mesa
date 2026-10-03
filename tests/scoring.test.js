// Pruebas del sistema de puntaje. Correr con: npm test  (o: node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  scoreGame, computeScores, computeDisplayRanks, getTiedWith, playersInGames,
  getPoints, normSystem, DEFAULT_BEST_N, gameWinners,
} from '../js/scoring.js';

const pts = (g, system = 'rivals') =>
  Object.fromEntries(Object.entries(scoreGame(g, system)).map(([p, r]) => [p, r.pts]));
const full = names => ({ positions: names, participants: names });

test('rivales vencidos: valores por puesto según tamaño de la mesa', () => {
  assert.deepEqual(getPoints(2, 'rivals'), [150, 50]);
  assert.deepEqual(getPoints(3, 'rivals'), [167, 100, 33]);
  assert.deepEqual(getPoints(4, 'rivals'), [175, 125, 75, 25]);
  assert.deepEqual(getPoints(6, 'rivals'), [183, 150, 117, 83, 50, 17]);
});

test('rivales vencidos: cada mesa reparte en promedio 100 por jugador', () => {
  for (let n = 2; n <= 10; n++) {
    const names = Array.from({ length: n }, (_, i) => 'J' + i);
    const total = Object.values(pts(full(names))).reduce((s, v) => s + v, 0);
    assert.ok(Math.abs(total - 100 * n) <= n, `mesa de ${n}: total ${total}`);
  }
});

test('ganarle a más gente vale más', () => {
  const two = pts(full(['A', 'B'])).A;
  const six = pts(full(['A', 'B', 'C', 'D', 'E', 'F'])).A;
  assert.ok(six > two);
});

test('solo se registra al ganador: el resto queda empatado al final', () => {
  const r = scoreGame({ positions: ['A'], participants: ['A', 'B', 'C', 'D', 'E'] }, 'rivals');
  assert.equal(r.A.pts, 180);
  for (const p of ['B', 'C', 'D', 'E']) {
    assert.equal(r[p].pts, 80);
    assert.equal(r[p].ranked, false);
  }
});

test('equipos: cada equipo cuenta como un jugador y sus miembros reciben lo mismo', () => {
  const r = scoreGame({ positions: ['A', 'B', 'C', 'D'], teams: [['A', 'B'], ['C', 'D']] }, 'rivals');
  assert.deepEqual([r.A.pts, r.B.pts, r.C.pts, r.D.pts], [150, 150, 50, 50]);
  assert.equal(r.B.rank, 0);
  assert.equal(r.C.rank, 1);
});

test('multiplicador por dificultad', () => {
  assert.equal(pts({ ...full(['A', 'B']), complexity: 'Media' }).A, 173);
  assert.equal(pts({ ...full(['A', 'B']), complexity: 'Alta' }).A, 195);
  assert.equal(pts({ ...full(['A', 'B']), complexity: 'Desconocida' }).A, 150);
});

test('"balanced" y sistema vacío se tratan como rivales vencidos', () => {
  assert.equal(normSystem('balanced'), 'rivals');
  assert.equal(normSystem(undefined), 'rivals');
  assert.deepEqual(pts(full(['A', 'B', 'C']), 'balanced'), pts(full(['A', 'B', 'C']), 'rivals'));
});

test('sistemas antiguos se mantienen para torneos archivados', () => {
  assert.deepEqual(getPoints(4, 'proportional'), [100, 75, 50, 25]);
  assert.deepEqual(getPoints(4, 'flat'), [100, 70, 50, 35]);
  assert.deepEqual(getPoints(4, 'fibonacci'), [100, 60, 40, 20]);
  const r = pts({ positions: ['A'], participants: ['A', 'B'] }, 'proportional');
  assert.deepEqual(r, { A: 100, B: 25 });
});

test('partidas viejas sin lista de participantes usan solo el podio', () => {
  assert.deepEqual(Object.keys(scoreGame({ positions: ['A', 'B'] }, 'rivals')), ['A', 'B']);
});

test('mejores N: los puntos solo suman los mejores resultados, el resto cuenta todo', () => {
  const games = [
    full(['A', 'B']), full(['A', 'B']), full(['B', 'A']), // A: 150,150,50
  ];
  const [top] = computeScores(games, { system: 'rivals', bestN: 2, players: ['A', 'B'] });
  assert.equal(top.name, 'A');
  assert.equal(top.pts, 300);
  assert.equal(top.counted, 2);
  assert.equal(top.gamesPlayed, 3);
  assert.equal(top.wins, 2);
  const all = computeScores(games, { system: 'rivals', bestN: 0, players: ['A', 'B'] });
  assert.equal(all.find(p => p.name === 'A').pts, 350);
});

test('valor por defecto de mejores N', () => {
  assert.equal(DEFAULT_BEST_N, 5);
});

test('solo aparecen los jugadores pedidos, aunque tengan 0', () => {
  const sc = computeScores([full(['A', 'X'])], { system: 'rivals', players: ['A', 'Z'] });
  assert.deepEqual(sc.map(p => p.name), ['A', 'Z']);
  assert.equal(sc[1].pts, 0);
  assert.equal(sc[1].gamesPlayed, 0);
});

test('desempate: puntos, luego victorias, luego podios, luego alfabético', () => {
  const sc = computeScores([full(['B', 'A']), full(['A', 'B'])], { system: 'rivals', players: ['B', 'A'] });
  assert.deepEqual(sc.map(p => p.name), ['A', 'B']); // empate total → alfabético
  assert.deepEqual(computeDisplayRanks(sc), [1, 1]);
  assert.deepEqual(getTiedWith(sc, sc[0]), ['B']);
});

test('playersInGames incluye equipos y jugadores sin podio', () => {
  const names = playersInGames([
    { positions: ['A'], participants: ['A', 'B'] },
    { positions: ['C', 'D'], teams: [['C'], ['D']] },
  ]).sort();
  assert.deepEqual(names, ['A', 'B', 'C', 'D']);
});

test('regresión: torneo simulado de 7 partidas', () => {
  const games = [
    full(['Ana', 'Beto', 'Caro', 'Dani']),
    { positions: ['Beto'], participants: ['Beto', 'Ana', 'Caro', 'Dani', 'Eli'] },
    full(['Caro', 'Dani']),
    full(['Dani', 'Ana', 'Eli', 'Beto', 'Caro']),
    full(['Ana', 'Eli', 'Beto']),
    { positions: ['Eli'], participants: ['Eli', 'Ana', 'Beto', 'Caro', 'Dani'] },
    { positions: ['Ana', 'Beto', 'Caro', 'Dani'], teams: [['Ana', 'Beto'], ['Caro', 'Dani']] },
  ];
  const sc = computeScores(games, { system: 'rivals', bestN: 5, players: ['Ana', 'Beto', 'Caro', 'Dani', 'Eli'] });
  assert.deepEqual(sc.map(p => [p.name, p.pts]), [
    ['Ana', 712], ['Beto', 595], ['Eli', 460], ['Dani', 440], ['Caro', 435],
  ]);
});

test('ganadores: individual, solo ganador registrado y equipos', () => {
  assert.deepEqual(gameWinners(full(['A', 'B', 'C'])), ['A']);
  assert.deepEqual(gameWinners({ positions: ['B'], participants: ['B', 'A'] }), ['B']);
  assert.deepEqual(gameWinners({ positions: ['A', 'B', 'C', 'D'], teams: [['C', 'D'], ['A', 'B']] }).sort(), ['C', 'D']);
  assert.deepEqual(gameWinners({ positions: [] }), []);
});
