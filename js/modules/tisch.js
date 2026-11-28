/**
 * Modul: Am Tisch – Zugreihenfolge, Punkteblock (Runden oder Wertung je Spiel) und Timer.
 * Der Stand einer Partie liegt nur auf diesem Gerät (localStorage) und übersteht ein Neuladen.
 */
import { icon } from '../core/icons.js';
import { esc, uid, todayISO } from '../core/utils.js';
import { pageHeadHTML, openDialog, toast } from '../core/ui.js';
import { NEW_TITLE } from '../components/game-data.js';
import { sortPeople } from '../components/play-data.js';

const KEY = 'leeway-spielekompass-tisch';
const fresh = () => ({
  view: 'reihenfolge', gameId: '', players: [], turn: 0, round: 1,
  scoring: 'runden', rounds: [{}], sel: null, cats: [], catScores: {}, catPlayer: null,
  timer: { style: 'sand', seconds: 60 },
});
function load() {
  try { return { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return fresh(); }
}
let state = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* nur für diese Sitzung */ } };

const VIEWS = [
  { id: 'reihenfolge', label: 'Reihenfolge', icon: 'users' },
  { id: 'punkte', label: 'Punkte', icon: 'list' },
  { id: 'timer', label: 'Timer', icon: 'clock' },
];
const STYLES = [{ id: 'sand', label: 'Sanduhr' }, { id: 'ring', label: 'Ring' }, { id: 'digits', label: 'Ziffern' }];
const PRESETS = [30, 60, 120, 180, 300];
const presetLabel = (s) => (s < 60 ? `${s} s` : `${s / 60} Min.`);
const clock = (ms) => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

// ---------------------------------------------------------------- Hilfen Punkte
const cellVal = (r, pid) => (state.rounds[r] && Number.isFinite(state.rounds[r][pid]) ? state.rounds[r][pid] : null);
const roundTotal = (pid) => state.rounds.reduce((s, r) => s + (Number.isFinite(r[pid]) ? r[pid] : 0), 0);
const catTotal = (pid) => Object.values(state.catScores[pid] || {}).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
const totalOf = (pid) => (state.scoring === 'wertung' ? catTotal(pid) : roundTotal(pid));
function standings() {
  return state.players.map((p) => ({ ...p, total: totalOf(p.id) })).sort((a, b) => b.total - a.total);
}
function leaderIds() {
  const st = standings();
  if (!st.length || st[0].total === 0) return [];
  return st.filter((p) => p.total === st[0].total).map((p) => p.id);
}

// ---------------------------------------------------------------- Timer (läuft auch weiter, wenn man den Bereich verlässt)
const timer = { running: false, endsAt: 0, remaining: null, lock: null, audio: null, tick: null };
const totalMs = () => state.timer.seconds * 1000;
const remainingMs = () => (timer.running ? Math.max(0, timer.endsAt - Date.now()) : timer.remaining ?? totalMs());

function beep() {
  try {
    const ctx = timer.audio || (timer.audio = new (window.AudioContext || window.webkitAudioContext)());
    [0, 0.35, 0.7].forEach((at) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.28);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + at);
      o.stop(ctx.currentTime + at + 0.3);
    });
  } catch { /* ohne Ton */ }
}
async function keepAwake(on) {
  try {
    if (on && !timer.lock && navigator.wakeLock) timer.lock = await navigator.wakeLock.request('screen');
    if (!on && timer.lock) { await timer.lock.release(); timer.lock = null; }
  } catch { timer.lock = null; }
}
function startTimer() {
  const rest = timer.remaining && timer.remaining > 0 ? timer.remaining : totalMs();
  timer.endsAt = Date.now() + rest;
  timer.running = true;
  timer.remaining = null;
  try { if (!timer.audio) timer.audio = new (window.AudioContext || window.webkitAudioContext)(); timer.audio.resume?.(); } catch { /* ohne Ton */ }
  keepAwake(true);
  clearInterval(timer.tick);
  timer.tick = setInterval(tick, 100);
  tick();
}
function pauseTimer() {
  timer.remaining = remainingMs();
  timer.running = false;
  clearInterval(timer.tick);
  keepAwake(false);
  paintTimer();
}
function resetTimer() {
  timer.running = false;
  timer.remaining = null;
  clearInterval(timer.tick);
  keepAwake(false);
  paintTimer();
}
function tick() {
  if (timer.running && remainingMs() <= 0) {
    timer.running = false;
    timer.remaining = 0;
    clearInterval(timer.tick);
    keepAwake(false);
    beep();
    document.querySelector('[data-timer]')?.classList.add('is-done');
  }
  paintTimer();
}

