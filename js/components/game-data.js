/**
 * Spielekompass: Begriffe, Filter und der Austausch mit Claude (ohne Programmcode für die Oberfläche).
 *
 * Ein Spiel (Datenbereich „games“):
 * {
 *   id, title, publisher, year,
 *   playersMin, playersMax, playersBest,   // Zahlen; playersBest als Text, z. B. "4–6"
 *   durationMin, durationMax, ageMin,      // Minuten bzw. Jahre
 *   category: 'kinder' | 'familie' | 'kenner' | 'experte' | '',
 *   mechanics: ['kooperativ', …], competences: ['kommunikation', …], tags: ['freie Begriffe'],
 *   description, pedagogy, notes,
 *   labels: ['favorit', …],                // eigene Markierungen, siehe LABELS
 *   videoUrl, videoChannel,                // deutsches Erklärvideo (YouTube), optional
 *   expansions: [{ key, name, bggId, year, owned, source: 'bgg' | 'claude' | 'hand' }],
 *   cover: true | false, coverAt,          // Titelbild liegt in IndexedDB (core/image-store.js)
 *   recognition: { status: 'open' | 'done', at, confidence: 'hoch' | 'mittel' | 'niedrig' },
 *   createdAt, updatedAt
 * }
 */
import { norm, uid } from '../core/utils.js';

export const CATEGORIES = [
  { id: 'kinder', label: 'Kinderspiel', hint: 'einfache Regeln, kurze Runden, für Kinder gemacht' },
  { id: 'familie', label: 'Familienspiel', hint: 'zugänglich für gemischte Gruppen' },
  { id: 'kenner', label: 'Kennerspiel', hint: 'mehr Regeln und Entscheidungen' },
  { id: 'experte', label: 'Expertenspiel', hint: 'komplex, lang, für Erfahrene' },
];

export const MECHANICS = [
  { id: 'kooperativ', label: 'Kooperativ' },
  { id: 'team', label: 'Teamspiel' },
  { id: 'party', label: 'Partyspiel' },
  { id: 'social-deduction', label: 'Social Deduction' },
  { id: 'bluff', label: 'Bluffen' },
  { id: 'player-elimination', label: 'Player Elimination' },
  { id: 'area-control', label: 'Area Control' },
  { id: 'worker-placement', label: 'Worker Placement' },
  { id: 'deckbuilding', label: 'Deckbuilding' },
  { id: 'engine-building', label: 'Engine Building' },
  { id: 'plaettchen', label: 'Plättchen legen' },
  { id: 'set-collection', label: 'Sets sammeln' },
  { id: 'stichspiel', label: 'Stichspiel' },
  { id: 'wuerfeln', label: 'Würfeln' },
  { id: 'push-your-luck', label: 'Push your Luck' },
  { id: 'roll-write', label: 'Roll & Write' },
  { id: 'wettrennen', label: 'Wettrennen' },
  { id: 'verhandeln', label: 'Verhandeln & Handeln' },
  { id: 'deduktion', label: 'Deduktion & Rätseln' },
  { id: 'escape', label: 'Escape & Krimi' },
  { id: 'merken', label: 'Merken (Memo)' },
  { id: 'reaktion', label: 'Reaktion & Tempo' },
  { id: 'geschick', label: 'Geschicklichkeit' },
  { id: 'wissen', label: 'Wissen & Quiz' },
  { id: 'woerter', label: 'Wörter & Begriffe' },
  { id: 'erzaehlen', label: 'Erzählen & Fantasie' },
  { id: 'zeichnen', label: 'Zeichnen & Darstellen' },
  { id: 'echtzeit', label: 'Echtzeit' },
  { id: 'abstrakt', label: 'Abstrakte Strategie' },
  { id: 'kampagne', label: 'Kampagne & Legacy' },
];

export const COMPETENCES = [
  { id: 'zusammenarbeit', label: 'Zusammenarbeit' },
  { id: 'kommunikation', label: 'Kommunikation' },
  { id: 'frustrationstoleranz', label: 'Frustrationstoleranz' },
  { id: 'regeln', label: 'Regeln & Fairness' },
  { id: 'impulskontrolle', label: 'Impulskontrolle & Geduld' },
  { id: 'empathie', label: 'Empathie & Perspektivwechsel' },
  { id: 'konflikt', label: 'Konfliktfähigkeit & Verhandeln' },
  { id: 'selbstvertrauen', label: 'Selbstvertrauen & Auftreten' },
  { id: 'konzentration', label: 'Konzentration & Aufmerksamkeit' },
  { id: 'gedaechtnis', label: 'Merkfähigkeit' },
  { id: 'strategie', label: 'Strategisch planen' },
  { id: 'logik', label: 'Logisches Denken' },
  { id: 'entscheiden', label: 'Entscheidungen treffen' },
  { id: 'kreativitaet', label: 'Kreativität & Fantasie' },
  { id: 'sprache', label: 'Sprache & Wortschatz' },
  { id: 'mathe', label: 'Zählen & Rechnen' },
  { id: 'raeumlich', label: 'Räumliches Denken' },
  { id: 'wahrnehmung', label: 'Wahrnehmung (Farben, Formen)' },
  { id: 'reaktion', label: 'Reaktionsfähigkeit' },
  { id: 'motorik', label: 'Feinmotorik' },
];

export const TIME_STEPS = [15, 30, 45, 60, 90, 120, 180, 240, 360, 480];

