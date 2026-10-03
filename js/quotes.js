// ==================== FRASES ====================
// Frases de los jugadores (las escribe el grupo) y datos curiosos sacados de las estadísticas,
// para la pantalla de carga y la de campeón. Módulo puro, se prueba en tests/quotes.test.js.

// Frases iniciales del grupo. Se asocian al jugador sin importar mayúsculas ni tildes.
export const SEED_QUOTES = {
  daniel: ['No hay con quién.'],
  biku: ['NOSCU'],
  sian: ['El único veneno\nque viene con encanto.'],
  nicolas: ['The lord of the rules'],
};

export const QUOTE_MAX = 140;

export function normName(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Limpia una frase escrita por el usuario: quita caracteres que rompen el HTML y controles,
// conserva los saltos de línea.
export function cleanQuote(s) {
  return String(s ?? '')
    .replace(/[<>`\\]/g, '')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, QUOTE_MAX);
}

// Frases iniciales que corresponden a los jugadores del grupo: {nombre: [frases]}
export function seedQuotesFor(players) {
  const out = {};
  (players || []).forEach(p => {
    const q = SEED_QUOTES[normName(p)];
    if (q && !out[p]) out[p] = q.slice();
  });
  return out;
}

// Datos curiosos a partir de las estadísticas. Cada uno: {name, icon, text}
export function statFacts({ standings = [], streaks = {}, kings = {}, titles = {}, lastChampion = null } = {}) {
  const facts = [];
  Object.entries(streaks).forEach(([p, n]) => { if (n >= 2) facts.push({ name: p, icon: '🔥', text: `${p} lleva ${n} victorias seguidas` }); });
  const [first, second] = standings;
  if (first && first.pts > 0 && (!second || second.pts < first.pts)) {
    facts.push({ name: first.name, icon: '🥇', text: `${first.name} va primero con ${first.pts} pts` });
  }
  Object.entries(kings).forEach(([game, byPlayer]) => {
    const max = Math.max(...Object.values(byPlayer));
    const top = Object.keys(byPlayer).filter(p => byPlayer[p] === max);
    if (max >= 2 && top.length === 1) facts.push({ name: top[0], icon: '👑', text: `${top[0]} es el rey de ${game}: ${max} victorias` });
  });
  Object.entries(titles).forEach(([p, n]) => { if (n >= 1) facts.push({ name: p, icon: '🏆', text: `${p} tiene ${n} ${n === 1 ? 'título' : 'títulos'}` }); });
  if (lastChampion && lastChampion.name) {
    facts.push({ name: lastChampion.name, icon: '🏆', text: `${lastChampion.name} ganó «${lastChampion.tournament}»` });
  }
  return facts;
}

// Elige qué mostrar: una frase de un jugador (más probable) o un dato curioso.
// quotes: {nombre: [frases]} solo de jugadores del grupo. Devuelve {type, name, text, icon} o null.
export function pickSplash({ quotes = {}, facts = [], rng = Math.random } = {}) {
  const pairs = [];
  Object.entries(quotes).forEach(([name, list]) => (list || []).forEach(text => { if (text) pairs.push({ name, text }); }));
  const useQuote = pairs.length && (!facts.length || rng() < 0.65);
  if (useQuote) { const q = pairs[Math.floor(rng() * pairs.length)]; return { type: 'quote', name: q.name, text: q.text }; }
  if (facts.length) { const f = facts[Math.floor(rng() * facts.length)]; return { ...f, type: 'fact' }; }
  return null;
}

// Deja solo frases y datos de ciertos jugadores (torneo en curso o último campeón).
// allowed = lista de nombres, o null para no filtrar.
export function restrictPool({ quotes = {}, facts = [] } = {}, allowed) {
  if (!allowed) return { quotes, facts };
  const set = new Set(allowed);
  return {
    quotes: Object.fromEntries(Object.entries(quotes).filter(([n]) => set.has(n))),
    facts: facts.filter(f => set.has(f.name)),
  };
}
