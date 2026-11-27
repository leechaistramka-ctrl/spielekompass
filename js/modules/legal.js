/**
 * Module: Impressum und Datenschutzerklärung.
 * Die persönlichen Angaben stehen in js/config.js (LEGAL) – hier nur die Texte.
 * Beide Seiten erscheinen nicht in der Hauptnavigation (hidden), sondern als Links
 * in der Seitenleiste, im „Mehr“-Blatt und in den Einstellungen.
 */
import { LEGAL } from '../config.js';
import { icon } from '../core/icons.js';
import { esc } from '../core/utils.js';
import { pageHeadHTML } from '../core/ui.js';
import { href } from '../core/router.js';

/** true, solange ein Wert noch ein Platzhalter in [eckigen Klammern] ist. */
const isPlaceholder = (v) => /^\s*\[.*\]\s*$/.test(String(v || ''));
const hasPlaceholders = () => Object.values(LEGAL).some(isPlaceholder);

/** Wert sicher ausgeben; Platzhalter werden farbig markiert. */
const v = (value) => (isPlaceholder(value) ? `<mark class="legal-placeholder">${esc(value)}</mark>` : esc(value));

const placeholderNotice = () =>
  hasPlaceholders()
    ? `<section class="panel legal-notice" role="note">
        <h2>${icon('info')}<span>Vorlage – noch nicht ausgefüllt</span></h2>
        <p>Die <mark class="legal-placeholder">markierten Stellen</mark> sind Platzhalter. Sie werden in <code>js/config.js</code> im Abschnitt <code>LEGAL</code> ersetzt.
        Vor einer öffentlichen Nutzung sollten die Texte zusätzlich rechtlich geprüft werden.</p>
      </section>`
    : '';

const crossLink = (id, label) => `<p class="legal-cross"><a class="btn btn-ghost" href="${href(id)}">${icon('arrow')}<span>${esc(label)}</span></a></p>`;

const addressHTML = () => `
  <p>${v(LEGAL.owner)}<br>${esc(LEGAL.business)}<br>${v(LEGAL.street)}<br>${v(LEGAL.city)}${LEGAL.country ? `<br>${esc(LEGAL.country)}` : ''}</p>`;

const contactHTML = () => `
  <p>E-Mail: ${v(LEGAL.email)}${LEGAL.phone ? `<br>Telefon: ${v(LEGAL.phone)}` : ''}</p>`;

export const impressum = {
  id: 'impressum',
  title: 'Impressum',
  icon: 'info',
  group: 'system',
  status: 'ready',
  hidden: true,

  render(root) {
    root.innerHTML = `
      ${pageHeadHTML({ eyebrow: 'Rechtliches', title: 'Impressum' })}
      <div class="legal">
        ${placeholderNotice()}
        <article class="panel legal-text">
          <h2>Angaben gemäß § 5 DDG</h2>
          ${addressHTML()}

          <h3>Kontakt</h3>
          ${contactHTML()}

          ${LEGAL.vatId ? `<h3>Umsatzsteuer-ID</h3><p>Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz:<br>${v(LEGAL.vatId)}</p>` : ''}

          <h3>Verbraucherstreitbeilegung</h3>
          <p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>

          <h3>Haftung für Inhalte und Links</h3>
          <p>Die Inhalte dieser Anwendung wurden mit Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität wird keine Gewähr übernommen.
          Inhalte, die Nutzerinnen und Nutzer selbst in der Anwendung anlegen, werden ausschließlich auf ihrem eigenen Gerät gespeichert; dafür sind sie selbst verantwortlich.</p>
        </article>
        ${crossLink('datenschutz', 'Zur Datenschutzerklärung')}
      </div>`;
  },
};

