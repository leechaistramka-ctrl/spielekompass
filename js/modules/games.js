/** Modul: Spiele – Spielesammlung als filterbare Kartei mit Titelbildern. */
import { icon } from '../core/icons.js';
import { esc, plural, daysAgo } from '../core/utils.js';
import { APP } from '../config.js';
import { emptyStateHTML, pageHeadHTML, confirmDialog, toast } from '../core/ui.js';
import { href } from '../core/router.js';
import {
  CATEGORIES, MECHANICS, COMPETENCES, TIME_STEPS, categoryLabel, mechanicLabel, competenceLabel,
  playersText, durationText, ageText, timeLabel, isRecognized, emptyFilter, filterActive, filterCount, filterGames, sampleGames,
} from '../components/game-data.js';
import {
  coverHTML, hydrateCovers, replaceCover, removeGame, openGameForm, openRecognizeDialog,
  exportKartei, importKartei, chipsList, addGamesAutomatically, enqueueRecognition, resumeRecognition, recropCover,
  enqueueBgg, applyFromClipboard, canReadClipboard,
} from '../components/game-ui.js';
import { hasApiKey, getApiKey, setApiKey, MODEL } from '../components/game-ai.js';
import { hasBggToken, getBggToken, setBggToken } from '../components/game-bgg.js';

const status = (g) => g.recognition?.status || 'open';
const isBusy = (g) => ['queued', 'running'].includes(status(g));
const bggStatus = (g) => g.bgg?.status || '';
const isBggBusy = (g) => ['queued', 'running'].includes(bggStatus(g));
const BGG_APPS = 'https://boardgamegeek.com/applications';

/** Erkennen: mit API-Schlüssel automatisch, sonst über das Teilen-Menü. */
async function recognize(store, games) {
  if (!games.length) return;
  if (hasApiKey()) {
    await enqueueRecognition(store, games);
    toast(games.length > 1 ? `${games.length} Spiele werden erkannt` : 'Claude erkennt das Spiel');
  } else {
    await openRecognizeDialog(store, games);
  }
}

// Filter bleibt erhalten, solange die App geöffnet ist.
let filter = emptyFilter();
let showAllMechanics = false;

const PHOTO_INPUT = (label, cls = 'btn-primary', multiple = true) =>
  `<label class="btn ${cls} file-btn">${icon('camera')}<span>${esc(label)}</span>
    <input type="file" accept="image/*" ${multiple ? 'multiple' : ''} data-g="photos" class="visually-hidden"></label>`;

const counted = (games, key) => {
  const m = new Map();
  for (const g of games) for (const id of g[key] || []) m.set(id, (m.get(id) || 0) + 1);
  return m;
};

const stepper = (key, label, value, unit, min, max) => `<div class="stepper" role="group" aria-label="${esc(label)}">
  <span class="stepper-label">${esc(label)}</span>
  <div class="stepper-ctl">
    <button type="button" class="btn btn-icon btn-ghost" data-g="step" data-key="${key}" data-d="-1" data-min="${min}" data-max="${max}" aria-label="${esc(label)} verringern">−</button>
    <output class="stepper-value ${value == null ? 'is-any' : ''}" data-value="${key}">${value == null ? 'egal' : `${value}${unit}`}</output>
    <button type="button" class="btn btn-icon btn-ghost" data-g="step" data-key="${key}" data-d="1" data-min="${min}" data-max="${max}" aria-label="${esc(label)} erhöhen">+</button>
  </div>
</div>`;

const chip = (kind, id, label, on, n = null) =>
  `<button type="button" class="chip" data-g="toggle" data-kind="${kind}" data-id="${esc(id)}" aria-pressed="${on}">${esc(label)}${n != null ? `<span class="chip-n">${n}</span>` : ''}</button>`;

/** Knopf „Alle Filter zurücksetzen“: immer an derselben Stelle, ohne gesetzte Filter ausgegraut. */
const resetAllHTML = () => {
  const n = filterCount(filter);
  return `<button type="button" class="btn ${n ? 'btn-primary' : 'btn-ghost'} finder-reset" data-g="reset" ${n ? '' : 'disabled'}>
    ${icon('x')}<span>Alle Filter zurücksetzen${n ? ` (${n})` : ''}</span></button>`;
};

