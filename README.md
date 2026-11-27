# Spielekompass

**Ein Produkt von LEEWAY Studio.** Die eigene Sammlung von Gesellschaftsspielen als Kartei für die pädagogische Arbeit: Schachtel fotografieren, Spiel erkennen und einordnen lassen, für jede Gruppe das passende Spiel finden.

Installierbare Web-App (PWA) für iPad, iPhone und Computer. Offline nutzbar, ohne Konto, ohne Tracking. Alle Daten bleiben auf dem Gerät.

**Version 1.1.0** · Stand: 27.11.2026

## Was der Spielekompass kann

- **Spiele fotografieren** (auch mehrere auf einmal). Das Foto bleibt auf dem Gerät.
- **Erkennen ohne Kosten je Spiel:** Fotos und Auftrag über das Teilen-Menü an die eigene Claude-App geben, Antwort kopieren und mit einem Tipp auf „Antwort übernehmen“ eintragen. Titelbild wird automatisch auf die Schachtel zugeschnitten.
- **Optional: Abgleich mit BoardGameGeek** (unter Einstellungen, kostenloser App-Schlüssel vom eigenen BGG-Konto): Spieleranzahl, beste Spielerzahl, Dauer, Alter, Komplexität, Mechaniken. Spielart und Kompetenzen werden per Regeln abgeleitet, wenn sie fehlen.
- **Passende Spiele finden:** Gruppengröße, jüngste Person, verfügbare Zeit, Kompetenzziele (z. B. Zusammenarbeit, Frustrationstoleranz), Spielart und Mechaniken kombinierbar, dazu Suche.
- **Detailansicht** mit Titelbild, Eckdaten, Beschreibung, pädagogischem Einsatz, eigenen Notizen und Quellen. Alles von Hand bearbeitbar, Zuschnitt jederzeit anpassbar.
- **Kartei sichern und übertragen:** eine Datei mit allen Angaben und Fotos, z. B. für ein zweites Gerät.

Details zu Abläufen, Datenformat und Antwortformat: [docs/SPIELEKOMPASS.md](docs/SPIELEKOMPASS.md)

## Umzug aus dem LEEWAY Workspace

Der Spielekompass ist aus der „Spielothek“ im LEEWAY Workspace hervorgegangen und hat einen eigenen Speicher.

1. Im Workspace (oder in der Spielothek-App) unter Spielothek → „Kartei exportieren“ tippen.
2. Im Spielekompass „Kartei einspielen …“ wählen (in der leeren Kartei oder unter Einstellungen).

Alte Antworten von Claude (`spielothek-antwort`) und normale Workspace-Sicherungen (nur die Spiele, ohne Fotos) versteht der Spielekompass ebenfalls.

## Starten (lokal am Computer)

Voraussetzung: [Node.js](https://nodejs.org) (kostenlos).

```bash
node tools/serve.cjs        # dann im Browser http://localhost:8080 öffnen
```

Einen Build-Schritt oder `npm install` braucht die App selbst nicht.

## Auf iPad und iPhone nutzen

Die App muss über **https** erreichbar sein (geplant: statichost.eu, EU-Hosting). Dann in Safari öffnen → Teilen → „Zum Home-Bildschirm“.

> Die installierte App hat einen **eigenen Speicher**, getrennt vom Safari-Tab. Daher erst installieren, dann loslegen. Zwischen Geräten überträgst du die Spiele per Kartei-Datei.

## Einzeldatei

`node tools/build-single-html.cjs` erzeugt `dist/Spielekompass.html`: die komplette App in einer Datei. Per Doppelklick im Browser nutzbar, ohne Server. Ohne Offline-Dienst und ohne Installation als App.

## Marke

LEEWAY Studio Markenpaket 1.0: Logos in `assets/brand/` (unverändert), Farben Waldgrün #193126, Messinggold #C8A66D, Hellgold #E9D6AD, Naturweiß #F1E9D8, Graphit #171B18, Schriften Lato und Noto Serif Italic (lokal in `assets/fonts/`).

## Tests

```bash
npm install          # nur einmal: installiert Playwright (Testwerkzeug)
npx playwright install chromium
npm test             # automatische Funktionstests
```

## Weitere Dokumentation

- [CLAUDE.md](CLAUDE.md): Regeln und Aufbau für die Weiterentwicklung
- [docs/SPIELEKOMPASS.md](docs/SPIELEKOMPASS.md): Abläufe, Filter, Datenflüsse, Speicherung, Antwortformat
- [docs/LIZENZEN.md](docs/LIZENZEN.md): verwendete Komponenten und Lizenzen
- [CHANGELOG.md](CHANGELOG.md): Versionsgeschichte
