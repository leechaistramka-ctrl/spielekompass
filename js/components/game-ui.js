/**
 * Spielekompass: Bausteine der Oberfläche
 * - Foto zuschneiden (Titelbild)
 * - Spiel bearbeiten
 * - Erkennung mit Claude (Fotos und Auftrag über das Teilen-Menü, Antwort zurück einfügen)
 * - Kartei mit Fotos sichern und einspielen
 */
import { icon } from '../core/icons.js';
import { esc, plural, todayISO } from '../core/utils.js';
import { openDialog, fieldHTML, toast } from '../core/ui.js';
import { putImage, getImage, imageURL, deleteImage, blobToDataURL, dataURLToBlob } from '../core/image-store.js';
import {
  CATEGORIES, MECHANICS, COMPETENCES, LABELS, cleanVideoUrl, resolveExpansions, NEW_TITLE, recognitionPrompt, expansionsPrompt, needsExpansions, EXP_BATCH, parseRecognition, looksLikeAnswer,
} from './game-data.js';
import { hasApiKey, recognizeGame } from './game-ai.js';
import { hasBggToken, searchBgg, fetchBggThing, bggPatch } from './game-bgg.js';

const COVER_SIZE = 800; // längste Kante des gespeicherten Titelbilds in Pixeln
const MAX_BATCH = 10;   // so viele Fotos gehen höchstens auf einmal an Claude

// ================================================================= Titelbild anzeigen
const initials = (t) => String(t || '?').replace(/^(die|der|das|the)\s+/i, '').slice(0, 2).toUpperCase();

/** Platzhalter bzw. Rahmen für das Titelbild; das Bild selbst lädt hydrateCovers nach. */
export function coverHTML(g, cls = '') {
  return `<div class="cover ${cls}" ${g.cover ? `data-cover="${esc(g.id)}"` : ''}>
    <span class="cover-initials" aria-hidden="true">${esc(initials(g.title))}</span>
    ${g.cover ? `<img alt="" decoding="async">` : ''}
  </div>`;
}

export async function hydrateCovers(root) {
  for (const el of root.querySelectorAll('[data-cover]')) {
    try {
      const url = await imageURL(el.dataset.cover);
      const img = el.querySelector('img');
      if (url && img) { img.src = url; el.classList.add('has-image'); }
    } catch {
      /* ohne Bild bleibt der Platzhalter sichtbar */
    }
  }
}

// ================================================================= Zuschneiden
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Das Foto konnte nicht gelesen werden.'));
    img.src = src;
  });
}

const canvasBlob = (canvas, type = 'image/jpeg', q = 0.84) =>
  new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Bild konnte nicht erzeugt werden.'))), type, q));

const ASPECTS = [
  { id: '1:1', label: 'Quadrat', w: 1, h: 1 },
  { id: '3:4', label: 'Hoch', w: 3, h: 4 },
  { id: '4:3', label: 'Quer', w: 4, h: 3 },
];

/**
 * Zeigt das Foto in einem Rahmen. Verschieben mit dem Finger, Zoomen mit zwei Fingern oder dem Regler.
 * Liefert ein JPEG (Blob), 'skip' (nur bei Stapeln) oder null (abgebrochen).
 */