/** Bedienfeld „Passende Spiele finden“ (ohne Suchfeld, damit es beim Tippen den Fokus behält). */
function controlsHTML(games) {
  const comp = counted(games, 'competences');
  const mech = counted(games, 'mechanics');
  const cats = new Map();
  for (const g of games) if (g.category) cats.set(g.category, (cats.get(g.category) || 0) + 1);
  // Nur Begriffe zeigen, die in der Kartei vorkommen (plus gewählte). Leere Kartei: alle.
  const visible = (list, counts, sel) => (games.length ? list.filter((x) => counts.has(x.id) || sel.includes(x.id)) : list);
  const comps = visible(COMPETENCES, comp, filter.competences);
  let mechs = visible(MECHANICS, mech, filter.mechanics).sort((a, b) => (mech.get(b.id) || 0) - (mech.get(a.id) || 0));
  const hidden = !showAllMechanics && mechs.length > 10 ? mechs.length - 10 : 0;
  if (hidden) mechs = mechs.filter((m, n) => n < 10 || filter.mechanics.includes(m.id));

  return `
    <div class="finder-row">
      ${stepper('players', 'Gruppengröße', filter.players, '', 1, 30)}
      ${stepper('age', 'Jüngste Person', filter.age, ' J.', 2, 99)}
    </div>
    <div class="finder-block">
      <p class="finder-label">${icon('clock')} Verfügbare Zeit</p>
      <div class="chips" role="group" aria-label="Verfügbare Zeit">
        <button type="button" class="chip" data-g="time" data-time="" aria-pressed="${filter.time == null}">egal</button>
        ${TIME_STEPS.map((t) => `<button type="button" class="chip" data-g="time" data-time="${t}" aria-pressed="${filter.time === t}">${esc(timeLabel(t))}</button>`).join('')}
      </div>
    </div>
    <div class="finder-block">
      <p class="finder-label">${icon('compass')} Woran möchtest du arbeiten?</p>
      <div class="chips wrap" role="group" aria-label="Kompetenzen">
        ${comps.map((c) => chip('competences', c.id, c.label, filter.competences.includes(c.id), games.length ? comp.get(c.id) || 0 : null)).join('')}
      </div>
    </div>
    <div class="finder-block">
      <p class="finder-label">${icon('dice')} Spielart</p>
      <div class="chips" role="group" aria-label="Spielart">
        ${CATEGORIES.map((c) => chip('categories', c.id, c.label, filter.categories.includes(c.id), games.length ? cats.get(c.id) || 0 : null)).join('')}
      </div>
    </div>
    <div class="finder-block">
      <p class="finder-label">${icon('sparkle')} Mechanik</p>
      <div class="chips wrap" role="group" aria-label="Mechaniken">
        ${mechs.map((m) => chip('mechanics', m.id, m.label, filter.mechanics.includes(m.id), games.length ? mech.get(m.id) || 0 : null)).join('')}
        ${hidden ? `<button type="button" class="chip chip-more" data-g="more-mech">+ ${hidden} weitere</button>` : ''}
      </div>
    </div>`;
}

function statusBadge(g) {
  const st = status(g);
  if (st === 'running') return `<span class="badge badge-busy"><span class="spinner" aria-hidden="true"></span>wird erkannt …</span>`;
  if (st === 'queued') return `<span class="badge badge-open">${icon('clock')}wartet auf Erkennung</span>`;
  if (st === 'error') return `<span class="badge due-danger">${icon('info')}Erkennung fehlgeschlagen</span>`;
  if (!isRecognized(g)) return `<span class="badge badge-open">${icon('info')}noch nicht erkannt</span>`;
  if (isBggBusy(g)) return `<span class="badge badge-busy"><span class="spinner" aria-hidden="true"></span>BoardGameGeek …</span>`;
  return '';
}

function cardHTML({ game: g, hits, ideal, tight }) {
  const facts = [playersText(g), durationText(g), ageText(g)].filter(Boolean);
  return `<a class="game-card" href="${href('games/' + encodeURIComponent(g.id))}" data-id="${esc(g.id)}">
    ${coverHTML(g)}
    <div class="game-card-body">
      <h3 class="game-title">${esc(g.title)}</h3>
      ${facts.length ? `<p class="game-facts">${facts.map(esc).join(' · ')}</p>` : ''}
      <div class="game-badges">
        ${g.category ? `<span class="badge cat-${esc(g.category)}">${esc(categoryLabel(g.category))}</span>` : ''}
        ${statusBadge(g)}
        ${filter.competences.length ? `<span class="badge is-hit">${icon('check')}${hits} von ${filter.competences.length} Zielen</span>` : ''}
        ${ideal ? '<span class="badge is-hit">ideale Gruppengröße</span>' : ''}
        ${tight ? '<span class="badge due-warn">kann länger dauern</span>' : ''}
      </div>
    </div>
  </a>`;
}

