/** Modul: Spieleabend – Rahmen eingeben, Ablauf aus Bausteinen vorschlagen lassen, danach ins Protokoll übernehmen. */
import { icon } from '../core/icons.js';
import { esc, plural, todayISO, parseISODate } from '../core/utils.js';
import { pageHeadHTML, emptyStateHTML, openDialog, confirmDialog, toast } from '../core/ui.js';
import { href } from '../core/router.js';
import { coverHTML, hydrateCovers } from '../components/game-ui.js';
import { durationText, playersText, NEW_TITLE } from '../components/game-data.js';
import {
  EXPERIENCE, SLOT_KINDS, planEvening, slotTimes, windowMinutes, toMinutes, fromMinutes, slotCandidates, pickForSlot,
  historyFor, playStats, daysSince, agoText, shortDate,
} from '../components/play-data.js';
import { wirePeople, personName } from '../components/play-ui.js';

// Eingaben des Formulars bleiben erhalten, solange die App offen ist (auch wenn neu gezeichnet wird).
const draft = { date: '', from: '18:30', to: '22:00', players: 4, youngest: 10, experience: 'gemischt', groupId: null, mainGameId: '' };

const weekday = (iso) => parseISODate(iso)?.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' }) || '';
const playable = (store) => store.list('games').filter((g) => g.title && g.title !== NEW_TITLE)
  .sort((a, b) => String(a.title).localeCompare(String(b.title), 'de', { sensitivity: 'base' }));
const ctxFor = (store, ev) => ({
  players: ev.players, youngest: ev.youngest, experience: ev.experience,
  history: ev.groupId ? historyFor(store.list('plays'), ev.groupId) : new Map(),
  mainGame: ev.mainGameId ? store.get('games', ev.mainGameId) : null,
});

const counter = (key, label, value, min, max, unit = '') => `<div class="plan-count">
  <span class="field-label">${esc(label)}</span>
  <div class="count-ctl"><button type="button" class="btn btn-icon btn-ghost" data-a="step" data-key="${key}" data-d="-1" data-min="${min}" data-max="${max}" aria-label="${esc(label)} verringern">−</button>
    <strong data-count="${key}">${value}${unit}</strong>
    <button type="button" class="btn btn-icon btn-ghost" data-a="step" data-key="${key}" data-d="1" data-min="${min}" data-max="${max}" aria-label="${esc(label)} erhöhen">+</button></div>
</div>`;