export function openCropDialog(file, { step = '', allowSkip = false } = {}) {
  return new Promise((resolve) => {
    let srcURL = URL.createObjectURL(file);
    let img = null;
    let aspect = ASPECTS[0];
    const v = { zoom: 1, cx: 0, cy: 0 };
    let result = null;

    const dlg = openDialog({
      title: 'Titelbild zuschneiden',
      subtitle: step || 'Schachtel in den Rahmen schieben',
      className: 'sheet-crop',
      bodyHTML: `
        <div class="crop-stage" data-stage style="aspect-ratio:1 / 1"><img class="crop-img" alt="" draggable="false"></div>
        <p class="hint small">Mit dem Finger verschieben, mit zwei Fingern oder dem Regler vergrößern.</p>
        <div class="crop-tools">
          <div class="segmented" role="group" aria-label="Format">
            ${ASPECTS.map((a, n) => `<button type="button" data-aspect="${a.id}" aria-pressed="${n === 0}">${esc(a.label)}</button>`).join('')}
          </div>
          <label class="crop-zoom">${icon('search')}<input type="range" min="1" max="4" step="0.01" value="1" data-zoom aria-label="Vergrößern"></label>
          <button type="button" class="btn btn-ghost" data-rotate>${icon('rotate')}<span>Drehen</span></button>
        </div>
        <footer class="sheet-foot crop-foot">
          ${allowSkip ? '<button type="button" class="btn btn-quiet" data-skip>Ohne Bild</button>' : ''}
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost" data-close>Abbrechen</button>
          <button type="button" class="btn btn-primary" data-ok>${icon('check')}<span>Übernehmen</span></button>
        </footer>`,
    });
    const stage = dlg.querySelector('[data-stage]');
    const view = dlg.querySelector('.crop-img');
    const zoomInput = dlg.querySelector('[data-zoom]');

    const frame = () => ({ W: stage.clientWidth || 300, H: stage.clientHeight || 300 });
    const scale = () => {
      const { W, H } = frame();
      return Math.max(W / img.naturalWidth, H / img.naturalHeight) * v.zoom;
    };
    function clamp() {
      const { W, H } = frame();
      const s = scale();
      const hw = W / (2 * s);
      const hh = H / (2 * s);
      v.cx = Math.min(img.naturalWidth - hw, Math.max(hw, v.cx));
      v.cy = Math.min(img.naturalHeight - hh, Math.max(hh, v.cy));
    }
    function draw() {
      if (!img) return;
      clamp();
      const { W, H } = frame();
      const s = scale();
      view.style.width = `${img.naturalWidth * s}px`;
      view.style.height = `${img.naturalHeight * s}px`;
      view.style.transform = `translate(${W / 2 - v.cx * s}px, ${H / 2 - v.cy * s}px)`;
      zoomInput.value = String(v.zoom);
    }
    async function load(url) {
      img = await loadImage(url);
      view.src = url;
      v.zoom = 1;
      v.cx = img.naturalWidth / 2;
      v.cy = img.naturalHeight / 2;
      draw();
    }
    const setZoom = (z) => { v.zoom = Math.min(4, Math.max(1, z)); draw(); };

    // Finger und Maus
    const pointers = new Map();
    let pinch = null;
    stage.addEventListener('pointerdown', (e) => {
      stage.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: v.zoom };
      }
    });
    stage.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p || !img) return;
      if (pointers.size === 1) {
        const s = scale();
        v.cx -= (e.clientX - p.x) / s;
        v.cy -= (e.clientY - p.y) / s;
        draw();
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()];
        setZoom(pinch.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / (pinch.d || 1)));
      }
    });
    const up = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; };
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', (e) => { e.preventDefault(); setZoom(v.zoom * (e.deltaY < 0 ? 1.08 : 0.93)); }, { passive: false });
    zoomInput.addEventListener('input', () => setZoom(Number(zoomInput.value)));

    dlg.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-aspect]');
      if (a) {
        aspect = ASPECTS.find((x) => x.id === a.dataset.aspect) || ASPECTS[0];
        dlg.querySelectorAll('[data-aspect]').forEach((b) => b.setAttribute('aria-pressed', String(b === a)));
        stage.style.aspectRatio = `${aspect.w} / ${aspect.h}`;
        draw();
      }
      if (e.target.closest('[data-rotate]') && img) {
        const c = document.createElement('canvas');
        c.width = img.naturalHeight;
        c.height = img.naturalWidth;
        const ctx = c.getContext('2d');
        ctx.translate(c.width, 0);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(img, 0, 0);
        const blob = await canvasBlob(c, 'image/jpeg', 0.92);
        URL.revokeObjectURL(srcURL);
        srcURL = URL.createObjectURL(blob);
        await load(srcURL);
      }
      if (e.target.closest('[data-skip]')) { result = 'skip'; dlg.close(); }
      if (e.target.closest('[data-ok]') && img) {
        const { W, H } = frame();
        const s = scale();
        const k = COVER_SIZE / Math.max(aspect.w, aspect.h);
        const c = document.createElement('canvas');
        c.width = Math.round(aspect.w * k);
        c.height = Math.round(aspect.h * k);
        c.getContext('2d').drawImage(img, v.cx - W / (2 * s), v.cy - H / (2 * s), W / s, H / s, 0, 0, c.width, c.height);
        try {
          result = await canvasBlob(c);
          dlg.close();
        } catch (err) {
          toast(err.message, 'danger');
        }
      }
    });
    dlg.addEventListener('close', () => { URL.revokeObjectURL(srcURL); resolve(result); });
    load(srcURL).catch((err) => { toast(err.message, 'danger'); dlg.close(); });
  });
}


/** Foto eines vorhandenen Spiels ersetzen. */
export async function replaceCover(store, game, file) {
  if (hasApiKey()) {
    const original = await shrink(file, ORIGINAL_SIZE);
    await putImage(originalKey(game.id), original);
    await putImage(game.id, await cropFromBox(original, null));
    await store.update('games', game.id, { cover: true, coverAt: new Date().toISOString() });
    return true;
  }
  const blob = await openCropDialog(file);
  if (!blob || blob === 'skip') return false;
  await putImage(game.id, blob);
  await store.update('games', game.id, { cover: true, coverAt: new Date().toISOString() });
  return true;
}

export async function removeGame(store, game) {
  forgetQueued(game.id);
  await store.remove('games', game.id);
  for (const key of [game.id, originalKey(game.id)]) {
    try { await deleteImage(key); } catch { /* Bild war schon weg */ }
  }
}

// ================================================================= Automatisch (Claude API)
const ORIGINAL_SIZE = 1568; // längste Kante des Fotos, das an Claude geht (mehr nutzt Claude nicht)
export const originalKey = (id) => `${id}:original`;

