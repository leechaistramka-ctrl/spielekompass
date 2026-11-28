/**
 * Spielekompass: Bausteine der Oberfläche rund ums Spielen
 * - Personen und Gruppen antippen (und neu anlegen)
 * - Verleihen
 * - „Heute gespielt“
 * - „Was spiele ich heute?“
 */
import { icon } from '../core/icons.js';
import { esc, plural, todayISO } from '../core/utils.js';
import { openDialog, toast } from '../core/ui.js';
import { navigate } from '../core/router.js';
import { coverHTML, hydrateCovers } from './game-ui.js';
import { playersText, durationText, ageText } from './game-data.js';
import {
  sortPeople, LOAN_REMIND, DEFAULT_REMIND, playStats, daysSince, agoText, TONIGHT_TIMES, tonightCandidates, pickRandom,
} from './play-data.js';

// ================================================================= Personen und Gruppen
/** Chips zum Antippen. selected = Kennungen; data-person trägt die Kennung. */
export function peopleChipsHTML(people, selected = [], { kind = null, addLabel = '+ Neu' } = {}) {
  const list = sortPeople(people.filter((p) => !kind || p.kind === kind));
  return `<div class="chips wrap people-chips">
    ${list.map((p) => `<button type="button" class="chip" data-person="${esc(p.id)}" aria-pressed="${selected.includes(p.id)}">${p.kind === 'group' ? icon('users') : ''}${esc(p.name)}</button>`).join('')}
    <button type="button" class="chip chip-more" data-person-new>${esc(addLabel)}</button>
  </div>
  <form class="person-new" data-person-form hidden>
    <label class="visually-hidden" for="person-name">Name</label>
    <input id="person-name" name="name" type="text" maxlength="60" placeholder="${kind === 'group' ? 'Name der Gruppe, z. B. Jugendgruppe Di' : 'Name, z. B. Anna'}" autocomplete="off">
    <button type="submit" class="btn btn-primary">${icon('plus')}<span>Anlegen</span></button>
  </form>`;
}

/**
 * Verbindet die Chips in einem Container mit dem Speicher.
 * onChange(ids) wird bei jeder Auswahl aufgerufen; multi = mehrere gleichzeitig.
 */
export function wirePeople(store, container, { kind = 'person', multi = true, selected = [], onChange = () => {} } = {}) {
  let ids = [...selected];
  const draw = () => {
    const host = container.querySelector('[data-people]');
    host.innerHTML = peopleChipsHTML(store.list('people'), ids, { kind: kind === 'any' ? null : kind });
  };
  draw();
  container.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-person]');
    if (chip && container.contains(chip)) {
      const id = chip.dataset.person;
      ids = ids.includes(id) ? ids.filter((x) => x !== id) : multi ? [...ids, id] : [id];
      draw();
      onChange(ids);
    }
    if (e.target.closest('[data-person-new]')) {
      const form = container.querySelector('[data-person-form]');
      form.hidden = false;
      form.querySelector('input').focus();
    }
  });
  container.addEventListener('submit', async (e) => {
    if (!e.target.matches('[data-person-form]')) return;
    e.preventDefault();
    const name = String(new FormData(e.target).get('name') || '').trim().slice(0, 60);
    if (!name) return;
    const existing = store.list('people').find((p) => p.name.toLowerCase() === name.toLowerCase());
    const person = existing || await store.create('people', { name, kind: kind === 'any' ? 'person' : kind });
    ids = multi ? [...new Set([...ids, person.id])] : [person.id];
    draw();
    onChange(ids);
  });
  return { get: () => ids };
}

export const personName = (store, id) => store.get('people', id)?.name || '';