/** Eigene Markierungen je Spiel (frei kombinierbar, filterbar). */
export const LABELS = [
  { id: 'favorit', label: 'Favorit' },
  { id: 'bald', label: 'Bald wieder spielen' },
  { id: 'mitbringen', label: 'Zur nächsten Runde mitbringen' },
  { id: 'nie-gespielt', label: 'Noch nie gespielt' },
  { id: 'aussortieren', label: 'Fliegt aus der Sammlung' },
];

const byId = (list) => new Map(list.map((x) => [x.id, x]));
const CAT = byId(CATEGORIES);
const MEC = byId(MECHANICS);
const COM = byId(COMPETENCES);
const LAB = byId(LABELS);

export const categoryLabel = (id) => CAT.get(id)?.label || '';
export const mechanicLabel = (id) => MEC.get(id)?.label || id;
export const competenceLabel = (id) => COM.get(id)?.label || id;
export const labelLabel = (id) => LAB.get(id)?.label || id;

// ---------------------------------------------------------------- Anzeige
const dash = (a, b) => (a && b && a !== b ? `${a}–${b}` : String(a || b || ''));

export function playersText(g) {
  if (!g.playersMin && !g.playersMax) return '';
  const r = dash(g.playersMin, g.playersMax);
  return `${r} ${r === '1' ? 'Person' : 'Personen'}`;
}
/** Dauer: bis 90 Minuten in Minuten, darüber in Stunden (z. B. „4–8 Std.“). */
const hours = (m) => String(Math.round((m / 60) * 2) / 2).replace('.5', '½').replace(/^0½$/, '½');
export function durationText(g) {
  const a = g.durationMin || g.durationMax;
  const b = g.durationMax || g.durationMin;
  if (!a) return '';
  if (Math.max(a, b) <= 90) return `${dash(g.durationMin, g.durationMax)} Min.`;
  const ha = hours(a);
  const hb = hours(b);
  if (a < 60) return `${a} Min. – ${hb} Std.`;
  return `${ha === hb ? ha : `${ha}–${hb}`} Std.`;
}
export const ageText = (g) => (g.ageMin ? `ab ${g.ageMin} J.` : '');
export const timeLabel = (m) => (m >= 90 ? `bis ${hours(m)} Std.` : `bis ${m} Min.`);

/** YouTube-Suche nach einem deutschen Erklärvideo – kostenlos, ohne Schlüssel. */
export const videoSearchUrl = (g) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${g.title || ''} Erklärvideo deutsch Regeln`)}`;