/** Foto verkleinern (JPEG). Liefert einen Blob. */
async function shrink(blob, max) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await canvasBlob(c, 'image/jpeg', 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Schneidet das Titelbild aus dem Foto. box = { x, y, w, h } als Anteile (0–1) oder null.
 * Ohne Bereich: mittiges Quadrat. Mit Bereich: etwas Rand dazu, Seitenverhältnis bleibt wie die Schachtel.
 */
export async function cropFromBox(blob, box) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    let sx; let sy; let sw; let sh;
    if (box) {
      const pad = 0.015;
      sx = Math.max(0, (box.x - pad) * W);
      sy = Math.max(0, (box.y - pad) * H);
      sw = Math.min(W - sx, (box.w + 2 * pad) * W);
      sh = Math.min(H - sy, (box.h + 2 * pad) * H);
    } else {
      const side = Math.min(W, H);
      sx = (W - side) / 2; sy = (H - side) / 2; sw = side; sh = side;
    }
    const k = Math.min(1, COVER_SIZE / Math.max(sw, sh));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(sw * k));
    c.height = Math.max(1, Math.round(sh * k));
    c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return await canvasBlob(c);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Warteschlange: Spiele werden nacheinander erkannt, damit nichts doppelt läuft.
const queue = [];
let active = null;
export const isQueued = (id) => active === id || queue.includes(id);
function forgetQueued(id) {
  const i = queue.indexOf(id);
  if (i >= 0) queue.splice(i, 1);
}

/** Spiele zur automatischen Erkennung einreihen. */
export async function enqueueRecognition(store, games) {
  for (const g of games) {
    if (!g || isQueued(g.id)) continue;
    queue.push(g.id);
    await store.update('games', g.id, { recognition: { ...(g.recognition || {}), status: 'queued', error: '' } });
  }
  runQueue(store);
}

async function runQueue(store) {
  if (active) return;
  while (queue.length) {
    active = queue.shift();
    try {
      await recognizeOne(store, active);
    } catch (err) {
      const fatal = !!err.fatal;
      if (store.get('games', active)) {
        await store.update('games', active, { recognition: { status: 'error', error: err.message || 'Erkennung fehlgeschlagen.', at: new Date().toISOString() } });
      }
      if (fatal) {
        const rest = queue.splice(0);
        for (const id of rest) {
          if (store.get('games', id)) await store.update('games', id, { recognition: { status: 'error', error: err.message } });
        }
        toast(err.message, 'danger');
      }
    }
    active = null;
  }
}

async function recognizeOne(store, id) {
  const game = store.get('games', id);
  if (!game) return;
  await store.update('games', id, { recognition: { status: 'running', at: new Date().toISOString() } });
  const original = await getImage(originalKey(id)).catch(() => null);
  const photo = original || (game.cover ? await getImage(id).catch(() => null) : null);
  if (!photo && (!game.title || game.title === NEW_TITLE)) throw new Error('Ohne Foto und Titel kann das Spiel nicht erkannt werden.');
  const b64 = photo ? (await blobToDataURL(photo)).split(',')[1] : null;
  const patch = await recognizeGame(game, b64);
  if (!store.get('games', id)) return; // inzwischen gelöscht
  if (original) {
    try {
      await putImage(id, await cropFromBox(original, patch.cropBox || null));
      patch.cover = true;
      patch.coverAt = new Date().toISOString();
    } catch { /* Titelbild bleibt wie es ist */ }
  }
  await store.update('games', id, resolveExpansions(store.get('games', id), patch));
  await enqueueBgg(store, [store.get('games', id)], { force: true });
}

/** Läuft beim Öffnen der Kartei: unterbrochene Erkennungen (z. B. App geschlossen) fortsetzen. */
export function resumeRecognition(store) {
  if (hasBggToken()) {
    const staleBgg = store.list('games').filter((g) => ['queued', 'running'].includes(g.bgg?.status) && !isBggQueued(g.id));
    if (staleBgg.length) enqueueBgg(store, staleBgg, { force: true });
  }
  if (!hasApiKey()) return;
  const stale = store.list('games').filter((g) => ['queued', 'running'].includes(g.recognition?.status) && !isQueued(g.id));
  if (stale.length) enqueueRecognition(store, stale);
}

/** Fotos vollautomatisch aufnehmen: speichern, vorläufiges Titelbild, dann Erkennung einreihen. */
export async function addGamesAutomatically(store, files, { recognize = true } = {}) {
  const list = [...files].filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|heic|webp)$/i.test(f.name));
  const created = [];
  for (const file of list) {
    const original = await shrink(file, ORIGINAL_SIZE);
    const game = await store.create('games', {
      title: NEW_TITLE, mechanics: [], competences: [], tags: [], cover: false, recognition: { status: recognize ? 'queued' : 'open' },
    });
    await putImage(originalKey(game.id), original);
    await putImage(game.id, await cropFromBox(original, null));
    await store.update('games', game.id, { cover: true, coverAt: new Date().toISOString() });
    created.push(store.get('games', game.id));
  }
  if (recognize) await enqueueRecognition(store, created);
  return created;
}

// ================================================================= Abgleich mit BoardGameGeek
// Eigene Warteschlange: ein Spiel nach dem anderen, mit Pause zwischen den Abfragen (siehe game-bgg.js).
const bggQueue = [];
let bggActive = null;
export const isBggQueued = (id) => bggActive === id || bggQueue.includes(id);
const hasTitle = (g) => !!(g && g.title && g.title !== NEW_TITLE);

