// ==================== DADOS ====================
// Dibujo de cada dado como SVG (forma según la cantidad de caras) y tiradas aleatorias.
// Módulo puro: sin DOM ni estado, se prueba en tests/dice.test.js.

// Posición de los puntos del d6 (sobre un cuadro de 100×100)
const P = { tl: [30, 30], tr: [70, 30], ml: [30, 50], mr: [70, 50], c: [50, 50], bl: [30, 70], br: [70, 70] };
export const PIPS = {
  1: ['c'],
  2: ['tl', 'br'],
  3: ['tl', 'c', 'br'],
  4: ['tl', 'tr', 'bl', 'br'],
  5: ['tl', 'tr', 'c', 'bl', 'br'],
  6: ['tl', 'tr', 'ml', 'mr', 'bl', 'br'],
};

// Forma, color y posición del número para cada tipo de dado
export const DIE_STYLES = {
  4: { shape: 'polygon', points: '50,8 93,86 7,86', fill: '#FFE066', text: '#000', ty: 70, fs: 30 },
  6: { shape: 'rect', fill: '#FFFFFF', text: '#000', ty: 62, fs: 34 },
  8: { shape: 'polygon', points: '50,5 94,50 50,95 6,50', fill: '#FF6B9D', text: '#000', ty: 62, fs: 32 },
  10: { shape: 'polygon', points: '50,5 93,42 50,95 7,42', fill: '#A3E635', text: '#000', ty: 58, fs: 30 },
  12: { shape: 'polygon', points: '50,5 94,37 77,92 23,92 6,37', fill: '#FFE066', text: '#000', ty: 64, fs: 30 },
  20: { shape: 'polygon', points: '50,4 91,27 91,73 50,96 9,73 9,27', fill: '#FF6B9D', text: '#000', ty: 61, fs: 30, inner: '50,24 77,70 23,70' },
  100: { shape: 'rect', fill: '#000000', text: '#A3E635', ty: 61, fs: 28 },
};

function shapeSvg(st, dx, dy, fill) {
  if (st.shape === 'rect') return `<rect x="${8 + dx}" y="${8 + dy}" width="84" height="84" rx="16" fill="${fill}" stroke="#000" stroke-width="5"/>`;
  const pts = st.points.split(' ').map(p => p.split(',').map(Number)).map(([x, y]) => `${x + dx},${y + dy}`).join(' ');
  return `<polygon points="${pts}" fill="${fill}" stroke="#000" stroke-width="5" stroke-linejoin="round"/>`;
}

// SVG de un dado mostrando `value`. La sombra sólida es parte del dibujo (estilo de la app).
export function dieSVG(faces, value) {
  const st = DIE_STYLES[faces] || DIE_STYLES[6];
  let face;
  if (faces === 6 && PIPS[value]) {
    face = PIPS[value].map(k => `<circle cx="${P[k][0]}" cy="${P[k][1]}" r="8.5" fill="#000"/>`).join('');
  } else {
    face = `<text x="50" y="${st.ty}" text-anchor="middle" font-family="Space Grotesk,system-ui,sans-serif" font-weight="700" font-size="${String(value).length > 2 ? st.fs - 6 : st.fs}" fill="${st.text}">${Number(value)}</text>`;
  }
  const inner = st.inner ? `<polygon points="${st.inner}" fill="none" stroke="#000" stroke-width="2" opacity=".25"/>` : '';
  return `<svg class="die-svg" viewBox="0 0 106 106" role="img" aria-label="d${faces}: ${Number(value)}">`
    + shapeSvg(st, 6, 6, '#000') + shapeSvg(st, 0, 0, st.fill) + inner + face + '</svg>';
}

// Tirada: `count` dados de `faces` caras. `rng` se puede reemplazar en las pruebas.
export function rollValues(count, faces, rng = Math.random) {
  return Array.from({ length: count }, () => Math.floor(rng() * faces) + 1);
}

// Etiqueta especial bajo el dado: crítico/pifia en d20, máximo en el resto
export function dieBadge(faces, value) {
  if (faces === 20 && value === 20) return { cls: 'die-crit', label: '¡CRÍTICO!' };
  if (faces === 20 && value === 1) return { cls: 'die-fumble', label: '¡PIFIA!' };
  if (value === faces && faces > 1) return { cls: 'die-max', label: 'máximo' };
  return null;
}