/** Nur echte YouTube-Adressen (Video oder Kurzlink) zulassen. */
export function cleanVideoUrl(u) {
  const v = String(u || '').trim();
  return /^https:\/\/(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)[\w-]{6,}[^\s"<>]*$/.test(v) ? v : '';
}

/** „4–6“ oder „4“ → { min, max } */
export function parseRange(s) {
  const nums = String(s || '').match(/\d+/g);
  if (!nums) return null;
  const a = Number(nums[0]);
  const b = Number(nums[1] ?? nums[0]);
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

export const isRecognized = (g) => g.recognition?.status === 'done';

// ---------------------------------------------------------------- Erweiterungen
const expKey = (x) => (x.bggId ? `bgg-${x.bggId}` : `n-${norm(x.name).replace(/[^a-z0-9äöüß]+/g, '-')}`);

/**
 * Führt eine neue Liste von Erweiterungen mit der vorhandenen zusammen.
 * Nichts geht verloren: „besitze ich“-Häkchen und selbst eingetragene bleiben, Doppelte (gleiche BGG-Nummer
 * oder gleicher Name) werden zusammengelegt. Deutsche Namen (aus Claudes Antwort oder von Hand) haben Vorrang.
 */
export function mergeExpansions(existing = [], incoming = [], source = 'bgg') {
  const out = (existing || []).map((x) => ({ ...x }));
  for (const raw of incoming || []) {
    const name = String(raw?.name || '').trim().slice(0, 140);
    if (!name) continue;
    const bggId = Number.isInteger(raw.bggId) && raw.bggId > 0 ? raw.bggId : null;
    const year = Number.isInteger(raw.year) ? raw.year : null;
    const hit = out.find((x) => (bggId && x.bggId === bggId) || norm(x.name) === norm(name));
    if (hit) {
      if (bggId && !hit.bggId) hit.bggId = bggId;
      if (year && !hit.year) hit.year = year;
      if (source !== 'bgg' && hit.source === 'bgg') { hit.name = name; hit.source = source; }
      hit.key = expKey(hit);
    } else {
      const x = { name, bggId, year, owned: false, source };
      out.push({ ...x, key: expKey(x) });
    }
  }
  return out;
}

/** Wendet die in einer Antwort gefundenen Erweiterungen auf ein Spiel an (vor dem Speichern aufrufen). */
export function resolveExpansions(game, patch) {
  if (patch.expansionsFound) {
    patch.expansions = mergeExpansions(game?.expansions, patch.expansionsFound, 'claude');
    delete patch.expansionsFound;
  }
  return patch;
}

/** Sortierung für die Anzeige: vorhandene zuerst, dann nach Jahr und Name. */
export const sortExpansions = (list = []) => [...list].sort((a, b) => Number(b.owned) - Number(a.owned)
  || (a.year || 9999) - (b.year || 9999) || String(a.name).localeCompare(String(b.name), 'de'));

// ---------------------------------------------------------------- Filtern
export const emptyFilter = () => ({ players: null, age: null, time: null, categories: [], mechanics: [], competences: [], labels: [], query: '' });

/** Anzahl gesetzter Filter (jede gewählte Kompetenz, Spielart und Mechanik zählt einzeln). */
export const filterCount = (f) =>
  [f.players, f.age, f.time].filter((v) => v != null).length
  + f.categories.length + f.mechanics.length + f.competences.length + (f.labels || []).length + (f.query.trim() ? 1 : 0);

export const filterActive = (f) =>
  f.players != null || f.age != null || f.time != null || f.categories.length || f.mechanics.length || f.competences.length || (f.labels || []).length || !!f.query.trim();

/**
 * Wendet den Filter an und sortiert nach Passung.
 * - Gruppengröße, Alter, Zeit, Spielart: harte Bedingungen. Fehlende Angaben am Spiel schließen nicht aus.
 * - Mechaniken: Alle gewählten müssen zutreffen.
 * - Eigene Labels: mindestens eines der gewählten muss gesetzt sein.
 * - Kompetenzen: mindestens eine muss zutreffen; je mehr, desto weiter oben.
 * Liefert [{ game, hits, ideal, tight }].
 */
export function filterGames(games, f) {
  const q = norm(f.query.trim());
  const out = [];
  for (const g of games) {
    if (f.players != null) {
      if (g.playersMin && f.players < g.playersMin) continue;
      if (g.playersMax && f.players > g.playersMax) continue;
    }
    if (f.age != null && g.ageMin && g.ageMin > f.age) continue;
    if (f.time != null && g.durationMin && g.durationMin > f.time) continue;
    if (f.categories.length && !f.categories.includes(g.category)) continue;
    if ((f.labels || []).length && !f.labels.some((l) => (g.labels || []).includes(l))) continue;
    const mech = g.mechanics || [];
    if (f.mechanics.some((m) => !mech.includes(m))) continue;
    const hits = f.competences.filter((c) => (g.competences || []).includes(c)).length;
    if (f.competences.length && !hits) continue;
    if (q && !norm([g.title, g.publisher, g.description, g.pedagogy, g.notes, ...(g.tags || []),
      ...mech.map(mechanicLabel), ...(g.competences || []).map(competenceLabel),
      ...(g.expansions || []).filter((x) => x.owned).map((x) => x.name)].join(' ')).includes(q)) continue;
    const best = parseRange(g.playersBest);
    const ideal = f.players != null && !!best && f.players >= best.min && f.players <= best.max;
    const tight = f.time != null && !!g.durationMax && g.durationMax > f.time;
    out.push({ game: g, hits, ideal, tight });
  }
  return out.sort((a, b) => b.hits - a.hits || Number(b.ideal) - Number(a.ideal) || Number(a.tight) - Number(b.tight) ||
    String(a.game.title).localeCompare(String(b.game.title), 'de'));
}

// ---------------------------------------------------------------- Sortierung
export const SORTS = [
  { id: 'az', label: 'A–Z' },
  { id: 'neu', label: 'Zuletzt hinzugefügt' },
  { id: 'dauer', label: 'Spielzeit, kurze zuerst' },
  { id: 'gruppe', label: 'Für große Gruppen zuerst' },
  { id: 'alter', label: 'Für Jüngste zuerst' },
  { id: 'passung', label: 'Beste Passung zum Filter' },
];
export const DEFAULT_SORT = 'az';
const byTitle = (a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'de', { numeric: true, sensitivity: 'base' });
// Unbekannte Werte (leer) stehen immer hinten.
const byNum = (va, vb, dir = 1) => (va == null && vb == null ? 0 : va == null ? 1 : vb == null ? -1 : (va - vb) * dir);

/** Sortiert das Ergebnis von filterGames. „passung“ behält dessen Reihenfolge (Kompetenz-Treffer, ideale Spielerzahl, Zeit). */
export function sortResults(results, sort = DEFAULT_SORT) {
  if (sort === 'passung') return results;
  const cmp = {
    az: (a, b) => byTitle(a, b),
    neu: (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || byTitle(a, b),
    dauer: (a, b) => byNum(a.durationMin || a.durationMax, b.durationMin || b.durationMax) || byNum(a.durationMax, b.durationMax) || byTitle(a, b),
    gruppe: (a, b) => byNum(a.playersMax, b.playersMax, -1) || byNum(a.playersMin, b.playersMin, -1) || byTitle(a, b),
    alter: (a, b) => byNum(a.ageMin, b.ageMin) || byTitle(a, b),
  }[sort] || byTitle;
  return [...results].sort((x, y) => cmp(x.game, y.game));
}

// ---------------------------------------------------------------- Auftrag an Claude
export const ANSWER_MARK = 'spielekompass-antwort';
// Antworten aus der Zeit im LEEWAY Workspace tragen noch diese Kennzeichnung.
export const ANSWER_MARK_OLD = 'spielothek-antwort';

const VOCAB = () => `- kategorie: genau einer dieser Werte: ${CATEGORIES.map((c) => `${c.id} (${c.label})`).join(', ')}
- mechaniken: die prägenden, höchstens 5, nur aus dieser Liste: ${MECHANICS.map((m) => m.id).join(', ')}
- kompetenzen: die pädagogisch wichtigsten, die das Spiel fördert, höchstens 6, nur aus dieser Liste: ${COMPETENCES.map((c) => c.id).join(', ')}
- schlagworte: weitere passende Begriffe, die in den Listen fehlen (optional)
- beschreibung: 2 bis 3 Sätze auf Deutsch: Thema und worum es geht
- paedagogik: 1 bis 2 Sätze auf Deutsch: wofür es sich in der pädagogischen Arbeit eignet und worauf man achten sollte
- sicherheit: hoch, mittel oder niedrig (wie sicher du bist, das richtige Spiel erkannt zu haben)
- erklaervideo: Adresse eines deutschsprachigen Erklärvideos (Regelerklärung) auf YouTube, gern von bekannten deutschen Kanälen wie Hunter & Cron oder Spiel doch mal!. Nur eine Adresse, die du wirklich gefunden hast; sonst weglassen
- erklaervideo_kanal: Name des Kanals (optional)
- erweiterungen: alle bisher offiziell veröffentlichten Erweiterungen des Spiels (keine Fan-Erweiterungen, keine eigenständigen Nachfolger), je mit deutschem Namen, falls es eine deutsche Ausgabe gibt, BoardGameGeek-Nummer und Jahr. Gibt es keine, eine leere Liste`;

const ANSWER_ITEM = `{"kennung": "…", "titel": "…", "verlag": "…", "jahr": 2015,
   "spieler_min": 2, "spieler_max": 8, "spieler_ideal": "4-6",
   "dauer_min": 15, "dauer_max": 30, "alter_ab": 10, "komplexitaet": 1.8,
   "bgg_id": 178900, "bgg_url": "https://boardgamegeek.com/boardgame/178900",
   "kategorie": "familie", "mechaniken": ["party"], "kompetenzen": ["kommunikation"],
   "schlagworte": [], "beschreibung": "…", "paedagogik": "…", "sicherheit": "hoch",
   "erklaervideo": "https://www.youtube.com/watch?v=…", "erklaervideo_kanal": "…",
   "erweiterungen": [{"name": "…", "bgg_id": 123456, "jahr": 2018}],
   "quellen": ["https://…"]ZUSCHNITT}`;

/**
 * Auftrag für die Übergabe von Hand (Teilen-Menü), auch für mehrere Spiele.
 * entries = [{ game, photo: Nummer | null }]
 */
export function recognitionPrompt(entries) {
  const list = entries.map(({ game, photo }) => {
    const known = game.title && game.title !== NEW_TITLE ? `, bisher eingetragen: „${game.title}“` : '';
    return `- Kennung ${game.id}: ${photo ? `Foto ${photo}` : 'kein Foto'}${known}`;
  }).join('\n');
  const many = entries.length > 1;
  const photos = entries.some((e) => e.photo);
  const crop = photos ? ',\n   "zuschnitt": {"x": 0.1, "y": 0.05, "breite": 0.8, "hoehe": 0.9}' : '';
  return `Du hilfst mir, meine Spielesammlung (Gesellschaftsspiele) für die pädagogische Arbeit zu katalogisieren.
${many ? `Es geht um ${entries.length} Spiele. Die Fotos sind in dieser Reihenfolge angehängt:` : 'Es geht um dieses Spiel:'}
${list}

Erkenne jedes Spiel anhand der Schachtel bzw. des Titels. Nimm Spieleranzahl, Spieldauer, Alter und Komplexität möglichst von BoardGameGeek, sonst von der Schachtel. Wichtig ist vor allem die Nummer des Spiels bei BoardGameGeek (bgg_id). Ordne dann ein:
${VOCAB()}${photos ? `
- zuschnitt (nur bei Spielen mit Foto): der Bereich des Fotos, in dem die Vorderseite der Schachtel liegt, als Anteile des ganzen Bildes von 0 bis 1 (x und y = linke obere Ecke, breite, hoehe). Möglichst eng an die Kanten der Schachtel.` : ''}

Antworte nur mit einem JSON-Codeblock in genau diesem Format, ohne weiteren Text:
\`\`\`json
{"${ANSWER_MARK}": 1, "spiele": [
  ${ANSWER_ITEM.replace('ZUSCHNITT', crop)}
]}
\`\`\`
Unbekannte Werte lässt du weg oder setzt null. Erfinde nichts.`;
}

/** Auftrag für die automatische Erkennung über die Claude API (ein Spiel, mit Websuche). */
export function autoPrompt(game, hasPhoto) {
  const known = game.title && game.title !== NEW_TITLE ? game.title : '';
  const what = hasPhoto
    ? `Auf dem Foto ist ein Gesellschaftsspiel zu sehen, meist die Schachtel${known ? ` (bisher eingetragen als „${known}“)` : ''}. Erkenne das Spiel.`
    : `Es geht um das Gesellschaftsspiel „${known}“${game.publisher ? ` (${game.publisher})` : ''}.`;
  const crop = hasPhoto
    ? ',\n   "zuschnitt": {"x": 0.1, "y": 0.05, "breite": 0.8, "hoehe": 0.9}'
    : '';
  return `Du katalogisierst meine Spielesammlung für die pädagogische Arbeit.
${what}

Recherchiere mit der Websuche:
1. Zuerst auf BoardGameGeek (boardgamegeek.com): Spieleranzahl, beste Spielerzahl laut Community-Umfrage, Spieldauer, Mindestalter, Komplexität (Weight, 1 bis 5), Verlag, Jahr, Kategorien und Mechaniken.
2. Ergänzend aus weiteren verlässlichen Quellen, z. B. Verlagsseite, Spielanleitung, deutsche Rezensionen. Bei deutschen Ausgaben gelten Alter und Dauer der deutschen Schachtel, wenn sie auf dem Foto lesbar sind.

Ordne dann ein:
${VOCAB()}
- komplexitaet: BoardGameGeek-Weight als Zahl
- quellen: die Adressen, die du genutzt hast${hasPhoto ? `
- zuschnitt: der Bereich des Fotos, in dem die Vorderseite der Schachtel liegt, als Anteile des ganzen Bildes von 0 bis 1 (x und y = linke obere Ecke, breite, hoehe). Möglichst eng an die Kanten der Schachtel.` : ''}

Antworte am Ende mit genau einem JSON-Codeblock in diesem Format:
\`\`\`json
{"${ANSWER_MARK}": 1, "spiele": [
  ${ANSWER_ITEM.replace('"kennung": "…"', `"kennung": "${game.id}"`).replace('ZUSCHNITT', crop)}
]}
\`\`\`
Unbekannte Werte lässt du weg oder setzt null. Erfinde nichts.`;
}

export const NEW_TITLE = 'Neues Spiel';

// ---------------------------------------------------------------- Sammel-Auftrag Erweiterungen
export const EXP_BATCH = 15; // so viele Spiele je Sammel-Auftrag (kleiner = Antwort reißt nicht ab)

/** Spiele, für die noch keine Liste der Erweiterungen nachgeschlagen wurde. */
export const needsExpansions = (g) => isRecognized(g) && !!g.title && g.title !== NEW_TITLE && !g.expansionsAt && !(g.expansions || []).length;

/** Text-Auftrag nur für die Erweiterungen mehrerer Spiele (ohne Fotos, kostet nichts extra). */
export function expansionsPrompt(games) {
  const list = games.map((g) => `- Kennung ${g.id}: „${g.title}“${g.publisher ? `, ${g.publisher}` : ''}${g.year ? `, ${g.year}` : ''}${g.bggId ? `, BoardGameGeek-Nummer ${g.bggId}` : ''}`).join('\n');
  return `Ich pflege meine Spielesammlung (Gesellschaftsspiele). Bitte nenne mir zu jedem dieser ${games.length === 1 ? 'Spiele' : `${games.length} Spiele`} alle bisher offiziell veröffentlichten Erweiterungen:
${list}

Regeln:
- Nur offizielle Erweiterungen, keine Fan-Erweiterungen, keine eigenständigen Nachfolger oder Neuauflagen.
- Deutscher Name, falls es eine deutsche Ausgabe gibt, sonst der Originalname.
- Dazu, wenn bekannt, die Nummer bei BoardGameGeek (bgg_id) und das Jahr.
- Gibt es keine Erweiterung, eine leere Liste.
- Jedes Spiel genau einmal, mit seiner Kennung.
- Schreibe Sonderzeichen wie & direkt, nicht als HTML (&amp;).

Antworte nur mit einem JSON-Codeblock in genau diesem Format, ohne weiteren Text:
\`\`\`json
{"${ANSWER_MARK}": 1, "auftrag": "erweiterungen", "spiele": [
  {"kennung": "…", "erweiterungen": [{"name": "…", "bgg_id": 123456, "jahr": 2018}]}
]}
\`\`\`
Unbekannte Werte lässt du weg. Erfinde nichts.`;
}

const SYN_CATEGORY = { kinderspiel: 'kinder', kind: 'kinder', familienspiel: 'familie', family: 'familie', kennerspiel: 'kenner', experten: 'experte', expertenspiel: 'experte', expert: 'experte' };

function toInt(v, min, max) {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
}
const text = (v, max = 2000) => (typeof v === 'string' && v.trim() ? decodeEntities(v.trim()).slice(0, max) : undefined);

/** Ordnet freie Begriffe den bekannten Kennungen zu (z. B. „Kooperativ“ → kooperativ). */
function mapVocab(values, list) {
  const known = [];
  const extra = [];
  const lookup = new Map();
  for (const x of list) {
    lookup.set(norm(x.id), x.id);
    lookup.set(norm(x.label), x.id);
  }
  for (const v of Array.isArray(values) ? values : []) {
    if (typeof v !== 'string' || !v.trim()) continue;
    const id = lookup.get(norm(v.trim()));
    if (id) { if (!known.includes(id)) known.push(id); } else extra.push(v.trim().slice(0, 40));
  }
  return { known, extra };
}

/** Erkennt, ob ein Text (z. B. aus der Zwischenablage) eine Antwort für den Spielekompass ist. */
export const looksLikeAnswer = (raw) => { const s = String(raw || ''); return s.includes(ANSWER_MARK) || s.includes(ANSWER_MARK_OLD); };

/** HTML-Zeichen, die beim Kopieren aus Webseiten entstehen können (&amp;, &quot; …), zurückverwandeln. */
const ENTITIES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
export const decodeEntities = (s) => String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
  return ENTITIES[e.toLowerCase()] ?? m;
});

/**
 * Rettet aus einer abgeschnittenen Antwort alle vollständigen Einträge der Liste „spiele“.
 * Liest Zeichen für Zeichen und beachtet dabei Text in Anführungszeichen.
 */
function salvageItems(json) {
  const start = json.search(/"spiele"\s*:\s*\[/);
  if (start < 0) return null;
  let i = json.indexOf('[', start) + 1;
  const items = [];
  let depth = 0, from = -1, inStr = false, esc = false;
  for (; i < json.length; i++) {
    const c = json[i];
    if (inStr) {
      if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') { if (depth === 0) from = i; depth++; }
    else if (c === '}') {
      depth--;
      if (depth === 0 && from >= 0) { try { items.push(JSON.parse(json.slice(from, i + 1))); } catch { /* beschädigter Eintrag */ } from = -1; }
    } else if (c === ']' && depth === 0) break;
  }
  if (!items.length) return null;
  const head = json.slice(0, start);
  const data = { spiele: items, abgeschnitten: true };
  const auftrag = head.match(/"auftrag"\s*:\s*"([^"]*)"/);
  if (auftrag) data.auftrag = auftrag[1];
  return data;
}

/** Holt den JSON-Teil aus der Antwort (mit oder ohne Codeblock, notfalls aus einer abgeschnittenen Antwort). */
function extractJSON(raw) {
  const s = String(raw || '');
  const blocks = [...s.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  // Ohne schließende ``` (abgeschnitten): alles nach dem öffnenden Codeblock nehmen.
  const open = s.search(/```(?:json)?\s*[[{]/i);
  const body = blocks.length ? blocks[blocks.length - 1][1] : open >= 0 ? s.slice(open).replace(/^```(?:json)?/i, '') : s;
  const first = body.search(/[[{]/);
  if (first < 0) throw new Error('In der Antwort steht kein JSON. Bitte die ganze Antwort von Claude kopieren.');
  const lastClose = Math.max(body.lastIndexOf('}'), body.lastIndexOf(']'));
  const whole = body.slice(first, lastClose >= first ? lastClose + 1 : undefined);
  const rest = body.slice(first);
  // Der Reihe nach: unverändert (deutsche Anführungszeichen „…“ im Text sind gültig),
  // dann mit geraden statt typografischen Anführungszeichen (Tastatur-Autokorrektur),
  // dann mit zurückverwandelten HTML-Zeichen (&quot; &amp; …).
  const variants = [(t) => t, (t) => t.replace(/[“”„]/g, '"'), (t) => decodeEntities(t), (t) => decodeEntities(t).replace(/[“”„]/g, '"')];
  for (const v of variants) { try { return JSON.parse(v(whole)); } catch { /* nächster Versuch */ } }
  // Abgeschnittene Antwort: die vollständigen Einträge retten.
  for (const v of variants) { const data = salvageItems(v(rest)); if (data) return data; }
  throw new Error('Die Antwort ist unvollständig oder beschädigt. Bitte die ganze Antwort von Claude erneut kopieren.');
}

/** Erweiterungen aus Claudes Antwort lesen (ohne Fan-Erweiterungen). */
function readExpansions(list) {
  return list.slice(0, 80).map((e) => (typeof e === 'string' ? { name: text(e, 140) } : e && typeof e === 'object'
    ? { name: text(e.name, 140), bggId: toInt(e.bgg_id, 1, 99999999), year: toInt(e.jahr, 1900, 2100) } : null))
    .filter((e) => e && e.name && !/fan[- ]?(expansion|erweiterung)/i.test(e.name));
}

/**
 * Liest Claudes Antwort und macht daraus Änderungen für die Spiele.
 * ids = Kennungen der Spiele in der Reihenfolge des Auftrags (Rückfall, falls Claude keine Kennung nennt).
 * strict = nur über die Kennung zuordnen, ohne Rückfall auf die Reihenfolge
 * (für „Antwort übernehmen“ außerhalb des Dialogs, wo die Reihenfolge des Auftrags unbekannt ist).
 * Liefert [{ id, patch }].
 */
export function parseRecognition(raw, ids, { strict = false } = {}) {
  const data = extractJSON(raw);
  const items = Array.isArray(data) ? data : Array.isArray(data?.spiele) ? data.spiele : data && typeof data === 'object' ? [data] : [];
  if (!items.length) throw new Error('In der Antwort sind keine Spiele enthalten.');
  const onlyExpansions = data?.auftrag === 'erweiterungen';
  const used = new Set();
  const result = [];
  items.forEach((it, n) => {
    if (!it || typeof it !== 'object') return;
    let id = ids.includes(it.kennung) ? it.kennung : null;
    if (!id && !strict && ids.length === 1) id = ids[0];
    if (!id && !strict && ids[n] && !used.has(ids[n])) id = ids[n];
    if (!id || used.has(id)) return;
    used.add(id);
    if (onlyExpansions) {
      // Sammel-Auftrag: nur die Erweiterungen eintragen, alles andere am Spiel bleibt unverändert.
      if (!Array.isArray(it.erweiterungen)) return;
      const found = readExpansions(it.erweiterungen);
      const patch = { expansionsAt: new Date().toISOString() };
      if (found.length) patch.expansionsFound = found;
      result.push({ id, patch, onlyExpansions: true });
      return;
    }
    const mech = mapVocab(it.mechaniken, MECHANICS);
    const comp = mapVocab(it.kompetenzen, COMPETENCES);
    const tags = [...new Set([...mech.extra, ...comp.extra, ...(Array.isArray(it.schlagworte) ? it.schlagworte : [])]
      .filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim().slice(0, 40)))].slice(0, 10);
    let cat = norm(it.kategorie || '').trim();
    cat = SYN_CATEGORY[cat] || cat;
    const patch = {
      title: text(it.titel, 120),
      publisher: text(it.verlag, 80),
      year: toInt(it.jahr, 1800, 2100),
      playersMin: toInt(it.spieler_min, 1, 99),
      playersMax: toInt(it.spieler_max, 1, 99),
      playersBest: text(it.spieler_ideal != null ? String(it.spieler_ideal) : undefined, 20),
      durationMin: toInt(it.dauer_min, 1, 1440),
      durationMax: toInt(it.dauer_max, 1, 1440),
      ageMin: toInt(it.alter_ab, 1, 99),
      category: CAT.has(cat) ? cat : undefined,
      mechanics: mech.known.length ? mech.known : undefined,
      competences: comp.known.length ? comp.known : undefined,
      tags: tags.length ? tags : undefined,
      description: text(it.beschreibung),
      pedagogy: text(it.paedagogik),
    };
    const weight = Number.parseFloat(it.komplexitaet);
    if (Number.isFinite(weight) && weight >= 1 && weight <= 5) patch.weight = Math.round(weight * 100) / 100;
    const bggId = toInt(it.bgg_id, 1, 99999999);
    if (bggId) { patch.bggId = bggId; patch.bggUrl = `https://boardgamegeek.com/boardgame/${bggId}`; }
    const urls = (Array.isArray(it.quellen) ? it.quellen : []).filter((u) => typeof u === 'string' && /^https:\/\/[^\s"<>]+$/.test(u)).slice(0, 8);
    if (urls.length) patch.sources = urls;
    if (Array.isArray(it.erweiterungen)) {
      const found = readExpansions(it.erweiterungen);
      if (found.length) patch.expansionsFound = found;
      patch.expansionsAt = new Date().toISOString();
    }
    const video = cleanVideoUrl(it.erklaervideo);
    if (video) { patch.videoUrl = video; patch.videoChannel = text(it.erklaervideo_kanal, 60) || ''; }
    const z = it.zuschnitt;
    if (z && typeof z === 'object') {
      const box = [z.x, z.y, z.breite, z.hoehe].map(Number);
      if (box.every(Number.isFinite) && box[2] > 0.05 && box[3] > 0.05) {
        const c = (v) => Math.min(1, Math.max(0, v));
        patch.cropBox = { x: c(box[0]), y: c(box[1]), w: c(box[2]), h: c(box[3]) };
      }
    }
    for (const k of Object.keys(patch)) if (patch[k] === undefined) delete patch[k];
    if (patch.playersMin && patch.playersMax && patch.playersMin > patch.playersMax) [patch.playersMin, patch.playersMax] = [patch.playersMax, patch.playersMin];
    if (patch.durationMin && patch.durationMax && patch.durationMin > patch.durationMax) [patch.durationMin, patch.durationMax] = [patch.durationMax, patch.durationMin];
    const conf = ['hoch', 'mittel', 'niedrig'].includes(it.sicherheit) ? it.sicherheit : '';
    patch.recognition = { status: 'done', at: new Date().toISOString(), confidence: conf };
    result.push({ id, patch });
  });
  if (!result.length) throw new Error('Die Antwort passt zu keinem der Spiele. Bitte den Auftrag aus diesem Spielekompass verwenden.');
  if (data?.abgeschnitten) result.truncated = true;
  return result;
}

// ---------------------------------------------------------------- Beispielspiele
/** Bekannte Spiele ohne Foto zum Ausprobieren der Filter. Angaben nach Verlag bzw. BoardGameGeek. */
export function sampleGames() {
  const done = { status: 'done', at: new Date().toISOString(), confidence: 'hoch' };
  const g = (title, publisher, year, pl, best, dur, age, category, mechanics, competences, description, pedagogy) => ({
    id: uid(), title, publisher, year, playersMin: pl[0], playersMax: pl[1], playersBest: best,
    durationMin: dur[0], durationMax: dur[1], ageMin: age, category, mechanics, competences, tags: [],
    description, pedagogy, notes: '', cover: false, recognition: done, sample: true,
  });
  return [
    g('Codenames', 'Czech Games Edition', 2015, [2, 8], '4-8', [15, 15], 14, 'familie', ['party', 'team', 'woerter'],
      ['kommunikation', 'zusammenarbeit', 'sprache', 'empathie'],
      'Zwei Teams suchen ihre Geheimagenten in einem Raster aus Wortkarten. Wer den Überblick hat, gibt Ein-Wort-Hinweise, die möglichst viele eigene Begriffe verbinden.',
      'Gut für Gruppen, die an genauer Sprache und am Hineindenken in andere arbeiten. Die Hinweisgebenden stehen kurz im Mittelpunkt.'),
    g('Die Crew – Reist gemeinsam zum 9. Planeten', 'Kosmos', 2019, [2, 5], '4', [20, 20], 10, 'kenner', ['kooperativ', 'stichspiel', 'kampagne'],
      ['zusammenarbeit', 'kommunikation', 'strategie', 'konzentration', 'frustrationstoleranz'],
      'Ein kooperatives Stichspiel als Weltraummission: Die Gruppe erfüllt gemeinsam Aufträge, darf sich aber nur sehr eingeschränkt absprechen. Über viele Missionen wird es schwieriger.',
      'Fördert Absprache mit wenigen Worten und das gemeinsame Tragen von Misserfolgen. Kurze Missionen lassen sich gut wiederholen.'),
    g('Die Werwölfe von Düsterwald', 'Lui-même / Asmodee', 2001, [8, 18], '10-15', [30, 30], 10, 'familie', ['party', 'social-deduction', 'bluff', 'player-elimination'],
      ['kommunikation', 'empathie', 'selbstvertrauen', 'frustrationstoleranz'],
      'Im Dorf verstecken sich Werwölfe. Jede Nacht schlagen sie zu, jeden Tag diskutiert das Dorf und stimmt ab, wen es verdächtigt. Eine Spielleitung führt durch das Spiel.',
      'Stark für Argumentieren und Auftreten vor der Gruppe. Ausgeschiedene sitzen lange daneben, daher eher für stabile Gruppen; Rollen gut nachbesprechen.'),
    g('Risiko', 'Hasbro', 1959, [2, 6], '4-5', [120, 240], 10, 'familie', ['area-control', 'wuerfeln', 'player-elimination', 'verhandeln'],
      ['strategie', 'frustrationstoleranz', 'konflikt', 'entscheiden'],
      'Auf einer Weltkarte erobern die Spielenden mit Armeen Länder und Kontinente. Kämpfe werden ausgewürfelt, Bündnisse geschlossen und gebrochen.',
      'Sehr lang und konfliktreich. Eignet sich für Gespräche über Bündnisse, Fairness und den Umgang mit Niederlagen, eher für ältere Jugendliche.'),
    g('Hanabi', 'Abacus Spiele', 2010, [2, 5], '3-4', [25, 25], 8, 'familie', ['kooperativ', 'deduktion', 'merken'],
      ['zusammenarbeit', 'kommunikation', 'gedaechtnis', 'logik', 'impulskontrolle'],
      'Gemeinsam wird ein Feuerwerk aus Karten gelegt. Die eigenen Karten sieht man nicht, nur die der anderen, und Hinweise sind streng begrenzt.',
      'Trainiert genaues Zuhören, Merken und Vertrauen in die Gruppe. Ruhig und konzentriert, gut für kleine Gruppen.'),
    g('Dixit', 'Libellud', 2008, [3, 6], '5-6', [30, 30], 8, 'familie', ['erzaehlen', 'party', 'bluff'],
      ['kreativitaet', 'sprache', 'empathie', 'kommunikation'],
      'Traumhafte Bildkarten: Wer erzählt, beschreibt eine eigene Karte mit einem Wort, Satz oder Geräusch. Die anderen legen passende Karten dazu, dann wird geraten.',
      'Sprachfreundlich und offen, auch für Gruppen mit wenig Deutschkenntnissen. Gut für Gespräche über Gefühle und Fantasie.'),
    g('Mensch ärgere Dich nicht', 'Schmidt Spiele', 1914, [2, 4], '4', [30, 30], 6, 'familie', ['wuerfeln', 'wettrennen'],
      ['frustrationstoleranz', 'regeln', 'mathe', 'impulskontrolle'],
      'Der Klassiker: Mit Würfelglück laufen die eigenen Figuren einmal ums Brett ins Ziel. Wer auf ein besetztes Feld kommt, wirft die fremde Figur hinaus.',
      'Ideal, um Rausgeworfen-Werden auszuhalten und Regeln einzuhalten. Für jüngere Kinder hilft das Zählen der Felder.'),
    g('Halli Galli', 'Amigo', 1990, [2, 6], '3-4', [15, 15], 6, 'kinder', ['reaktion', 'echtzeit'],
      ['reaktion', 'konzentration', 'mathe', 'impulskontrolle'],
      'Reihum werden Obstkarten aufgedeckt. Liegen genau fünf gleiche Früchte aus, schlägt man schnell auf die Glocke.',
      'Laut und lebhaft. Fördert Zählen bis fünf, Aufmerksamkeit und das Bremsen vorschneller Reaktionen.'),
    g('Carcassonne', 'Hans im Glück', 2000, [2, 5], '2-4', [35, 35], 7, 'familie', ['plaettchen', 'area-control'],
      ['raeumlich', 'strategie', 'entscheiden'],
      'Aus Landschaftsplättchen entsteht nach und nach eine Gegend mit Städten, Straßen, Klöstern und Wiesen. Mit Figuren besetzt man Gebiete und erhält Punkte.',
      'Ruhiges Legespiel mit wenig direktem Konflikt. Gut, um vorausschauendes Planen und räumliches Denken zu üben.'),
    g('Pandemie', 'Z-Man Games / Asmodee', 2008, [2, 4], '4', [45, 45], 8, 'kenner', ['kooperativ'],
      ['zusammenarbeit', 'kommunikation', 'strategie', 'frustrationstoleranz'],
      'Als Expertenteam reist die Gruppe um die Welt, behandelt Krankheitsausbrüche und forscht nach Heilmitteln, bevor sich vier Seuchen ausbreiten.',
      'Fördert gemeinsames Planen und Rollenverteilung. Achtung: Erfahrene neigen dazu, für alle zu entscheiden.'),
    g('Obstgarten', 'HABA', 1986, [1, 8], '2-4', [10, 15], 3, 'kinder', ['kooperativ', 'wuerfeln'],
      ['zusammenarbeit', 'wahrnehmung', 'regeln', 'frustrationstoleranz', 'motorik'],
      'Gemeinsam ernten die Kinder Äpfel, Birnen, Kirschen und Pflaumen, bevor der Rabe über sein Puzzle den Obstgarten erreicht. Der Farbwürfel zeigt, was gepflückt wird.',
      'Erstes Regelspiel für Kleine: Farben erkennen, abwarten, gemeinsam gewinnen oder verlieren.'),
  ];
}