/** Zeichnet nur die Anzeige des Timers neu (Sanduhr, Ring oder Ziffern). */
function paintTimer() {
  const host = document.querySelector('[data-timer]');
  if (!host) return;
  const rest = remainingMs();
  const frac = totalMs() ? rest / totalMs() : 0; // 1 = voll, 0 = abgelaufen
  host.querySelector('[data-timer-text]').textContent = clock(rest);
  host.classList.toggle('is-running', timer.running);
  if (rest > 0) host.classList.remove('is-done');
  const btn = host.ownerDocument.querySelector('[data-x="toggle"]');
  if (btn) btn.innerHTML = timer.running ? `${icon('clock')}<span>Pause</span>` : `${icon('play')}<span>${rest < totalMs() && rest > 0 ? 'Weiter' : 'Start'}</span>`;
  if (state.timer.style === 'sand') {
    // Oben: Sand nimmt ab (von oben her), unten: Haufen wächst.
    const top = host.querySelector('[data-sand-top]');
    const bottom = host.querySelector('[data-sand-bottom]');
    const stream = host.querySelector('[data-sand-stream]');
    if (top) top.setAttribute('y', String(30 + (1 - frac) * 118));
    if (top) top.setAttribute('height', String(frac * 118));
    if (bottom) bottom.setAttribute('y', String(290 - (1 - frac) * 118));
    if (bottom) bottom.setAttribute('height', String((1 - frac) * 118));
    if (stream) stream.style.opacity = timer.running && frac > 0 ? '1' : '0';
  }
  if (state.timer.style === 'ring') {
    const c = host.querySelector('[data-ring]');
    if (c) c.setAttribute('stroke-dashoffset', String(741 * (1 - frac)));
  }
  if (state.timer.style === 'digits') {
    const bar = host.querySelector('[data-bar]');
    if (bar) bar.style.width = `${frac * 100}%`;
  }
}

function timerFaceHTML() {
  if (state.timer.style === 'sand') {
    return `<svg class="sandglass" viewBox="0 0 200 320" aria-hidden="true">
      <defs>
        <clipPath id="glass-top"><path d="M42 26 C42 110 92 132 96 158 L104 158 C108 132 158 110 158 26 Z"/></clipPath>
        <clipPath id="glass-bottom"><path d="M96 162 C92 188 42 210 42 294 L158 294 C158 210 108 188 104 162 Z"/></clipPath>
      </defs>
      <rect x="22" y="8" width="156" height="16" rx="7" class="glass-cap"/>
      <rect x="22" y="296" width="156" height="16" rx="7" class="glass-cap"/>
      <path d="M40 24 C40 110 90 134 92 160 C90 186 40 210 40 296 L160 296 C160 210 110 186 108 160 C110 134 160 110 160 24 Z" class="glass-bg"/>
      <rect data-sand-top x="30" y="30" width="140" height="118" class="sand" clip-path="url(#glass-top)"/>
      <rect data-sand-bottom x="30" y="290" width="140" height="0" class="sand" clip-path="url(#glass-bottom)"/>
      <rect data-sand-stream x="98.5" y="156" width="3" height="136" class="sand sand-stream"/>
      <path d="M40 24 C40 110 90 134 92 160 C90 186 40 210 40 296 L160 296 C160 210 110 186 108 160 C110 134 160 110 160 24 Z" class="glass"/>
    </svg>`;
  }
  if (state.timer.style === 'ring') {
    return `<svg class="ring" viewBox="0 0 280 280" aria-hidden="true">
      <circle cx="140" cy="140" r="118" class="ring-track"/>
      <circle cx="140" cy="140" r="118" class="ring-bar" data-ring stroke-dasharray="741" stroke-dashoffset="0" transform="rotate(-90 140 140)"/>
    </svg>`;
  }
  return '<div class="digits-bar"><div data-bar></div></div>';
}

