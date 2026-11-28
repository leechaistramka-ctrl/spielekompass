# Spielekompass

Der Spielekompass ist eine Kartei der eigenen Gesellschaftsspiele für die pädagogische Arbeit: mit Titelbild, Eckdaten, Einordnung und Filtern, die zu einer konkreten Gruppe passende Spiele finden.

## Ablauf

### Standard: kostenlos über die Claude-App und BoardGameGeek

Ohne Kosten je Spiel. Nur das Teilen an die Claude-App bleibt ein Handgriff (läuft über das eigene Claude-Abo).

1. Einmalig unten in der Kartei unter „Verbindungen → BoardGameGeek“ einen App-Schlüssel eintragen. Er kostet nichts: mit dem eigenen BoardGameGeek-Konto unter boardgamegeek.com/applications eine nicht kommerzielle Anwendung anlegen und dort einen Token erzeugen. Das Passwort braucht die App nicht. Der Schlüssel bleibt nur auf diesem Gerät und steht in keiner Sicherung.
2. **Spiel fotografieren**, gern mehrere auf einmal. Die App speichert das Foto und schneidet vorläufig mittig zu; ein Zuschnitt von Hand ist nicht nötig.
3. Der Dialog „Mit Claude erkennen“ öffnet sich. „An Claude teilen“ gibt Fotos und Auftrag an die Claude-App (bis zu 10 Spiele auf einmal). Claude antwortet mit einem JSON-Block. In der Claude-App bei der Antwort auf „Kopieren“ tippen, zurück in den Spielekompass und „Antwort übernehmen“ tippen (steht im Hinweis „noch nicht erkannt“ und im Dialog). Auf iPhone/iPad einmal „Einfügen“ bestätigen. Ohne Zugriff auf die Zwischenablage: Antwort im Dialog von Hand einfügen, „Daten übernehmen“.
4. Die App schneidet das Titelbild nach Claudes Angabe auf die Schachtel zu und holt danach automatisch von BoardGameGeek: Spieleranzahl, beste Spielerzahl (Umfrage), Dauer, Alter, Komplexität, Verlag, Jahr und Mechaniken. Hat Claude die BGG-Nummer genannt, wird direkt nachgeschlagen, sonst nach dem Titel gesucht.
5. Fehlen Spielart oder Kompetenzen, leitet die App sie per Regeln ab (`js/components/game-bgg.js`): Kinderspiel nach BGG-Kategorie oder Alter, sonst nach Komplexität (unter 1,9 Familienspiel, unter 2,8 Kennerspiel, sonst Expertenspiel); Kompetenzen aus den Mechaniken (z. B. Kooperativ → Zusammenarbeit, Kommunikation, Frustrationstoleranz). Vorhandene Einordnungen bleiben erhalten.

Auch ohne Foto: „Ohne Foto“ → nur den Titel eintragen → BoardGameGeek ergänzt den Rest.
Fakten von BoardGameGeek überschreiben die Angaben aus der Antwort; nur das Alter der (deutschen) Schachtel hat Vorrang. Texte von BoardGameGeek übernimmt die App nicht. Zwischen zwei Abfragen liegen mindestens 1,5 Sekunden. Nicht gefunden? Oft hilft der englische Originaltitel, dann im Spiel „Erneut abgleichen“.

Offen: Ob BoardGameGeek Abfragen direkt aus dem Browser zulässt (CORS), ließ sich vorab nicht prüfen. Falls nicht, zeigt die App das als Fehler an; dann braucht es später eine Weiterleitung über den Heimserver.

### Optional: vollautomatisch mit der Claude API (kostenpflichtig)

1. Unter „Verbindungen → Claude API“ einen API-Schlüssel der Claude Console eintragen (console.anthropic.com → API Keys, Guthaben nötig).
2. **Spiel fotografieren**. Im Hintergrund, Spiel für Spiel (etwa 1 bis 2 Minuten je Spiel, App geöffnet lassen), erkennt Claude das Spiel, recherchiert per Websuche zuerst auf BoardGameGeek, ordnet ein und nennt den Zuschnitt. Mit BGG-Schlüssel folgt danach noch der Abgleich.
3. Wird die App mittendrin geschlossen, geht es beim nächsten Öffnen weiter. Fehler stehen am Spiel, mit „Erneut versuchen“.

Kosten: Modell `claude-opus-5-5` mit Websuche, grob 5 bis 20 Cent je Spiel (Schätzung).

Passt ein Zuschnitt nicht, im Spiel „Zuschnitt anpassen“ tippen (nutzt das gespeicherte Originalfoto; Finger, zwei Finger oder Regler, Format Quadrat, Hoch oder Quer, drehen).

### Als App auf iPad und iPhone

In Safari die Adresse des Spielekompass öffnen → Teilen → „Zum Home-Bildschirm“. Die App heißt „Spielekompass“, hat ein eigenes Symbol und startet direkt in der Kartei.
Wichtig: Jede Home-Bildschirm-App hat ihren eigenen Speicher. Spiele zwischen Geräten oder aus der früheren Spielothek überträgt „Kartei exportieren / einspielen“.

## Filter

