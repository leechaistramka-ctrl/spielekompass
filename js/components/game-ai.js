/**
 * Spielekompass: vollautomatische Erkennung über die Claude API.
 *
 * Ausnahme von der Regel „keine fremden Dienste“, ausdrücklich gewünscht
 * (persönliches Werkzeug). Ablauf je Spiel:
 *   Foto (verkleinert) → Claude erkennt das Spiel, recherchiert per Websuche zuerst auf BoardGameGeek,
 *   ergänzt aus weiteren Quellen, ordnet ein und nennt den Bildausschnitt der Schachtel
 *   → Titelbild wird automatisch zugeschnitten, Angaben werden eingetragen.
 *
 * Der API-Schlüssel liegt nur auf diesem Gerät (localStorage) und ist nicht Teil von Sicherungen.
 * Die Anfragen gehen direkt vom Browser an api.anthropic.com.
 */
import { autoPrompt, parseRecognition } from './game-data.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
export const MODEL = 'claude-opus-5-5';
const KEY_NAME = 'leeway-spielekompass-schluessel';
const MAX_CONTINUE = 5; // so oft darf Claude eine lange Recherche fortsetzen (pause_turn)

export function getApiKey() {
  try { return localStorage.getItem(KEY_NAME) || ''; } catch { return ''; }
}
export function setApiKey(key) {
  try {
    if (key) localStorage.setItem(KEY_NAME, key.trim()); else localStorage.removeItem(KEY_NAME);
  } catch { /* privater Modus: Schlüssel gilt nur für diese Sitzung nicht */ }
}
export const hasApiKey = () => !!getApiKey();

export class RecognitionError extends Error {
  constructor(message, { fatal = false } = {}) {
    super(message);
    this.fatal = fatal; // true = weitere Spiele der Warteschlange gar nicht erst versuchen
  }
}

async function callClaude(body) {
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': getApiKey(),
        'anthropic-version': '2026-10-21',
        'anthropic-beta': 'server-side-fallback-2026-07-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new RecognitionError('Keine Verbindung zu Claude. Bitte Internetverbindung prüfen.');
  }
  if (res.ok) return res.json();
  let detail = '';
  try { detail = (await res.json())?.error?.message || ''; } catch { /* keine Details */ }
  if (res.status === 401 || res.status === 403) throw new RecognitionError('Der API-Schlüssel wurde abgelehnt. Bitte unter „Verbindungen → Claude API“ prüfen.', { fatal: true });
  if (/credit|balance|billing/i.test(detail)) throw new RecognitionError('Das Guthaben für die Claude API ist aufgebraucht. Bitte in der Claude Console aufladen.', { fatal: true });
  if (res.status === 429) throw new RecognitionError('Zu viele Anfragen auf einmal. Bitte in einer Minute erneut versuchen.');
  if (res.status >= 500) throw new RecognitionError('Claude ist gerade überlastet. Bitte später erneut versuchen.');
  throw new RecognitionError(`Anfrage abgelehnt (${res.status})${detail ? `: ${detail}` : ''}`);
}

/**
 * Erkennt ein Spiel. imageBase64 = JPEG ohne „data:“-Vorspann oder null (dann nur über den Titel).
 * Liefert den Patch für das Spiel (inkl. cropBox) wie parseRecognition.
 */
export async function recognizeGame(game, imageBase64) {
  const content = [];
  if (imageBase64) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } });
  content.push({ type: 'text', text: autoPrompt(game, !!imageBase64) });
  const user = { role: 'user', content };
  const base = {
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: 'medium' },
    fallbacks: 'default',
    tools: [
      { type: 'web_search_20260209', name: 'web_search', max_uses: 6 },
      { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 4 },
    ],
  };
  let assistant = [];
  for (let n = 0; n <= MAX_CONTINUE; n += 1) {
    const messages = assistant.length ? [user, { role: 'assistant', content: assistant }] : [user];
    const res = await callClaude({ ...base, messages });
    assistant = [...assistant, ...(res.content || [])];
    if (res.stop_reason === 'refusal') throw new RecognitionError('Claude hat die Anfrage abgelehnt.');
    if (res.stop_reason !== 'pause_turn') break;
  }
  const answer = assistant.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try {
    return parseRecognition(answer, [game.id])[0].patch;
  } catch (err) {
    throw new RecognitionError(`Claude hat keine verwertbaren Angaben geliefert. ${err.message}`);
  }
}
