/**
 * Spielekompass: Logik rund ums Spielen (ohne Oberfläche)
 * - Spielprotokoll auswerten (wie oft, wann zuletzt, mit wem)
 * - Verleih (Frist, Erinnerung)
 * - „Was spiele ich heute?“ (passende Spiele für Zeit und Personen)
 * - Spieleabend-Planer (Ablauf aus Bausteinen)
 */
import { todayISO, parseISODate } from '../core/utils.js';
import { NEW_TITLE } from './game-data.js';

// ---------------------------------------------------------------- Personen und Gruppen
export const PERSON_KINDS = [
  { id: 'person', label: 'Person' },
  { id: 'group', label: 'Gruppe' },
];
export const sortPeople = (list) => [...list].sort((a, b) => String(a.name).localeCompare(String(b.name), 'de', { sensitivity: 'base' }));

// ---------------------------------------------------------------- Datum
const DAY = 86400000;
/** Ganze Tage zwischen einem Datum (JJJJ-MM-TT) und heute. */
export function daysSince(dateISO, today = todayISO()) {
  const a = parseISODate(dateISO);
  const b = parseISODate(today);
  return a && b ? Math.round((b - a) / DAY) : null;
}
export function agoText(days) {
  if (days == null) return '';
  if (days <= 0) return 'heute';
  if (days === 1) return 'gestern';
  if (days < 14) return `vor ${days} Tagen`;
  if (days < 60) return `vor ${Math.round(days / 7)} Wochen`;
  if (days < 730) return `vor ${Math.round(days / 30)} Monaten`;
  return `vor ${Math.round(days / 365)} Jahren`;
}
export const shortDate = (iso) => {
  const d = parseISODate(iso);
  return d ? d.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : '2-digit' }) : '';
};

// ---------------------------------------------------------------- Spielprotokoll
/** Map gameId → { count, last, lastPlay } aus allen Einträgen des Protokolls. */
export function playStats(plays) {
  const map = new Map();
  for (const p of plays) {
    if (!p.gameId) continue;
    const s = map.get(p.gameId) || { count: 0, last: '', lastPlay: null };
    s.count += 1;
    if (String(p.date) >= s.last) { s.last = String(p.date); s.lastPlay = p; }
    map.set(p.gameId, s);
  }
  return map;
}

/** Map gameId → letztes Datum, an dem die Person/Gruppe dabei war. */
export function historyFor(plays, personId) {
  const map = new Map();
  if (!personId) return map;
  for (const p of plays) {
    if (!p.gameId || !(p.people || []).includes(personId)) continue;
    if (!map.has(p.gameId) || String(p.date) > map.get(p.gameId)) map.set(p.gameId, String(p.date));
  }
  return map;
}

// ---------------------------------------------------------------- Verleih
export const LOAN_REMIND = [
  { days: 14, label: '2 Wochen' },
  { days: 28, label: '4 Wochen' },
  { days: 56, label: '8 Wochen' },
  { days: 0, label: 'nie' },
];
export const DEFAULT_REMIND = 28;

/** Fällige Erinnerungen: Frist abgelaufen und nicht auf später verschoben. */
export function loanDue(g, today = todayISO()) {
  const l = g.loan;
  if (!l || !l.remindDays) return false;
  const days = daysSince(l.since, today);
  if (days == null || days < l.remindDays) return false;
  return !(l.snoozeUntil && String(l.snoozeUntil) > today);
}

// ---------------------------------------------------------------- Passende Spiele
const isPlayable = (g) => !!g.title && g.title !== NEW_TITLE;
const minDuration = (g) => g.durationMin || g.durationMax || null;
const playDuration = (g, fallback = 30) => g.durationMax || g.durationMin || fallback;

/**
 * Grundprüfung für Zeit, Personen und Alter. Unbekannte Angaben gelten als passend.
 * opts: { minutes, players, youngest, includeLoaned }
 */
export function fits(g, { minutes = null, players = null, youngest = null, includeLoaned = false } = {}) {
  if (!isPlayable(g)) return false;
  if (!includeLoaned && g.loan) return false;
  if (players != null) {
    if (g.playersMin && players < g.playersMin) return false;
    if (g.playersMax && players > g.playersMax) return false;
  }
  if (minutes != null && minDuration(g) && minDuration(g) > minutes) return false;
  if (youngest != null && g.ageMin && g.ageMin > youngest) return false;
  return true;
}

