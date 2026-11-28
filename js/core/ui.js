/**
 * Wiederverwendbare Oberflächen-Bausteine: Formulare, Dialoge, Bestätigungen, Hinweise.
 */
import { icon } from './icons.js';
import { esc } from './utils.js';

let fieldSeq = 0;

/**
 * Ein Formularfeld aus einer Beschreibung erzeugen.
 * f = { name, label, type: 'text'|'textarea'|'select'|'date', options, required, placeholder, hint, wide }
 */
export function fieldHTML(f, value) {
  const id = `f-${f.name}-${++fieldSeq}`;
  const v = value ?? f.default ?? '';
  const common = `id="${id}" name="${esc(f.name)}" ${f.required ? 'required' : ''} ${f.autofocus ? 'autofocus' : ''}`;
  let control;
  if (f.type === 'textarea') {
    control = `<textarea ${common} rows="${f.rows || 4}" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
  } else if (f.type === 'select') {
    control = `<div class="select-wrap"><select ${common}>${f.options
      .map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(v ?? '') ? 'selected' : ''}>${esc(o.label)}</option>`)
      .join('')}</select></div>`;
  } else {
    control = `<input ${common} type="${f.type || 'text'}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${
      f.maxlength ? `maxlength="${f.maxlength}"` : ''
    } autocomplete="off" enterkeyhint="done">`;
  }
  return `<div class="field ${f.wide ? 'field-wide' : ''}">
    <label for="${id}">${esc(f.label)}${f.required ? '<span class="req" aria-hidden="true"> *</span>' : ''}</label>
    ${control}
    ${f.hint ? `<p class="hint">${esc(f.hint)}</p>` : ''}
  </div>`;
}

export function readForm(form, fields) {
  const fd = new FormData(form);
  const out = {};
  for (const f of fields) {
    const v = fd.get(f.name);
    out[f.name] = typeof v === 'string' ? (f.type === 'textarea' ? v.trim() : v.trim()) : '';
  }
  return out;
}

function createDialog(className = '') {
  const dlg = document.createElement('dialog');
  dlg.className = `sheet ${className}`;
  document.body.appendChild(dlg);
  dlg.addEventListener('close', () => setTimeout(() => dlg.remove(), 10));
  // Tippen auf den abgedunkelten Hintergrund schließt den Dialog.
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close('cancel');
  });
  dlg.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) dlg.close('cancel');
  });
  return dlg;
}

const headHTML = (title, subtitle) => `
  <header class="sheet-head">
    <div><h2>${esc(title)}</h2>${subtitle ? `<p class="sheet-sub">${esc(subtitle)}</p>` : ''}</div>
    <button type="button" class="btn btn-icon btn-quiet" data-close aria-label="Schließen">${icon('x')}</button>
  </header>`;

/** Allgemeiner Dialog mit beliebigem Inhalt. Gibt das <dialog>-Element zurück. */
export function openDialog({ title, subtitle, bodyHTML, className = '' }) {
  const dlg = createDialog(className);
  dlg.innerHTML = `<div class="sheet-inner">${headHTML(title, subtitle)}<div class="sheet-body">${bodyHTML}</div></div>`;
  dlg.showModal();
  return dlg;
}

/**
 * Formular-Dialog zum Anlegen/Bearbeiten.
 * onSubmit(data) speichert; onDelete() ist optional (zeigt „Löschen“).
 */