// ================================================================= Übersicht und neuer Abend
function renderList(root, store, navigate) {
  if (!draft.date) draft.date = todayISO();
  const games = playable(store);
  const evenings = store.list('evenings').sort((a, b) => String(b.date + b.from).localeCompare(String(a.date + a.from)));
  root.innerHTML = `
    ${pageHeadHTML({ eyebrow: 'Spieleabend', title: 'Abend planen', intro: 'Rahmen eingeben, die App schlägt einen Ablauf aus deiner Sammlung vor. Einzelne Spiele tauschst du mit einem Tipp.' })}
    ${games.length ? `<form class="panel plan-form" data-plan-form>
      <h2>Neuer Abend</h2>
      <div class="plan-when">
        <label class="field"><span class="field-label">Datum</span><input type="date" name="date" value="${esc(draft.date)}" required></label>
        <label class="field"><span class="field-label">Von</span><input type="time" name="from" value="${esc(draft.from)}" required></label>
        <label class="field"><span class="field-label">Bis</span><input type="time" name="to" value="${esc(draft.to)}" required></label>
      </div>
      <div class="plan-counts">${counter('players', 'Personen', draft.players, 1, 30)}${counter('youngest', 'Jüngste Person', draft.youngest, 3, 99, ' J.')}</div>
      <p class="field-label">Erfahrung der Gruppe</p>
      <div class="chips wrap">${EXPERIENCE.map((x) => `<button type="button" class="chip" data-a="exp" data-id="${x.id}" aria-pressed="${draft.experience === x.id}">${esc(x.label)}</button>`).join('')}</div>
      <p class="field-label">Gruppe <span class="muted small">(optional, damit Gespieltes berücksichtigt wird)</span></p>
      <div class="plan-group"><div data-people></div></div>
      <label class="field"><span class="field-label">Hauptspiel <span class="muted small">(optional)</span></span>
        <span class="select-wrap"><select name="mainGameId" data-main>
          <option value="">Keine Vorgabe – die App wählt</option>
          ${games.map((g) => `<option value="${esc(g.id)}" ${draft.mainGameId === g.id ? 'selected' : ''}>${esc(g.title)}${durationText(g) ? ` (${esc(durationText(g))})` : ''}</option>`).join('')}
        </select></span></label>
      <button type="submit" class="btn btn-primary btn-big">${icon('sparkle')}<span>Abend vorschlagen</span></button>
    </form>` : emptyStateHTML({ iconName: 'dice', title: 'Noch keine Spiele', text: 'Trage zuerst Spiele in die Kartei ein. Dann schlägt die App hier ganze Abende vor.', actionsHTML: `<a class="btn btn-primary" href="${href('games')}">${icon('dice')}<span>Zur Kartei</span></a>` })}
    ${evenings.length ? `<section class="panel"><h2>Geplante Abende</h2><ul class="evening-list">
      ${evenings.map((ev) => `<li><a class="evening-item" href="${href('abend/' + ev.id)}" data-evening="${esc(ev.id)}">
        <span class="evening-date"><strong>${esc(weekday(ev.date))}</strong><span class="muted small">${esc(ev.from)}–${esc(ev.to)}</span></span>
        <span class="evening-games">${esc(ev.slots.filter((s) => s.gameId).map((s) => store.get('games', s.gameId)?.title).filter(Boolean).join(' · ') || 'ohne Spiele')}</span>
        ${ev.groupId ? `<span class="badge">${esc(personName(store, ev.groupId))}</span>` : ''}
        ${ev.playedAt ? '<span class="badge badge-played">gespielt</span>' : ''}
      </a></li>`).join('')}</ul></section>` : ''}`;

  const form = root.querySelector('[data-plan-form]');
  if (!form) return;
  wirePeople(store, form.querySelector('.plan-group'), {
    kind: 'group', multi: false, selected: draft.groupId ? [draft.groupId] : [],
    onChange: (ids) => { draft.groupId = ids[0] || null; },
  });
  form.addEventListener('input', (e) => {
    if (['date', 'from', 'to'].includes(e.target.name)) draft[e.target.name] = e.target.value;
  });
  form.addEventListener('change', (e) => { if (e.target.matches('[data-main]')) draft.mainGameId = e.target.value; });
  form.addEventListener('click', (e) => {
    const el = e.target.closest('[data-a]');
    if (!el) return;
    if (el.dataset.a === 'step') {
      const k = el.dataset.key;
      draft[k] = Math.min(Number(el.dataset.max), Math.max(Number(el.dataset.min), draft[k] + Number(el.dataset.d)));
      form.querySelector(`[data-count="${k}"]`).textContent = `${draft[k]}${k === 'youngest' ? ' J.' : ''}`;
    }
    if (el.dataset.a === 'exp') {
      draft.experience = el.dataset.id;
      form.querySelectorAll('[data-a="exp"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === draft.experience)));
    }
  });
  form.addEventListener('submit', async (e) => {
    if (e.target !== form) return;
    e.preventDefault();
    if (windowMinutes(draft.from, draft.to) < 20) { toast('Bitte ein Zeitfenster von mindestens 20 Minuten wählen.', 'danger'); return; }
    const opts = { ...draft };
    const slots = planEvening(store.list('games'), opts, opts.groupId ? historyFor(store.list('plays'), opts.groupId) : new Map());
    const ev = await store.create('evenings', { ...opts, slots, playedAt: null });
    navigate('abend/' + ev.id);
  });
}

// ================================================================= Ein Abend
function slotBadge(store, ev, g) {
  if (ev.groupId) {
    const last = historyFor(store.list('plays'), ev.groupId).get(g.id);
    if (last) return `<span class="badge badge-recent">mit ${esc(personName(store, ev.groupId))} ${esc(agoText(daysSince(last)))}</span>`;
  }
  const s = playStats(store.list('plays').filter((p) => p.gameId === g.id)).get(g.id);
  return s ? `<span class="badge badge-tag">zuletzt ${esc(agoText(daysSince(s.last)))}</span>` : '';
}

function renderEvening(root, store, id, navigate) {
  const ev = store.get('evenings', id);
  if (!ev) {
    root.innerHTML = `<a class="back" href="${href('abend')}">${icon('chevron-left')}Alle Abende</a>${emptyStateHTML({ iconName: 'calendar', title: 'Abend nicht gefunden', text: 'Vielleicht wurde er gelöscht.' })}`;
    return;
  }
  const times = slotTimes(ev.from, ev.slots);
  const end = (toMinutes(ev.from) ?? 0) + ev.slots.reduce((s, x) => s + (x.minutes || 0), 0);
  const over = ev.slots.reduce((s, x) => s + (x.minutes || 0), 0) - windowMinutes(ev.from, ev.to);
  root.innerHTML = `
    <a class="back" href="${href('abend')}">${icon('chevron-left')}Alle Abende</a>
    ${pageHeadHTML({
      eyebrow: `${weekday(ev.date)} · ${ev.from}–${ev.to} · ${plural(ev.players, 'Person', 'Personen')}${ev.groupId ? ` · ${personName(store, ev.groupId)}` : ''}`,
      title: ev.playedAt ? 'Euer Abend (gespielt)' : 'Euer Abend',
    })}
    <section class="panel plan-slots">
      ${ev.slots.map((s, i) => {
        const k = SLOT_KINDS[s.kind] || SLOT_KINDS.spiel;
        const g = s.gameId ? store.get('games', s.gameId) : null;
        return `<div class="slot" data-slot="${i}">
          <span class="slot-time">${esc(times[i])}</span>
          <div class="slot-main">
            <p class="slot-kind">${esc(k.label)} · ${s.minutes} Min.</p>
            ${k.noGame ? '' : g ? `<a class="slot-game" href="${href('games/' + g.id)}">${coverHTML(g, 'cover-thumb')}<span><strong>${esc(g.title)}</strong>${s.locked ? `<span class="slot-lock" aria-label="festgehalten">${icon('check')}</span>` : ''}<span class="small muted">${esc([playersText(g), durationText(g)].filter(Boolean).join(' · '))}</span></span></a>
              <div class="game-badges">${slotBadge(store, ev, g)}</div>` : '<p class="small muted">Kein passendes Spiel gefunden. „Auswählen“ zeigt alle Möglichkeiten.</p>'}
            <div class="slot-actions">
              ${k.noGame ? '' : `<button type="button" class="btn btn-ghost btn-small" data-a="reroll" data-i="${i}" ${s.locked ? 'disabled' : ''}>${icon('dice')}<span>Anderes</span></button>
              <button type="button" class="btn btn-ghost btn-small" data-a="choose" data-i="${i}">${icon('list')}<span>Auswählen</span></button>
              <button type="button" class="btn btn-icon btn-ghost" data-a="lock" title="Festhalten" data-i="${i}" aria-pressed="${!!s.locked}">${icon(s.locked ? 'check' : 'star')}<span class="visually-hidden">${s.locked ? 'Festgehalten' : 'Festhalten'}</span></button>`}
              <button type="button" class="btn btn-icon btn-quiet" data-a="remove" data-i="${i}" aria-label="Baustein entfernen">${icon('x')}</button>
            </div>
          </div>
        </div>`;
      }).join('') || '<p class="muted">Noch keine Bausteine.</p>'}
      <p class="small ${over > 0 ? 'due-warn' : 'muted'}" data-plan-end>Ende gegen ${fromMinutes(end)}${over > 0 ? ` – ${over} Min. über dem Zeitfenster` : ''}</p>
      <div class="btn-row">
        <button type="button" class="btn btn-ghost" data-a="add" data-kind="spiel">${icon('plus')}<span>Spiel</span></button>
        <button type="button" class="btn btn-ghost" data-a="add" data-kind="pause">${icon('plus')}<span>Pause</span></button>
        <button type="button" class="btn btn-ghost" data-a="replan">${icon('rotate')}<span>Neu vorschlagen</span></button>
      </div>
    </section>
    <div class="btn-row plan-foot">
      ${ev.playedAt ? `<span class="badge badge-played">${icon('check')}Ins Protokoll übernommen am ${esc(shortDate(ev.playedAt.slice(0, 10)))}</span>`
        : `<button type="button" class="btn btn-gold" data-a="played">${icon('check')}<span>So gespielt – ins Protokoll</span></button>`}
      <button type="button" class="btn btn-danger-quiet" data-a="delete">${icon('trash')}<span>Abend löschen</span></button>
    </div>`;
  hydrateCovers(root);

  const games = () => store.list('games');
  const used = (except) => ev.slots.filter((_, j) => j !== except).map((s) => s.gameId).filter(Boolean);
  const setSlots = (slots) => store.update('evenings', ev.id, { slots });
  const minutesFor = (g, kind) => {
    const k = SLOT_KINDS[kind] || SLOT_KINDS.spiel;
    const d = g ? (g.durationMax || g.durationMin || k.minutes) : k.minutes;
    return k.light ? Math.max(15, Math.min(30, d)) : d;
  };
  root.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-a]');
    if (!el) return;
    const a = el.dataset.a;
    const i = Number(el.dataset.i);
    const slots = ev.slots.map((s) => ({ ...s }));
    const ctx = ctxFor(store, ev);
    if (a === 'reroll') {
      const g = pickForSlot(games(), slots[i].kind, { ...ctx, slotMinutes: SLOT_KINDS[slots[i].kind]?.light ? undefined : slots[i].minutes }, [...used(i), slots[i].gameId].filter(Boolean));
      if (!g) { toast('Kein weiteres passendes Spiel in deiner Sammlung.', 'danger'); return; }
      slots[i] = { ...slots[i], gameId: g.id, minutes: minutesFor(g, slots[i].kind) };
      await setSlots(slots);
    }
    if (a === 'lock') { slots[i].locked = !slots[i].locked; await setSlots(slots); }
    if (a === 'remove') { slots.splice(i, 1); await setSlots(slots); }
    if (a === 'add') {
      const kind = el.dataset.kind;
      const g = kind === 'pause' ? null : pickForSlot(games(), 'spiel', ctx, used(-1));
      slots.push({ kind, minutes: kind === 'pause' ? 15 : minutesFor(g, 'spiel'), gameId: g?.id || null, locked: false });
      await setSlots(slots);
    }
    if (a === 'replan') {
      // Festgehaltene Spiele bleiben, der Rest wird neu gewürfelt.
      const next = slots.map((s, j) => {
        if (s.locked || !s.gameId && SLOT_KINDS[s.kind]?.noGame) return s;
        const g = pickForSlot(games(), s.kind, { ...ctx, slotMinutes: SLOT_KINDS[s.kind]?.light ? undefined : s.minutes }, slots.filter((x, n) => n !== j && x.locked).map((x) => x.gameId));
        return { ...s, gameId: g?.id || null };
      });
      // Doppelte vermeiden: ein Spiel nur einmal pro Abend
      const seen = new Set();
      for (const s of next) { if (s.gameId && seen.has(s.gameId) && !s.locked) s.gameId = null; if (s.gameId) seen.add(s.gameId); }
      await setSlots(next);
    }
    if (a === 'choose') openChooser(store, ev, i);
    if (a === 'played') {
      const ids = ev.slots.map((s) => s.gameId).filter(Boolean);
      for (const gid of ids) await store.create('plays', { gameId: gid, date: ev.date, people: ev.groupId ? [ev.groupId] : [], names: [], eveningId: ev.id });
      await store.update('evenings', ev.id, { playedAt: new Date().toISOString() });
      toast(`${plural(ids.length, 'Spiel', 'Spiele')} ins Protokoll übernommen`);
    }
    if (a === 'delete') {
      if (!(await confirmDialog({ title: 'Abend löschen?', message: 'Der Plan wird entfernt. Bereits ins Protokoll übernommene Spiele bleiben dort.', confirmLabel: 'Löschen', danger: true }))) return;
      navigate('abend');
      await store.remove('evenings', ev.id);
      toast('Abend gelöscht');
    }
  });
}