/**
 * Spiele mit BoardGameGeek abgleichen (nur mit App-Schlüssel und bekanntem Titel).
 * force: auch Spiele, die schon abgeglichen sind (z. B. nach neuer Erkennung).
 * Liefert die Anzahl eingereihter Spiele.
 */
export async function enqueueBgg(store, games, { force = false } = {}) {
  if (!hasBggToken()) return 0;
  let n = 0;
  for (const g of games) {
    if (!hasTitle(g) || isBggQueued(g.id)) continue;
    if (!force && ['done', 'notfound'].includes(g.bgg?.status)) continue;
    bggQueue.push(g.id);
    n += 1;
    await store.update('games', g.id, { bgg: { ...(g.bgg || {}), status: 'queued', error: '' } });
  }
  runBggQueue(store);
  return n;
}

async function runBggQueue(store) {
  if (bggActive) return;
  while (bggQueue.length) {
    bggActive = bggQueue.shift();
    try {
      await enrichOne(store, bggActive);
    } catch (err) {
      const at = new Date().toISOString();
      if (store.get('games', bggActive)) await store.update('games', bggActive, { bgg: { status: 'error', error: err.message || 'Abgleich fehlgeschlagen.', at } });
      if (err.fatal) {
        for (const id of bggQueue.splice(0)) {
          if (store.get('games', id)) await store.update('games', id, { bgg: { status: 'error', error: err.message, at } });
        }
        toast(err.message, 'danger');
      }
    }
    bggActive = null;
  }
}

async function enrichOne(store, id) {
  const game = store.get('games', id);
  if (!hasTitle(game)) return;
  await store.update('games', id, { bgg: { ...(game.bgg || {}), status: 'running', error: '' } });
  let data = null;
  if (game.bggId) {
    // Von Claude genannte Nummer zuerst; stimmt sie nicht, wird nach dem Titel gesucht.
    try { data = await fetchBggThing(game.bggId); } catch (err) { if (err.fatal) throw err; }
  }
  if (!data) {
    const hits = await searchBgg(game.title, game.year);
    if (!hits.length) {
      if (store.get('games', id)) await store.update('games', id, { bgg: { status: 'notfound', at: new Date().toISOString() } });
      return;
    }
    data = await fetchBggThing(hits[0].id);
  }
  const cur = store.get('games', id);
  if (cur) await store.update('games', id, bggPatch(cur, data));
}

/** Zuschnitt von Hand anpassen – aus dem gespeicherten Foto, sonst aus dem Titelbild. */
export async function recropCover(store, game) {
  const src = (await getImage(originalKey(game.id)).catch(() => null)) || (await getImage(game.id).catch(() => null));
  if (!src) return false;
  const blob = await openCropDialog(src);
  if (!blob || blob === 'skip') return false;
  await putImage(game.id, blob);
  await store.update('games', game.id, { cover: true, coverAt: new Date().toISOString() });
  return true;
}

// ================================================================= Bearbeiten
const checkChips = (name, list, selected) => `<div class="check-chips" role="group">
  ${list.map((x) => `<label class="check-chip"><input type="checkbox" name="${name}" value="${esc(x.id)}" ${selected.includes(x.id) ? 'checked' : ''}><span>${esc(x.label)}</span></label>`).join('')}
</div>`;

const NUM_FIELDS = ['playersMin', 'playersMax', 'durationMin', 'durationMax', 'ageMin', 'year'];

