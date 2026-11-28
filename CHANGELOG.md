# Änderungsprotokoll

## 1.2.0 – 28.11.2026
- **Erweiterungen je Spiel**: Die veröffentlichten Erweiterungen kommen automatisch, ohne sie einzeln zu scannen
  - Aus Claudes Antwort (deutsche Namen, ohne Zusatzkosten über die Claude-App) und mit BoardGameGeek-Schlüssel aus BoardGameGeek. Doppelte werden über die BGG-Nummer zusammengelegt, Fan-Erweiterungen weggelassen
  - In der Ansicht eines Spiels antippen, was du besitzt („2 von 7 vorhanden“); vorhandene stehen oben, lange Listen sind gekürzt
  - Fehlende von Hand ergänzen (und wieder entfernen); „Liste von BoardGameGeek aktualisieren“ behält deine Häkchen
  - An der Karte steht „+ 2 Erweiterungen“; die Suche findet Spiele auch über vorhandene Erweiterungen

## 1.1.0 – 27.11.2026
- **Filterbereich ein- und ausklappbar**: Tipp auf „Passende Spiele finden“. Das Gerät merkt sich den Zustand. Gesetzte Filter wirken weiter, „Alle Filter zurücksetzen“ bleibt sichtbar
- **Eigene Labels** je Spiel: Favorit, Bald wieder spielen, Zur nächsten Runde mitbringen, Noch nie gespielt, Fliegt aus der Sammlung. Mit einem Tipp in der Detailansicht setzen, an der Karte sichtbar, unter „Meine Labels“ filterbar (eines der gewählten reicht)
- **Spielzeit bis 8 Stunden**: neue Stufen bis 3, 4, 6 und 8 Std.; lange Spiele zeigen die Dauer in Stunden (z. B. „4–8 Std.“)
- **Deutsches Erklärvideo** je Spiel: Claude schlägt bei der Erkennung ein Video vor (ohne Zusatzkosten über die Claude-App), dazu immer „Deutsches Erklärvideo auf YouTube suchen“. Eigene Adresse unter „Bearbeiten“. YouTube öffnet sich erst beim Antippen

## 1.0.1 – 27.11.2026
- Knopf **„Alle Filter zurücksetzen“** oben und unten im Bereich „Passende Spiele finden“: setzt Gruppengröße, Alter, Zeit, Kompetenzen, Spielart, Mechaniken und Suche mit einem Tipp zurück und zeigt wieder alle Spiele. Er zeigt, wie viele Filter gerade gesetzt sind, und ist ohne Filter ausgegraut
- Passt kein Spiel, steht der Knopf auch direkt im Hinweis „Kein Spiel passt“

## 1.0.0 – 27.11.2026
- **Spielekompass als eigenständiges Produkt** von LEEWAY Studio, hervorgegangen aus der Spielothek im LEEWAY Workspace (Stand 0.10.3)
  - Eigene App mit eigenem Namen, Symbol, Speicher und Adresse; startet direkt in der Kartei
  - Navigation nur noch: Spiele, Einstellungen (dazu Impressum und Datenschutz)
  - Einstellungen: Darstellung, Kartei sichern & übertragen (mit „Letzte Sicherung“), Speicher & Installation, alle Daten löschen
  - Erinnerung in der Kartei, wenn die letzte Sicherung älter als 14 Tage ist
  - **Umzug:** Kartei der früheren Spielothek (mit Fotos) und Sicherungen des LEEWAY Workspace (nur Spiele) lassen sich einspielen, auch direkt aus der leeren Kartei. Alte Claude-Antworten (`spielothek-antwort`) werden weiter verstanden
  - Neue Kennzeichnung der Claude-Antworten: `spielekompass-antwort`
  - Datenschutzerklärung auf den Spielekompass zugeschnitten (ohne Kalender, Spracheingabe, Ideenwerkstatt)
  - Untere Leiste auf dem iPhone verteilt sich auf die vorhandenen Bereiche
- Übernommen aus der Spielothek: Fotos, Erkennung über die Claude-App mit „Antwort übernehmen“ aus der Zwischenablage, automatischer Zuschnitt, Abgleich mit BoardGameGeek, Einordnung per Regeln, optionale Claude API, Filter, Detailansicht, Bearbeiten, Kartei-Export
- Tests auf den Spielekompass zugeschnitten (34 Tests)
