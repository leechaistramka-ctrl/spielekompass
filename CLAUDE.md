# Spielekompass (LEEWAY Studio): Hinweise für die Weiterentwicklung

## Wer und wofür
- **Spielekompass** ist ein eigenständiges Produkt im LEEWAY-Studio-Universum: die eigene Sammlung von Gesellschaftsspielen als Kartei für die pädagogische Arbeit. Spiele fotografieren, erkennen und einordnen lassen, für jede Gruppe das passende Spiel finden.
- Hervorgegangen aus der „Spielothek“ im LEEWAY Workspace (Repo `leeway-workspace`, Stand 0.10.3). Seit 1.0.0 eigenständig und unabhängig vom Workspace weiterentwickelt.
- Genutzt vor allem auf **iPad Air** und **iPhone**. Soll später auch geteilt werden können.
- Die Inhaberin bzw. der Inhaber ist kein Programmierer: Entscheidungen verständlich auf Deutsch erklären, sinnvolle Annahmen treffen und als „Annahme:“ kennzeichnen.

## Feste Regeln
- **Sprache:** Oberfläche, Kommentare und Dokumentation auf Deutsch.
- **Keine Kosten je Spiel als Standard:** Erkennung über das Teilen an die eigene Claude-App, Antwort mit einem Tipp aus der Zwischenablage übernehmen. Die Claude API (kostenpflichtig) bleibt Option.
- **Fremde Dienste nur mit eigenem Schlüssel und nur, wenn eingeschaltet:** BoardGameGeek-Schnittstelle und Claude API. Schlüssel nur auf dem Gerät (`localStorage`), nie in Sicherungen. Ohne Schlüssel funktioniert alles ohne fremde Dienste. Sonst keine Tracker, keine CDNs. Schriften und Bilder liegen lokal in `assets/`.
- **DSGVO:** Nutzerdaten bleiben auf dem Gerät. Hosting nur bei EU-Anbietern (geplant: statichost.eu). Neue Datenflüsse → Datenschutzerklärung in `js/modules/legal.js` anpassen.
- **Kein Build-Schritt:** reines HTML, CSS und JavaScript mit ES-Modulen. Kein Framework.
- **Marke:** LEEWAY Studio Markenpaket 1.0. Farben: Waldgrün #193126, Messinggold #C8A66D, Hellgold #E9D6AD, Naturweiß #F1E9D8, Graphit #171B18. Schriften: Lato, Noto Serif Italic. Logos in `assets/brand/` unverändert lassen.
- **Bedienung:** Touch-Ziele mindestens 44 px, Hoch- und Querformat, Safe Areas beachten.
- **Sicherheit:** Nutzertext immer über `esc()` aus `js/core/utils.js` ausgeben.
- **Öffentliches Repo:** Keine persönlichen Daten, Schlüssel oder echten Adressen ins Repo. Angaben für das Impressum nur in `js/config.js` → `LEGAL` (Platzhalter, bis sie bewusst eingetragen werden).

## Bei jeder Änderung
1. `sw.js`: Konstante `CACHE` erhöhen und neue Dateien in `ASSETS` eintragen (ein Test prüft, dass alle eingetragenen Dateien existieren).
2. `js/config.js` und `package.json`: Version erhöhen. `CHANGELOG.md` aktualisieren.
3. Tests ausführen: `node tests/e2e.test.cjs` (Playwright mit Chromium). Alle Tests müssen bestehen.
4. Einzeldatei bauen: `node tools/build-single-html.cjs` (erzeugt `dist/Spielekompass.html`, steht nicht in Git).

## Aufbau
- `index.html`: App-Gerüst, startet in der Kartei (`#/games`).
- `js/core/store.js`: Datenspeicher mit austauschbarem Adapter. Einziger Datenbereich: `games`. Speicherplatz `leeway-spielekompass` (nicht ändern, sonst sind vorhandene Daten weg).
- `js/core/image-store.js`: Fotos in IndexedDB (Datenbank `leeway-spielekompass-bilder`).
- `js/modules/`: `games.js` (Kartei, Filter, Detail, Verbindungen), `settings.js` (Darstellung, Kartei sichern, Speicher, Löschen), `legal.js` (Impressum, Datenschutz).
- `js/components/game-data.js`: Begriffe (Spielarten, Mechaniken, Kompetenzen), Filter, Auftrag an Claude und Auswertung der Antwort. Neue Mechaniken oder Kompetenzen hier ergänzen.
- `js/components/game-ui.js`: Zuschnitt, Bearbeiten, Erkennen-Dialog, „Antwort übernehmen“, Kartei-Export und -Import.
- `js/components/game-bgg.js`: Abgleich mit BoardGameGeek und Einordnung per Regeln.
- `js/components/game-ai.js`: optionale vollautomatische Erkennung über die Claude API.
- Antwortformat und Abläufe: `docs/SPIELEKOMPASS.md`.
- Kompatibilität: Antworten mit `spielothek-antwort`, Karteien `leeway-spielothek` und Workspace-Sicherungen (`leeway-workspace`, nur Spiele) werden weiter verstanden.
- Lokal starten: `node tools/serve.cjs` → http://localhost:8080
- Hinweis: `css/modules.css` enthält noch Gestaltung aus dem Workspace (Dashboard, Aufgaben, Kalender …), die hier nicht genutzt wird. Kann bei Gelegenheit entfernt werden.