export function openGameForm(store, game = null) {
  const g = game || { title: '', mechanics: [], competences: [], tags: [] };
  const num = (name, label, extra = {}) => ({ name, label, type: 'number', ...extra });
  const fields = [
    { name: 'title', label: 'Titel', required: true, wide: true, placeholder: 'z. B. Die Crew' },
    { name: 'publisher', label: 'Verlag' },
    num('year', 'Erscheinungsjahr'),
    num('playersMin', 'Personen von'),
    num('playersMax', 'Personen bis'),
    { name: 'playersBest', label: 'Am besten mit', placeholder: 'z. B. 4–6' },
    num('ageMin', 'Alter ab (Jahre)'),
    num('durationMin', 'Dauer von (Min.)'),
    num('durationMax', 'Dauer bis (Min.)'),
    { name: 'category', label: 'Spielart', type: 'select', wide: true, options: [{ value: '', label: '– noch offen –' }, ...CATEGORIES.map((c) => ({ value: c.id, label: `${c.label} (${c.hint})` }))] },
    { name: 'description', label: 'Worum geht es?', type: 'textarea', rows: 3, wide: true },
    { name: 'pedagogy', label: 'Pädagogischer Einsatz', type: 'textarea', rows: 3, wide: true },
    { name: 'tags', label: 'Weitere Schlagworte', wide: true, placeholder: 'durch Komma getrennt', hint: 'Begriffe, die in den Listen unten fehlen.' },
    { name: 'notes', label: 'Eigene Notizen', type: 'textarea', rows: 2, wide: true, placeholder: 'z. B. Varianten, Erfahrungen, fehlendes Material, Standort' },
    { name: 'videoUrl', label: 'Erklärvideo (YouTube-Adresse)', wide: true, placeholder: 'https://www.youtube.com/watch?v=…', hint: 'Leer lassen, wenn es keins gibt.' },
  ];
  const values = { ...g, tags: (g.tags || []).join(', ') };
  const dlg = openDialog({
    title: game ? 'Spiel bearbeiten' : 'Spiel ohne Foto anlegen',
    className: 'sheet-form sheet-game',
    bodyHTML: `<form data-game-form novalidate>
      <div class="form-grid">${fields.map((f) => fieldHTML(f, values[f.name])).join('')}</div>
      <h3 class="form-section">Meine Labels</h3>${checkChips('labels', LABELS, g.labels || [])}
      <h3 class="form-section">Mechaniken</h3>${checkChips('mechanics', MECHANICS, g.mechanics || [])}
      <h3 class="form-section">Kompetenzen, die das Spiel fördert</h3>${checkChips('competences', COMPETENCES, g.competences || [])}
      <footer class="sheet-foot">
        ${game ? `<button type="button" class="btn btn-danger-quiet" data-delete>${icon('trash')}<span>Löschen</span></button>` : ''}
        <span class="spacer"></span>
        <button type="button" class="btn btn-ghost" data-close>Abbrechen</button>
        <button type="submit" class="btn btn-primary">Speichern</button>
      </footer>
    </form>`,
  });
  dlg.querySelectorAll('input[type="number"]').forEach((i) => { i.min = '0'; i.inputMode = 'numeric'; });
  const form = dlg.querySelector('form');
  return new Promise((resolve) => {
    let saved = null;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const s = (k) => String(fd.get(k) || '').trim();
      const data = {
        title: s('title'), publisher: s('publisher'), playersBest: s('playersBest'), category: s('category'),
        description: s('description'), pedagogy: s('pedagogy'), notes: s('notes'),
        tags: [...new Set(s('tags').split(',').map((t) => t.trim()).filter(Boolean))],
        mechanics: fd.getAll('mechanics').map(String), competences: fd.getAll('competences').map(String),
        labels: fd.getAll('labels').map(String),
        videoUrl: cleanVideoUrl(s('videoUrl')),
      };
      if (data.videoUrl !== (g.videoUrl || '')) data.videoChannel = '';
      for (const k of NUM_FIELDS) {
        const n = Number.parseInt(s(k), 10);
        data[k] = Number.isFinite(n) && n > 0 ? n : null;
      }
      try {
        if (!data.title) throw new Error('Bitte einen Titel eingeben.');
        if (s('videoUrl') && !data.videoUrl) throw new Error('Das ist keine YouTube-Adresse (youtube.com/watch?v=… oder youtu.be/…).');
        if (data.playersMin && data.playersMax && data.playersMin > data.playersMax) throw new Error('„Personen von“ ist größer als „Personen bis“.');
        if (data.durationMin && data.durationMax && data.durationMin > data.durationMax) throw new Error('„Dauer von“ ist größer als „Dauer bis“.');
        if (game) {
          const rec = game.recognition?.status === 'done' ? game.recognition : { status: data.title !== NEW_TITLE && data.category ? 'done' : 'open' };
          saved = await store.update('games', game.id, { ...data, recognition: rec });
        } else {
          saved = await store.create('games', { ...data, cover: false, recognition: { status: data.category ? 'done' : 'open' } });
        }
        dlg.close('saved');
        if (!game || game.title !== data.title) enqueueBgg(store, [saved], { force: true });
      } catch (err) {
        toast(err.message, 'danger');
      }
    });
    dlg.querySelector('[data-delete]')?.addEventListener('click', () => { saved = 'delete'; dlg.close(); });
    dlg.addEventListener('close', () => resolve(saved));
  });
}

// ================================================================= Erkennen mit Claude
const canShareFiles = (files) => {
  try { return typeof navigator.share === 'function' && !!navigator.canShare?.({ files }); } catch { return false; }
};

async function copyText(textValue) {
  try { await navigator.clipboard.writeText(textValue); return true; } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: textValue, readOnly: true });
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Wendet eine eingefügte Antwort an. Liefert die Anzahl aktualisierter Spiele. */
export async function applyRecognition(store, answer, ids, options = {}) {
  const changes = parseRecognition(answer, ids, options);
  if (options.info) options.info.truncated = !!changes.truncated;
  const done = [];
  for (const { id, patch, onlyExpansions } of changes) {
    if (!store.get('games', id)) continue;
    if (onlyExpansions) {
      // Nur Erweiterungen: kein erneuter Abgleich mit BoardGameGeek, sonst bleibt alles, wie es ist.
      await store.update('games', id, resolveExpansions(store.get('games', id), patch));
      continue;
    }
    // Zuschnitt aus Claudes Antwort auf das gespeicherte Originalfoto anwenden
    const original = patch.cropBox ? await getImage(originalKey(id)).catch(() => null) : null;
    if (original) {
      try {
        await putImage(id, await cropFromBox(original, patch.cropBox));
        patch.cover = true;
        patch.coverAt = new Date().toISOString();
      } catch { /* Titelbild bleibt wie es ist */ }
    }
    done.push(await store.update('games', id, resolveExpansions(store.get('games', id), patch)));
  }
  if (done.length) await enqueueBgg(store, done, { force: true });
  return changes.filter(({ id }) => store.get('games', id)).length;
}

