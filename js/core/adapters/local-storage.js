/**
 * Speicher-Adapter für den lokalen Gerätespeicher (localStorage).
 *
 * Jeder Adapter bietet dieselben vier Funktionen: load, save, clear, usage.
 * Ein späterer Server-Adapter (Heimserver) implementiert genau diese Funktionen –
 * der Rest der App bleibt dadurch unverändert.
 */
export class LocalStorageAdapter {
  constructor(key) {
    this.key = key;
    this.label = 'Lokaler Gerätespeicher';
  }

  async load() {
    const raw = localStorage.getItem(this.key);
    return raw ? JSON.parse(raw) : null;
  }

  async save(snapshot) {
    try {
      localStorage.setItem(this.key, JSON.stringify(snapshot));
    } catch (err) {
      const e = new Error('Speichern fehlgeschlagen – der Gerätespeicher ist möglicherweise voll.');
      e.cause = err;
      throw e;
    }
  }

  async clear() {
    localStorage.removeItem(this.key);
  }

  /** Ungefährer Speicherverbrauch in Bytes (localStorage speichert Text als UTF-16). */
  async usage() {
    return (localStorage.getItem(this.key) || '').length * 2;
  }
}