export function openFormDialog({ title, subtitle, fields, values = {}, submitLabel = 'Speichern', onSubmit, onDelete, extraActions = [] }) {
  const dlg = createDialog('sheet-form');
  dlg.innerHTML = `<form class="sheet-inner" method="dialog">
    ${headHTML(title, subtitle)}
    <div class="sheet-body"><div class="form-grid">${fields.map((f) => fieldHTML(f, values[f.name])).join('')}</div></div>
    <footer class="sheet-foot">
      ${onDelete ? `<button type="button" class="btn btn-danger-quiet" data-delete>${icon('trash')}<span>Löschen</span></button>` : ''}
      ${extraActions.map((a, i) => `<button type="button" class="btn btn-ghost" data-extra="${i}">${a.iconName ? icon(a.iconName) : ''}<span>${esc(a.label)}</span></button>`).join('')}
      <span class="spacer"></span>
      <button type="button" class="btn btn-ghost" data-close>Abbrechen</button>
      <button type="submit" class="btn btn-primary">${esc(submitLabel)}</button>
    </footer>
  </form>`;
  const form = dlg.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    try {
      await onSubmit(readForm(form, fields));
      dlg.close('saved');
    } catch (err) {
      toast(err.message || 'Speichern fehlgeschlagen.', 'danger');
    } finally {
      submitBtn.disabled = false;
    }
  });
  form.querySelectorAll('[data-extra]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      try {
        await extraActions[Number(btn.dataset.extra)].onClick(readForm(form, fields));
      } catch (err) {
        toast(err.message || 'Das hat nicht geklappt.', 'danger');
      }
    }),
  );
  form.querySelector('[data-delete]')?.addEventListener('click', async () => {
    const done = await onDelete();
    if (done !== false) dlg.close('deleted');
  });
  dlg.showModal();
  return dlg;
}

/** Sicherheitsabfrage. Liefert true bei Bestätigung. */
export function confirmDialog({ title, message, confirmLabel = 'Bestätigen', danger = false }) {
  return new Promise((resolve) => {
    const dlg = createDialog('sheet-confirm');
    dlg.innerHTML = `<div class="sheet-inner">
      ${headHTML(title)}
      <div class="sheet-body"><p class="confirm-text">${esc(message)}</p></div>
      <footer class="sheet-foot">
        <span class="spacer"></span>
        <button type="button" class="btn btn-ghost" data-close>Abbrechen</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm>${esc(confirmLabel)}</button>
      </footer>
    </div>`;
    let ok = false;
    dlg.querySelector('[data-confirm]').addEventListener('click', () => {
      ok = true;
      dlg.close('confirm');
    });
    dlg.addEventListener('close', () => resolve(ok));
    dlg.showModal();
    dlg.querySelector('[data-confirm]').focus();
  });
}

/** Kurzer Hinweis am unteren Bildschirmrand. tone: 'ok' | 'danger' | 'info' */
export function toast(message, tone = 'ok') {
  let host = document.getElementById('toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  // Liegt ein Dialog offen, muss der Hinweis darin erscheinen, damit er sichtbar bleibt.
  const openDlg = [...document.querySelectorAll('dialog[open]')].pop();
  (openDlg || document.body).appendChild(host);
  const el = document.createElement('div');
  el.className = `toast toast-${tone}`;
  el.innerHTML = `${icon(tone === 'ok' ? 'check' : 'info')}<span>${esc(message)}</span>`;
  host.appendChild(el);
  setTimeout(() => el.classList.add('out'), tone === 'ok' ? 2600 : 5200);
  setTimeout(() => el.remove(), tone === 'ok' ? 3000 : 5600);
}

/** Leerzustand mit Icon, Titel, Text und optionalen Aktionen. */
export function emptyStateHTML({ iconName = 'compass', title, text, actionsHTML = '' }) {
  return `<div class="empty">
    <div class="empty-icon">${icon(iconName)}</div>
    <h3>${esc(title)}</h3>
    ${text ? `<p>${esc(text)}</p>` : ''}
    ${actionsHTML ? `<div class="empty-actions">${actionsHTML}</div>` : ''}
  </div>`;
}

/** Seitenkopf mit kleiner Überzeile, Titel und Aktionen. */
export function pageHeadHTML({ eyebrow, title, intro, actionsHTML = '' }) {
  return `<header class="page-head">
    <div class="page-head-text">
      ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
      <h1>${esc(title)}</h1>
      ${intro ? `<p class="page-intro">${esc(intro)}</p>` : ''}
    </div>
    ${actionsHTML ? `<div class="page-actions">${actionsHTML}</div>` : ''}
  </header>`;
}
