/** Kleine Hilfsfunktionen, die überall gebraucht werden. */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Schützt vor eingeschleustem HTML: jeder Nutzertext läuft vor der Anzeige hier durch. */
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

const pad = (n) => String(n).padStart(2, '0');
/** Datum als „JJJJ-MM-TT“ in lokaler Zeit. */
export const todayISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function addDaysISO(days, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

export function parseISODate(s) {
  if (!s || typeof s !== 'string') return null;
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Tage bis zu einem Datum (negativ = vergangen), null ohne Datum. */
export function daysUntil(s) {
  const d = parseISODate(s);
  if (!d) return null;
  return Math.round((d - parseISODate(todayISO())) / 86400000);
}

export function formatDate(s, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const d = parseISODate(s);
  return d ? d.toLocaleDateString('de-DE', opts) : '';
}

export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('de-DE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Lesbare Fälligkeit mit Tonalität für die Farbgebung. */
export function dueLabel(s) {
  const n = daysUntil(s);
  if (n === null) return null;
  if (n < -1) return { text: `${-n} Tage überfällig`, tone: 'danger' };
  if (n === -1) return { text: 'seit gestern fällig', tone: 'danger' };
  if (n === 0) return { text: 'heute fällig', tone: 'warn' };
  if (n === 1) return { text: 'morgen', tone: 'warn' };
  if (n < 7) return { text: `in ${n} Tagen`, tone: 'soft' };
  return { text: formatDate(s, { day: 'numeric', month: 'short' }), tone: 'muted' };
}

/** „vor 3 Tagen“ für einen ISO-Zeitstempel. */
export function daysAgo(iso) {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((Date.now() - then.getTime()) / 86400000);
}

export function debounce(fn, ms = 180) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2).replace('.', ',')} MB`;
}

/** Normalisiert Text für die Suche (Groß-/Kleinschreibung, Umlaute bleiben erhalten). */
export const norm = (s) => String(s ?? '').toLocaleLowerCase('de-DE');