// ================================================================= Verleihen
export function openLoanDialog(store, game) {
  const loan = game.loan || null;
  let remind = loan?.remindDays ?? DEFAULT_REMIND;
  let who = loan?.personId ? [loan.personId] : [];
  const dlg = openDialog({
    title: loan ? 'Verleih ändern' : 'Verleihen',
    subtitle: game.title,
    className: 'sheet-loan',
    bodyHTML: `
      <p class="field-label">An wen?</p>
      <div data-people></div>
      <p class="field-label">Erinnern nach</p>
      <div class="chips wrap" data-remind>${LOAN_REMIND.map((r) => `<button type="button" class="chip" data-days="${r.days}" aria-pressed="${r.days === remind}">${esc(r.label)}</button>`).join('')}</div>
      <p class="hint small">Das Datum ist ${loan ? 'der Tag des Verleihens' : 'heute'}. Die Namen bleiben nur auf diesem Gerät.</p>`,
  });
  dlg.querySelector('.sheet-inner').insertAdjacentHTML('beforeend', `<footer class="sheet-foot"><span class="spacer"></span>
    <button type="button" class="btn btn-ghost" data-close>Abbrechen</button>
    <button type="button" class="btn btn-primary" data-loan-save disabled>${icon('check')}<span>Verleihen</span></button></footer>`);
  const save = dlg.querySelector('[data-loan-save]');
  const sync = () => {
    save.disabled = !who.length;
    save.querySelector('span').textContent = who.length ? `Verliehen an ${personName(store, who[0])}` : 'Person wählen';
  };
  wirePeople(store, dlg.querySelector('.sheet-body'), { kind: 'any', multi: false, selected: who, onChange: (ids) => { who = ids; sync(); } });
  sync();
  dlg.addEventListener('click', async (e) => {
    const d = e.target.closest('[data-days]');
    if (d) {
      remind = Number(d.dataset.days);
      dlg.querySelectorAll('[data-days]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.days) === remind)));
    }
    if (e.target.closest('[data-loan-save]') && who.length) {
      await store.update('games', game.id, {
        loan: { personId: who[0], name: personName(store, who[0]), since: loan?.since || todayISO(), remindDays: remind, snoozeUntil: null },
      });
      dlg.close();
      toast(`Verliehen an ${personName(store, who[0])}`);
    }
  });
}

export async function returnLoan(store, game) {
  await store.update('games', game.id, { loan: null });
  toast(`${game.title} ist zurück`);
}

// ================================================================= Heute gespielt
/** Trägt ein Spiel sofort ins Protokoll ein und öffnet danach (optional) „Wer war dabei?“. */
export async function playedToday(store, game, { ask = true } = {}) {
  const play = await store.create('plays', { gameId: game.id, date: todayISO(), people: [], names: [] });
  if (ask) openPlayedDialog(store, play.id, { justCreated: true });
  else toast(`${game.title}: heute gespielt`);
  return play;
}

export function openPlayedDialog(store, playId, { justCreated = false } = {}) {
  const play = store.get('plays', playId);
  const game = store.get('games', play?.gameId);
  if (!play) return;
  const dlg = openDialog({
    title: justCreated ? 'Eingetragen' : 'Gespielt',
    subtitle: `${game?.title || 'Spiel'} · ${play.date === todayISO() ? 'heute' : play.date.split('-').reverse().join('.')}`,
    className: 'sheet-played',
    bodyHTML: `<p class="field-label">Wer war dabei? <span class="muted small">(optional)</span></p>
      <div data-people></div>`,
  });
  dlg.querySelector('.sheet-inner').insertAdjacentHTML('beforeend', `<footer class="sheet-foot">
    <button type="button" class="btn btn-danger-quiet" data-play-del>${icon(justCreated ? 'undo' : 'trash')}<span>${justCreated ? 'Rückgängig' : 'Löschen'}</span></button>
    <span class="spacer"></span><button type="button" class="btn btn-primary" data-close>Fertig</button></footer>`);
  wirePeople(store, dlg.querySelector('.sheet-body'), {
    kind: 'any', multi: true, selected: play.people || [],
    onChange: (ids) => store.update('plays', playId, { people: ids }),
  });
  dlg.addEventListener('click', async (e) => {
    if (e.target.closest('[data-play-del]')) {
      await store.remove('plays', playId);
      dlg.close();
      toast(justCreated ? 'Wieder ausgetragen' : 'Eintrag gelöscht');
    }
  });
}

/** Text „5× gespielt · zuletzt 14.11. mit Jugendgruppe Di“. */
export function playSummary(store, gameId) {
  const s = playStats(store.list('plays').filter((p) => p.gameId === gameId)).get(gameId);
  if (!s) return { count: 0, text: 'Noch nicht gespielt' };
  const who = (s.lastPlay.people || []).map((id) => personName(store, id)).filter(Boolean);
  return { count: s.count, last: s.last, text: `${s.count}× gespielt · zuletzt ${agoText(daysSince(s.last))}${who.length ? ` mit ${who.join(', ')}` : ''}` };
}

// ================================================================= Was spiele ich heute?
const TONIGHT_KEY = 'leeway-spielekompass-heute';
const loadTonight = () => { try { return { minutes: 60, players: 4, kids: false, favorites: false, notRecent: false, ...JSON.parse(localStorage.getItem(TONIGHT_KEY) || '{}') }; } catch { return { minutes: 60, players: 4 }; } };
const saveTonight = (o) => { try { localStorage.setItem(TONIGHT_KEY, JSON.stringify(o)); } catch { /* nur für jetzt */ } };

export function openTonightDialog(store) {
  const opts = loadTonight();
  let shown = null;
  const dlg = openDialog({ title: 'Was spiele ich heute?', className: 'sheet-tonight', bodyHTML: '<div data-tonight></div>' });
  const body = dlg.querySelector('[data-tonight]');
  const candidates = () => tonightCandidates(store.list('games'), opts, playStats(store.list('plays')));
  const drawForm = () => {
    const n = candidates().length;
    body.innerHTML = `
      <p class="field-label">Wie viel Zeit?</p>
      <div class="chips wrap">${TONIGHT_TIMES.map((t) => `<button type="button" class="chip" data-t="time" data-min="${t.minutes ?? ''}" aria-pressed="${opts.minutes === t.minutes}">${esc(t.label)}</button>`).join('')}</div>
      <p class="field-label">Wie viele Personen?</p>
      <div class="count-ctl"><button type="button" class="btn btn-icon btn-ghost" data-t="less" aria-label="Weniger Personen">−</button><strong data-t-players>${opts.players}</strong><button type="button" class="btn btn-icon btn-ghost" data-t="more" aria-label="Mehr Personen">+</button></div>
      <p class="field-label">Optional</p>
      <div class="chips wrap">
        <button type="button" class="chip" data-t="kids" aria-pressed="${!!opts.kids}">Kinder dabei</button>
        <button type="button" class="chip" data-t="favorites" aria-pressed="${!!opts.favorites}">nur Favoriten</button>
        <button type="button" class="chip" data-t="notRecent" aria-pressed="${!!opts.notRecent}">lange nicht gespielt</button>
      </div>
      <button type="button" class="btn btn-gold btn-big" data-t="roll" ${n ? '' : 'disabled'}>${icon('dice')}<span>Würfeln</span></button>
      <p class="hint small" data-t-count>${n ? `${plural(n, 'Spiel passt', 'Spiele passen')}.` : 'Kein Spiel passt. Mehr Zeit wählen oder einen Wunsch abwählen.'}</p>`;
  };
  const drawResult = (g) => {
    const s = playStats(store.list('plays')).get(g.id);
    body.innerHTML = `
      <p class="eyebrow">Heute vielleicht …</p>
      <div class="tonight-cover">${coverHTML(g, 'cover-large')}</div>
      <h2 class="tonight-title" data-t-title>${esc(g.title)}</h2>
      <div class="game-badges">${[playersText(g), durationText(g), ageText(g)].filter(Boolean).map((x) => `<span class="badge">${esc(x)}</span>`).join('')}
        <span class="badge ${s ? 'badge-tag' : 'badge-open'}">${s ? `zuletzt ${esc(agoText(daysSince(s.last)))}` : 'noch nie gespielt'}</span></div>
      <div class="btn-row tonight-actions">
        <button type="button" class="btn btn-primary" data-t="open">${icon('arrow')}<span>Ansehen</span></button>
        <button type="button" class="btn btn-gold" data-t="again">${icon('dice')}<span>Nochmal</span></button>
      </div>
      <div class="btn-row"><button type="button" class="btn btn-ghost" data-t="played">${icon('check')}<span>Heute gespielt</span></button>
        <button type="button" class="btn btn-quiet" data-t="back">Vorgaben ändern</button></div>`;
    hydrateCovers(body);
  };
  const roll = () => {
    const g = pickRandom(candidates(), shown?.id);
    if (!g) { drawForm(); return; }
    shown = g;
    drawResult(g);
  };
  drawForm();
  dlg.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-t]');
    if (!el) return;
    const t = el.dataset.t;
    if (t === 'time') opts.minutes = el.dataset.min ? Number(el.dataset.min) : null;
    if (t === 'less') opts.players = Math.max(1, opts.players - 1);
    if (t === 'more') opts.players = Math.min(30, opts.players + 1);
    if (['kids', 'favorites', 'notRecent'].includes(t)) opts[t] = !opts[t];
    if (['time', 'less', 'more', 'kids', 'favorites', 'notRecent'].includes(t)) { saveTonight(opts); drawForm(); }
    if (t === 'roll' || t === 'again') roll();
    if (t === 'back') drawForm();
    if (t === 'open' && shown) { dlg.close(); navigate('games/' + shown.id); }
    if (t === 'played' && shown) { dlg.close(); await playedToday(store, shown); }
  });
}