// ---------------------------------------------------------------- Zeichnen
function playerOrderHTML() {
  return `<ol class="order-list">${state.players.map((p, i) => `<li class="order-item ${i === state.turn ? 'is-turn' : ''}" data-pid="${esc(p.id)}">
      <span class="order-n">${i + 1}</span><span class="order-name">${esc(p.name)}</span>${i === state.turn ? '<span class="badge badge-tag">ist dran</span>' : ''}
      <span class="order-tools">
        <button type="button" class="btn btn-icon btn-quiet" data-x="up" data-i="${i}" aria-label="${esc(p.name)} nach oben" ${i === 0 ? 'disabled' : ''}>${icon('chevron-up')}</button>
        <button type="button" class="btn btn-icon btn-quiet" data-x="down" data-i="${i}" aria-label="${esc(p.name)} nach unten" ${i === state.players.length - 1 ? 'disabled' : ''}>${icon('chevron-down')}</button>
        <button type="button" class="btn btn-icon btn-quiet" data-x="del" data-i="${i}" aria-label="${esc(p.name)} entfernen">${icon('x')}</button>
      </span></li>`).join('')}</ol>`;
}

function viewReihenfolge(store) {
  const people = sortPeople(store.list('people').filter((p) => p.kind !== 'group' && !state.players.some((x) => x.personId === p.id)));
  const cur = state.players[state.turn];
  const next = state.players.length ? state.players[(state.turn + 1) % state.players.length] : null;
  return `
    <section class="panel">
      <h2>Wer spielt mit?</h2>
      ${state.players.length ? playerOrderHTML() : '<p class="muted small">Noch niemand eingetragen.</p>'}
      ${people.length ? `<p class="field-label">Schnell hinzufügen</p><div class="chips wrap">${people.map((p) => `<button type="button" class="chip" data-x="add-person" data-id="${esc(p.id)}">${icon('plus')}${esc(p.name)}</button>`).join('')}</div>` : ''}
      <form class="person-new" data-x-form="add">
        <label class="visually-hidden" for="tisch-name">Name</label>
        <input id="tisch-name" name="name" type="text" maxlength="40" placeholder="Name eintragen" autocomplete="off">
        <button type="submit" class="btn btn-ghost">${icon('plus')}<span>Hinzufügen</span></button>
      </form>
      ${state.players.length > 1 ? `<div class="btn-row">
        <button type="button" class="btn btn-ghost" data-x="draw">${icon('dice')}<span>Startperson auslosen</span></button>
        <button type="button" class="btn btn-ghost" data-x="shuffle">${icon('rotate')}<span>Mischen</span></button>
      </div>` : ''}
    </section>
    ${cur ? `<section class="panel turn-panel" aria-live="polite">
      <p class="small muted" data-round>Runde ${state.round}</p>
      <p class="turn-now"><strong data-turn>${esc(cur.name)}</strong> ist dran</p>
      <button type="button" class="btn btn-gold btn-big" data-x="next">${next && next !== cur ? `Weiter: ${esc(next.name)}` : 'Nächste Runde'} ›</button>
      <div class="btn-row center">
        <button type="button" class="btn btn-quiet btn-small" data-x="prev">‹ Zurück</button>
        <button type="button" class="btn btn-quiet btn-small" data-x="restart">${icon('rotate')}<span>Von vorn</span></button>
      </div>
    </section>` : ''}`;
}

