/** Modul: Einstellungen */
import { APP } from '../config.js';
import { icon } from '../core/icons.js';
import { esc, formatBytes, formatDateTime, daysAgo, plural } from '../core/utils.js';
import { pageHeadHTML, confirmDialog, toast } from '../core/ui.js';
import { href } from '../core/router.js';
import { clearImages } from '../core/image-store.js';
import { exportKartei, importKartei } from '../components/game-ui.js';

const THEMES = [
  { id: 'system', label: 'Automatisch' },
  { id: 'dark', label: 'Wald (dunkel)' },
  { id: 'light', label: 'Naturweiß (hell)' },
];

export default {
  id: 'settings',
  title: 'Einstellungen',
  icon: 'settings',
  group: 'system',
  status: 'ready',

  render(root, { store }) {
    const s = store.settings;
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const last = s.lastExportAt;
    const ago = daysAgo(last);

    root.innerHTML = `
      ${pageHeadHTML({ eyebrow: 'System', title: 'Einstellungen' })}
      <div class="settings-list">
        <section class="panel">
          <h2>Darstellung</h2>
          <div class="segmented wide" role="radiogroup" aria-label="Farbschema">
            ${THEMES.map((t) => `<button type="button" role="radio" data-s="theme" data-theme="${t.id}" aria-checked="${s.theme === t.id}" aria-pressed="${s.theme === t.id}">${esc(t.label)}</button>`).join('')}
          </div>
          <p class="small muted">„Automatisch“ folgt der Einstellung deines Geräts.</p>
        </section>

        <section class="panel">
          <h2>${icon('download')} Kartei sichern & übertragen</h2>
          <p class="muted small">Deine Spiele liegen nur auf diesem Gerät. Die Kartei-Datei enthält alle Angaben und Fotos – zum Sichern oder für ein zweites Gerät.
          Einspielen lassen sich auch Karteien der früheren Spielothek und Sicherungen des LEEWAY Workspace (dort ohne Fotos).</p>
          <p class="small muted">Letzte Sicherung: <strong data-last-export>${last ? `${esc(formatDateTime(last))} (${ago === 0 ? 'heute' : `vor ${esc(plural(ago, 'Tag', 'Tagen'))}`})` : 'noch keine'}</strong></p>
          <div class="btn-row">
            <button type="button" class="btn btn-primary" data-s="export">${icon('download')}<span>Kartei exportieren</span></button>
            <label class="btn btn-ghost file-btn">${icon('upload')}<span>Kartei einspielen …</span><input type="file" accept="application/json,.json" data-s="import" class="visually-hidden"></label>
          </div>
        </section>

        <section class="panel">
          <h2>Speicher & Installation</h2>
          <ul class="kv">
            <li><span>Speicherort</span><strong>${esc(store.adapter.label)}</strong></li>
            <li><span>Belegter Platz</span><strong data-usage>…</strong></li>
            <li><span>Dauerhafter Speicher</span><strong data-persist>…</strong></li>
            <li><span>Als App installiert</span><strong>${standalone ? 'Ja' : 'Nein – im Browser geöffnet'}</strong></li>
            <li><span>Offline-Modus</span><strong>${'serviceWorker' in navigator && navigator.serviceWorker.controller ? 'Aktiv' : 'Wird beim nächsten Start aktiv'}</strong></li>
          </ul>
          <p class="small muted">Auf iPhone und iPad: in Safari „Teilen → Zum Home-Bildschirm“. Dann startet der Spielekompass wie eine eigene App.</p>
        </section>

        <section class="panel">
          <h2>Über diese App</h2>
          <ul class="kv">
            <li><span>Anwendung</span><strong>${esc(APP.name)} – ${esc(APP.studio)}</strong></li>
            <li><span>Version</span><strong>${esc(APP.version)} (Datenformat ${APP.schemaVersion})</strong></li>
            <li><span>Externe Dienste</span><strong>Nur wenn du sie einschaltest (BoardGameGeek, Claude API)</strong></li>
            <li><span>Tracking</span><strong>Keines</strong></li>
          </ul>
          <div class="btn-row">
            <a class="btn btn-ghost" href="${href('impressum')}">${icon('info')}<span>Impressum</span></a>
            <a class="btn btn-ghost" href="${href('datenschutz')}">${icon('shield')}<span>Datenschutzerklärung</span></a>
          </div>
        </section>

        <section class="panel danger-zone">
          <h2>Alle Daten löschen</h2>
          <p class="muted">Entfernt alle Spiele samt Fotos von diesem Gerät. Exportiere vorher die Kartei.</p>
          <button type="button" class="btn btn-danger-quiet" data-s="reset">${icon('trash')}<span>Alle Daten löschen …</span></button>
        </section>
      </div>`;

    // Speicherinfos asynchron nachladen.
    store.usage().then((b) => {
      const el = root.querySelector('[data-usage]');
      if (el) el.textContent = `${formatBytes(b)} (Text-Daten, Fotos zusätzlich)`;
    });
    const persistEl = root.querySelector('[data-persist]');
    if (navigator.storage?.persisted) {
      navigator.storage.persisted().then((p) => { persistEl.textContent = p ? 'Ja – vor automatischem Löschen geschützt' : 'Nicht bestätigt'; });
    } else persistEl.textContent = 'Nicht verfügbar';

    root.addEventListener('change', async (e) => {
      if (e.target.dataset?.s !== 'import' || !e.target.files?.[0]) return;
      try {
        const n = await importKartei(store, e.target.files[0]);
        toast(n ? `${plural(n, 'Spiel', 'Spiele')} übernommen` : 'Alles war schon auf dem neuesten Stand');
      } catch (err) {
        toast(err.message, 'danger');
      }
      e.target.value = '';
    });

    root.addEventListener('click', async (e) => {
      const el = e.target.closest('[data-s]');
      if (!el) return;
      try {
        if (el.dataset.s === 'theme') await store.setSettings({ theme: el.dataset.theme });
        if (el.dataset.s === 'export') toast(`${plural(await exportKartei(store), 'Spiel', 'Spiele')} exportiert`);
        if (el.dataset.s === 'reset') {
          const ok = await confirmDialog({
            title: 'Wirklich alle Daten löschen?',
            message: 'Alle Spiele samt Fotos werden von diesem Gerät entfernt. Das lässt sich nur mit einer exportierten Kartei rückgängig machen.',
            confirmLabel: 'Endgültig löschen',
            danger: true,
          });
          if (ok) {
            await store.reset();
            await clearImages().catch(() => {});
            toast('Alle Daten gelöscht');
          }
        }
      } catch (err) { toast(err.message, 'danger'); }
    });
  },
};