export const canReadClipboard = () => typeof navigator.clipboard?.readText === 'function';

/** Liest die Zwischenablage. Auf iPhone/iPad erscheint dabei kurz die Taste „Einfügen“ des Systems. */
async function readClipboard() {
  try { return await navigator.clipboard.readText(); } catch {
    throw new Error('Kein Zugriff auf die Zwischenablage. Bitte „Einfügen“ bestätigen oder die Antwort von Hand einfügen.');
  }
}

/**
 * „Antwort übernehmen“ mit einem Tipp: liest Claudes Antwort aus der Zwischenablage und trägt sie ein.
 * Funktioniert auch ohne geöffneten Dialog (z. B. nach dem Wechsel zur Claude-App und zurück);
 * zugeordnet wird dann nur über die Kennung der Spiele.
 */
export async function applyFromClipboard(store) {
  const raw = await readClipboard();
  if (!looksLikeAnswer(raw)) {
    throw new Error('In der Zwischenablage steht keine Antwort für den Spielekompass. In Claude bei der Antwort auf „Kopieren“ tippen und es erneut versuchen.');
  }
  const ids = store.list('games').map((g) => g.id);
  const n = await applyRecognition(store, raw, ids, { strict: true });
  return n;
}

/**
 * Dialog „Mit Claude erkennen“ für ein oder mehrere Spiele.
 * 1. Fotos und Auftrag über das Teilen-Menü an die Claude-App geben (oder kopieren).
 * 2. Claudes Antwort hier einfügen → Daten werden übernommen.
 */
export async function openRecognizeDialog(store, games) {
  const batch = games.slice(0, MAX_BATCH);
  let photo = 0;
  const entries = batch.map((game) => ({ game, photo: game.cover ? ++photo : null }));
  const files = [];
  for (const e of entries) {
    if (!e.photo) continue;
    // Das ganze Foto teilen (nicht das Titelbild), damit Claude den Zuschnitt darauf angeben kann.
    e.original = await getImage(originalKey(e.game.id)).catch(() => null);
    const blob = e.original || await getImage(e.game.id).catch(() => null);
    if (blob) files.push(new File([blob], `spiel-${e.photo}.jpg`, { type: 'image/jpeg' }));
    else e.photo = null;
  }
  const prompt = recognitionPrompt(entries);
  const ids = batch.map((g) => g.id);
  const share = files.length ? canShareFiles(files) : typeof navigator.share === 'function';
  const canPaste = canReadClipboard();

  const dlg = openDialog({
    title: 'Mit Claude erkennen',
    subtitle: `${plural(batch.length, 'Spiel', 'Spiele')}${games.length > batch.length ? ` (die ersten ${MAX_BATCH} von ${games.length})` : ''}`,
    className: 'sheet-recognize',
    bodyHTML: `
      <ol class="recog-steps">
        <li>
          <h3>Fotos und Auftrag an Claude geben</h3>
          <div class="recog-thumbs">${entries.map((e) => coverHTML(e.game, 'cover-thumb')).join('')}</div>
          <div class="btn-row">
            ${share ? `<button type="button" class="btn btn-primary" data-r="share">${icon('share')}<span>An Claude teilen</span></button>` : ''}
            <button type="button" class="btn ${share ? 'btn-ghost' : 'btn-primary'}" data-r="copy">${icon('copy')}<span>Auftrag kopieren</span></button>
            ${files.length && !share ? `<button type="button" class="btn btn-ghost" data-r="photos">${icon('download')}<span>Fotos speichern</span></button>` : ''}
          </div>
          <p class="hint small">${share
            ? 'Im Teilen-Menü die Claude-App wählen. Erscheint der Auftrag dort nicht, zusätzlich „Auftrag kopieren“ tippen und in Claude einfügen.'
            : 'Auftrag kopieren und in Claude einfügen, die Fotos dazu hochladen.'}</p>
        </li>
        <li>
          <h3>Antwort von Claude hier einfügen</h3>
          <div class="field"><label for="recog-answer" class="visually-hidden">Antwort von Claude</label>
            <textarea id="recog-answer" rows="5" data-r-answer placeholder="Die komplette Antwort mit dem JSON-Block einfügen"></textarea></div>
          <div class="btn-row">
            ${canPaste ? `<button type="button" class="btn btn-primary" data-r="paste">${icon('upload')}<span>Aus Zwischenablage übernehmen</span></button>` : ''}
            <button type="button" class="btn ${canPaste ? 'btn-ghost' : 'btn-primary'}" data-r="apply">${icon('check')}<span>Daten übernehmen</span></button>
          </div>
        </li>
      </ol>
      <details class="recog-prompt"><summary>Auftrag ansehen</summary><pre>${esc(prompt)}</pre></details>`,
  });
  hydrateCovers(dlg);
  const answer = dlg.querySelector('[data-r-answer]');

  return new Promise((resolve) => {
    let applied = 0;
    dlg.addEventListener('click', async (e) => {
      const el = e.target.closest('[data-r]');
      if (!el) return;
      const r = el.dataset.r;
      try {
        if (r === 'share') {
          try {
            await navigator.share(files.length ? { files, text: prompt, title: 'Spiele erkennen' } : { text: prompt, title: 'Spiele erkennen' });
            toast('Geteilt – Claude antwortet mit einem JSON-Block. Diesen danach hier einfügen.');
          } catch (err) {
            if (err.name !== 'AbortError') toast('Teilen nicht möglich – bitte „Auftrag kopieren“ verwenden.', 'danger');
          }
        }
        if (r === 'copy') {
          if (await copyText(prompt)) toast('Auftrag kopiert – in Claude einfügen');
          else toast('Kopieren hat nicht geklappt – bitte „Auftrag ansehen“ öffnen und markieren.', 'danger');
        }
        if (r === 'photos') files.forEach((f) => downloadBlob(f, f.name));
        if (r === 'paste') {
          // Ein Tipp: lesen und gleich übernehmen. Klappt das nicht, bleibt der Text zum Prüfen im Feld.
          answer.value = await readClipboard();
          if (!looksLikeAnswer(answer.value)) {
            answer.focus();
            throw new Error('In der Zwischenablage steht keine Antwort für den Spielekompass. In Claude bei der Antwort auf „Kopieren“ tippen.');
          }
          applied = await applyRecognition(store, answer.value, ids);
          dlg.close();
          toast(`${plural(applied, 'Spiel', 'Spiele')} erkannt und eingetragen`);
        }
        if (r === 'apply') {
          if (!answer.value.trim()) throw new Error('Bitte zuerst die Antwort von Claude einfügen.');
          applied = await applyRecognition(store, answer.value, ids);
          dlg.close();
          toast(`${plural(applied, 'Spiel', 'Spiele')} erkannt und eingetragen`);
        }
      } catch (err) {
        toast(err.message || 'Das hat nicht geklappt.', 'danger');
      }
    });
    dlg.addEventListener('close', () => resolve(applied));
  });
}

