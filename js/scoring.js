// ==================== SISTEMA DE PUNTAJE ====================
// Módulo puro: no lee ni escribe el estado de la app ni el DOM, así se puede probar aislado
// (ver tests/scoring.test.js). Todo lo que necesita llega por parámetros.
//
// 'rivals' (Rivales vencidos, el recomendado): por cada partida ganas 2 por cada jugador que
// quedó debajo de ti y 1 por cada empatado contigo (tú incluido), dividido entre los jugadores
// de la mesa, ×100. Cada partida reparte en promedio 100 pts por jugador sin importar si eran
// 2 o 6, y ganarle a más gente vale más. Quienes jugaron sin podio quedan empatados al final.
// 'balanced' existió solo un día como versión anterior: se trata como 'rivals'.
// Los demás sistemas se conservan para torneos archivados que se jugaron con ellos.

export const DEFAULT_BEST_N = 5;

// En los sistemas antiguos, quien jugó sin podio recibe el 25% de lo que ganó el 1° en esa partida.
export const PARTICIPATION_RATIO = 0.25;

// Multiplicador de puntos según dificultad del juego (nivel "suave"). La dificultad se guarda
// en cada partida al registrarla, así editar el catálogo después no cambia puntos ya jugados.
export const COMPLEXITY_MULTIPLIERS = { Baja: 1.0, Media: 1.15, Alta: 1.3 };

export function normSystem(s) {
  return (!s || s === 'balanced') ? 'rivals' : s;
}

export function getComplexityMultiplier(complexity) {
  return COMPLEXITY_MULTIPLIERS[complexity] || 1.0;
}

export function rivalsPoints(n) {
  return Array.from({ length: n }, (_, i) => (2 * (n - 1 - i) + 1) / n * 100);
}

// Puntos base (sin multiplicador) para n puestos ordenados.
export function getPoints(n, system) {
  system = normSystem(system);
  if (system === 'rivals') return rivalsPoints(n).map(v => Math.round(v));
  if (system === 'fibonacci') {
    const f = [1, 2, 3, 5, 8, 13, 21];
    const b = f.slice(0, n).reverse();
    const m = b[0];
    return b.map(v => Math.round(v / m * 100));
  }
  if (system === 'flat') return [100, 70, 50, 35, 20, 10].slice(0, n);
  return Array.from({ length: n }, (_, i) => Math.round((n - i) / n * 100));
}

export function getParticipationPoints(winnerPoints) {
  return Math.round((winnerPoints || 0) * PARTICIPATION_RATIO);
}

// Puntos de UNA partida para cada jugador que la jugó.
// Devuelve {nombre:{pts, rank, ranked}}: rank = puesto (0 = ganó) o -1 si jugó sin podio.
// En partidas de equipos, cada equipo es un "jugador" y todos sus miembros reciben lo mismo.
export function scoreGame(g, system) {
  system = normSystem(system);
  const mult = getComplexityMultiplier(g.complexity);
  const out = {};
  if (g.teams && g.teams.length) {
    const T = g.teams.length;
    const base = system === 'rivals' ? rivalsPoints(T) : getPoints(T, system);
    g.teams.forEach((team, ti) => (team || []).forEach(p => {
      out[p] = { pts: Math.round((base[ti] || 0) * mult), rank: ti, ranked: true };
    }));
    return out;
  }
  const positions = (g.positions || []).filter(Boolean);
  const participants = g.participants || positions;
  const unranked = participants.filter(p => p && positions.indexOf(p) < 0);
  if (system === 'rivals') {
    const N = positions.length + unranked.length;
    positions.forEach((p, i) => {
      const below = (positions.length - 1 - i) + unranked.length;
      out[p] = { pts: Math.round((2 * below + 1) / N * 100 * mult), rank: i, ranked: true };
    });
    unranked.forEach(p => {
      out[p] = { pts: Math.round(unranked.length / N * 100 * mult), rank: -1, ranked: false };
    });
  } else {
    const base = getPoints(positions.length, system);
    positions.forEach((p, i) => {
      out[p] = { pts: Math.round((base[i] || 0) * mult), rank: i, ranked: true };
    });
    const part = getParticipationPoints(Math.round((base[0] || 0) * mult));
    unranked.forEach(p => { out[p] = { pts: part, rank: -1, ranked: false }; });
  }
  return out;
}

// Todos los nombres que aparecen en una lista de partidas
export function playersInGames(games) {
  const set = {};
  (games || []).forEach(g => Object.keys(scoreGame(g, 'proportional')).forEach(p => { set[p] = true; }));
  return Object.keys(set);
}

// Marcador de un conjunto de partidas.
// opts: {system, bestN (0 = todas), players (lista de nombres a mostrar, aunque tengan 0)}.
// Victorias, podios y partidas jugadas cuentan TODAS las partidas; los puntos solo las mejores N.
// Orden: puntos → victorias → podios → alfabético.
export function computeScores(games, { system, bestN = 0, players = [] } = {}) {
  const results = {}, wins = {}, podiums = {}, gp = {};
  players.forEach(p => { results[p] = []; wins[p] = 0; podiums[p] = 0; gp[p] = 0; });
  (games || []).forEach(g => {
    Object.entries(scoreGame(g, system)).forEach(([p, r]) => {
      if (results[p] === undefined) return;
      results[p].push(r.pts); gp[p]++;
      if (r.ranked && r.rank === 0) wins[p]++;
      if (r.ranked && r.rank < 3) podiums[p]++;
    });
  });
  return players.map(p => {
    const sorted = results[p].slice().sort((a, b) => b - a);
    const counted = bestN > 0 ? sorted.slice(0, bestN) : sorted;
    return {
      name: p, pts: counted.reduce((s, v) => s + v, 0),
      wins: wins[p], podiums: podiums[p], gamesPlayed: gp[p], counted: counted.length,
    };
  }).sort((a, b) => b.pts - a.pts || b.wins - a.wins || b.podiums - a.podiums || a.name.localeCompare(b.name, 'es'));
}

// Puestos para mostrar: si dos jugadores quedan exactamente iguales en pts/victorias/podios,
// comparten el mismo puesto (1,1,3,4...). El orden del array no cambia.
export function computeDisplayRanks(sc) {
  const ranks = [];
  (sc || []).forEach((p, i) => {
    const prev = sc[i - 1];
    if (i > 0 && p.pts === prev.pts && p.wins === prev.wins && p.podiums === prev.podiums) ranks.push(ranks[i - 1]);
    else ranks.push(i + 1);
  });
  return ranks;
}

// Nombres empatados EXACTO con `player` en pts/victorias/podios (sin incluirlo a él)
export function getTiedWith(sc, player) {
  return (sc || []).filter(p => p.name !== player.name && p.pts === player.pts && p.wins === player.wins && p.podiums === player.podiums).map(p => p.name);
}