function resultsHTML(games) {
  if (!games.length) {
    return emptyStateHTML({
      iconName: 'dice', title: 'Noch keine Spiele in der Kartei',
      text: 'Fotografiere die Schachtel eines Spiels. Claude erkennt es und trägt Spieleranzahl, Dauer, Alter, Mechaniken und Kompetenzen ein. Du hast schon Spiele in der Spielothek des LEEWAY Workspace erfasst? Dann spiele die exportierte Kartei ein.',
      actionsHTML: `${PHOTO_INPUT('Spiel fotografieren')}<label class="btn btn-ghost file-btn">${icon('upload')}<span>Kartei einspielen …</span><input type="file" accept="application/json,.json" data-g="import" class="visually-hidden"></label><button type="button" class="btn btn-ghost" data-g="sample">${icon('sparkle')}<span>Beispielspiele laden</span></button>`,
    });
  }
  const list = filterGames(games, filter);
  const head = `<div class="results-head">
    <h2>${filterActive(filter) ? esc(plural(list.length, 'passendes Spiel', 'passende Spiele')) : esc(plural(games.length, 'Spiel', 'Spiele'))}</h2>
    ${filterActive(filter) ? `<button type="button" class="btn btn-quiet btn-small" data-g="reset">${icon('x')}<span>Filter zurücksetzen</span></button>` : ''}
  </div>`;
  if (!list.length) {
    return head + emptyStateHTML({
      iconName: 'search', title: 'Kein Spiel passt zu allen Wünschen', text: 'Lockere einen Filter, z. B. die Zeit oder eine Mechanik.',
      actionsHTML: `<button type="button" class="btn btn-primary" data-g="reset">${icon('x')}<span>Alle Filter zurücksetzen</span></button>`,
    });
  }
  return `${head}<div class="game-grid">${list.map(cardHTML).join('')}</div>`;
}

function openBarHTML(games) {
  const busy = games.filter(isBusy);
  const open = games.filter((g) => !isBusy(g) && !isRecognized(g));
  const parts = [];
  const bggBusy = games.filter((g) => !isBusy(g) && isBggBusy(g));
  if (bggBusy.length) {
    parts.push(`<section class="dev-bar recog-bar is-busy" aria-live="polite" data-bgg-bar>
      <div class="dev-bar-text">
        <strong><span class="spinner" aria-hidden="true"></span>BoardGameGeek ergänzt ${esc(plural(bggBusy.length, 'Spiel', 'Spiele'))}</strong>
        <span class="small muted">Spieleranzahl, Dauer, Alter, Komplexität und Mechaniken; Spielart und Kompetenzen leitet die App daraus ab. Ein paar Sekunden je Spiel.</span>
      </div>
    </section>`);
  }
  if (busy.length) {
    parts.push(`<section class="dev-bar recog-bar is-busy" aria-live="polite">
      <div class="dev-bar-text">
        <strong><span class="spinner" aria-hidden="true"></span>Claude erkennt ${esc(plural(busy.length, 'Spiel', 'Spiele'))}</strong>
        <span class="small muted">Suche auf BoardGameGeek und weiteren Quellen, Zuschnitt und Einordnung laufen automatisch. Etwa ein bis zwei Minuten je Spiel; die App sollte dabei geöffnet bleiben.</span>
      </div>
    </section>`);
  }
  if (open.length) {
    const errors = open.filter((g) => status(g) === 'error').length;
    parts.push(`<section class="dev-bar recog-bar" aria-label="Noch nicht erkannte Spiele">
      <div class="dev-bar-text">
        <strong>${esc(plural(open.length, 'Spiel ist', 'Spiele sind'))} noch nicht erkannt${errors ? ` (${errors} mit Fehler)` : ''}</strong>
        <span class="small muted">${hasApiKey() ? 'Claude erkennt sie automatisch und holt die Daten von BoardGameGeek.' : `Fotos und Auftrag gehen über das Teilen-Menü an deine Claude-App (ohne Zusatzkosten). Danach in Claude die Antwort kopieren und hier „Antwort übernehmen“ tippen.${hasBggToken() ? ' Die Daten von BoardGameGeek kommen danach automatisch dazu.' : ''}`}</span>
      </div>
      <div class="dev-bar-actions">
        ${!hasApiKey() && canReadClipboard() ? `<button type="button" class="btn btn-primary" data-g="paste-answer">${icon('upload')}<span>Antwort übernehmen</span></button>` : ''}
        <button type="button" class="btn ${!hasApiKey() && canReadClipboard() ? 'btn-ghost' : 'btn-primary'}" data-g="recognize-open">${icon('sparkle')}<span>${hasApiKey() ? 'Jetzt erkennen' : 'Mit Claude erkennen'}</span></button>
      </div>
    </section>`);
  }
  return parts.join('');
}

