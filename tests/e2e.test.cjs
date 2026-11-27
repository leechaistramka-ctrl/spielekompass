/**
 * Automatische Funktionstests (Ende-zu-Ende) mit Playwright.
 * Start:  node tests/e2e.test.cjs
 * Spielekompass: prüft die App so, wie ein Mensch sie bedient: tippen, ausfüllen, neu laden.
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createServer } = require('../tools/serve.cjs');

const PORT = 8093;
const BASE = `http://localhost:${PORT}/`;
const results = [];
let failures = 0;

async function test(name, fn) {
  try {
    await fn();
    results.push(`  ✓ ${name}`);
  } catch (err) {
    failures += 1;
    results.push(`  ✗ ${name}\n      ${String(err.message).split('\n')[0]}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({ locale: 'de-DE', viewport: { width: 1180, height: 820 }, hasTouch: true, ...opts });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
  await page.goto(BASE);
  await page.waitForSelector('.view');
  return { ctx, page };
}

const fillDialog = async (page, values) => {
  for (const [name, value] of Object.entries(values)) {
    const el = page.locator(`dialog[open] [name="${name}"]`);
    const tag = await el.evaluate((n) => n.tagName);
    if (tag === 'SELECT') await el.selectOption(value);
    else await el.fill(value);
  }
};
const submitDialog = (page) => page.click('dialog[open] [type="submit"]');
const confirm = (page) => page.click('dialog[open] [data-confirm]');
const data = (page) => page.evaluate(() => window.__leeway.store.state.collections);


(async () => {
  const server = createServer().listen(PORT);
  const browser = await chromium.launch();
  const { ctx, page } = await newPage(browser);

  await test('Start: leere Kartei mit Foto-Knopf, Import und Beispielspielen, keine Fehler', async () => {
    assert(page.url().endsWith('#/games'), 'Startet nicht in der Kartei: ' + page.url());
    await page.waitForSelector('.view-games .empty');
    for (const sel of ['[data-g="photos"]', '[data-g="import"]', '[data-g="sample"]']) {
      assert((await page.locator('.view-games .empty ' + sel).count()) === 1, 'Im Leerzustand fehlt ' + sel);
    }
    assert((await page.title()).includes('Spielekompass'), 'Titel falsch: ' + (await page.title()));
    const nav = await page.$$eval('#sidebar-nav a.nav-item', (as) => as.map((a) => a.getAttribute('href')));
    assert(nav.join() === '#/games,#/settings', 'Navigation falsch: ' + nav.join());
    assert(!(await page.$('#quick-idea')), 'Kein Ideen-Knopf im Spielekompass');
    assert(page.errors.length === 0, 'Konsolenfehler: ' + page.errors.join(' | '));
  });

  await test('Manifest und Symbole: eigene App „Spielekompass“', async () => {
    const man = await (await page.request.get(BASE + 'manifest.webmanifest')).json();
    assert(man.short_name === 'Spielekompass' && man.start_url.includes('#/games'), 'Manifest falsch');
    for (const i of [...man.icons.map((x) => x.src), 'assets/icons/apple-touch-icon.png']) {
      assert((await page.request.get(BASE + i)).ok(), 'Icon fehlt: ' + i);
    }
    const sw = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
    const listed = [...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]).filter(Boolean);
    for (const f of listed) assert(fs.existsSync(path.join(__dirname, '..', f)), 'Datei aus sw.js fehlt: ' + f);
    await page.goto(BASE + '#/gibtesnicht');
    await page.waitForFunction(() => location.hash === '#/games');
  });

  await test('Umzug: Sicherung des LEEWAY Workspace und Kartei der Spielothek einspielen', async () => {
    const dir = os.tmpdir();
    const old = (id, title, extra = {}) => ({ id, title, mechanics: [], competences: [], tags: [], cover: false, recognition: { status: 'done' }, updatedAt: '2026-11-27T07:00:00.000Z', ...extra });
    const ws = path.join(dir, 'workspace-sicherung.json');
    fs.writeFileSync(ws, JSON.stringify({ app: 'leeway-workspace', schemaVersion: 1, settings: {}, collections: { projects: [{ id: 'p1', name: 'Projekt' }], games: [old('w1', 'Aus dem Workspace', { cover: true })] } }));
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const kt = path.join(dir, 'spielothek-alt.json');
    fs.writeFileSync(kt, JSON.stringify({ app: 'leeway-spielothek', format: 1, games: [old('s1', 'Aus der Spielothek', { cover: true })], images: { s1: png } }));
    await page.goto(BASE + '#/games');
    await page.setInputFiles('.view-games [data-g="import"]', ws);
    await page.waitForSelector('.game-card[data-id="w1"]');
    await page.setInputFiles('.view-games [data-g="import"]', kt);
    await page.waitForSelector('.game-card[data-id="s1"] .cover.has-image');
    const g = await data(page);
    assert(Object.keys(g).join() === 'games' && g.games.length === 2, 'Nur Spiele sollen übernommen werden');
    assert(g.games.find((x) => x.id === 'w1').cover === false, 'Foto ohne Bilddaten sollte entfallen');
    const bad = path.join(dir, 'fremd.json');
    fs.writeFileSync(bad, JSON.stringify({ app: 'etwas-anderes', games: [] }));
    await page.setInputFiles('.view-games [data-g="import"]', bad);
    await page.waitForSelector('.toast-danger:has-text("keine Kartei")');
    await page.evaluate(() => window.__leeway.store.reset());
    await page.waitForSelector('.view-games .empty');
  });

  await test('Farbschema umschalten und gespeichert', async () => {
    await page.goto(BASE + '#/settings');
    await page.click('[data-theme="light"]');
    assert((await page.getAttribute('html', 'data-theme')) === 'light', 'Hell nicht aktiv');
    await page.reload();
    await page.waitForSelector('.view');
    assert((await page.getAttribute('html', 'data-theme')) === 'light', 'Schema nicht gespeichert');
    await page.click('[data-theme="dark"]');
  });

  await test('Impressum und Datenschutz: erreichbar, nicht in der Hauptnavigation, Platzhalter-Hinweis', async () => {
    await page.goto(BASE + '#/settings');
    await page.click('.view a[href="#/impressum"]');
    await page.waitForSelector('.view-impressum .legal-text');
    const imp = await page.textContent('.view');
    assert(imp.includes('Angaben gemäß § 5 DDG') && imp.includes('LEEWAY Studio'), 'Impressum unvollständig');
    assert(await page.isVisible('.legal-notice'), 'Hinweis auf Platzhalter fehlt');
    await page.click('.view a[href="#/datenschutz"]');
    await page.waitForSelector('.view-datenschutz .legal-text');
    const ds = await page.textContent('.view');
    for (const t of ['Verantwortliche Stelle', 'Hosting', 'statichost.eu', 'BoardGameGeek', 'Claude-App', 'Deine Rechte', 'Art. 6 Abs. 1 lit. f DSGVO']) {
      assert(ds.includes(t), `Datenschutzerklärung: „${t}“ fehlt`);
    }
    for (const t of ['Kalender', 'Spracheingabe', 'Ideenwerkstatt', 'Projekte']) {
      assert(!ds.includes(t), `Datenschutzerklärung erwähnt noch „${t}“`);
    }
    assert(!(await page.isVisible('#sidebar-nav a[href="#/impressum"]')), 'Impressum steht in der Hauptnavigation');
    assert(await page.isVisible('.sidebar-legal a[href="#/datenschutz"]'), 'Link in der Seitenleiste fehlt');
    assert(page.errors.length === 0, 'Konsolenfehler: ' + page.errors.join(' | '));
  });

  await test('Offline: App startet ohne Netz (Service Worker), Spiele bleiben', async () => {
    await page.goto(BASE + '#/games');
    await page.click('[data-g="sample"]');
    await page.waitForSelector('.game-card');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForSelector('.game-card');
    assert((await data(page)).games.length === 11, 'Daten offline nicht verfügbar');
    await ctx.setOffline(false);
  });

  await test('Update: neue Version auf dem Server → Hinweis „Jetzt laden“', async () => {
    const swPath = path.join(__dirname, '../sw.js');
    const original = fs.readFileSync(swPath, 'utf8');
    try {
      await page.goto(BASE + '#/games');
      await page.waitForFunction(() => !!navigator.serviceWorker.controller);
      fs.writeFileSync(swPath, original.replace(/const CACHE = '([^']+)'/, "const CACHE = '$1-testupdate'"));
      await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
      await page.waitForSelector('#update-banner', { timeout: 15000 });
      await page.click('#update-banner button');
      await page.waitForSelector('.view');
      const keys = await page.evaluate(() => caches.keys());
      assert(keys.some((k) => k.endsWith('-testupdate')) && keys.length === 1, 'Alter Zwischenspeicher nicht ersetzt: ' + keys.join(', '));
    } finally {
      fs.writeFileSync(swPath, original);
    }
  });

  await test('Alle Daten löschen (Einstellungen) entfernt Spiele', async () => {
    await page.goto(BASE + '#/settings');
    await page.click('[data-s="reset"]');
    await confirm(page);
    await page.waitForSelector('.toast:has-text("gelöscht")');
    assert((await data(page)).games.length === 0, 'Spiele nicht gelöscht');
  });

  // ------------------------------------------------------------------ Spiele
  {
    const { ctx: gc, page: gp } = await newPage(browser);
    const games = () => gp.evaluate(() => window.__leeway.store.state.collections.games);
    const cards = () => gp.locator('.game-card').count();
    const photo = async (w = 1200, h = 900, color = '#c8a66d') => Buffer.from(await gp.evaluate(([w, h, color]) => {
      const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
      const x = c.getContext('2d');
      x.fillStyle = '#193126'; x.fillRect(0, 0, w, h);
      x.fillStyle = color; x.fillRect(w * 0.2, h * 0.15, w * 0.6, h * 0.7);
      return c.toDataURL('image/png').split(',')[1];
    }, [w, h, color]), 'base64');
    const answerFor = (id, extra = {}) => '```json\n' + JSON.stringify({ 'spielekompass-antwort': 1, spiele: [{
      kennung: id, titel: 'Kakerlakenpoker', verlag: 'Drei Magier', jahr: 2004, spieler_min: 2, spieler_max: 6, spieler_ideal: '4-6',
      dauer_min: 20, dauer_max: 20, alter_ab: 8, kategorie: 'Familienspiel', mechaniken: ['bluff', 'Partyspiel', 'Kartenspiel'],
      kompetenzen: ['empathie', 'Kommunikation', 'frustrationstoleranz'], beschreibung: 'Ein Bluffspiel mit Ungeziefer-Karten.',
      paedagogik: 'Gut zum Üben von Mimik lesen.', sicherheit: 'hoch', ...extra }] }) + '\n```';

    await test('Spiele: in der Navigation, leere Kartei, Beispielspiele laden', async () => {
      assert(await gp.isVisible('#sidebar-nav a[href="#/games"]'), 'Spiele fehlen in der Navigation');
      await gp.goto(BASE + '#/games');
      await gp.waitForSelector('.view-games .empty');
      assert((await gp.locator('.view-games .empty [data-g="photos"]').count()) === 1, 'Foto-Knopf fehlt im Leerzustand');
      await gp.click('[data-g="sample"]');
      await gp.waitForSelector('.game-card');
      assert((await cards()) === 11, `Erwartet 11 Beispielspiele, gefunden ${await cards()}`);
    });

    await test('Spiele: Filter Gruppengröße, Kompetenz, Zeit kombiniert; zurücksetzen', async () => {
      await gp.click('[data-g="step"][data-key="players"][data-d="1"]'); // egal → 4
      for (let n = 0; n < 4; n += 1) await gp.click('[data-g="step"][data-key="players"][data-d="1"]');
      assert((await gp.textContent('[data-value="players"]')).trim() === '8', 'Gruppengröße nicht 8');
      assert((await cards()) === 3, `8 Personen: erwartet 3, gefunden ${await cards()}`);
      await gp.click('[data-g="toggle"][data-kind="competences"][data-id="kommunikation"]');
      assert((await cards()) === 2, `+ Kommunikation: erwartet 2, gefunden ${await cards()}`);
      assert((await gp.textContent('.game-grid')).includes('1 von 1 Zielen'), 'Treffer-Hinweis fehlt');
      await gp.click('[data-g="time"][data-time="15"]');
      assert((await cards()) === 1 && (await gp.textContent('.game-card')).includes('Codenames'), 'Zeitfilter falsch');
      await gp.click('[data-g="reset"]');
      assert((await cards()) === 11, 'Zurücksetzen wirkt nicht');
    });

    await test('Spiele: Mechaniken (alle müssen passen), Alter, Spielart, Suche behält Fokus', async () => {
      await gp.click('[data-g="toggle"][data-kind="mechanics"][data-id="kooperativ"]');
      assert((await cards()) === 4, `Kooperativ: erwartet 4, gefunden ${await cards()}`);
      await gp.click('[data-g="toggle"][data-kind="mechanics"][data-id="wuerfeln"]');
      assert((await cards()) === 1 && (await gp.textContent('.game-card')).includes('Obstgarten'), 'Kooperativ + Würfeln falsch');
      await gp.click('[data-g="reset"]');
      await gp.click('[data-g="step"][data-key="age"][data-d="1"]'); // egal → 8
      for (let n = 0; n < 2; n += 1) await gp.click('[data-g="step"][data-key="age"][data-d="-1"]'); // 6
      assert((await cards()) === 3, `Jüngste 6 Jahre: erwartet 3, gefunden ${await cards()}`);
      await gp.click('[data-g="toggle"][data-kind="categories"][data-id="kinder"]');
      assert((await cards()) === 2, `Kinderspiele ab 6: erwartet 2, gefunden ${await cards()}`);
      await gp.click('[data-g="reset"]');
      await gp.focus('[data-g="search"]');
      await gp.keyboard.type('feuerwerk');
      assert((await cards()) === 1, 'Suche in Beschreibung wirkt nicht');
      assert(await gp.evaluate(() => document.activeElement?.dataset.g === 'search'), 'Suchfeld hat den Fokus verloren');
      await gp.click('[data-g="reset"]');
      assert((await gp.inputValue('[data-g="search"]')) === '', 'Suchfeld nicht geleert');
    });

    let newId;
    const imageSize = (key) => gp.evaluate(async (k) => {
      const db = await new Promise((r) => { const q = indexedDB.open('leeway-spielekompass-bilder'); q.onsuccess = () => r(q.result); });
      const blob = await new Promise((r) => { const q = db.transaction('images').objectStore('images').get(k); q.onsuccess = () => r(q.result); });
      if (!blob) return null;
      const bmp = await createImageBitmap(blob);
      return [blob.type, bmp.width, bmp.height];
    }, key);

    await test('Spiele: Foto aufnehmen → ohne Zwischenschritt zur Erkennung, ganzes Foto wird geteilt', async () => {
      await gp.setInputFiles('.page-actions [data-g="photos"]', { name: 'schachtel.png', mimeType: 'image/png', buffer: await photo() });
      await gp.waitForSelector('dialog[open].sheet-recognize');
      assert(!(await gp.$('dialog[open].sheet-crop')), 'Zuschnitt-Dialog sollte nicht erscheinen');
      const g = (await games()).find((x) => x.recognition?.status === 'open');
      assert(g && g.cover === true && g.title === 'Neues Spiel', 'Neues Spiel mit Titelbild fehlt');
      newId = g.id;
      const cover = await imageSize(newId);
      assert(cover[0] === 'image/jpeg' && cover[1] === 800 && cover[2] === 800, `Vorläufiges Titelbild falsch: ${cover.join(' ')}`);
      const orig = await imageSize(newId + ':original');
      assert(orig && orig[1] === 1200 && orig[2] === 900, 'Originalfoto nicht gespeichert');
      const prompt = await gp.textContent('dialog[open] .recog-prompt pre');
      assert(prompt.includes(`Kennung ${newId}: Foto 1`) && prompt.includes('spielekompass-antwort') && prompt.includes('social-deduction'), 'Auftrag unvollständig');
      assert(prompt.includes('"zuschnitt"') && prompt.includes('bgg_id'), 'Auftrag fragt nicht nach Zuschnitt und BGG-Nummer');
      assert(await gp.isVisible('dialog[open] [data-r="photos"]'), 'Ohne Teilen-Menü fehlt „Fotos speichern“');
    });

    await test('Spiele: Antwort von Claude einfügen übernimmt Daten (auch Bezeichnungen statt Kennungen)', async () => {
      await gp.click('dialog[open] [data-r="apply"]');
      await gp.waitForSelector('.toast-danger');
      await gp.fill('dialog[open] [data-r-answer]', 'Leider kann ich das Spiel nicht erkennen.');
      await gp.click('dialog[open] [data-r="apply"]');
      assert(await gp.isVisible('dialog[open].sheet-recognize'), 'Dialog hätte bei ungültiger Antwort offen bleiben müssen');
      await gp.fill('dialog[open] [data-r-answer]', 'Hier das Ergebnis:\n' + answerFor(newId, { zuschnitt: { x: 0.2, y: 0.15, breite: 0.6, hoehe: 0.7 } }));
      await gp.click('dialog[open] [data-r="apply"]');
      await gp.waitForFunction(() => !document.querySelector('dialog[open].sheet-recognize'));
      const cover = await imageSize(newId);
      assert(cover[1] === 756 && cover[2] === 657, `Zuschnitt aus der Antwort nicht angewendet: ${cover.join(' ')}`);
      const g = (await games()).find((x) => x.id === newId);
      assert(g.title === 'Kakerlakenpoker' && g.playersMin === 2 && g.playersMax === 6 && g.ageMin === 8 && g.category === 'familie', 'Grunddaten falsch');
      assert(g.mechanics.join() === 'bluff,party' && g.tags.includes('Kartenspiel'), 'Mechaniken falsch: ' + g.mechanics.join());
      assert(g.competences.join() === 'empathie,kommunikation,frustrationstoleranz', 'Kompetenzen falsch');
      assert(g.recognition.status === 'done' && g.recognition.confidence === 'hoch', 'Erkennungsstand falsch');
      assert(!(await gp.isVisible('.recog-bar')), 'Hinweis „wartet auf Erkennung“ sollte weg sein');
    });

    await test('Spiele: „Antwort übernehmen“ liest die Zwischenablage mit einem Tipp, ohne Dialog', async () => {
      // Zwischenablage nachbilden (im Testbrowser sonst nur mit Berechtigung lesbar)
      const setClipboard = (t) => gp.evaluate((v) => {
        window.__clip = v;
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: async () => window.__clip, writeText: async () => {} } });
      }, t);
      const tmp = await gp.evaluate(() => window.__leeway.store.create('games', { title: 'Neues Spiel', mechanics: [], competences: [], tags: [], cover: false, recognition: { status: 'open' } }));
      await gp.waitForSelector('.recog-bar [data-g="paste-answer"]');
      // Falscher Inhalt: Fehlermeldung, nichts ändert sich
      await setClipboard('Einkaufsliste: Milch, Brot');
      await gp.click('.recog-bar [data-g="paste-answer"]');
      await gp.waitForSelector('.toast-danger:has-text("keine Antwort für den Spielekompass")');
      // Antwort mit unbekannter Kennung wird nicht irgendeinem Spiel zugeordnet
      await setClipboard(answerFor('gibt-es-nicht'));
      await gp.click('.recog-bar [data-g="paste-answer"]');
      await gp.waitForSelector('.toast-danger:has-text("passt zu keinem")');
      assert((await games()).find((x) => x.id === tmp.id).recognition.status === 'open', 'Falsche Zuordnung trotz unbekannter Kennung');
      // Richtige Antwort: direkt eingetragen
      // Richtige Antwort mit deutschen Anführungszeichen im Text („…“): direkt eingetragen
      const desc = 'Rettet 16 „too big to fail“-Unternehmen.';
      await setClipboard('Hier das Ergebnis:\n' + answerFor(tmp.id, { beschreibung: desc }));
      await gp.click('.recog-bar [data-g="paste-answer"]');
      await gp.waitForFunction((id) => window.__leeway.store.get('games', id)?.recognition?.status === 'done', tmp.id);
      const g = (await games()).find((x) => x.id === tmp.id);
      assert(g.title === 'Kakerlakenpoker' && g.category === 'familie', 'Daten aus der Zwischenablage nicht übernommen');
      assert(g.description === desc, 'Deutsche Anführungszeichen im Text verfälscht: ' + g.description);
      // Typografische Anführungszeichen statt gerader (Tastatur-Autokorrektur) werden weiterhin gelesen
      await gp.evaluate((id) => window.__leeway.store.update('games', id, { recognition: { status: 'open' } }), tmp.id);
      await gp.waitForSelector('.recog-bar [data-g="paste-answer"]');
      // … auch mit der alten Kennzeichnung aus der Spielothek-Zeit
      await setClipboard(answerFor(tmp.id, { titel: 'QE' }).replace('spielekompass-antwort', 'spielothek-antwort').replace(/"/g, '“'));
      await gp.click('.recog-bar [data-g="paste-answer"]');
      await gp.waitForFunction((id) => window.__leeway.store.get('games', id)?.title === 'QE', tmp.id);
      assert(!(await gp.$('dialog[open]')), 'Es sollte sich kein Dialog öffnen');
      await gp.evaluate((id) => window.__leeway.store.remove('games', id), tmp.id);
    });

    await test('Spiele: Detailansicht mit Titelbild, Beschreibung, Kompetenzen; HTML wird nicht ausgeführt', async () => {
      await gp.click(`.game-card[data-id="${newId}"]`);
      await gp.waitForSelector('.game-detail');
      await gp.waitForSelector('.cover-large.has-image');
      assert(await gp.evaluate(() => document.querySelector('.cover-large img').naturalWidth === 756), 'Titelbild nicht geladen');
      // Zuschnitt von Hand nachbessern: Format, Zoom, Verschieben
      await gp.click('[data-g="recrop"]');
      await gp.waitForSelector('dialog[open].sheet-crop .crop-img[src]');
      await gp.click('dialog[open] [data-aspect="3:4"]');
      await gp.locator('dialog[open] [data-zoom]').fill('1.5');
      const box = await gp.locator('dialog[open] [data-stage]').boundingBox();
      await gp.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await gp.mouse.down();
      await gp.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 10, { steps: 4 });
      await gp.mouse.up();
      await gp.click('dialog[open] [data-ok]');
      await gp.waitForSelector('.toast:has-text("Titelbild gespeichert")');
      const size = await imageSize(newId);
      assert(size[0] === 'image/jpeg' && size[1] === 600 && size[2] === 800, `Zuschnitt falsch: ${size.join(' ')}`);
      const t = await gp.textContent('.game-main');
      assert(t.includes('Ein Bluffspiel mit Ungeziefer-Karten.') && t.includes('Empathie & Perspektivwechsel') && t.includes('20 Min.'), 'Detail unvollständig');
      await gp.click('[data-g="recognize"]');
      await gp.fill('dialog[open] [data-r-answer]', answerFor('unbekannt', { titel: '<img src=x onerror="window.__xss=1">', beschreibung: '<b>fett</b>' }));
      await gp.click('dialog[open] [data-r="apply"]');
      await gp.waitForFunction(() => !document.querySelector('dialog[open]'));
      assert((await gp.textContent('.game-main h1')).includes('<img'), 'Titel nicht als Text dargestellt');
      assert(!(await gp.evaluate(() => window.__xss)) && (await gp.locator('.game-main b').count()) === 0, 'HTML wurde eingeschleust');
    });

    await test('Spiele: bearbeiten mit Plausibilitätsprüfung', async () => {
      await gp.click('[data-g="edit"]');
      await fillDialog(gp, { title: 'Kakerlakenpoker', playersMin: '7', playersMax: '3' });
      await gp.click('dialog[open] [type="submit"]');
      await gp.waitForSelector('.toast-danger');
      assert(await gp.isVisible('dialog[open].sheet-game'), 'Dialog hätte offen bleiben müssen');
      await fillDialog(gp, { playersMin: '2', playersMax: '6', notes: 'Fehlt: 1 Karte' });
      await gp.click('dialog[open] .check-chip:has(input[name="competences"][value="reaktion"]) span');
      await gp.click('dialog[open] [type="submit"]');
      await gp.waitForFunction(() => !document.querySelector('dialog[open]'));
      const g = (await games()).find((x) => x.id === newId);
      assert(g.title === 'Kakerlakenpoker' && g.notes === 'Fehlt: 1 Karte' && g.competences.includes('reaktion'), 'Änderung nicht gespeichert');
      assert((await gp.textContent('.game-main')).includes('Fehlt: 1 Karte'), 'Notiz nicht angezeigt');
    });

    await test('Spiele: mehrere Fotos auf einmal, gemeinsame Erkennung', async () => {
      await gp.goto(BASE + '#/games');
      await gp.waitForSelector('.game-card');
      const before = (await games()).length;
      await gp.setInputFiles('.page-actions [data-g="photos"]', [
        { name: 'a.png', mimeType: 'image/png', buffer: await photo(900, 1200, '#e9d6ad') },
        { name: 'b.png', mimeType: 'image/png', buffer: await photo(1000, 1000, '#8c8f70') },
      ]);
      await gp.waitForSelector('dialog[open].sheet-recognize');
      const fresh = (await games()).filter((x) => x.recognition?.status === 'open');
      assert((await games()).length === before + 2 && fresh.length === 2, 'Es sollten 2 neue Spiele entstehen');
      assert(fresh.every((x) => x.cover), 'Beide Spiele sollten ein Titelbild haben');
      const prompt = await gp.textContent('dialog[open] .recog-prompt pre');
      assert(prompt.includes('Es geht um 2 Spiele') && prompt.includes('Foto 2'), 'Stapel-Auftrag falsch');
      const ans = JSON.stringify({ spiele: [
        { titel: 'Spiel Eins', spieler_min: 3, spieler_max: 5, kategorie: 'kenner', mechaniken: ['area-control'] },
        { titel: 'Spiel Zwei', spieler_min: 1, spieler_max: 4, kategorie: 'experte' },
      ] });
      await gp.fill('dialog[open] [data-r-answer]', ans);
      await gp.click('dialog[open] [data-r="apply"]');
      await gp.waitForFunction(() => !document.querySelector('dialog[open]'));
      const titles = (await games()).map((x) => x.title);
      assert(titles.includes('Spiel Eins') && titles.includes('Spiel Zwei'), 'Reihenfolge ohne Kennung nicht zugeordnet');
    });

    await test('Spiele: Kartei mit Fotos exportieren und in leerem Gerät einspielen', async () => {
      const [dl] = await Promise.all([gp.waitForEvent('download'), gp.click('[data-g="export"]')]);
      const file = path.join(os.tmpdir(), 'spielekompass-test.json');
      await dl.saveAs(file);
      const json = JSON.parse(fs.readFileSync(file, 'utf8'));
      assert(json.app === 'leeway-spielekompass' && json.games.length === (await games()).length, 'Export unvollständig');
      assert(Object.keys(json.images).length === 3 && json.images[newId].startsWith('data:image/jpeg;base64,'), 'Fotos fehlen im Export');
      const { ctx: c2, page: p2 } = await newPage(browser);
      await p2.goto(BASE + '#/games');
      await p2.waitForSelector('.view-games .empty');
      await p2.click('[data-g="sample"]');
      await p2.waitForSelector('.game-card');
      await p2.setInputFiles('[data-g="import"]', file);
      await p2.waitForSelector(`.game-card[data-id="${newId}"] .cover.has-image`);
      const n = await p2.evaluate(() => window.__leeway.store.state.collections.games.length);
      assert(n === 11 + json.games.length, `Nach Import erwartet ${11 + json.games.length}, gefunden ${n}`);
      await p2.setInputFiles('[data-g="import"]', file);
      await p2.waitForSelector('.toast:has-text("neuesten Stand")');
      assert(p2.errors.length === 0, p2.errors.join(' | '));
      await c2.close();
    });

    await test('Spiele: Spiel löschen entfernt auch das Foto; normale Sicherung enthält Spiele', async () => {
      await gp.click(`.game-card[data-id="${newId}"]`);
      await gp.waitForSelector('.game-detail');
      await gp.click('[data-g="delete"]');
      await confirm(gp);
      await gp.waitForSelector('.view-games .game-grid');
      assert(!(await games()).some((x) => x.id === newId), 'Spiel nicht gelöscht');
      const left = await gp.evaluate(async (id) => {
        const db = await new Promise((r) => { const q = indexedDB.open('leeway-spielekompass-bilder'); q.onsuccess = () => r(q.result); });
        return new Promise((r) => { const q = db.transaction('images').objectStore('images').get(id); q.onsuccess = () => r(q.result); });
      }, newId);
      assert(!left, 'Foto ist noch gespeichert');
      const backup = await gp.evaluate(() => window.__leeway.store.exportData());
      assert(Array.isArray(backup.collections.games) && backup.collections.games.length > 10, 'Spiele fehlen in der Sicherung');
    });

    await test('Spiele: iPhone ohne seitliches Scrollen, Touch-Ziele ab 44 px', async () => {
      const { ctx: c3, page: p3 } = await newPage(browser, { ...devices['iPhone 13'], locale: 'de-DE' });
      await p3.goto(BASE + '#/games');
      await p3.click('[data-g="sample"]');
      await p3.waitForSelector('.game-card');
      await p3.click('[data-g="toggle"][data-kind="competences"][data-id="zusammenarbeit"]');
      for (const hash of ['#/games', '#/games/' + (await p3.evaluate(() => window.__leeway.store.state.collections.games[1].id))]) {
        await p3.goto(BASE + hash);
        await p3.waitForSelector('.view-games');
        const overflow = await p3.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert(overflow <= 0, `Seitliches Scrollen auf ${hash}: ${overflow}px`);
        const small = await p3.evaluate(() => [...document.querySelectorAll('.view-games .btn, .view-games .chip')]
          .map((e) => [e.textContent.trim().slice(0, 30), e.getBoundingClientRect().height]).filter(([, h]) => h > 0 && h < 40));
        assert(!small.length, 'Zu kleine Bedienelemente: ' + small.map(([n, h]) => `${n} (${Math.round(h)})`).join(', '));
      }
      await p3.click('[data-g="edit"]');
      await p3.waitForSelector('dialog[open].sheet-game');
      const chipH = await p3.evaluate(() => document.querySelector('dialog[open] .check-chip span').getBoundingClientRect().height);
      assert(chipH >= 44, 'Auswahl-Chips kleiner als 44 px');
      assert(p3.errors.length === 0, p3.errors.join(' | '));
      await c3.close();
    });

    await test('Spiele: keine Konsolenfehler', async () => {
      assert(gp.errors.length === 0, 'Konsolenfehler: ' + gp.errors.join(' | '));
    });
    await gc.close();
  }

  // ------------------------------------------------------------------ Spiele: BoardGameGeek (nachgebildet)
  {
    const { ctx: bc, page: bp } = await newPage(browser);
    const games = () => bp.evaluate(() => window.__leeway.store.state.collections.games);
    const one = async (title) => (await games()).find((g) => g.title === title);
    const calls = [];
    let bggMode = 'ok';
    let busyOnce = true;
    const thingXML = `<?xml version="1.0" encoding="utf-8"?><items><item type="boardgame" id="284083">
      <name type="primary" sortindex="1" value="The Crew: The Quest for Planet Nine"/><name type="alternate" value="Die Crew"/>
      <yearpublished value="2019"/><minplayers value="2"/><maxplayers value="5"/>
      <poll name="suggested_numplayers" title="Beste Spielerzahl" totalvotes="400">
        <results numplayers="3"><result value="Best" numvotes="40"/><result value="Recommended" numvotes="50"/><result value="Not Recommended" numvotes="2"/></results>
        <results numplayers="4"><result value="Best" numvotes="300"/><result value="Recommended" numvotes="50"/><result value="Not Recommended" numvotes="2"/></results>
        <results numplayers="5"><result value="Best" numvotes="20"/><result value="Recommended" numvotes="90"/><result value="Not Recommended" numvotes="10"/></results>
      </poll>
      <playingtime value="20"/><minplaytime value="20"/><maxplaytime value="20"/><minage value="10"/>
      <link type="boardgamecategory" id="1" value="Card Game"/><link type="boardgamecategory" id="2" value="Space Exploration"/>
      <link type="boardgamemechanic" id="3" value="Cooperative Game"/><link type="boardgamemechanic" id="4" value="Trick-taking"/><link type="boardgamemechanic" id="5" value="Communication Limits"/>
      <link type="boardgamepublisher" id="6" value="KOSMOS"/>
      <statistics page="1"><ratings><averageweight value="1.98"/></ratings></statistics>
    </item></items>`;
    await bp.route('https://boardgamegeek.com/xmlapi2/**', async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      calls.push({ path: url.pathname + url.search, auth: req.headers().authorization, at: Date.now() });
      const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization', 'content-type': 'text/xml' };
      if (bggMode === 'auth') return route.fulfill({ status: 401, headers: h, body: '<error/>' });
      if (url.pathname.endsWith('/search')) {
        const q = url.searchParams.get('query').toLowerCase();
        const body = q.includes('crew')
          ? '<items total="1"><item type="boardgame" id="284083"><name type="alternate" value="Die Crew"/><yearpublished value="2019"/></item></items>'
          : '<items total="0"></items>';
        return route.fulfill({ status: 200, headers: h, body });
      }
      if (busyOnce) { busyOnce = false; return route.fulfill({ status: 202, headers: h, body: '<message>Your request has been accepted</message>' }); }
      return route.fulfill({ status: 200, headers: h, body: thingXML });
    });
    const addGame = (data) => bp.evaluate((d) => window.__leeway.store.create('games', { mechanics: [], competences: [], tags: [], cover: false, recognition: { status: 'open' }, ...d }), data);

    await test('BoardGameGeek: nicht in der Kartei, sondern unter Einstellungen; Schlüssel prüfen, nur auf dem Gerät', async () => {
      await bp.goto(BASE + '#/games');
      await bp.waitForSelector('.view-games');
      assert(!(await bp.$('.view-games #verbindung-bgg, .view-games .api-panel')), 'Verbindungen stehen noch in der Kartei');
      assert(!(await bp.$('#verbindung-api')), 'Claude API sollte entfernt sein');
      await bp.goto(BASE + '#/settings');
      await bp.waitForSelector('[data-s-form="bgg"]');
      await bp.fill('#bgg-token', 'kurz');
      await bp.click('[data-s-form="bgg"] [type="submit"]');
      await bp.waitForSelector('.toast-danger');
      await bp.fill('#bgg-token', 'bgg-test-token-0000-1234');
      await bp.click('[data-s-form="bgg"] [type="submit"]');
      await bp.waitForSelector('#verbindung-bgg .api-state.is-on');
      assert((await bp.textContent('#verbindung-bgg .api-state')).includes('…1234'), 'Schlüsselende nicht angezeigt');
      const backup = await bp.evaluate(() => JSON.stringify(window.__leeway.store.exportData()));
      assert(!backup.includes('bgg-test-token'), 'Schlüssel steht in der Sicherung');
      assert(calls.length === 0, 'Ohne Spiele darf nichts abgefragt werden');
    });

    await test('BoardGameGeek: Spiel mit Titel → Suche, Fakten, beste Spielerzahl; Spielart und Kompetenzen per Regeln', async () => {
      const g0 = await addGame({ title: 'Die Crew' });
      await bp.goto(BASE + '#/games/' + g0.id);
      await bp.waitForSelector('[data-g="bgg"]');
      await bp.click('[data-g="bgg"]');
      await bp.waitForFunction((id) => window.__leeway.store.get('games', id)?.bgg?.status === 'done', g0.id, { timeout: 20000 });
      const g = await one('Die Crew');
      assert(g.playersMin === 2 && g.playersMax === 5 && g.playersBest === '4' && g.durationMin === 20 && g.ageMin === 10, 'Fakten falsch: ' + JSON.stringify(g));
      assert(g.weight === 1.98 && g.year === 2019 && g.publisher === 'KOSMOS' && g.bggUrl === 'https://boardgamegeek.com/boardgame/284083', 'Eckdaten falsch');
      assert(g.title === 'Die Crew', 'Deutscher Titel wurde überschrieben');
      assert(g.mechanics.includes('kooperativ') && g.mechanics.includes('stichspiel'), 'Mechaniken: ' + g.mechanics.join());
      assert(g.category === 'kenner', 'Spielart: ' + g.category);
      assert(g.competences[0] === 'zusammenarbeit' && g.competences.includes('kommunikation') && g.competences.length <= 6, 'Kompetenzen: ' + g.competences.join());
      assert(g.recognition.status === 'done' && g.recognition.source === 'bgg', 'Gilt nicht als erkannt');
      assert(calls.every((c) => c.auth === 'Bearer bgg-test-token-0000-1234'), 'App-Schlüssel fehlt in der Anfrage');
      assert(calls[0].path.includes('/search') && calls[0].path.includes('exact=1') && calls.filter((c) => c.path.includes('/thing')).length === 2, 'Ablauf (Suche, 202, Wiederholung): ' + calls.map((c) => c.path).join(' '));
      for (let n = 1; n < calls.length; n += 1) assert(calls[n].at - calls[n - 1].at >= 1400, 'Zu schnell hintereinander abgefragt');
      await bp.waitForSelector('.game-fact');
      assert((await bp.textContent('.game-facts-grid')).includes('1,98 von 5'), 'Komplexität fehlt in der Ansicht');
      assert(!(await bp.$('[data-bgg-hint]')), 'Hinweis sollte nach dem Abgleich weg sein');
    });

    await test('BoardGameGeek: Antwort aus der Claude-App mit BGG-Nummer → direkt abgeglichen, Einordnung bleibt', async () => {
      calls.length = 0;
      const g0 = await addGame({ title: 'Neues Spiel' });
      const answer = '```json\n' + JSON.stringify({ 'spielekompass-antwort': 1, spiele: [{ kennung: g0.id, titel: 'Die Crew – Mission Tiefsee', bgg_id: 284083,
        spieler_min: 2, spieler_max: 6, alter_ab: 8, kategorie: 'familie', mechaniken: ['stichspiel'], kompetenzen: ['empathie'], sicherheit: 'hoch' }] }) + '\n```';
      await bp.goto(BASE + '#/games/' + g0.id);
      await bp.click('[data-g="recognize"]');
      await bp.waitForSelector('dialog[open] [data-r-answer]');
      await bp.fill('dialog[open] [data-r-answer]', answer);
      await bp.click('dialog[open] [data-r="apply"]');
      await bp.waitForFunction((id) => window.__leeway.store.get('games', id)?.bgg?.status === 'done', g0.id, { timeout: 20000 });
      const g = (await games()).find((x) => x.id === g0.id);
      assert(calls.length === 1 && calls[0].path.startsWith('/xmlapi2/thing?id=284083'), 'Hätte direkt nachschlagen sollen: ' + calls.map((c) => c.path).join(' '));
      assert(g.playersMax === 5 && g.ageMin === 8, 'Fakten von BGG bzw. Schachtel falsch');
      assert(g.category === 'familie' && g.competences.join() === 'empathie', 'Vorhandene Einordnung wurde überschrieben');
      assert(g.mechanics.includes('stichspiel') && g.mechanics.includes('kooperativ'), 'Mechaniken nicht ergänzt');
    });

    await test('BoardGameGeek: unbekannter Titel und abgelehnter Schlüssel zeigen Hinweise', async () => {
      const g0 = await addGame({ title: 'Ganz unbekanntes Spiel' });
      await bp.goto(BASE + '#/games/' + g0.id);
      await bp.click('[data-g="bgg"]');
      await bp.waitForFunction(() => document.querySelector('[data-bgg-hint]')?.textContent.includes('nicht gefunden'), null, { timeout: 15000 });
      bggMode = 'auth';
      await bp.click('[data-g="bgg"]');
      await bp.waitForFunction(() => document.querySelector('[data-bgg-hint]')?.textContent.includes('abgelehnt'), null, { timeout: 15000 });
      bggMode = 'ok';
      bp.errors = bp.errors.filter((e) => !e.includes('401') && !e.includes('202'));
      assert(bp.errors.length === 0, 'Konsolenfehler: ' + bp.errors.join(' | '));
    });
    await bc.close();
  }


  await test('Keine Konsolenfehler im gesamten Ablauf', async () => {
    const relevant = page.errors.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e));
    assert(relevant.length === 0, relevant.join(' | '));
  });
  await ctx.close();

  // ---- Darstellung auf verschiedenen Geräten ----
  await test('iPhone: untere Leiste sichtbar, Seitenleiste verborgen, kein seitliches Scrollen', async () => {
    const { ctx: c, page: p } = await newPage(browser, { ...devices['iPhone 13'], locale: 'de-DE' });
    assert(await p.isVisible('#tabbar'), 'Tabbar fehlt');
    assert(!(await p.isVisible('.sidebar')), 'Sidebar sichtbar');
    await p.click('[data-g="sample"]');
    for (const r of ['games', 'settings', 'impressum', 'datenschutz']) {
      await p.goto(BASE + '#/' + r);
      await p.waitForTimeout(150);
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert(overflow <= 0, `Seitliches Scrollen auf ${r}: ${overflow}px`);
    }
    await p.click('[data-more]');
    await p.click('dialog[open] .more-legal a[href="#/impressum"]');
    await p.waitForSelector('.view-impressum .legal-text');
    const small = await p.evaluate(() => [...document.querySelectorAll('.tab')]
      .map((e) => e.getBoundingClientRect().height).filter((h) => h > 0 && h < 44));
    assert(!small.length, 'Tabs kleiner als 44 px');
    await c.close();
  });

  await test('iPad hochkant: Symbolleiste; iPad quer: volle Seitenleiste', async () => {
    const { ctx: c, page: p } = await newPage(browser, { viewport: { width: 820, height: 1180 } });
    assert(await p.isVisible('.sidebar') && !(await p.isVisible('.brand-full')), 'Symbolleiste falsch');
    await p.setViewportSize({ width: 1180, height: 820 });
    assert(await p.isVisible('.brand-full'), 'Volle Seitenleiste fehlt');
    assert(!(await p.isVisible('#tabbar')), 'Tabbar sollte verborgen sein');
    await c.close();
  });

  await test('Einzeldatei (dist/Spielekompass.html) läuft ohne Server, Daten bleiben erhalten', async () => {
    require('child_process').execFileSync('node', [path.join(__dirname, '../tools/build-single-html.cjs')]);
    const file = 'file://' + path.join(__dirname, '../dist/Spielekompass.html');
    const c = await browser.newContext({ locale: 'de-DE' });
    const p = await c.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(file);
    await p.waitForSelector('.view-games .empty');
    assert(await p.evaluate(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0)), 'Bilder fehlen');
    await p.click('[data-g="sample"]');
    await p.waitForSelector('.game-card');
    await p.reload();
    await p.waitForSelector('.game-card');
    assert(errs.length === 0, errs.join(' | '));
    await c.close();
  });

  await browser.close();
  server.close();
  console.log('\nSpielekompass – Funktionstests\n');
  console.log(results.join('\n'));
  console.log(`\n${results.length - failures} von ${results.length} Tests bestanden.`);
  process.exit(failures ? 1 : 0);
})();
