# Spielekompass

Der Spielekompass ist eine Kartei der eigenen Gesellschaftsspiele für die pädagogische Arbeit: mit Titelbild, Eckdaten, Einordnung und Filtern, die zu einer konkreten Gruppe passende Spiele finden.

## Ablauf

### Standard: kostenlos über die Claude-App und BoardGameGeek

Ohne Kosten je Spiel. Nur das Teilen an die Claude-App bleibt ein Handgriff (läuft über das eigene Claude-Abo).

1. Optional, einmalig unter „Einstellungen → BoardGameGeek“ einen App-Schlüssel eintragen. Er kostet nichts: mit dem eigenen BoardGameGeek-Konto unter boardgamegeek.com/applications eine nicht kommerzielle Anwendung anlegen und dort einen Token erzeugen. Das Passwort braucht die App nicht. Der Schlüssel bleibt nur auf diesem Gerät und steht in keiner Sicherung.
2. **Spiel fotografieren**, gern mehrere auf einmal. Die App speichert das Foto und schneidet vorläufig mittig zu; ein Zuschnitt von Hand ist nicht nötig.
3. Der Dialog „Mit Claude erkennen“ öffnet sich. „An Claude teilen“ gibt Fotos und Auftrag an die Claude-App (bis zu 10 Spiele auf einmal). Claude antwortet mit einem JSON-Block. In der Claude-App bei der Antwort auf „Kopieren“ tippen, zurück in den Spielekompass und „Antwort übernehmen“ tippen (steht im Hinweis „noch nicht erkannt“ und im Dialog). Auf iPhone/iPad einmal „Einfügen“ bestätigen. Ohne Zugriff auf die Zwischenablage: Antwort im Dialog von Hand einfügen, „Daten übernehmen“.
4. Die App schneidet das Titelbild nach Claudes Angabe auf die Schachtel zu. Ist BoardGameGeek verbunden, holt sie danach automatisch: Spieleranzahl, beste Spielerzahl (Umfrage), Dauer, Alter, Komplexität, Verlag, Jahr und Mechaniken. Hat Claude die BGG-Nummer genannt, wird direkt nachgeschlagen, sonst nach dem Titel gesucht.
5. Fehlen Spielart oder Kompetenzen, leitet die App sie per Regeln ab (`js/components/game-bgg.js`): Kinderspiel nach BGG-Kategorie oder Alter, sonst nach Komplexität (unter 1,9 Familienspiel, unter 2,8 Kennerspiel, sonst Expertenspiel); Kompetenzen aus den Mechaniken (z. B. Kooperativ → Zusammenarbeit, Kommunikation, Frustrationstoleranz). Vorhandene Einordnungen bleiben erhalten.

Auch ohne Foto: „Ohne Foto“ → nur den Titel eintragen → BoardGameGeek ergänzt den Rest.
Fakten von BoardGameGeek überschreiben die Angaben aus der Antwort; nur das Alter der (deutschen) Schachtel hat Vorrang. Texte von BoardGameGeek übernimmt die App nicht. Zwischen zwei Abfragen liegen mindestens 1,5 Sekunden. Nicht gefunden? Oft hilft der englische Originaltitel, dann im Spiel „Erneut abgleichen“.

Offen: Ob BoardGameGeek Abfragen direkt aus dem Browser zulässt (CORS), ließ sich vorab nicht prüfen. Falls nicht, zeigt die App das als Fehler an; dann braucht es später eine Weiterleitung über den Heimserver.

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

## Datenflüsse

- Fremde Dienste nur mit eigenem Schlüssel und nur, wenn eingeschaltet.
- Die App sendet keine Fotos; die Weitergabe an die Claude-App läuft über das Teilen-Menü.
- Mit BoardGameGeek-Schlüssel gehen Titel bzw. BGG-Nummer und der Schlüssel (Bearer-Token) direkt vom Gerät an `boardgamegeek.com/xmlapi2` (`/search`, `/thing?stats=1`), keine Fotos.

## Speicherung

- Angaben zu den Spielen: Datenbereich `games` im Speicherplatz `leeway-spielekompass` (`localStorage`).
- Fotos: Gerätedatenbank des Browsers (IndexedDB, Datenbank `leeway-spielekompass-bilder`). Titelbild unter der ID des Spiels, das Originalfoto (für Zuschnitt und Erkennung) unter `<ID>:original`.
- Schlüssel: `localStorage` unter `leeway-spielekompass-bgg` (BoardGameGeek), nie in Sicherungen.
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
   "quellen": ["https://…"], "zuschnitt": {"x": 0.1, "y": 0.05, "breite": 0.8, "hoehe": 0.9}}
]}
```

- Antworten mit der alten Kennzeichnung `spielothek-antwort` werden ebenfalls verstanden.
- Deutsche Anführungszeichen („…“) im Text sind erlaubt.
- Fehlt die `kennung`, wird im Dialog nach Reihenfolge zugeordnet. „Antwort übernehmen“ außerhalb des Dialogs ordnet nur über die Kennung zu.
- `zuschnitt` gibt den Bereich der Schachtel als Anteile des Fotos an (nur automatisch genutzt). Quellen werden nur als `https://`-Adressen übernommen.
- Mechaniken und Kompetenzen dürfen als Kennung oder Bezeichnung kommen („Kooperativ“). Unbekannte Begriffe werden zu Schlagworten.
- Die Listen der Kennungen stehen in `js/components/game-data.js` (`CATEGORIES`, `MECHANICS`, `COMPETENCES`).
