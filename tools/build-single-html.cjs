#!/usr/bin/env node
/**
 * Baut die gesamte App zu EINER eigenständigen HTML-Datei zusammen
 * (Programmcode, Gestaltung, Schriften und Bilder eingebettet).
 *
 * Die Datei lässt sich per Doppelklick im Browser öffnen – ohne Server, ohne Internet.
 * Aufruf:  node tools/build-single-html.cjs   →  dist/Spielekompass.html
 *
 * Hinweis: Im Einzeldatei-Modus gibt es keinen Service Worker und keine Installation
 * als App; die Daten werden trotzdem dauerhaft im Browser gespeichert.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist');
const MIME = { '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function dataUri(rel) {
  const file = path.join(ROOT, rel);
  const mime = MIME[path.extname(file).toLowerCase()];
  if (!mime || !fs.existsSync(file)) throw new Error(`Datei nicht gefunden: ${rel}`);
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

/** Ersetzt alle Verweise auf assets/… durch eingebettete Daten. */
function inlineAssets(text) {
  return text.replace(/(?:\.\.\/)?(assets\/[\w\/.\-]+\.(?:svg|jpe?g|png|woff2))/g, (_, rel) => dataUri(rel));
}

// ---------------------------------------------------------------- JavaScript bündeln
const modules = new Map(); // Pfad → umgewandelter Code
const order = [];

function resolve(from, spec) {
  return path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
}

function transform(file) {
  let code = read(file);
  const deps = [];
  // import { a, b as c } from './x.js';   (auch mehrzeilig)
  code = code.replace(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?/g, (_, names, spec) => {
    const dep = resolve(file, spec);
    deps.push(dep);
    const list = names.split(',').map((n) => n.trim()).filter(Boolean).map((n) => n.replace(/\s+as\s+/, ': '));
    return `const { ${list.join(', ')} } = __m[${JSON.stringify(dep)}];`;
  });
  // import x from './y.js';
  code = code.replace(/import\s+([\w$]+)\s+from\s*['"]([^'"]+)['"];?/g, (_, name, spec) => {
    const dep = resolve(file, spec);
    deps.push(dep);
    return `const ${name} = __m[${JSON.stringify(dep)}].default;`;
  });
  if (/\bimport\s*\(|\bimport\s+['"]/.test(code)) throw new Error(`Nicht unterstützter Import in ${file}`);

  const exported = [];
  code = code.replace(/export\s+default\s+/g, 'const __default = ');
  code = code.replace(/export\s+(async\s+function|function|class|const|let)\s+([\w$]+)/g, (_, kw, name) => {
    exported.push(name);
    return `${kw} ${name}`;
  });
  if (/^\s*export\s/m.test(code)) throw new Error(`Nicht unterstützter Export in ${file}`);
  const hasDefault = code.includes('const __default = ');
  const ret = [...exported, ...(hasDefault ? ['default: __default'] : [])].join(', ');
  return { deps, body: `__m[${JSON.stringify(file)}] = (() => {\n${code}\nreturn { ${ret} };\n})();` };
}

function visit(file, stack = []) {
  if (modules.has(file)) return;
  if (stack.includes(file)) throw new Error(`Zirkulärer Import: ${[...stack, file].join(' → ')}`);
  const { deps, body } = transform(file);
  for (const d of deps) visit(d, [...stack, file]);
  modules.set(file, body);
  order.push(file);
}

visit('js/app.js');
const bundle = `(() => {\n'use strict';\nconst __m = {};\n${order.map((f) => `// ---- ${f}\n${modules.get(f)}`).join('\n\n')}\n})();`;

// ---------------------------------------------------------------- HTML zusammensetzen
let html = read('index.html');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => `<style>\n${read(href)}\n</style>`);
html = html.replace(/\s*<link rel="manifest"[^>]*>/, '');
html = html.replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '');
html = html.replace(/<script type="module" src="js\/app.js"><\/script>/, () => `<script>\n${bundle.replace(/<\/script/gi, '<\\/script')}\n</script>`);
html = inlineAssets(html);
html = html.replace('<title>Spielekompass · LEEWAY Studio</title>', '<title>Spielekompass · LEEWAY Studio</title>\n  <meta name="generator" content="Spielekompass – Einzeldatei">');

fs.mkdirSync(OUT_DIR, { recursive: true });
const out = path.join(OUT_DIR, 'Spielekompass.html');
fs.writeFileSync(out, html);
console.log(`Erstellt: ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB, ${order.length} Module)`);