/**
 * Sammel-Auftrag „Erweiterungen ergänzen“: ein Text-Auftrag für bis zu EXP_BATCH Spiele ohne Liste.
 * Claudes Antwort trägt nur die Erweiterungen ein und überschreibt sonst nichts.
 */
export function openExpansionsBatchDialog(store) {
  const missing = store.list('games').filter(needsExpansions);
  const batch = missing.slice(0, EXP_BATCH);
  if (!batch.length) { toast('Alle Spiele haben schon eine Liste der Erweiterungen.'); return Promise.resolve(0); }
  const prompt = expansionsPrompt(batch);
  const ids = batch.map((g) => g.id);
  const share = typeof navigator.share === 'function';
  const canPaste = canReadClipboard();
  const dlg = openDialog({
    title: 'Erweiterungen ergänzen',
    subtitle: `${plural(batch.length, 'Spiel', 'Spiele')}${missing.length > batch.length ? ` (die ersten ${EXP_BATCH} von ${missing.length})` : ''}`,
    className: 'sheet-batch',
    bodyHTML: `
      <p class="hint">Ein einziger Text-Auftrag an deine Claude-App, ganz ohne Fotos. Übernommen werden nur die Erweiterungen, alle anderen Angaben und deine Häkchen bleiben, wie sie sind.</p>
      <ol class="recog-steps">
        <li>
          <h3>Auftrag an Claude geben</h3>
          <div class="btn-row">
            ${share ? `<button type="button" class="btn btn-primary" data-r="share">${icon('share')}<span>An Claude teilen</span></button>` : ''}
            <button type="button" class="btn ${share ? 'btn-ghost' : 'btn-primary'}" data-r="copy">${icon('copy')}<span>Auftrag kopieren</span></button>
          </div>
        </li>
        <li>
          <h3>Antwort von Claude hier einfügen</h3>
          <div class="field"><label for="exp-batch-answer" class="visually-hidden">Antwort von Claude</label>
            <textarea id="exp-batch-answer" rows="5" data-r-answer placeholder="Die komplette Antwort mit dem JSON-Block einfügen"></textarea></div>
          <div class="btn-row">
            ${canPaste ? `<button type="button" class="btn btn-primary" data-r="paste">${icon('upload')}<span>Aus Zwischenablage übernehmen</span></button>` : ''}
            <button type="button" class="btn ${canPaste ? 'btn-ghost' : 'btn-primary'}" data-r="apply">${icon('check')}<span>Erweiterungen übernehmen</span></button>
          </div>
        </li>
      </ol>
      ${missing.length > batch.length ? `<p class="hint small">Danach diesen Knopf noch einmal tippen, dann kommen die nächsten Spiele dran.</p>` : ''}
      <details class="recog-prompt"><summary>Auftrag ansehen</summary><pre>${esc(prompt)}</pre></details>`,
  });
  const answer = dlg.querySelector('[data-r-answer]');
  const apply = async () => {
    const info = {};
    const n = await applyRecognition(store, answer.value, ids, { strict: true, info });
    const left = store.list('games').filter(needsExpansions).length;
    dlg.close(); // zuerst schließen, sonst verschwindet der Hinweis mit dem Dialog
    if (info.truncated) toast(`Die Antwort war abgeschnitten: ${plural(n, 'Spiel', 'Spiele')} übernommen, ${left} noch offen. Einfach „Erweiterungen ergänzen“ erneut tippen.`, 'warning');
    else toast(`Erweiterungen für ${plural(n, 'Spiel', 'Spiele')} eingetragen${left ? ` – noch ${left} offen` : ''}`);
    return n;
  };
  return new Promise((resolve) => {
    let applied = 0;
    dlg.addEventListener('click', async (e) => {
      const el = e.target.closest('[data-r]');
      if (!el) return;
      try {
        if (el.dataset.r === 'share') {
          try { await navigator.share({ text: prompt, title: 'Erweiterungen ergänzen' }); toast('Geteilt – die Antwort von Claude danach hier übernehmen.'); } catch (err) {
            if (err.name !== 'AbortError') toast('Teilen nicht möglich – bitte „Auftrag kopieren“ verwenden.', 'danger');
          }
        }
        if (el.dataset.r === 'copy') {
          if (await copyText(prompt)) toast('Auftrag kopiert – in Claude einfügen');
          else toast('Kopieren hat nicht geklappt – bitte „Auftrag ansehen“ öffnen und markieren.', 'danger');
        }
        if (el.dataset.r === 'paste') {
          answer.value = await readClipboard();
          if (!looksLikeAnswer(answer.value)) { answer.focus(); throw new Error('In der Zwischenablage steht keine Antwort für den Spielekompass. In Claude bei der Antwort auf „Kopieren“ tippen.'); }
          applied = await apply();
        }
        if (el.dataset.r === 'apply') {
          if (!answer.value.trim()) throw new Error('Bitte zuerst die Antwort von Claude einfügen.');
          applied = await apply();
        }
      } catch (err) {
        toast(err.message || 'Das hat nicht geklappt.', 'danger');
      }
    });
    dlg.addEventListener('close', () => resolve(applied));
  });
}

