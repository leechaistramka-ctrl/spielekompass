/**
 * Bilderspeicher für Titelbilder der Spiele.
 *
 * Fotos sind zu groß für den normalen Gerätespeicher (localStorage, ca. 5 MB).
 * Sie liegen deshalb in der Gerätedatenbank des Browsers (IndexedDB), ebenfalls nur auf dem Gerät.
 * Schlüssel ist die ID des Spiels. Für den Heimserver später: dieselben Funktionen mit Server umsetzen.
 */
const DB_NAME = 'leeway-spielekompass-bilder';
const STORE = 'images';

let dbPromise = null;
const urls = new Map(); // ID → Objekt-URL (Zwischenspeicher für die Anzeige)

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) { reject(new Error('Dieser Browser kann keine Bilder speichern.')); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Bilderspeicher nicht verfügbar.'));
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

async function run(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error || new Error('Bild konnte nicht gespeichert werden.'));
    tx.onabort = () => reject(tx.error || new Error('Bild konnte nicht gespeichert werden – der Gerätespeicher ist möglicherweise voll.'));
  });
}

function forget(id) {
  const u = urls.get(id);
  if (u) URL.revokeObjectURL(u);
  urls.delete(id);
}

export async function putImage(id, blob) {
  await run('readwrite', (s) => s.put(blob, id));
  forget(id);
}

export const getImage = (id) => run('readonly', (s) => s.get(id)).then((b) => b || null);

/** Objekt-URL für ein <img>, oder null, wenn es kein Bild gibt. */
export async function imageURL(id) {
  if (urls.has(id)) return urls.get(id);
  const blob = await getImage(id);
  if (!blob) return null;
  const u = URL.createObjectURL(blob);
  urls.set(id, u);
  return u;
}

export async function deleteImage(id) {
  await run('readwrite', (s) => s.delete(id));
  forget(id);
}

export async function imageIds() {
  return (await run('readonly', (s) => s.getAllKeys())) || [];
}

export async function clearImages() {
  await run('readwrite', (s) => s.clear());
  for (const id of [...urls.keys()]) forget(id);
}

export const blobToDataURL = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

export async function dataURLToBlob(url) {
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(String(url))) throw new Error('Ungültiges Bild in der Datei.');
  return (await fetch(url)).blob();
}