function bggPanelHTML() {
  const token = getBggToken();
  return `<div class="api-block" id="verbindung-bgg">
    <h3>${icon('links')} BoardGameGeek</h3>
    ${token
      ? `<p class="api-state is-on">${icon('check')}<span>Verbunden mit App-Schlüssel …${esc(token.slice(-4))}</span></p>
        <p class="muted small">Sobald ein Spiel einen Titel hat, holt die App Spieleranzahl, beste Spielerzahl, Dauer, Alter, Komplexität und Mechaniken von BoardGameGeek. Spielart und Kompetenzen leitet sie daraus ab, wenn noch nichts eingetragen ist. Kostenlos.</p>
        <div class="btn-row">
          <button type="button" class="btn btn-ghost" data-g="bgg-all">${icon('rotate')}<span>Alle Spiele abgleichen</span></button>
          <button type="button" class="btn btn-danger-quiet" data-g="bgg-remove">${icon('trash')}<span>Schlüssel entfernen</span></button>
        </div>`
      : `<p class="muted small">Kostenlos mit deinem BoardGameGeek-Konto: Unter <a href="${BGG_APPS}" target="_blank" rel="noopener noreferrer">boardgamegeek.com/applications</a> eine Anwendung anlegen (nicht kommerziell), dort einen Schlüssel („Token“) erzeugen und hier einfügen. Dein Passwort brauchst du dafür nicht. Der Schlüssel bleibt nur auf diesem Gerät und ist nicht Teil von Sicherungen.</p>
        <form class="api-form" data-g-form="bgg">
          <label class="visually-hidden" for="bgg-token">App-Schlüssel von BoardGameGeek</label>
          <input id="bgg-token" type="password" name="token" placeholder="App-Schlüssel (Token)" autocomplete="off" spellcheck="false" required>
          <button type="submit" class="btn btn-primary">${icon('check')}<span>Speichern</span></button>
        </form>`}
  </div>`;
}

function claudePanelHTML() {
  const key = getApiKey();
  return `<div class="api-block" id="verbindung-api">
    <h3>${icon('sparkle')} Claude API (optional, kostenpflichtig)</h3>
    ${key
      ? `<p class="api-state is-on">${icon('check')}<span>Aktiv mit Schlüssel …${esc(key.slice(-4))} · Modell ${esc(MODEL)}</span></p>
        <p class="muted small">Neue Fotos werden ohne Teilen-Schritt erkannt, zugeschnitten und eingeordnet. Kosten: je Spiel grob 5 bis 20 Cent, abgerechnet über die Claude Console.</p>
        <div class="btn-row"><button type="button" class="btn btn-danger-quiet" data-g="api-remove">${icon('trash')}<span>Schlüssel entfernen</span></button></div>`
      : `<p class="muted small">Nicht nötig: Ohne Schlüssel teilst du die Fotos an deine Claude-App, das ist mit deinem Abo abgedeckt. Nur wer auch diesen Schritt sparen will, hinterlegt einen API-Schlüssel der Claude Console; dann kostet jedes Spiel etwas.</p>
        <form class="api-form" data-g-form="api">
          <label class="visually-hidden" for="api-key">API-Schlüssel</label>
          <input id="api-key" type="password" name="key" placeholder="sk-ant-…" autocomplete="off" spellcheck="false" required>
          <button type="submit" class="btn btn-ghost">${icon('check')}<span>Speichern</span></button>
        </form>`}
  </div>`;
}

const apiPanelHTML = () => `<section class="panel api-panel">
  <h2>${icon('settings')} Verbindungen</h2>
  ${bggPanelHTML()}
  ${claudePanelHTML()}
</section>`;