function viewPunkte(store) {
  if (!state.players.length) {
    return `<section class="panel"><p class="muted">Trage zuerst unter „Reihenfolge“ ein, wer mitspielt.</p>
      <button type="button" class="btn btn-primary" data-x="view" data-id="reihenfolge">${icon('users')}<span>Mitspielende eintragen</span></button></section>`;
  }
  const leaders = leaderIds();
  const game = state.gameId ? store.get('games', state.gameId) : null;
  const cats = game?.scoreCats?.length ? game.scoreCats : state.cats;
  const seg = `<div class="segmented" role="radiogroup" aria-label="Art der Wertung">
    <button type="button" role="radio" data-x="scoring" data-id="runden" aria-pressed="${state.scoring === 'runden'}" aria-checked="${state.scoring === 'runden'}">Runde für Runde</button>
    <button type="button" role="radio" data-x="scoring" data-id="wertung" aria-pressed="${state.scoring === 'wertung'}" aria-checked="${state.scoring === 'wertung'}">Wertung ${game ? esc(game.title) : 'je Spiel'}</button>
  </div>`;
  if (state.scoring === 'wertung') {
    const pid = state.players.some((p) => p.id === state.catPlayer) ? state.catPlayer : state.players[0].id;
    const vals = state.catScores[pid] || {};
    return `${seg}
      <section class="panel">
        <div class="chips wrap">${state.players.map((p) => `<button type="button" class="chip" data-x="cat-player" data-id="${esc(p.id)}" aria-pressed="${p.id === pid}">${esc(p.name)}</button>`).join('')}</div>
        ${cats.length ? `<div class="cat-list">${cats.map((c) => `<label class="cat-row"><span>${esc(c)}</span>
            <input type="number" inputmode="numeric" data-cat="${esc(c)}" value="${Number.isFinite(vals[c]) ? vals[c] : ''}" placeholder="0"></label>`).join('')}
          <p class="cat-row cat-sum"><span>${esc(state.players.find((p) => p.id === pid).name)} gesamt</span><strong data-cat-total>${catTotal(pid)}</strong></p></div>`
          : `<p class="muted small">Noch keine Kategorien${game ? ` für ${esc(game.title)}` : ''}. Lege sie einmal an, ${game ? 'sie werden am Spiel gespeichert' : 'z. B. Straßen, Städte, Klöster'}.</p>`}
        <button type="button" class="btn btn-ghost" data-x="cats">${icon('edit')}<span>Kategorien ${cats.length ? 'bearbeiten' : 'anlegen'}</span></button>
      </section>
      <section class="panel"><h2>Stand</h2><p class="standings" data-standings>${standings().map((p) => `<span class="${leaders.includes(p.id) ? 'is-lead' : ''}">${esc(p.name)} <strong>${p.total}</strong></span>`).join(' · ')}</p></section>
      ${endButtons()}`;
  }
  const sel = state.sel && state.players.some((p) => p.id === state.sel.pid) && state.rounds[state.sel.r] ? state.sel : { r: state.rounds.length - 1, pid: state.players[0].id };
  state.sel = sel;
  const selName = state.players.find((p) => p.id === sel.pid)?.name || '';
  return `${seg}
    <div class="score-wrap"><table class="score-table">
      <thead><tr><th scope="col">Runde</th>${state.players.map((p) => `<th scope="col">${esc(p.name)}</th>`).join('')}</tr></thead>
      <tbody>${state.rounds.map((_, r) => `<tr><th scope="row">${r + 1}</th>${state.players.map((p) => {
        const v = cellVal(r, p.id);
        const on = sel.r === r && sel.pid === p.id;
        return `<td><button type="button" class="score-cell ${on ? 'is-sel' : ''}" data-x="cell" data-r="${r}" data-pid="${esc(p.id)}" aria-label="${esc(p.name)}, Runde ${r + 1}: ${v ?? 'leer'}">${v ?? '–'}</button></td>`;
      }).join('')}</tr>`).join('')}</tbody>
      <tfoot><tr><th scope="row">Summe</th>${state.players.map((p) => `<td class="${leaders.includes(p.id) ? 'is-lead' : ''}" data-sum="${esc(p.id)}">${roundTotal(p.id)}</td>`).join('')}</tr></tfoot>
    </table></div>
    <section class="panel score-entry">
      <p class="entry-who"><strong>${esc(selName)}</strong> · Runde ${sel.r + 1} <span class="badge" data-entry-val>${cellVal(sel.r, sel.pid) ?? 0}</span></p>
      <div class="score-pad">
        ${[-5, -1, 1, 5].map((d) => `<button type="button" class="btn btn-ghost" data-x="add" data-d="${d}">${d > 0 ? '+' : '−'}${Math.abs(d)}</button>`).join('')}
      </div>
      <form class="score-type" data-x-form="value">
        <label class="visually-hidden" for="score-value">Punkte</label>
        <input id="score-value" name="v" type="number" inputmode="numeric" placeholder="Zahl eingeben">
        <button type="submit" class="btn btn-primary">OK ›</button>
      </form>
      <div class="btn-row"><button type="button" class="btn btn-ghost" data-x="round">${icon('plus')}<span>Neue Runde</span></button></div>
    </section>
    ${endButtons()}`;
}

