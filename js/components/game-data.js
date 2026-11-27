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

export const TIME_STEPS = [15, 30, 45, 60, 90, 120];

const byId = (list) => new Map(list.map((x) => [x.id, x]));
const CAT = byId(CATEGORIES);
const MEC = byId(MECHANICS);
const COM = byId(COMPETENCES);

export const categoryLabel = (id) => CAT.get(id)?.label || '';
export const mechanicLabel = (id) => MEC.get(id)?.label || id;
export const competenceLabel = (id) => COM.get(id)?.label || id;

// ---------------------------------------------------------------- Anzeige
const dash = (a, b) => (a && b && a !== b ? `${a}–${b}` : String(a || b || ''));

export function playersText(g) {
  if (!g.playersMin && !g.playersMax) return '';
  const r = dash(g.playersMin, g.playersMax);
  return `${r} ${r === '1' ? 'Person' : 'Personen'}`;
}
export const durationText = (g) => (g.durationMin || g.durationMax ? `${dash(g.durationMin, g.durationMax)} Min.` : '');
export const ageText = (g) => (g.ageMin ? `ab ${g.ageMin} J.` : '');
export const timeLabel = (m) => (m >= 120 ? 'bis 2 Std.' : m >= 90 ? 'bis 1½ Std.' : `bis ${m} Min.`);

/** „4–6“ oder „4“ → { min, max } */
export function parseRange(s) {
  const nums = String(s || '').match(/\d+/g);
  if (!nums) return null;
  const a = Number(nums[0]);
  const b = Number(nums[1] ?? nums[0]);
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

export const isRecognized = (g) => g.recognition?.status === 'done';

// ---------------------------------------------------------------- Filtern
export const emptyFilter = () => ({ players: null, age: null, time: null, categories: [], mechanics: [], competences: [], query: '' });

export const filterActive = (f) =>
  f.players != null || f.age != null || f.time != null || f.categories.length || f.mechanics.length || f.competences.length || !!f.query.trim();

/**
 * Wendet den Filter an und sortiert nach Passung.
 * - Gruppengröße, Alter, Zeit, Spielart: harte Bedingungen. Fehlende Angaben am Spiel schließen nicht aus.
 * - Mechaniken: Alle gewählten müssen zutreffen.
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
    const mech = g.mechanics || [];
    if (f.mechanics.some((m) => !mech.includes(m))) continue;
    const hits = f.competences.filter((c) => (g.competences || []).includes(c)).length;
    if (f.competences.length && !hits) continue;
    if (q && !norm([g.title, g.publisher, g.description, g.pedagogy, g.notes, ...(g.tags || []),
      ...mech.map(mechanicLabel), ...(g.competences || []).map(competenceLabel)].join(' ')).includes(q)) continue;
    const best = parseRange(g.playersBest);
    const ideal = f.players != null && !!best && f.players >= best.min && f.players <= best.max;
    const tight = f.time != null && !!g.durationMax && g.durationMax > f.time;
    out.push({ game: g, hits, ideal, tight });
  }
  return out.sort((a, b) => b.hits - a.hits || Number(b.ideal) - Number(a.ideal) || Number(a.tight) - Number(b.tight) ||
    String(a.game.title).localeCompare(String(b.game.title), 'de'));
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
- sicherheit: hoch, mittel oder niedrig (wie sicher du bist, das richtige Spiel erkannt zu haben)`;

const ANSWER_ITEM = `{"kennung": "…", "titel": "…", "verlag": "…", "jahr": 2015,
   "spieler_min": 2, "spieler_max": 8, "spieler_ideal": "4-6",
   "dauer_min": 15, "dauer_max": 30, "alter_ab": 10, "komplexitaet": 1.8,
   "bgg_id": 178900, "bgg_url": "https://boardgamegeek.com/boardgame/178900",
   "kategorie": "familie", "mechaniken": ["party"], "kompetenzen": ["kommunikation"],
   "schlagworte": [], "beschreibung": "…", "paedagogik": "…", "sicherheit": "hoch",
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

export const NEW_TITLE = 'Neues Spiel';

const SYN_CATEGORY = { kinderspiel: 'kinder', kind: 'kinder', familienspiel: 'familie', family: 'familie', kennerspiel: 'kenner', experten: 'experte', expertenspiel: 'experte', expert: 'experte' };

function toInt(v, min, max) {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
}
const text = (v, max = 2000) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

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

/** Holt den JSON-Teil aus der Antwort (mit oder ohne Codeblock). */
function extractJSON(raw) {
  const s = String(raw || '');
  const blocks = [...s.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  const body = blocks.length ? blocks[blocks.length - 1][1] : s;
  const first = body.search(/[[{]/);
  const last = Math.max(body.lastIndexOf('}'), body.lastIndexOf(']'));
  if (first < 0 || last < first) throw new Error('In der Antwort steht kein JSON. Bitte die ganze Antwort von Claude kopieren.');
  const json = body.slice(first, last + 1);
  // Zuerst unverändert lesen: Deutsche Anführungszeichen („…“) im Text sind gültig und dürfen nicht ersetzt werden.
  try { return JSON.parse(json); } catch { /* weiter mit Rückfall */ }
  // Rückfall: Die Tastatur hat gerade Anführungszeichen in typografische verwandelt („Intelligente Interpunktion“).
  try {
    return JSON.parse(json.replace(/[“”„]/g, '"'));
  } catch {
    throw new Error('Die Antwort ist unvollständig oder beschädigt. Bitte die ganze Antwort von Claude erneut kopieren.');
  }
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
  const used = new Set();
  const result = [];
  items.forEach((it, n) => {
    if (!it || typeof it !== 'object') return;
    let id = ids.includes(it.kennung) ? it.kennung : null;
    if (!id && !strict && ids.length === 1) id = ids[0];
    if (!id && !strict && ids[n] && !used.has(ids[n])) id = ids[n];
    if (!id || used.has(id)) return;
    used.add(id);
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