export const TONIGHT_TIMES = [
  { minutes: 15, label: '15 Min.' },
  { minutes: 30, label: '30 Min.' },
  { minutes: 60, label: '1 Std.' },
  { minutes: 120, label: '2 Std.' },
  { minutes: null, label: 'mehr' },
];

/** Kandidaten für „Was spiele ich heute?“. extra: { kids, favorites, notRecent }, stats aus playStats. */
export function tonightCandidates(games, { minutes, players, kids = false, favorites = false, notRecent = false } = {}, stats = new Map()) {
  return games.filter((g) => fits(g, { minutes, players, youngest: kids ? 8 : null })
    && (!favorites || (g.labels || []).includes('favorit'))
    && (!notRecent || !(stats.get(g.id)?.last) || daysSince(stats.get(g.id).last) > 60));
}

/** Zufällige Auswahl; das zuletzt gezeigte Spiel kommt nur, wenn es das einzige ist. */
export function pickRandom(list, avoidId = null, rnd = Math.random) {
  const pool = list.length > 1 ? list.filter((g) => g.id !== avoidId) : list;
  return pool.length ? pool[Math.floor(rnd() * pool.length)] : null;
}

// ---------------------------------------------------------------- Spieleabend-Planer
export const EXPERIENCE = [
  { id: 'gelegenheit', label: 'Gelegenheit', maxWeight: 2.2 },
  { id: 'gemischt', label: 'Gemischt', maxWeight: 3 },
  { id: 'viel', label: 'Vielspieler', maxWeight: 5 },
];

export const SLOT_KINDS = {
  ankommen: { label: 'Ankommen', minutes: 20, light: true },
  haupt: { label: 'Hauptspiel', minutes: 60 },
  zweites: { label: 'Zweites Spiel', minutes: 45 },
  pause: { label: 'Pause', minutes: 15, noGame: true },
  absacker: { label: 'Absacker', minutes: 20, light: true },
  spiel: { label: 'Spiel', minutes: 30 },
};