const endButtons = () => `<div class="btn-row">
  <button type="button" class="btn btn-gold" data-x="finish">${icon('star')}<span>Spiel beenden</span></button>
  <button type="button" class="btn btn-quiet" data-x="clear">${icon('trash')}<span>Punkte leeren</span></button></div>`;

function viewTimer() {
  const cur = state.players[state.turn];
  return `<section class="panel timer-panel">
    <div class="segmented" role="radiogroup" aria-label="Ansicht des Timers">
      ${STYLES.map((s) => `<button type="button" role="radio" data-x="style" data-id="${s.id}" aria-pressed="${state.timer.style === s.id}" aria-checked="${state.timer.style === s.id}">${esc(s.label)}</button>`).join('')}
    </div>
    <div class="timer-face style-${state.timer.style}" data-timer>
      ${timerFaceHTML()}
      <p class="timer-text" data-timer-text>${clock(remainingMs())}</p>
      ${cur ? `<p class="small muted timer-who">Zug von <strong>${esc(cur.name)}</strong></p>` : ''}
    </div>
    <div class="btn-row center">
      <button type="button" class="btn btn-ghost" data-x="reset">${icon('rotate')}<span>${state.timer.style === 'sand' ? 'Umdrehen' : 'Neu'}</span></button>
      <button type="button" class="btn btn-gold" data-x="toggle">${icon('play')}<span>Start</span></button>
      ${state.players.length > 1 ? `<button type="button" class="btn btn-ghost" data-x="timer-next">Nächste ›</button>` : ''}
    </div>
    <div class="chips wrap center">${PRESETS.map((s) => `<button type="button" class="chip" data-x="preset" data-s="${s}" aria-pressed="${state.timer.seconds === s}">${presetLabel(s)}</button>`).join('')}
      <button type="button" class="chip chip-more" data-x="custom" aria-pressed="${!PRESETS.includes(state.timer.seconds)}">${PRESETS.includes(state.timer.seconds) ? 'eigene' : clock(state.timer.seconds * 1000)}</button></div>
    <form class="person-new" data-x-form="custom" hidden>
      <label class="visually-hidden" for="timer-min">Minuten</label>
      <input id="timer-min" name="m" type="number" inputmode="decimal" min="0.1" max="180" step="0.5" placeholder="Minuten, z. B. 1,5">
      <button type="submit" class="btn btn-primary">Übernehmen</button>
    </form>
    <p class="hint small">Am Ende ertönt ein Ton. Der Bildschirm bleibt an, solange der Timer läuft.</p>
  </section>`;
}

