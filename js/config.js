/**
 * Zentrale Konfiguration des Spielekompass (ein Produkt von LEEWAY Studio).
 * Hier stehen Werte, die man ändern möchte, ohne Programmcode anzufassen.
 */
export const APP = {
  name: 'Spielekompass',
  studio: 'LEEWAY Studio',
  version: '1.3.0',
  // Version des Datenformats. Wird erhöht, wenn sich die Struktur der Daten ändert.
  schemaVersion: 1,
  // Name des Speicherplatzes im Browser. Nicht ändern – sonst „verschwinden“ vorhandene Daten.
  storageKey: 'leeway-spielekompass',
  brand: {
    // Dateien aus dem LEEWAY-Markenpaket 1.0 (assets/brand/)
    signetDark: 'assets/brand/signet-hellgold.svg',   // Signet für dunkle Flächen
    signetLight: 'assets/brand/signet-waldgruen.svg', // Signet für helle Flächen
    logoAlt: 'LEEWAY Studio',
    tagline: 'Raum für Möglichkeiten',
  },
  // Nach wie vielen Tagen ohne Sicherung die Kartei daran erinnert.
  backupReminderDays: 14,
};

/**
 * Angaben für Impressum und Datenschutzerklärung.
 * Alles in [eckigen Klammern] ist ein Platzhalter und muss vor der öffentlichen Nutzung ersetzt werden.
 * Solange noch Platzhalter enthalten sind, zeigen beide Seiten einen deutlichen Hinweis.
 * Optionale Felder: leer lassen ('') – dann erscheint die Zeile nicht.
 */
export const LEGAL = {
  // Wer ist verantwortlich? (Vor- und Nachname der Inhaberin bzw. des Inhabers)
  owner: '[Vor- und Nachname]',
  business: 'LEEWAY Studio',
  // Ladungsfähige Anschrift – ein Postfach reicht nicht.
  street: '[Straße und Hausnummer]',
  city: '[Postleitzahl und Ort]',
  country: 'Deutschland',
  email: '[E-Mail-Adresse]',
  // Telefon oder ein anderer schneller Kontaktweg (optional, aber empfohlen)
  phone: '',
  // Umsatzsteuer-Identifikationsnummer, falls vorhanden (optional)
  vatId: '',
  // Anbieter des Webhostings (steht im Impressum bzw. Vertrag von statichost.eu)
  hostName: '[Firmenname des Anbieters von statichost.eu]',
  hostAddress: '[Anschrift des Anbieters]',
  // Datum, an dem die Texte zuletzt geprüft wurden
  lastReviewed: '[TT.MM.JJJJ]',
};