// ================================================================= Liste
/** Erinnerung an die Sicherung, wenn die letzte Kartei zu alt ist. */
function backupHint(store) {
  const last = store.settings.lastExportAt;
  const ago = daysAgo(last);
  if (last && ago < APP.backupReminderDays) return '';
  return ` <strong>${last ? `Letzte Sicherung vor ${esc(plural(ago, 'Tag', 'Tagen'))}.` : 'Noch keine Sicherung.'}</strong>`;
}

function renderList(root, store) {
  const games = store.list('games');
  root.innerHTML = `
    ${pageHeadHTML({
      eyebrow: 'Spielekompass', title: 'Deine Spiele',
      intro: 'Deine Spiele als Kartei: fotografieren, von Claude einordnen lassen und für jede Gruppe das passende Spiel finden.',
      actionsHTML: games.length ? `${PHOTO_INPUT('Spiel fotografieren')}<button type="button" class="btn btn-ghost" data-g="new">${icon('plus')}<span>Ohne Foto</span></button>` : '',
    })}
    <div data-openbar>${openBarHTML(games)}</div>
    ${games.length ? `<section class="panel finder" aria-label="Passende Spiele finden">
      <div class="panel-head"><h2>Passende Spiele finden</h2><div data-reset-all>${resetAllHTML()}</div></div>
      <label class="search">${icon('search')}<input type="search" placeholder="Titel, Thema oder Begriff" value="${esc(filter.query)}" data-g="search" aria-label="Spiele durchsuchen"></label>
      <div data-controls>${controlsHTML(games)}</div>
      <div class="finder-foot" data-reset-all>${resetAllHTML()}</div>
      <p class="hint small">Mechaniken müssen alle zutreffen. Bei Kompetenzen reicht eine; Spiele mit mehr Treffern stehen oben.</p>
    </section>` : ''}
    <div data-results>${resultsHTML(games)}</div>
    ${games.length ? `<section class="panel kartei-panel">
      <h2>${icon('download')} Kartei sichern</h2>
      <p class="muted small">Deine Spiele liegen nur auf diesem Gerät. Die Kartei-Datei enthält alle Angaben und Fotos – zum Sichern oder für ein zweites Gerät.${backupHint(store)}</p>
      <div class="btn-row">
        <button type="button" class="btn btn-ghost" data-g="export">${icon('download')}<span>Kartei exportieren</span></button>
        <label class="btn btn-ghost file-btn">${icon('upload')}<span>Kartei einspielen …</span><input type="file" accept="application/json,.json" data-g="import" class="visually-hidden"></label>
      </div>
    </section>` : ''}
    <div data-api>${apiPanelHTML()}</div>`;
  hydrateCovers(root);
  resumeRecognition(store);

  const refresh = () => {
    const all = store.list('games');
    const controls = root.querySelector('[data-controls]');
    if (controls) controls.innerHTML = controlsHTML(all);
    root.querySelectorAll('[data-reset-all]').forEach((el) => { el.innerHTML = resetAllHTML(); });
    root.querySelector('[data-results]').innerHTML = resultsHTML(all);
    root.querySelector('[data-openbar]').innerHTML = openBarHTML(all);
    hydrateCovers(root.querySelector('[data-results]'));
  };
  // Für update(): nur Teile neu zeichnen, damit Suche und Filter beim Erkennen im Hintergrund nicht springen.
  root.__refresh = refresh;
  root.__count = games.length;

  root.addEventListener('submit', async (e) => {
    if (e.target.dataset.gForm === 'bgg') {
      e.preventDefault();
      const token = String(new FormData(e.target).get('token') || '').trim();
      if (!/^[\w.-]{16,}$/.test(token)) { toast('Das sieht nicht wie ein App-Schlüssel von BoardGameGeek aus.', 'danger'); return; }
      setBggToken(token);
      root.querySelector('[data-api]').innerHTML = apiPanelHTML();
      const n = await enqueueBgg(store, store.list('games').filter((g) => !g.sample));
      toast(n ? `BoardGameGeek verbunden – ${plural(n, 'Spiel wird', 'Spiele werden')} abgeglichen` : 'BoardGameGeek verbunden');
      refresh();
      return;
    }
    if (e.target.dataset.gForm !== 'api') return;
    e.preventDefault();
    const key = String(new FormData(e.target).get('key') || '').trim();
    if (!/^sk-ant-[\w-]{10,}$/.test(key)) { toast('Das sieht nicht wie ein API-Schlüssel aus (beginnt mit „sk-ant-“).', 'danger'); return; }
    setApiKey(key);
    root.querySelector('[data-api]').innerHTML = apiPanelHTML();
    refresh();
    toast('Automatische Erkennung ist aktiv');
  });

  root.addEventListener('input', (e) => {
    if (e.target.matches('[data-g="search"]')) { filter.query = e.target.value; refresh(); }
  });
  root.addEventListener('change', async (e) => {
    const g = e.target.dataset?.g;
    if (g === 'photos' && e.target.files?.length) {
      const files = [...e.target.files];
      e.target.value = '';
      if (hasApiKey()) {
        try {
          const created = await addGamesAutomatically(store, files);
          if (created.length) toast(`${plural(created.length, 'Foto', 'Fotos')} übernommen – Claude erkennt jetzt`);
        } catch (err) {
          toast(err.message, 'danger');
        }
        return;
      }
      // Ohne API-Schlüssel: Foto speichern, vorläufig mittig zuschneiden, dann an die Claude-App teilen.
      // Den genauen Zuschnitt liefert Claude in der Antwort mit.
      try {
        const created = await addGamesAutomatically(store, files, { recognize: false });
        if (created.length) {
          toast(`${plural(created.length, 'Spiel', 'Spiele')} angelegt`);
          await openRecognizeDialog(store, created);
        }
      } catch (err) {
        toast(err.message, 'danger');
      }
    }
    if (g === 'import' && e.target.files?.[0]) {
      try {
        const n = await importKartei(store, e.target.files[0]);
        toast(n ? `${plural(n, 'Spiel', 'Spiele')} übernommen` : 'Alles war schon auf dem neuesten Stand');
      } catch (err) {
        toast(err.message, 'danger');
      }
      e.target.value = '';
    }
  });
  root.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-g]');
    if (!el) return;
    const a = el.dataset.g;
    if (a === 'step') {
      const key = el.dataset.key;
      const d = Number(el.dataset.d);
      const min = Number(el.dataset.min);
      const max = Number(el.dataset.max);
      const start = key === 'players' ? 4 : 8;
      const cur = filter[key];
      if (cur == null) filter[key] = start;
      else if (cur + d < min) filter[key] = null;
      else filter[key] = Math.min(max, cur + d);
      refresh();
    }
    if (a === 'time') { filter.time = el.dataset.time ? Number(el.dataset.time) : null; refresh(); }
    if (a === 'toggle') {
      const list = filter[el.dataset.kind];
      const i = list.indexOf(el.dataset.id);
      if (i >= 0) list.splice(i, 1); else list.push(el.dataset.id);
      refresh();
    }
    if (a === 'more-mech') { showAllMechanics = true; refresh(); }
    if (a === 'reset') {
      filter = emptyFilter();
      const s = root.querySelector('[data-g="search"]');
      if (s) s.value = '';
      refresh();
    }
    if (a === 'new') {
      const saved = await openGameForm(store);
      if (saved && saved !== 'delete') toast('Spiel angelegt');
    }
    if (a === 'sample') {
      await store.replaceWhere('games', () => false, sampleGames());
      toast('Beispielspiele geladen');
    }
    if (a === 'paste-answer') {
      try {
        const n = await applyFromClipboard(store);
        toast(`${plural(n, 'Spiel', 'Spiele')} erkannt und eingetragen`);
      } catch (err) {
        toast(err.message || 'Das hat nicht geklappt.', 'danger');
      }
    }
    if (a === 'recognize-open') await recognize(store, store.list('games').filter((g) => !isBusy(g) && !isRecognized(g)));
    if (a === 'bgg-remove') {
      setBggToken('');
      root.querySelector('[data-api]').innerHTML = apiPanelHTML();
      toast('Schlüssel entfernt');
    }
    if (a === 'bgg-all') {
      const n = await enqueueBgg(store, store.list('games'), { force: true });
      toast(n ? `${plural(n, 'Spiel wird', 'Spiele werden')} mit BoardGameGeek abgeglichen` : 'Kein Spiel mit Titel zum Abgleichen');
    }
    if (a === 'api-remove') {
      setApiKey('');
      root.querySelector('[data-api]').innerHTML = apiPanelHTML();
      refresh();
      toast('Schlüssel entfernt');
    }
    if (a === 'export') {
      try { toast(`${plural(await exportKartei(store), 'Spiel', 'Spiele')} exportiert`); } catch (err) { toast(err.message, 'danger'); }
    }
  });
}