function render(root, store) {
  const games = store.list('games').filter((g) => g.title && g.title !== NEW_TITLE)
    .sort((a, b) => String(a.title).localeCompare(String(b.title), 'de', { sensitivity: 'base' }));
  if (state.gameId && !store.get('games', state.gameId)) state.gameId = '';
  root.innerHTML = `
    ${pageHeadHTML({ eyebrow: 'Am Tisch', title: VIEWS.find((v) => v.id === state.view)?.label || 'Am Tisch' })}
    <div class="tisch-top">
      <div class="segmented wide tisch-tabs" role="tablist" aria-label="Werkzeug">
        ${VIEWS.map((v) => `<button type="button" role="tab" data-x="view" data-id="${v.id}" aria-selected="${state.view === v.id}" aria-pressed="${state.view === v.id}">${icon(v.icon)}<span>${esc(v.label)}</span></button>`).join('')}
      </div>
      <label class="field tisch-game"><span class="field-label">Spiel (optional)</span>
        <span class="select-wrap"><select data-x-game><option value="">Kein bestimmtes Spiel</option>
          ${games.map((g) => `<option value="${esc(g.id)}" ${g.id === state.gameId ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</select></span></label>
    </div>
    <div class="tisch-body">${state.view === 'punkte' ? viewPunkte(store) : state.view === 'timer' ? viewTimer() : viewReihenfolge(store)}</div>`;
  if (state.view === 'timer') paintTimer();
}

// ---------------------------------------------------------------- Bedienung
function nextTurn(d = 1) {
  const n = state.players.length;
  if (!n) return;
  const t = state.turn + d;
  if (t >= n) { state.turn = 0; state.round += 1; } else if (t < 0) { if (state.round > 1) { state.turn = n - 1; state.round -= 1; } } else state.turn = t;
}

/** Nach einem Eintrag: zur nächsten Person in der Zugreihenfolge, nach der letzten eine neue Runde. */
function advanceCell() {
  const i = state.players.findIndex((p) => p.id === state.sel.pid);
  if (i < state.players.length - 1) state.sel = { r: state.sel.r, pid: state.players[i + 1].id };
  else {
    if (state.sel.r === state.rounds.length - 1) state.rounds.push({});
    state.sel = { r: state.sel.r + 1, pid: state.players[0].id };
  }
}

function openCatsDialog(root, store) {
  const game = state.gameId ? store.get('games', state.gameId) : null;
  const cats = game?.scoreCats?.length ? game.scoreCats : state.cats;
  const prompt = `Nenne die Wertungskategorien der Schlusswertung von „${game?.title || 'dem Spiel'}“ (deutsche Ausgabe), eine pro Zeile, nur die Namen, ohne Erklärung.`;
  const dlg = openDialog({
    title: 'Wertungskategorien', subtitle: game ? `${game.title} · wird am Spiel gespeichert` : 'Nur für diese Partie (Spiel oben wählen, um sie zu speichern)',
    className: 'sheet-cats',
    bodyHTML: `<div class="field"><label for="cats-text">Eine Kategorie pro Zeile</label>
      <textarea id="cats-text" rows="7" placeholder="Straßen&#10;Städte&#10;Klöster&#10;Wiesen">${esc(cats.join('\n'))}</textarea></div>
      <p class="hint small">Vorlage gesucht? Auftrag kopieren, in deiner Claude-App einfügen und die Antwort hier einfügen. Kostet nichts extra.</p>
      <div class="btn-row"><button type="button" class="btn btn-ghost" data-c="copy">${icon('copy')}<span>Auftrag für Claude kopieren</span></button></div>`,
  });
  dlg.querySelector('.sheet-inner').insertAdjacentHTML('beforeend', `<footer class="sheet-foot"><span class="spacer"></span>
    <button type="button" class="btn btn-ghost" data-close>Abbrechen</button><button type="button" class="btn btn-primary" data-c="save">Speichern</button></footer>`);
  dlg.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-c]');
    if (!el) return;
    if (el.dataset.c === 'copy') {
      try { await navigator.clipboard.writeText(prompt); toast('Auftrag kopiert – in Claude einfügen'); } catch { toast(prompt, 'warning'); }
    }
    if (el.dataset.c === 'save') {
      const list = [...new Set(dlg.querySelector('#cats-text').value.split('\n')
        .map((x) => x.replace(/^[\s\-–•*\d.)]+/, '').trim().slice(0, 40)).filter(Boolean))].slice(0, 20);
      if (game) await store.update('games', game.id, { scoreCats: list });
      else state.cats = list;
      save();
      dlg.close();
      render(root, store);
    }
  });
}

function openFinishDialog(root, store) {
  const st = standings();
  const game = state.gameId ? store.get('games', state.gameId) : null;
  const top = st[0];
  const dlg = openDialog({
    title: top && top.total > 0 ? `${top.name} gewinnt!` : 'Ergebnis', subtitle: game?.title || '',
    className: 'sheet-finish',
    bodyHTML: `<ol class="result-list">${st.map((p, i) => `<li class="${i === 0 && p.total > 0 ? 'is-lead' : ''}"><span>${i + 1}. ${esc(p.name)}</span><strong>${p.total}</strong></li>`).join('')}</ol>
      ${game ? '' : '<p class="hint small">Für das Protokoll oben ein Spiel wählen.</p>'}`,
  });
  dlg.querySelector('.sheet-inner').insertAdjacentHTML('beforeend', `<footer class="sheet-foot">
    <button type="button" class="btn btn-quiet" data-f="clear">${icon('rotate')}<span>Neue Partie</span></button><span class="spacer"></span>
    ${game ? `<button type="button" class="btn btn-gold" data-f="log">${icon('check')}<span>Ins Protokoll eintragen</span></button>` : '<button type="button" class="btn btn-primary" data-close>Schließen</button>'}</footer>`);
  dlg.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-f]');
    if (!el) return;
    if (el.dataset.f === 'log') {
      await store.create('plays', {
        gameId: game.id, date: todayISO(),
        people: state.players.map((p) => p.personId).filter(Boolean),
        names: state.players.filter((p) => !p.personId).map((p) => p.name),
        winner: top && top.total > 0 ? top.name : '',
        scores: Object.fromEntries(st.map((p) => [p.name, p.total])),
      });
      toast(`${game.title} im Protokoll eingetragen`);
    }
    // Nach dem Eintragen oder „Neue Partie“: Punkte leeren, Reihenfolge bleibt.
    state.rounds = [{}]; state.sel = null; state.catScores = {}; state.turn = 0; state.round = 1;
    save();
    dlg.close();
    render(root, store);
  });
}

function wire(root, store) {
  root.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-x]');
    if (!el) return;
    const x = el.dataset.x;
    const i = Number(el.dataset.i);
    let redraw = true;
    if (x === 'view') state.view = el.dataset.id;
    if (x === 'up' && i > 0) { [state.players[i - 1], state.players[i]] = [state.players[i], state.players[i - 1]]; }
    if (x === 'down' && i < state.players.length - 1) { [state.players[i + 1], state.players[i]] = [state.players[i], state.players[i + 1]]; }
    if (x === 'del') { state.players.splice(i, 1); state.turn = Math.min(state.turn, Math.max(0, state.players.length - 1)); }
    if (x === 'add-person') {
      const p = store.get('people', el.dataset.id);
      if (p) state.players.push({ id: uid(), name: p.name, personId: p.id });
    }
    if (x === 'draw') {
      // Startperson auslosen: Reihenfolge so drehen, dass die geloste Person beginnt.
      const k = Math.floor(Math.random() * state.players.length);
      state.players = [...state.players.slice(k), ...state.players.slice(0, k)];
      state.turn = 0;
      toast(`${state.players[0].name} beginnt`);
    }
    if (x === 'shuffle') {
      for (let n = state.players.length - 1; n > 0; n--) { const j = Math.floor(Math.random() * (n + 1)); [state.players[n], state.players[j]] = [state.players[j], state.players[n]]; }
      state.turn = 0;
    }
    if (x === 'next') nextTurn(1);
    if (x === 'prev') nextTurn(-1);
    if (x === 'restart') { state.turn = 0; state.round = 1; }
    if (x === 'scoring') state.scoring = el.dataset.id;
    if (x === 'cat-player') state.catPlayer = el.dataset.id;
    if (x === 'cats') { openCatsDialog(root, store); redraw = false; }
    if (x === 'cell') state.sel = { r: Number(el.dataset.r), pid: el.dataset.pid };
    if (x === 'add') {
      const { r, pid } = state.sel;
      state.rounds[r] = { ...state.rounds[r], [pid]: (cellVal(r, pid) || 0) + Number(el.dataset.d) };
    }
    if (x === 'round') { state.rounds.push({}); state.sel = { r: state.rounds.length - 1, pid: state.players[0].id }; }
    if (x === 'clear') { state.rounds = [{}]; state.sel = null; state.catScores = {}; }
    if (x === 'finish') { openFinishDialog(root, store); redraw = false; }
    if (x === 'style') state.timer.style = el.dataset.id;
    if (x === 'preset') { state.timer.seconds = Number(el.dataset.s); resetTimer(); }
    if (x === 'custom') { root.querySelector('[data-x-form="custom"]').hidden = false; root.querySelector('#timer-min').focus(); redraw = false; }
    if (x === 'toggle') { if (timer.running) pauseTimer(); else startTimer(); redraw = false; }
    if (x === 'reset') { resetTimer(); if (state.timer.style === 'sand') startTimer(); redraw = false; }
    if (x === 'timer-next') { nextTurn(1); resetTimer(); save(); render(root, store); startTimer(); return; }
    save();
    if (redraw) render(root, store);
  });
  root.addEventListener('change', (e) => {
    if (e.target.matches('[data-x-game]')) { state.gameId = e.target.value; save(); render(root, store); }
  });
  root.addEventListener('input', (e) => {
    const c = e.target.dataset?.cat;
    if (c == null) return;
    const pid = state.players.some((p) => p.id === state.catPlayer) ? state.catPlayer : state.players[0]?.id;
    if (!pid) return;
    const v = e.target.value === '' ? null : Number(e.target.value);
    state.catScores[pid] = { ...state.catScores[pid], [c]: Number.isFinite(v) ? v : null };
    save();
    // Nur Summe und Stand aktualisieren, damit das Eingabefeld den Fokus behält.
    root.querySelector('[data-cat-total]').textContent = catTotal(pid);
    const leaders = leaderIds();
    root.querySelector('[data-standings]').innerHTML = standings().map((p) => `<span class="${leaders.includes(p.id) ? 'is-lead' : ''}">${esc(p.name)} <strong>${p.total}</strong></span>`).join(' · ');
  });
  root.addEventListener('submit', (e) => {
    const f = e.target.dataset.xForm;
    if (!f) return;
    e.preventDefault();
    const data = new FormData(e.target);
    if (f === 'add') {
      const name = String(data.get('name') || '').trim().slice(0, 40);
      if (!name) return;
      state.players.push({ id: uid(), name });
      save();
      render(root, store);
      root.querySelector('#tisch-name')?.focus();
    }
    if (f === 'value') {
      const raw = String(data.get('v') || '').replace(',', '.');
      const { r, pid } = state.sel;
      if (raw !== '') state.rounds[r] = { ...state.rounds[r], [pid]: Number(raw) };
      advanceCell();
      save();
      render(root, store);
      root.querySelector('#score-value')?.focus();
    }
    if (f === 'custom') {
      const m = Number(String(data.get('m') || '').replace(',', '.'));
      if (!(m > 0)) return;
      state.timer.seconds = Math.round(Math.min(180, m) * 60);
      resetTimer();
      save();
      render(root, store);
    }
  });
}

export default {
  id: 'tisch',
  title: 'Am Tisch',
  icon: 'users',
  group: 'play',
  status: 'ready',
  render(root, { store }) {
    state = load();
    render(root, store);
    wire(root, store);
  },
  /** Der Stand liegt nicht im Speicher der Kartei; nur bei geänderten Spielen neu zeichnen. */
  update(root, ctx, change) {
    return change.col !== 'games';
  },
};