export const datenschutz = {
  id: 'datenschutz',
  title: 'Datenschutzerklärung',
  navTitle: 'Datenschutz',
  icon: 'shield',
  group: 'system',
  status: 'ready',
  hidden: true,

  render(root) {
    root.innerHTML = `
      ${pageHeadHTML({ eyebrow: 'Rechtliches', title: 'Datenschutzerklärung' })}
      <div class="legal">
        ${placeholderNotice()}
        <article class="panel legal-text">
          <h2>Das Wichtigste in Kürze</h2>
          <ul>
            <li>Alles, was du in dieser Anwendung anlegst (Spiele und ihre Fotos, Einstellungen), wird <strong>nur auf deinem Gerät</strong> gespeichert. Es wird nicht an uns übertragen und nur dann an Dritte, wenn du die optionale Verbindung zu BoardGameGeek selbst einschaltest (siehe Abschnitt 2).</li>
            <li>Es gibt <strong>kein Konto, keine Cookies, kein Tracking, keine Statistik</strong> und keine Werbung.</li>
            <li>Schriften und Bilder werden nicht von fremden Servern geladen.</li>
            <li>Beim Aufruf der Anwendung verarbeitet der Webhoster technisch notwendige Verbindungsdaten (siehe Abschnitt 3).</li>
          </ul>

          <h2>1. Verantwortliche Stelle</h2>
          ${addressHTML()}
          ${contactHTML()}

          <h2>2. Speicherung auf deinem Gerät</h2>
          <p>Die Anwendung speichert deine Inhalte im lokalen Speicher deines Browsers (<em>localStorage</em>). Damit sie auch ohne Internet startet,
          legt sie außerdem die Programmdateien (keine persönlichen Daten) im Zwischenspeicher des Browsers ab (<em>Service Worker</em>).</p>
          <p>Diese Speicherung ist unbedingt erforderlich, damit die von dir ausdrücklich gewünschte Anwendung funktioniert (§ 25 Abs. 2 Nr. 2 TDDDG).
          Wir haben keinen Zugriff auf diese Daten. Du kannst sie jederzeit unter <a href="${href('settings')}">Einstellungen → Alle Daten löschen</a> oder über die Browser-Einstellungen entfernen.</p>
          <p>Kartei-Dateien, die du exportierst, speicherst du selbst an einem Ort deiner Wahl (z. B. iCloud Drive). Für diese Ablage gelten die Bedingungen des jeweiligen Anbieters.</p>

          <p>Fotos für den Spielekompass nimmst du selbst auf oder wählst sie aus. Die Anwendung speichert sie in der Gerätedatenbank deines Browsers
          (<em>IndexedDB</em>), nicht auf einem Server. Achte darauf, dass auf den Fotos keine Personen oder andere persönlichen Angaben zu sehen sind.</p>
          <p><strong>Erkennung über deine Claude-App:</strong> Fotos und Auftrag gibst du selbst über das Teilen-Menü an deine Claude-App weiter; dafür gelten die Bedingungen deines eigenen Claude-Kontos.
          Die Anwendung selbst überträgt dabei nichts. Links zu Quellen (z. B. BoardGameGeek) öffnen sich nur, wenn du sie antippst.</p>
          <p><strong>Abgleich mit BoardGameGeek (nur wenn du ihn einschaltest):</strong> Hinterlegst du unter Einstellungen einen eigenen App-Schlüssel von BoardGameGeek,
          fragt die Anwendung für jedes Spiel mit Titel direkt von deinem Gerät die Schnittstelle von BoardGameGeek (BoardGameGeek, LLC, USA) ab. Übertragen werden
          der Spieltitel bzw. die Nummer des Spiels bei BoardGameGeek, der Schlüssel und technisch bedingt deine IP-Adresse, aber keine Fotos. Es gelten die
          Bedingungen und Datenschutzhinweise von BoardGameGeek; es handelt sich um eine Übermittlung in ein Drittland. Der Schlüssel bleibt im Speicher deines
          Geräts und ist nicht Teil von Sicherungsdateien.</p>

          <h2>3. Hosting</h2>
          <p>Die Anwendung wird bei folgendem Anbieter mit Sitz in der Europäischen Union bereitgestellt:</p>
          <p>${v(LEGAL.hostName)}<br>${v(LEGAL.hostAddress)}<br>Dienst: statichost.eu</p>
          <p>Beim Aufruf überträgt dein Browser technisch bedingt Daten an den Server des Anbieters, insbesondere IP-Adresse, Datum und Uhrzeit,
          die abgerufene Datei, die übertragene Datenmenge sowie Browser und Betriebssystem. Diese Daten sind nötig, um die Anwendung auszuliefern und den Betrieb
          sicher zu halten. Rechtsgrundlage ist unser berechtigtes Interesse an einer sicheren und zuverlässigen Bereitstellung (Art. 6 Abs. 1 lit. f DSGVO).
          Die Daten werden vom Anbieter nur so lange gespeichert, wie es dafür erforderlich ist, und nicht mit anderen Daten zusammengeführt.
          Mit dem Anbieter besteht ein Vertrag über die Auftragsverarbeitung (Art. 28 DSGVO).</p>


          <h2>4. Deine Rechte</h2>
          <p>Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18),
          Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21 DSGVO).
          Wende dich dafür an die oben genannte Kontaktadresse.</p>
          <p>Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO), insbesondere in dem Bundesland bzw. Mitgliedstaat deines Aufenthalts.</p>

          <h2>5. Änderungen</h2>
          <p>Diese Erklärung wird angepasst, wenn sich die Anwendung ändert, zum Beispiel durch eine Synchronisierung zwischen Geräten.</p>
          <p class="muted">Stand: ${v(LEGAL.lastReviewed)}</p>
        </article>
        ${crossLink('impressum', 'Zum Impressum')}
      </div>`;
  },
};

/** Kleine Linkzeile „Impressum · Datenschutz“ für Seitenleiste und „Mehr“-Blatt. */
export const legalLinksHTML = (className = '') => `
  <p class="legal-links ${className}">
    <a href="${href('impressum')}">Impressum</a><span aria-hidden="true">·</span><a href="${href('datenschutz')}">Datenschutz</a>
  </p>`;
