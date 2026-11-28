/**
 * Spielekompass: Daten von BoardGameGeek (XML API2) und regelbasierte Einordnung.
 *
 * - BoardGameGeek verlangt seit 2025 einen App-Schlüssel (Bearer-Token). Den legt der Nutzer
 *   mit seinem eigenen Konto unter boardgamegeek.com/applications an; er liegt nur auf dem Gerät.
 * - Übernommen werden nur Fakten: Spieleranzahl, beste Spielerzahl (Umfrage), Dauer, Alter,
 *   Komplexität, Verlag, Jahr, Mechaniken/Kategorien. Texte von BGG werden nicht übernommen.
 * - Spielart und Kompetenzen leitet die App per Regeln aus Mechaniken, Kategorien, Alter und
 *   Komplexität ab – ganz ohne KI (Rückfall, wenn keine KI-Einordnung vorliegt).
 */
import { norm } from '../core/utils.js';
import { mergeExpansions } from './game-data.js';

const BGG = 'https://boardgamegeek.com/xmlapi2';
const TOKEN_NAME = 'leeway-spielekompass-bgg';

export function getBggToken() {
  try { return localStorage.getItem(TOKEN_NAME) || ''; } catch { return ''; }
}
export function setBggToken(t) {
  try { if (t) localStorage.setItem(TOKEN_NAME, t.trim()); else localStorage.removeItem(TOKEN_NAME); } catch { /* privater Modus */ }
}
export const hasBggToken = () => !!getBggToken();

export class BggError extends Error {
  constructor(message, { fatal = false } = {}) { super(message); this.fatal = fatal; }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** BGG bittet um Zurückhaltung: zwischen zwei Abfragen mindestens so viele Millisekunden. */
export const BGG_PAUSE = 1500;
let lastCall = 0;

async function bggGet(path) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const gap = BGG_PAUSE - (Date.now() - lastCall);
    if (gap > 0) await wait(gap);
    lastCall = Date.now();
    let res;
    try {
      res = await fetch(`${BGG}${path}`, { headers: { Authorization: `Bearer ${getBggToken()}` } });
    } catch {
      throw new BggError('BoardGameGeek ist von hier aus nicht erreichbar. Entweder fehlt die Internetverbindung, oder BoardGameGeek erlaubt keine Abfrage direkt aus dem Browser (dann braucht es später eine Weiterleitung über den Heimserver).', { fatal: true });
    }
    if (res.status === 202 || res.status === 429) { await wait(2500 * (attempt + 1)); continue; }
    if (res.status === 401) throw new BggError('BoardGameGeek hat den App-Schlüssel abgelehnt. Bitte unter „Verbindungen“ prüfen.', { fatal: true });
    if (!res.ok) throw new BggError(`BoardGameGeek antwortet nicht (${res.status}). Bitte später erneut versuchen.`);
    const doc = new DOMParser().parseFromString(await res.text(), 'application/xml');
    if (doc.querySelector('parsererror')) throw new BggError('Antwort von BoardGameGeek nicht lesbar.');
    return doc;
  }
  throw new BggError('BoardGameGeek ist gerade ausgelastet. Bitte später erneut versuchen.');
}

const val = (el, sel) => el.querySelector(sel)?.getAttribute('value') ?? '';
const int = (v) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : null; };

/** Sucht ein Spiel nach Titel. Liefert [{ id, name, year }], beste Treffer zuerst. */
export async function searchBgg(title, year = null) {
  const q = encodeURIComponent(String(title).trim());
  let doc = await bggGet(`/search?query=${q}&type=boardgame&exact=1`);
  let items = [...doc.querySelectorAll('item')];
  if (!items.length) {
    doc = await bggGet(`/search?query=${q}&type=boardgame`);
    items = [...doc.querySelectorAll('item')];
  }
  const t = norm(title);
  return items.map((it) => ({ id: int(it.getAttribute('id')), name: val(it, 'name'), year: int(val(it, 'yearpublished')) }))
    .filter((x) => x.id)
    .sort((a, b) => Number(norm(b.name) === t) - Number(norm(a.name) === t)
      || (year ? Math.abs((a.year || 0) - year) - Math.abs((b.year || 0) - year) : 0)
      || (b.year || 0) - (a.year || 0));
}