export function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
export function fromMinutes(total) {
  const t = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
/** Länge des Zeitfensters in Minuten (auch über Mitternacht). */
export function windowMinutes(from, to) {
  const a = toMinutes(from);
  const b = toMinutes(to);
  if (a == null || b == null) return 0;
  return b > a ? b - a : b + 1440 - a;
}

/** Uhrzeiten der Bausteine. */
export function slotTimes(from, slots) {
  let t = toMinutes(from) ?? 0;
  return slots.map((s) => { const at = fromMinutes(t); t += s.minutes || 0; return at; });
}

const LIGHT_MECH = ['party', 'kooperativ', 'bluff', 'reaktion', 'kommunikation'];

/**
 * Bewertet ein Spiel für einen Baustein. Höher = besser, null = passt nicht.
 * ctx: { players, youngest, experience, history (Map gameId → Datum), mainGame }
 */
export function slotScore(g, kind, ctx) {
  const k = SLOT_KINDS[kind] || SLOT_KINDS.spiel;
  if (k.noGame) return null;
  const limit = ctx.slotMinutes || k.minutes;
  if (!fits(g, { players: ctx.players, youngest: ctx.youngest, minutes: k.light ? 30 : limit })) return null;
  const maxW = (EXPERIENCE.find((e) => e.id === ctx.experience) || EXPERIENCE[1]).maxWeight;
  if (g.weight && g.weight > maxW) return null;
  let score = 10;
  const dur = playDuration(g, k.minutes);
  if (k.light) {
    if (dur > 30) return null;
    if (g.weight && g.weight > 2.2) score -= 4;
    if ((g.mechanics || []).some((m) => LIGHT_MECH.includes(m))) score += 3;
    if (ctx.mainGame) {
      // Anders als das Hauptspiel: andere Mechaniken bringen Abwechslung.
      const same = (g.mechanics || []).filter((m) => (ctx.mainGame.mechanics || []).includes(m)).length;
      score -= same * 1.5;
    }
  } else {
    // Hauptspiele: die Länge soll den Baustein gut füllen.
    score += 6 - Math.min(6, Math.abs(limit - dur) / 15);
    if (dur < 25) score -= 5;
  }
  if ((g.labels || []).includes('favorit')) score += 1.5;
  if ((g.labels || []).includes('bald')) score += 2;
  if ((g.labels || []).includes('aussortieren')) score -= 3;
  const last = ctx.history?.get(g.id);
  if (last) {
    const d = daysSince(last);
    if (d != null && d < 60) score -= 6 - d / 12; // kürzlich mit dieser Gruppe gespielt: seltener
  }
  return score;
}

/** Sortierte Kandidaten für einen Baustein, ohne die ausgeschlossenen Spiele. */
export function slotCandidates(games, kind, ctx, exclude = []) {
  return games
    .filter((g) => !exclude.includes(g.id))
    .map((g) => ({ game: g, score: slotScore(g, kind, ctx) }))
    .filter((x) => x.score != null)
    .sort((a, b) => b.score - a.score || String(a.game.title).localeCompare(String(b.game.title), 'de'));
}

/** Zufällig unter den besten Kandidaten (damit nicht jeder Abend gleich aussieht). */
export function pickForSlot(games, kind, ctx, exclude = [], rnd = Math.random) {
  const list = slotCandidates(games, kind, ctx, exclude);
  if (!list.length) return null;
  const top = list.filter((x) => x.score >= list[0].score - 3).slice(0, 5);
  return top[Math.floor(rnd() * top.length)].game;
}

/**
 * Baut den Ablauf eines Abends.
 * opts: { from, to, players, youngest, experience, mainGameId }, history: Map gameId → Datum
 * Liefert slots: [{ kind, minutes, gameId, locked }]
 */
export function planEvening(games, opts, history = new Map(), rnd = Math.random) {
  const total = windowMinutes(opts.from, opts.to);
  const ctxBase = { players: opts.players, youngest: opts.youngest, experience: opts.experience, history };
  const main = opts.mainGameId ? games.find((g) => g.id === opts.mainGameId) : null;
  const slots = [];
  const used = [];
  const add = (kind, minutes, game, locked = false) => {
    slots.push({ kind, minutes, gameId: game?.id || null, locked });
    if (game) used.push(game.id);
  };
  const short = total < 75;
  if (!short) {
    const first = pickForSlot(games, 'ankommen', { ...ctxBase, mainGame: main }, main ? [main.id] : [], rnd);
    add('ankommen', first ? Math.max(15, Math.min(30, playDuration(first, 20))) : 20, first);
  }
  const ankommen = slots.reduce((s, x) => s + x.minutes, 0);
  const tail = short ? 0 : 20; // Absacker
  const pause = total - ankommen - tail >= 120 ? 15 : 0;
  let room = Math.max(20, total - ankommen - tail - pause);
  if (main) {
    const len = Math.min(room, playDuration(main, 60));
    add('haupt', len, main, true);
    room -= len;
  } else {
    const target = room > 150 ? Math.round(room * 0.55) : room;
    const pick = pickForSlot(games, 'haupt', { ...ctxBase, slotMinutes: target }, used, rnd);
    const len = pick ? Math.min(room, playDuration(pick, target)) : target;
    add('haupt', len, pick);
    room -= len;
  }
  if (pause) add('pause', pause, null);
  if (room >= 35) {
    const pick = pickForSlot(games, 'zweites', { ...ctxBase, slotMinutes: room, mainGame: main }, used, rnd);
    const len = pick ? Math.min(room, playDuration(pick, room)) : room;
    add('zweites', len, pick);
    room -= len;
  }
  // Restzeit mit weiteren Spielen füllen, damit der Abend das Zeitfenster nutzt.
  for (let n = 0; room >= 30 && n < 4; n++) {
    const pick = pickForSlot(games, 'spiel', { ...ctxBase, slotMinutes: room, mainGame: main }, used, rnd);
    if (!pick) break;
    const len = Math.min(room, playDuration(pick, 30));
    add('spiel', len, pick);
    room -= len;
  }
  if (!short) {
    const last = pickForSlot(games, 'absacker', { ...ctxBase, mainGame: main }, used, rnd);
    add('absacker', last ? Math.max(15, Math.min(30, tail + Math.max(0, room), playDuration(last, 20))) : 20, last);
  }
  return slots;
}