// ================================================================= Detail
function renderDetail(root, store, id, navigate) {
  const g = store.get('games', id);
  if (!g) {
    root.innerHTML = `<a class="back" href="${href('games')}">${icon('chevron-left')}Alle Spiele</a>
      ${emptyStateHTML({ iconName: 'dice', title: 'Spiel nicht gefunden', text: 'Vielleicht wurde es gelöscht.' })}`;
    return;
  }
  const fact = (ic, label, value) => (value ? `<div class="game-fact">${icon(ic)}<span class="small muted">${esc(label)}</span><strong>${esc(value)}</strong></div>` : '');
  const conf = g.recognition?.confidence;
  root.innerHTML = `
    <a class="back" href="${href('games')}">${icon('chevron-left')}Alle Spiele</a>
    <div class="game-detail">
      <div class="game-cover-col">
        ${coverHTML(g, 'cover-large')}
        <div class="btn-row">${PHOTO_INPUT(g.cover ? 'Foto ersetzen' : 'Foto hinzufügen', 'btn-ghost', false)}
          ${g.cover ? `<button type="button" class="btn btn-ghost" data-g="recrop">${icon('edit')}<span>Zuschnitt anpassen</span></button>` : ''}</div>
      </div>
      <div class="game-main">
        <header class="page-head">
          <div class="page-head-text">
            <p class="eyebrow">${esc([categoryLabel(g.category), g.publisher, g.year].filter(Boolean).join(' · ') || 'Spiel')}</p>
            <h1>${esc(g.title)}</h1>
          </div>
          <div class="page-actions">
            <button type="button" class="btn btn-ghost" data-g="edit">${icon('edit')}<span>Bearbeiten</span></button>
            <button type="button" class="btn btn-icon btn-ghost" data-g="delete" aria-label="Spiel löschen">${icon('trash')}</button>
          </div>
        </header>
        <div class="game-facts-grid">
          ${fact('users', 'Personen', playersText(g).replace(/ Personen?$/, ''))}
          ${fact('users', 'Am besten mit', g.playersBest)}
          ${fact('clock', 'Dauer', durationText(g))}
          ${fact('flag', 'Alter', ageText(g))}
          ${g.weight ? fact('compass', 'Komplexität', `${String(g.weight).replace('.', ',')} von 5`) : ''}
        </div>
        ${isBusy(g) ? `<section class="panel recog-hint" aria-live="polite">
          <p><span class="spinner" aria-hidden="true"></span><span>${status(g) === 'running' ? 'Claude erkennt das Spiel gerade und sucht auf BoardGameGeek …' : 'Wartet auf die Erkennung.'}</span></p>
        </section>` : !isRecognized(g) || conf === 'niedrig' ? `<section class="panel recog-hint">
          <p>${icon('info')}<span>${status(g) === 'error' ? `Die Erkennung hat nicht geklappt: ${esc(g.recognition?.error || '')}` : isRecognized(g) ? 'Claude war sich bei diesem Spiel unsicher. Bitte die Angaben prüfen.' : 'Dieses Spiel ist noch nicht erkannt.'}</span></p>
          <div class="btn-row"><button type="button" class="btn btn-primary" data-g="recognize">${icon('sparkle')}<span>${status(g) === 'error' ? 'Erneut versuchen' : 'Mit Claude erkennen'}</span></button></div>
        </section>` : ''}
        ${bggHintHTML(g)}
        ${g.description ? `<section class="panel"><h2>Worum geht es?</h2><p class="game-text">${esc(g.description)}</p></section>` : ''}
        ${(g.competences || []).length || g.pedagogy ? `<section class="panel"><h2>Pädagogisch</h2>
          ${g.pedagogy ? `<p class="game-text">${esc(g.pedagogy)}</p>` : ''}
          ${(g.competences || []).length ? `<p class="finder-label">Fördert</p><div class="game-badges">${chipsList(g.competences, competenceLabel)}</div>` : ''}
        </section>` : ''}
        ${(g.mechanics || []).length || (g.tags || []).length ? `<section class="panel"><h2>Mechanik</h2>
          <div class="game-badges">${chipsList(g.mechanics || [], mechanicLabel)}${(g.tags || []).map((t) => `<span class="badge badge-tag">${esc(t)}</span>`).join('')}</div>
        </section>` : ''}
        ${g.notes ? `<section class="panel"><h2>Eigene Notizen</h2><p class="game-text">${esc(g.notes)}</p></section>` : ''}
        ${g.bggUrl || (g.sources || []).length ? `<section class="panel"><h2>Quellen</h2><ul class="source-list">
          ${g.bggUrl ? `<li><a href="${esc(g.bggUrl)}" target="_blank" rel="noopener noreferrer">${icon('links')}<span>BoardGameGeek</span></a></li>` : ''}
          ${(g.sources || []).filter((u) => u !== g.bggUrl && /^https:\/\//.test(u)).map((u) => `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${icon('links')}<span>${esc(hostOf(u))}</span></a></li>`).join('')}
        </ul></section>` : ''}
        ${isRecognized(g) && !isBusy(g) ? `<p class="small muted recog-again"><button type="button" class="btn btn-quiet btn-small" data-g="recognize">${icon('sparkle')}<span>Erneut mit Claude erkennen</span></button></p>` : ''}
      </div>
    </div>`;
  hydrateCovers(root);
  resumeRecognition(store);

  const del = async () => {
    const ok = await confirmDialog({ title: 'Spiel löschen?', message: `„${g.title}“ wird mit Foto aus der Kartei entfernt.`, confirmLabel: 'Löschen', danger: true });
    if (!ok) return;
    navigate('games');
    await removeGame(store, g);
    toast('Spiel gelöscht');
  };
  root.addEventListener('change', async (e) => {
    if (e.target.dataset?.g === 'photos' && e.target.files?.[0]) {
      const file = e.target.files[0];
      e.target.value = '';
      try { if (await replaceCover(store, g, file)) toast('Titelbild gespeichert'); } catch (err) { toast(err.message, 'danger'); }
    }
  });
  root.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-g]');
    if (!el) return;
    const a = el.dataset.g;
    if (a === 'edit') {
      const res = await openGameForm(store, store.get('games', g.id));
      if (res === 'delete') await del();
      else if (res) toast('Gespeichert');
    }
    if (a === 'delete') await del();
    if (a === 'recognize') await recognize(store, [store.get('games', g.id)]);
    if (a === 'bgg') {
      if (await enqueueBgg(store, [store.get('games', g.id)], { force: true })) toast('Wird mit BoardGameGeek abgeglichen');
      else toast('Erst einen Titel eintragen', 'danger');
    }
    if (a === 'recrop') {
      try { if (await recropCover(store, store.get('games', g.id))) toast('Titelbild gespeichert'); } catch (err) { toast(err.message, 'danger'); }
    }
  });
}