/** Liest die Fakten eines Spiels. */
export async function fetchBggThing(id) {
  const doc = await bggGet(`/thing?id=${encodeURIComponent(id)}&stats=1`);
  const item = doc.querySelector('item');
  if (!item) throw new BggError('Spiel bei BoardGameGeek nicht gefunden.');
  const links = (type) => [...item.querySelectorAll(`link[type="${type}"]`)].map((l) => l.getAttribute('value')).filter(Boolean);
  // Beste Spielerzahl aus der Umfrage „suggested_numplayers“
  const best = [];
  for (const r of item.querySelectorAll('poll[name="suggested_numplayers"] results')) {
    const votes = Object.fromEntries([...r.querySelectorAll('result')].map((x) => [x.getAttribute('value'), Number(x.getAttribute('numvotes')) || 0]));
    const n = int(r.getAttribute('numplayers'));
    if (n && (votes.Best || 0) >= 3 && (votes.Best || 0) >= (votes.Recommended || 0) && (votes.Best || 0) >= (votes['Not Recommended'] || 0)) best.push(n);
  }
  const weight = Number.parseFloat(val(item, 'statistics averageweight'));
  return {
    bggId: int(item.getAttribute('id')),
    name: val(item, 'name[type="primary"]'),
    year: int(val(item, 'yearpublished')),
    playersMin: int(val(item, 'minplayers')),
    playersMax: int(val(item, 'maxplayers')),
    playersBest: best.length ? (best.length > 1 ? `${Math.min(...best)}–${Math.max(...best)}` : String(best[0])) : '',
    durationMin: int(val(item, 'minplaytime')) || int(val(item, 'playingtime')),
    durationMax: int(val(item, 'maxplaytime')) || int(val(item, 'playingtime')),
    ageMin: int(val(item, 'minage')),
    weight: Number.isFinite(weight) && weight >= 1 ? Math.round(weight * 100) / 100 : null,
    publisher: links('boardgamepublisher')[0] || '',
    mechanicsRaw: links('boardgamemechanic'),
    categoriesRaw: links('boardgamecategory'),
    // Erweiterungen dieses Spiels (inbound="true" wäre umgekehrt das Grundspiel einer Erweiterung)
    expansions: [...item.querySelectorAll('link[type="boardgameexpansion"]')]
      .filter((l) => l.getAttribute('inbound') !== 'true')
      .map((l) => ({ bggId: int(l.getAttribute('id')), name: l.getAttribute('value') || '' }))
      .filter((x) => x.bggId && x.name && !/fan expansion/i.test(x.name)),
  };
}

// ---------------------------------------------------------------- Regeln: BGG → Spielekompass
/** BGG-Mechaniken und -Kategorien (englisch) → eigene Mechanik-Kennungen. */
const MECH_RULES = [
  [/cooperative/i, 'kooperativ'],
  [/team-based/i, 'team'],
  [/party game/i, 'party'],
  [/hidden roles|traitor|social deduction/i, 'social-deduction'],
  [/bluff/i, 'bluff'],
  [/player elimination/i, 'player-elimination'],
  [/area majority|area control|area-impulse|territory building|influence/i, 'area-control'],
  [/worker placement/i, 'worker-placement'],
  [/deck, bag|deck building|bag building|pool building/i, 'deckbuilding'],
  [/engine building/i, 'engine-building'],
  [/tile placement/i, 'plaettchen'],
  [/set collection/i, 'set-collection'],
  [/trick-taking/i, 'stichspiel'],
  [/dice rolling/i, 'wuerfeln'],
  [/push your luck/i, 'push-your-luck'],
  [/paper-and-pencil|roll.*write/i, 'roll-write'],
  [/^race$|roll \/ spin and move|track movement/i, 'wettrennen'],
  [/negotiation|trading/i, 'verhandeln'],
  [/deduction/i, 'deduktion'],
  [/murder|mystery|escape/i, 'escape'],
  [/^memory$/i, 'merken'],
  [/real-time|speed matching|pattern recognition/i, 'reaktion'],
  [/dexterity|stacking|flicking/i, 'geschick'],
  [/trivia/i, 'wissen'],
  [/word game|spelling/i, 'woerter'],
  [/storytelling/i, 'erzaehlen'],
  [/drawing|acting|line drawing/i, 'zeichnen'],
  [/real-time/i, 'echtzeit'],
  [/abstract strategy/i, 'abstrakt'],
  [/legacy|campaign|scenario/i, 'kampagne'],
];