- **Gruppengröße**: Spiele, die diese Personenzahl erlauben. Passt sie zur idealen Gruppengröße, steht das an der Karte.
- **Jüngste Person**: Spiele, deren Altersangabe höchstens so hoch ist.
- **Verfügbare Zeit**: Spiele, deren kürzeste Dauer hineinpasst. Kann es länger dauern, steht das an der Karte.
- **Kompetenzen**: mindestens eine muss zutreffen. Spiele mit mehr Treffern stehen weiter oben („2 von 3 Zielen“).
- **Spielart**: Kinder-, Familien-, Kenner- oder Expertenspiel (mehrere wählbar).
- **Mechanik**: Alle gewählten müssen zutreffen.
- Fehlen einem Spiel Angaben, schließt der Filter es nicht aus.
- **Erweiterungen** (in der Ansicht eines Spiels): Liste der veröffentlichten Erweiterungen aus Claudes Antwort und BoardGameGeek, ankreuzen, was vorhanden ist. Gespeichert als `expansions: [{ key, name, bggId, year, owned, source }]`.
- **Meine Labels**: eigene Markierungen (Favorit, Bald wieder spielen, Zur nächsten Runde mitbringen, Noch nie gespielt, Fliegt aus der Sammlung). Eines der gewählten reicht.
- **Verfügbare Zeit** von 15 Minuten bis 8 Stunden.
- Der Filterbereich lässt sich mit einem Tipp auf die Überschrift ein- und ausklappen; gesetzte Filter wirken weiter.
- **Alle Filter zurücksetzen** (oben und unten im Filterbereich) setzt alles mit einem Tipp zurück; die Zahl in Klammern zeigt, wie viele Filter gerade gesetzt sind.

## Datenflüsse

- Fremde Dienste nur mit eigenem Schlüssel und nur, wenn eingeschaltet.
- Mit Schlüssel gehen das verkleinerte Foto (höchstens 1568 Pixel) bzw. der Titel direkt vom Gerät an `api.anthropic.com`. Die Websuche führt Claude auf den Servern von Anthropic aus.
- Ohne Claude-Schlüssel sendet die App keine Fotos; die Weitergabe an die Claude-App läuft über das Teilen-Menü.
- Mit BoardGameGeek-Schlüssel gehen Titel bzw. BGG-Nummer und der Schlüssel (Bearer-Token) direkt vom Gerät an `boardgamegeek.com/xmlapi2` (`/search`, `/thing?stats=1`), keine Fotos.

## Speicherung

- Angaben zu den Spielen: Datenbereich `games` im Speicherplatz `leeway-spielekompass` (`localStorage`).
- Fotos: Gerätedatenbank des Browsers (IndexedDB, Datenbank `leeway-spielekompass-bilder`). Titelbild unter der ID des Spiels, das Originalfoto (für Zuschnitt und Erkennung) unter `<ID>:original`.
- Schlüssel: `localStorage` unter `leeway-spielekompass-schluessel` (Claude API) und `leeway-spielekompass-bgg` (BoardGameGeek), nie in Sicherungen.
- Stand des Abgleichs je Spiel: `bgg: { status: 'queued' | 'running' | 'done' | 'notfound' | 'error', error, at }`.
- „Kartei exportieren“ (in der Kartei und unter Einstellungen) erzeugt eine Datei mit Angaben und Fotos (`{ app: "leeway-spielekompass", format: 1, games, images }`). Beim Einspielen gewinnt die neuere Fassung eines Spiels.
- Eingespielt werden außerdem Karteien der früheren Spielothek (`app: "leeway-spielothek"`) und Sicherungen des LEEWAY Workspace (`app: "leeway-workspace"`, nur `collections.games`, ohne Fotos).

## Antwortformat (für Claude)

```json
{"spielekompass-antwort": 1, "spiele": [
  {"kennung": "…", "titel": "…", "verlag": "…", "jahr": 2015,
   "spieler_min": 2, "spieler_max": 8, "spieler_ideal": "4-6",
   "dauer_min": 15, "dauer_max": 30, "alter_ab": 10, "komplexitaet": 1.8,
   "bgg_id": 178900, "kategorie": "familie", "mechaniken": ["party"], "kompetenzen": ["kommunikation"],
   "schlagworte": [], "beschreibung": "…", "paedagogik": "…", "sicherheit": "hoch",
   "erklaervideo": "https://www.youtube.com/watch?v=…", "erklaervideo_kanal": "…",
   "erweiterungen": [{"name": "…", "bgg_id": 123456, "jahr": 2018}],
   "quellen": ["https://…"], "zuschnitt": {"x": 0.1, "y": 0.05, "breite": 0.8, "hoehe": 0.9}}
]}
```

- Antworten mit der alten Kennzeichnung `spielothek-antwort` werden ebenfalls verstanden.
- Deutsche Anführungszeichen („…“) im Text sind erlaubt.
- Fehlt die `kennung`, wird im Dialog nach Reihenfolge zugeordnet. „Antwort übernehmen“ außerhalb des Dialogs ordnet nur über die Kennung zu.
- `zuschnitt` gibt den Bereich der Schachtel als Anteile des Fotos an (nur automatisch genutzt). Quellen werden nur als `https://`-Adressen übernommen.
- Mechaniken und Kompetenzen dürfen als Kennung oder Bezeichnung kommen („Kooperativ“). Unbekannte Begriffe werden zu Schlagworten.
- Die Listen der Kennungen stehen in `js/components/game-data.js` (`CATEGORIES`, `MECHANICS`, `COMPETENCES`).
