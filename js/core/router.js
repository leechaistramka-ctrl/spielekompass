/**
 * Sehr einfacher Router auf Basis des „#“-Teils der Adresse, z. B. #/projects/abc.
 * Vorteil: funktioniert offline und auf jedem einfachen Webserver ohne Sonderkonfiguration.
 */
export function parseRoute(hash = location.hash) {
  const path = String(hash || '').replace(/^#\/?/, '');
  const parts = path.split('/').filter(Boolean).map((p) => {
    try { return decodeURIComponent(p); } catch { return p; }
  });
  return { module: parts[0] || 'dashboard', params: parts.slice(1) };
}

export const href = (path) => '#/' + String(path).replace(/^[#/]+/, '');

export function navigate(path) {
  const target = href(path);
  if (location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = target;
}
