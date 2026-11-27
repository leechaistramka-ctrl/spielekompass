# Lizenzen und verwendete Komponenten

## In der App enthalten (wird an Nutzer ausgeliefert)

Die App enthält **keine fremden Programmbibliotheken oder Icon-Sammlungen**. Eingebettet sind nur zwei freie Schriften (siehe unten).

- **Programmcode, Gestaltung, Icons**: eigens für LEEWAY Studio erstellt. Die Icons in `js/core/icons.js` sind selbst gezeichnete SVG-Pfade.
- **Markenmaterialien** (Logos, Keyvisual, Panorama in `assets/brand/`, App-Icons): aus dem LEEWAY Studio Markenpaket 1.0, Eigentum von LEEWAY Studio. Laut Leitfaden ist das Bergmotiv KI-generiert; Markenverfügbarkeit und Rechte vor kommerzieller Nutzung prüfen.
- **Schriften**: Lato (Łukasz Dziedzic) und Noto Serif (The Noto Project Authors), beide SIL Open Font License 1.1 – frei nutzbar, auch kommerziell und eingebettet in Apps. Lizenztexte in `assets/fonts/`.

## Nur für Entwicklung und Tests (nicht Teil der App)

- **Playwright** (Microsoft), Apache License 2.0: automatisierte Browsertests und Icon-Erzeugung
- **Node.js**, MIT License: Ausführung der Hilfsskripte

## Lizenz dieses Projekts

In `package.json` steht derzeit `UNLICENSED`, das heißt: alle Rechte vorbehalten, keine Nutzung durch Dritte erlaubt. Das ist für ein privates Studio-Werkzeug der sichere Ausgangspunkt. Falls du den Code später veröffentlichen möchtest, kommen z. B. MIT (sehr frei) oder AGPL-3.0 (Änderungen müssen offen bleiben) infrage.

## Externe Dienste

Keine. Die App lädt nichts von fremden Servern, setzt keine Cookies, nutzt kein Tracking und keine KI-API. Sie verarbeitet nur die Daten, die du selbst eingibst. Gespeichert wird ausschließlich lokal auf deinem Gerät.
