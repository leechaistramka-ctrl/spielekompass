/**
 * Der Datenspeicher der App.
 *
 * - Hält alle Daten im Arbeitsspeicher (schnelles Lesen).
 * - Schreibt jede Änderung sofort über einen Adapter dauerhaft weg.
 * - Benachrichtigt die Oberfläche über Änderungen (subscribe).
 *
 * Datenformat (identisch mit der Export-Datei):
 * { app, schemaVersion, settings, collections: { games: [] } }
 */
import { APP } from '../config.js';
import { uid } from './utils.js';

export const APP_ID = 'leeway-spielekompass';

/** Alle Datenbereiche. Neue Module ergänzen hier ihren Bereich. */
// games: Spiele · people: Personen und Gruppen · plays: Spielprotokoll · evenings: geplante Spieleabende
export const COLLECTIONS = ['games', 'people', 'plays', 'evenings'];

export const COLLECTION_LABELS = {
  games: 'Spiele',
};

const DEFAULT_SETTINGS = {
  theme: 'system', // 'system' | 'dark' | 'light'
  lastExportAt: null, // Zeitpunkt der letzten exportierten Kartei
};

const emptyState = () => ({
  app: APP_ID,
  schemaVersion: APP.schemaVersion,
  settings: { ...DEFAULT_SETTINGS },
  collections: Object.fromEntries(COLLECTIONS.map((c) => [c, []])),
});

/**
 * Migrationen: Wenn sich das Datenformat ändert, wird hier alter Bestand
 * schrittweise auf die neue Version gebracht. Beispiel für später:
 *   2: (data) => { data.collections.tasks.forEach(t => t.tags ??= []); return data; }
 */
const MIGRATIONS = {};

function migrate(data) {
  let version = Number(data.schemaVersion) || 1;
  while (version < APP.schemaVersion) {
    version += 1;
    if (MIGRATIONS[version]) data = MIGRATIONS[version](data);
    data.schemaVersion = version;
  }
  return data;
}

const isRecord = (r) => r && typeof r === 'object' && !Array.isArray(r) && typeof r.id === 'string' && r.id;

function normalize(raw) {
  const state = emptyState();
  if (!raw || typeof raw !== 'object') return state;
  const data = migrate(structuredClone(raw));
  state.settings = { ...state.settings, ...(data.settings || {}) };
  for (const c of COLLECTIONS) {
    const arr = data.collections?.[c];
    if (Array.isArray(arr)) state.collections[c] = arr.filter(isRecord);
  }
  return state;
}

export class Store {
  constructor(adapter) {
    this.adapter = adapter;
    this.state = emptyState();
    this.listeners = new Set();
    this.loadError = null;
  }

  async init() {
    try {
      this.state = normalize(await this.adapter.load());
    } catch (err) {
      console.error('Laden fehlgeschlagen', err);
      this.loadError = err;
    }
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Führt eine Änderung aus, speichert sie und macht sie bei Fehlern rückgängig. */
  async #mutate(change, fn) {
    if (this.loadError) {
      throw new Error('Die gespeicherten Daten konnten nicht gelesen werden. Zum Schutz wird nichts überschrieben.');
    }
    const previous = structuredClone(this.state);
    const result = fn(this.state);
    try {
      await this.adapter.save(this.state);
    } catch (err) {
      this.state = previous;
      throw err;
    }
    for (const listener of this.listeners) listener(change);
    return result;
  }

