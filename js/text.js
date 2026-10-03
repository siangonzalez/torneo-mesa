// ==================== TEXTO SEGURO ====================
// Nombres de jugadores, juegos y torneos terminan dentro del HTML de la app. Dos defensas:
//   1. cleanName: al escribir un nombre se quitan los caracteres que pueden romper el HTML
//      (< > " ` \). El apóstrofe se permite (D'Angelo, O'Neil).
//   2. escHtml: al poner un nombre dentro de un atributo o del HTML se escapa igual.
// Los botones nunca llevan el nombre dentro de su código: lo leen de un atributo data-*.

export const NAME_MAX = 60;

export function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function cleanName(s) {
  return String(s ?? '')
    .replace(/[<>"`\\]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX);
}
