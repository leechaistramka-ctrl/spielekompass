/**
 * Startpunkt des Spielekompass: lädt die Daten, baut die Navigation und zeigt das passende Modul.
 */
import { APP } from './config.js';
import { Store } from './core/store.js';
import { LocalStorageAdapter } from './core/adapters/local-storage.js';
import { parseRoute, navigate, href } from './core/router.js';
import { icon } from './core/icons.js';
import { esc } from './core/utils.js';
import { openDialog, toast } from './core/ui.js';
import { modules, findModule, NAV_GROUPS, START_MODULE } from './modules/index.js';
import { legalLinksHTML } from './modules/legal.js';

// Hier wird festgelegt, WO die Daten liegen. Für den Heimserver später: anderen Adapter einsetzen.
const store = new Store(new LocalStorageAdapter(APP.storageKey));
let lastRouteKey = '';
let current = { mod: null, root: null, key: '' };

const $ = (sel) => document.querySelector(sel);

const inNav = (m) => !m.hidden;
const isPrimary = (m) => !m.hidden;

function applyTheme() {
  const pref = store.settings.theme;
  const dark = pref === 'dark' || (pref !== 'light' && !matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#193126' : '#F1E9D8');
}

const navItem = (m, active) => `
  <a class="nav-item ${active ? 'is-active' : ''}" href="${href(m.id)}" ${active ? 'aria-current="page"' : ''}>
    ${icon(m.icon)}<span class="nav-label">${esc(m.navTitle || m.title)}</span>
  </a>`;

function renderNav(activeId) {
  $('#sidebar-nav').innerHTML = NAV_GROUPS.map(
    (g) => `<div class="nav-group">
      <p class="nav-group-label">${esc(g.label)}</p>
      ${modules.filter((m) => m.group === g.id && inNav(m)).map((m) => navItem(m, m.id === activeId)).join('')}
    </div>`,
  ).join('');

  const primary = modules.filter(isPrimary);
  const moreActive = !primary.some((m) => m.id === activeId);
  $('#tabbar').innerHTML = `${primary
    .map((m) => `<a class="tab ${m.id === activeId ? 'is-active' : ''}" href="${href(m.id)}" ${m.id === activeId ? 'aria-current="page"' : ''}>${icon(m.icon)}<span>${esc(m.navTitle || m.title)}</span></a>`)
    .join('')}
    <button type="button" class="tab ${moreActive ? 'is-active' : ''}" data-more aria-haspopup="dialog">${icon('more')}<span>Mehr</span></button>`;
}

function openMoreSheet(activeId) {
  const others = modules.filter((m) => !isPrimary(m) && inNav(m));
  const dlg = openDialog({
    title: 'Mehr',
    className: 'sheet-more',
    bodyHTML: NAV_GROUPS.filter((g) => others.some((m) => m.group === g.id))
      .map((g) => `<p class="nav-group-label">${esc(g.label)}</p><div class="more-list">${others
        .filter((m) => m.group === g.id)
        .map((m) => navItem(m, m.id === activeId))
        .join('')}</div>`)
      .join('') + legalLinksHTML('more-legal'),
  });
  dlg.addEventListener('click', (e) => {
    if (e.target.closest('a.nav-item')) dlg.close();
  });
}

function render() {
  const route = parseRoute();
  const mod = findModule(route.module);
  if (!mod) {
    navigate(START_MODULE);
    return;
  }
  const routeKey = `${route.module}/${route.params.join('/')}`;
  const routeChanged = routeKey !== lastRouteKey;
  lastRouteKey = routeKey;

  const root = document.createElement('div');
  root.className = `view view-${mod.id}${routeChanged ? ' view-enter' : ''}`;
  $('#view').replaceChildren(root);
  current = { mod, root, key: routeKey };
  try {
    mod.render(root, { store, params: route.params, navigate });
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="empty"><h3>Dieses Modul konnte nicht angezeigt werden.</h3><p>${esc(err.message)}</p></div>`;
  }
  renderNav(mod.id);
  document.body.dataset.module = mod.id;
  document.title = `${mod.title} · ${APP.name}`;
  if (routeChanged) {
    window.scrollTo(0, 0);
    $('#view').focus({ preventScroll: true });
  }
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!secure) return;
  try {
    const hadController = !!navigator.serviceWorker.controller;
    const reg = await navigator.serviceWorker.register('./sw.js');
    // Neue Version wurde installiert und übernimmt → Hinweis mit „Jetzt laden“ zeigen.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) showUpdateBanner();
    });
    // Beim Zurückkehren in die App nach Aktualisierungen suchen.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  } catch (err) {
    console.warn('Offline-Modus nicht verfügbar:', err);
  }
}

function showUpdateBanner() {
  if (document.getElementById('update-banner')) return;
  const el = document.createElement('div');
  el.id = 'update-banner';
  el.setAttribute('role', 'status');
  el.innerHTML = `${icon('sparkle')}<span>Neue Version verfügbar.</span>
    <button type="button" class="btn btn-small btn-primary">Jetzt laden</button>`;
  el.querySelector('button').addEventListener('click', () => location.reload());
  document.body.appendChild(el);
}

async function start() {
  await store.init();
  if (store.loadError) {
    toast('Gespeicherte Daten konnten nicht gelesen werden. Zum Schutz wird nichts überschrieben – bitte eine Sicherung einspielen.', 'danger');
  }
  $('#brand-tagline').textContent = APP.brand.tagline;
  $('#brand-tagline').insertAdjacentHTML('afterend', legalLinksHTML('sidebar-legal'));

  applyTheme();
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', applyTheme);
  window.addEventListener('hashchange', render);
  store.subscribe((change) => {
    if (change.type === 'settings' || change.type === 'reset' || change.type === 'import') applyTheme();
    const route = parseRoute();
    const key = `${route.module}/${route.params.join('/')}`;
    if (current.mod?.update && current.key === key && current.root?.isConnected) {
      // Das Modul aktualisiert nur die betroffenen Bereiche selbst; false = doch komplett neu zeichnen.
      if (current.mod.update(current.root, { store, params: route.params, navigate }, change) !== false) return;
    }
    render();
  });
  $('#tabbar').addEventListener('click', (e) => {
    if (e.target.closest('[data-more]')) openMoreSheet(parseRoute().module);
  });

  render();
  document.documentElement.classList.add('is-ready');

  registerServiceWorker();
  // Browser bitten, die Daten nicht automatisch zu löschen (wirkt v. a. bei installierter App).
  navigator.storage?.persist?.().catch(() => {});

  // Für automatisierte Tests und Fehlersuche.
  window.__leeway = { store, version: APP.version };
}

start();