/** Eigene Mechanik → Kompetenzen, die sie typischerweise fördert. */
const COMPETENCE_RULES = {
  kooperativ: ['zusammenarbeit', 'kommunikation', 'frustrationstoleranz'],
  team: ['zusammenarbeit', 'kommunikation'],
  party: ['kommunikation', 'selbstvertrauen'],
  'social-deduction': ['empathie', 'kommunikation', 'logik'],
  bluff: ['empathie', 'impulskontrolle'],
  'player-elimination': ['frustrationstoleranz'],
  'area-control': ['strategie', 'konflikt'],
  'worker-placement': ['strategie', 'entscheiden'],
  deckbuilding: ['strategie', 'entscheiden'],
  'engine-building': ['strategie', 'logik'],
  plaettchen: ['raeumlich', 'strategie'],
  'set-collection': ['strategie', 'wahrnehmung'],
  stichspiel: ['konzentration', 'strategie'],
  wuerfeln: ['frustrationstoleranz', 'regeln'],
  'push-your-luck': ['impulskontrolle', 'entscheiden'],
  'roll-write': ['mathe', 'entscheiden'],
  wettrennen: ['regeln', 'frustrationstoleranz'],
  verhandeln: ['konflikt', 'kommunikation'],
  deduktion: ['logik', 'konzentration'],
  escape: ['logik', 'zusammenarbeit'],
  merken: ['gedaechtnis', 'konzentration'],
  reaktion: ['reaktion', 'konzentration', 'impulskontrolle'],
  geschick: ['motorik', 'konzentration'],
  wissen: ['sprache', 'konzentration'],
  woerter: ['sprache', 'kreativitaet'],
  erzaehlen: ['kreativitaet', 'sprache'],
  zeichnen: ['kreativitaet', 'motorik'],
  echtzeit: ['reaktion', 'konzentration'],
  abstrakt: ['strategie', 'logik'],
  kampagne: ['strategie', 'frustrationstoleranz'],
};

const CATEGORY_COMPETENCES = [
  [/math/i, 'mathe'],
  [/children's game/i, 'regeln'],
  [/educational/i, 'konzentration'],
  [/puzzle|spatial/i, 'raeumlich'],
];

export function mapBggMechanics(raw = []) {
  const out = [];
  for (const name of raw) for (const [re, id] of MECH_RULES) if (re.test(name) && !out.includes(id)) out.push(id);
  return out;
}

/** Kompetenzen aus Mechaniken (und BGG-Kategorien) ableiten, die häufigsten zuerst, höchstens 6. */
export function deriveCompetences(mechanics = [], categoriesRaw = []) {
  const score = new Map();
  const add = (id, w = 1) => score.set(id, (score.get(id) || 0) + w);
  mechanics.forEach((m, n) => (COMPETENCE_RULES[m] || []).forEach((c, k) => add(c, 3 - Math.min(2, k) + (n < 2 ? 1 : 0))));
  for (const name of categoriesRaw) for (const [re, id] of CATEGORY_COMPETENCES) if (re.test(name)) add(id, 2);
  return [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => id);
}

/** Spielart aus BGG-Angaben: Kinderspiel nach Kategorie/Alter, sonst nach Komplexität. */
export function deriveCategory({ categoriesRaw = [], ageMin = null, weight = null } = {}) {
  if (categoriesRaw.some((c) => /children's game/i.test(c)) || (ageMin && ageMin <= 5)) return 'kinder';
  if (!weight) return ageMin && ageMin <= 7 ? 'kinder' : '';
  if (weight < 1.9) return 'familie';
  if (weight < 2.8) return 'kenner';
  return 'experte';
}

/**
 * Macht aus BGG-Daten einen Patch für ein Spiel.
 * Fakten kommen von BGG; Einordnung (Spielart, Mechaniken, Kompetenzen) nur, wo noch nichts eingetragen ist –
 * eine vorhandene KI- oder Handeinordnung bleibt also erhalten, Mechaniken werden ergänzt.
 */
export function bggPatch(game, d) {
  const mech = mapBggMechanics([...d.mechanicsRaw, ...d.categoriesRaw]);
  const mechanics = [...new Set([...(game.mechanics || []), ...mech])].slice(0, 8);
  const patch = {
    bggId: d.bggId,
    bggUrl: `https://boardgamegeek.com/boardgame/${d.bggId}`,
    bgg: { status: 'done', at: new Date().toISOString(), name: d.name },
  };
  const set = (k, v) => { if (v !== null && v !== undefined && v !== '') patch[k] = v; };
  set('playersMin', d.playersMin);
  set('playersMax', d.playersMax);
  set('playersBest', d.playersBest);
  set('durationMin', d.durationMin);
  set('durationMax', d.durationMax);
  set('ageMin', game.ageMin || d.ageMin); // deutsche Schachtel (von Claude gelesen) hat Vorrang
  set('weight', d.weight);
  set('year', d.year);
  if (!game.publisher) set('publisher', d.publisher);
  if (!game.title || game.title === 'Neues Spiel') set('title', d.name);
  patch.mechanics = mechanics;
  if ((d.expansions || []).length) patch.expansions = mergeExpansions(game.expansions, d.expansions, 'bgg');
  patch.expansionsAt = new Date().toISOString(); // Liste von BoardGameGeek gilt als vollständig
  if (!(game.competences || []).length) patch.competences = deriveCompetences(mechanics, d.categoriesRaw);
  if (!game.category) set('category', deriveCategory({ ...d, ageMin: patch.ageMin }));
  if (game.recognition?.status !== 'done') patch.recognition = { status: 'done', at: new Date().toISOString(), confidence: 'mittel', source: 'bgg' };
  return patch;
}
