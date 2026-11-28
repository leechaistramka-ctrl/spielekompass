/**
 * Modul-Verzeichnis. Die Reihenfolge bestimmt die Navigation.
 * Neues Modul: Datei in js/modules/ anlegen, hier importieren und eintragen.
 *
 * Ein Modul ist ein Objekt mit:
 *   id       – Adresse (#/id) und interner Name
 *   title    – Anzeigename
 *   navTitle – (optional) kürzerer Name für die Navigation
 *   icon     – Name eines Icons aus core/icons.js
 *   group    – 'work' | 'system' (Navigationsgruppe)
 *   primary  – true = in der unteren Leiste auf dem iPhone sichtbar
 *   status   – 'ready'
 *   hidden   – (optional) true = nicht in der Navigation, nur über Links erreichbar
 *   render(root, ctx) – zeichnet das Modul in das Element root
 */
import games from './games.js';
import abend from './abend.js';
import tisch from './tisch.js';
import settings from './settings.js';
import { impressum, datenschutz } from './legal.js';

export const NAV_GROUPS = [
  { id: 'work', label: 'Sammlung' },
  { id: 'play', label: 'Spielen' },
  { id: 'system', label: 'System' },
];

export const START_MODULE = 'games';

export const modules = [games, abend, tisch, settings, impressum, datenschutz];

export const findModule = (id) => modules.find((m) => m.id === id) || null;