/** „Auswählen“: alle passenden Spiele für einen Baustein, die besten zuerst (passt zum Hauptspiel). */
function openChooser(store, ev, i) {
  const slot = ev.slots[i];
  const k = SLOT_KINDS[slot.kind] || SLOT_KINDS.spiel;
  const ctx = { ...ctxFor(store, ev), slotMinutes: k.light ? undefined : slot.minutes };
  const exclude = ev.slots.filter((_, j) => j !== i).map((s) => s.gameId).filter(Boolean);
  const list = slotCandidates(store.list('games'), slot.kind, ctx, exclude).slice(0, 12);
  const main = ctx.mainGame && slot.kind !== 'haupt' ? ctx.mainGame : null;
  const dlg = openDialog({
    title: main ? 'Passt gut dazu' : `${k.label} auswählen`,
    subtitle: main ? `Hauptspiel: ${main.title} · ${k.label}` : `${plural(ev.players, 'Person', 'Personen')} · ab ${ev.youngest} J.`,
    className: 'sheet-choose',
    bodyHTML: list.length ? `<ul class="choose-list">${list.map(({ game: g }) => `<li><button type="button" class="choose-item" data-pick="${esc(g.id)}" aria-pressed="${g.id === slot.gameId}">
        ${coverHTML(g, 'cover-thumb')}<span><strong>${esc(g.title)}</strong><span class="small muted">${esc([playersText(g), durationText(g)].filter(Boolean).join(' · '))}</span></span>
        <span class="btn btn-small ${g.id === slot.gameId ? 'btn-primary' : 'btn-ghost'}">${g.id === slot.gameId ? 'Gewählt' : 'Wählen'}</span></button></li>`).join('')}</ul>`
      : '<p class="muted">Kein Spiel deiner Sammlung passt zu diesem Baustein (Personen, Alter, Länge, Erfahrung).</p>',
  });
  hydrateCovers(dlg);
  dlg.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    const g = store.get('games', b.dataset.pick);
    const cur = store.get('evenings', ev.id);
    const slots = cur.slots.map((s) => ({ ...s }));
    const d = g.durationMax || g.durationMin || slots[i].minutes;
    slots[i] = { ...slots[i], gameId: g.id, locked: true, minutes: k.light ? Math.max(15, Math.min(30, d)) : d };
    await store.update('evenings', ev.id, { slots });
    dlg.close();
    toast(`${g.title} gewählt`);
  });
}

export default {
  id: 'abend',
  title: 'Spieleabend',
  navTitle: 'Abend',
  icon: 'calendar',
  group: 'play',
  status: 'ready',
  render(root, { store, params, navigate }) {
    if (params[0]) renderEvening(root, store, params[0], navigate);
    else renderList(root, store, navigate);
  },
  /** Neue Gruppe angelegt: Formular nicht neu zeichnen (die Chips aktualisieren sich selbst). */
  update(root, { params }, change) {
    return !params[0] && change.col === 'people';
  },
};
