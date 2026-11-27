# Änderungsprotokoll

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