/** Hinweis zum BGG-Abgleich in der Detailansicht. */
function bggHintHTML(g) {
  if (!hasBggToken() || isBusy(g) || !g.title || g.title === 'Neues Spiel') return '';
  const st = bggStatus(g);
  if (isBggBusy(g)) {
    return `<section class="panel recog-hint" aria-live="polite" data-bgg-hint>
      <p><span class="spinner" aria-hidden="true"></span><span>Daten werden von BoardGameGeek geholt …</span></p></section>`;
  }
  if (st === 'error' || st === 'notfound') {
    const msg = st === 'error' ? `Der Abgleich mit BoardGameGeek hat nicht geklappt: ${g.bgg?.error || ''}`
      : `„${g.title}“ wurde bei BoardGameGeek nicht gefunden. Oft hilft der englische Originaltitel (unter „Bearbeiten“).`;
    return `<section class="panel recog-hint" data-bgg-hint><p>${icon('info')}<span>${esc(msg)}</span></p>
      <div class="btn-row"><button type="button" class="btn btn-ghost" data-g="bgg">${icon('rotate')}<span>Erneut abgleichen</span></button></div></section>`;
  }
  if (st !== 'done') {
    return `<p class="small muted recog-again" data-bgg-hint><button type="button" class="btn btn-quiet btn-small" data-g="bgg">${icon('links')}<span>Mit BoardGameGeek abgleichen</span></button></p>`;
  }
  return '';
}

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

export default {
  id: 'games',
  title: 'Spiele',
  icon: 'dice',
  group: 'work',
  primary: true,
  status: 'ready',
  render(root, { store, params, navigate }) {
    if (params[0]) renderDetail(root, store, params[0], navigate);
    else renderList(root, store);
  },

  /** Liste: nur Ergebnisse, Filter und Statusleiste neu zeichnen (Suchfeld behält Fokus). */
  update(root, { store, params }, change) {
    if (params[0] || !root.__refresh || change.col !== 'games') return false;
    if ((store.count('games') > 0) !== (root.__count > 0)) return false;
    root.__refresh();
    return true;
  },
};