  // ---- Lesen ---------------------------------------------------------------
  list(col) {
    return [...this.#col(col)];
  }

  get(col, id) {
    return this.#col(col).find((r) => r.id === id) || null;
  }

  count(col) {
    return this.#col(col).length;
  }

  get settings() {
    return { ...this.state.settings };
  }

  get isEmpty() {
    return COLLECTIONS.every((c) => this.state.collections[c].length === 0);
  }

  // ---- Schreiben -----------------------------------------------------------
  create(col, data) {
    const now = new Date().toISOString();
    const record = { ...data, id: uid(), createdAt: now, updatedAt: now };
    return this.#mutate({ type: 'create', col, id: record.id }, (s) => {
      s.collections[col].push(record);
      return record;
    });
  }

  update(col, id, patch) {
    return this.#mutate({ type: 'update', col, id }, (s) => {
      const arr = s.collections[col];
      const i = arr.findIndex((r) => r.id === id);
      if (i < 0) throw new Error('Eintrag nicht gefunden.');
      arr[i] = { ...arr[i], ...patch, id, createdAt: arr[i].createdAt, updatedAt: new Date().toISOString() };
      return arr[i];
    });
  }

  /** Ändert mehrere Einträge auf einmal (z. B. Aufgaben eines gelöschten Projekts). */
  updateWhere(col, predicate, patch) {
    return this.#mutate({ type: 'update-many', col }, (s) => {
      const now = new Date().toISOString();
      let n = 0;
      s.collections[col] = s.collections[col].map((r) => {
        if (!predicate(r)) return r;
        n += 1;
        return { ...r, ...patch, updatedAt: now };
      });
      return n;
    });
  }

  /**
   * Ersetzt alle Einträge, auf die predicate zutrifft, in einem Schritt durch records
   * (z. B. beim erneuten Import eines Kalenders). Vorhandene id/createdAt bleiben erhalten.
   */
  replaceWhere(col, predicate, records) {
    return this.#mutate({ type: 'replace-many', col }, (s) => {
      const now = new Date().toISOString();
      const kept = s.collections[col].filter((r) => !predicate(r));
      const added = records.map((r) => ({ ...r, id: r.id || uid(), createdAt: r.createdAt || now, updatedAt: now }));
      s.collections[col] = [...kept, ...added];
      return added.length;
    });
  }

  remove(col, id) {
    return this.#mutate({ type: 'remove', col, id }, (s) => {
      s.collections[col] = s.collections[col].filter((r) => r.id !== id);
    });
  }

  setSettings(patch) {
    return this.#mutate({ type: 'settings' }, (s) => {
      s.settings = { ...s.settings, ...patch };
    });
  }

  reset() {
    return this.#mutate({ type: 'reset' }, (s) => {
      const keep = { theme: s.settings.theme };
      Object.assign(s, emptyState());
      s.settings = { ...s.settings, ...keep };
    });
  }

  // ---- Export / Import -----------------------------------------------------
  exportData() {
    const { lastExportAt, ...settings } = this.state.settings;
    return {
      app: APP_ID,
      schemaVersion: this.state.schemaVersion,
      appVersion: APP.version,
      exportedAt: new Date().toISOString(),
      settings,
      collections: structuredClone(this.state.collections),
    };
  }

  /** Prüft eine Sicherungsdatei, ohne etwas zu verändern. */
  static inspectImport(payload) {
    if (!payload || typeof payload !== 'object') return { ok: false, error: 'Die Datei enthält keine gültigen Daten.' };
    if (payload.app !== APP_ID) return { ok: false, error: 'Diese Datei ist keine Sicherung des Spielekompass.' };
    if (Number(payload.schemaVersion) > APP.schemaVersion) {
      return { ok: false, error: 'Die Sicherung stammt aus einer neueren App-Version. Bitte zuerst die App aktualisieren.' };
    }
    if (!payload.collections || typeof payload.collections !== 'object') {
      return { ok: false, error: 'In der Datei fehlen die Datenbereiche.' };
    }
    const counts = {};
    for (const c of COLLECTIONS) {
      const arr = payload.collections[c];
      counts[c] = Array.isArray(arr) ? arr.filter(isRecord).length : 0;
    }
    return { ok: true, counts, exportedAt: payload.exportedAt || null, appVersion: payload.appVersion || null };
  }

  /**
   * Importiert eine Sicherung.
   * mode 'merge':   Vorhandenes bleibt; gleiche Einträge werden durch die neuere Fassung ersetzt.
   * mode 'replace': Alle aktuellen Daten werden durch die Sicherung ersetzt.
   */
  importData(payload, mode = 'merge') {
    const check = Store.inspectImport(payload);
    if (!check.ok) return Promise.reject(new Error(check.error));
    const incoming = normalize(payload);
    return this.#mutate({ type: 'import', mode }, (s) => {
      if (mode === 'replace') {
        s.collections = incoming.collections;
        const { lastExportAt } = s.settings;
        s.settings = { ...incoming.settings, lastExportAt };
        return check.counts;
      }
      for (const c of COLLECTIONS) {
        const byId = new Map(s.collections[c].map((r) => [r.id, r]));
        for (const rec of incoming.collections[c]) {
          const existing = byId.get(rec.id);
          if (!existing || String(rec.updatedAt || '') > String(existing.updatedAt || '')) byId.set(rec.id, rec);
        }
        s.collections[c] = [...byId.values()];
      }
      return check.counts;
    });
  }

  usage() {
    return this.adapter.usage();
  }

  #col(col) {
    const arr = this.state.collections[col];
    if (!arr) throw new Error(`Unbekannter Datenbereich: ${col}`);
    return arr;
  }
}