// ================================================================= Kartei sichern
export const KARTEI_APP = 'leeway-spielekompass';
// Frühere Formate, die sich ebenfalls einspielen lassen (Umzug aus dem LEEWAY Workspace)
const KARTEI_OLD = 'leeway-spielothek';
const WORKSPACE_BACKUP = 'leeway-workspace';

export async function exportKartei(store) {
  const games = store.list('games');
  const images = {};
  for (const g of games) {
    if (!g.cover) continue;
    const blob = await getImage(g.id).catch(() => null);
    if (blob) images[g.id] = await blobToDataURL(blob);
  }
  const json = JSON.stringify({ app: KARTEI_APP, format: 1, exportedAt: new Date().toISOString(), games, images });
  downloadBlob(new Blob([json], { type: 'application/json' }), `spielekompass-${todayISO()}.json`);
  await store.setSettings({ lastExportAt: new Date().toISOString() }).catch(() => {});
  return games.length;
}

/**
 * Spiele (mit Fotos) aus einer Kartei-Datei übernehmen. Gleiche Spiele werden durch die neuere Fassung ersetzt.
 * Versteht auch die Kartei der früheren Spielothek und eine normale Sicherung des LEEWAY Workspace
 * (dort nur die Spiele, ohne Fotos).
 */
export async function importKartei(store, file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { throw new Error('Die Datei ist keine gültige JSON-Datei.'); }
  let list = null;
  if ((data?.app === KARTEI_APP || data?.app === KARTEI_OLD) && Array.isArray(data.games)) list = data.games;
  else if (data?.app === WORKSPACE_BACKUP && Array.isArray(data.collections?.games)) list = data.collections.games;
  if (!list) throw new Error('Diese Datei ist keine Kartei des Spielekompass (oder der früheren Spielothek).');
  const incoming = list.filter((g) => g && typeof g.id === 'string' && g.id && typeof g.title === 'string');
  const current = new Map(store.list('games').map((g) => [g.id, g]));
  const take = incoming.filter((g) => !current.has(g.id) || String(g.updatedAt || '') > String(current.get(g.id).updatedAt || ''));
  for (const g of take) {
    const url = data.images?.[g.id];
    if (url) {
      try { await putImage(g.id, await dataURLToBlob(url)); } catch { g.cover = false; }
    } else if (g.cover && !(await getImage(g.id).catch(() => null))) {
      g.cover = false; // Foto ist nicht in der Datei und auch nicht auf diesem Gerät
    }
  }
  const ids = new Set(take.map((g) => g.id));
  await store.replaceWhere('games', (g) => ids.has(g.id), take);
  return take.length;
}

export const chipsList = (ids, labelFn, selected = []) =>
  ids.map((id) => `<span class="badge ${selected.includes(id) ? 'is-hit' : ''}">${esc(labelFn(id))}</span>`).join('');
