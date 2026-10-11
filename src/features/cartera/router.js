import { useCallback, useEffect, useState } from 'react';

export const VIEWS = ['calculator', 'saved', 'clientes', 'prestamos', 'cobranza', 'reportes'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "#/prestamos/<id>?cliente=<id>" → { view, id, params } (validado). */
export function parseHash(hash) {
  const [path, query = ''] = String(hash || '').replace(/^#\/?/, '').split('?');
  const [view, id] = path.split('/');
  const params = Object.fromEntries(
    [...new URLSearchParams(query)].filter(([, value]) => UUID.test(value)),
  );
  if (!VIEWS.includes(view)) return { view: 'calculator', id: null, params: {} };
  return { view, id: id === 'nuevo' || UUID.test(id || '') ? id : null, params };
}

export function buildHash(view, id = null, params = {}) {
  const query = new URLSearchParams(params).toString();
  return `#/${view}${id ? `/${id}` : ''}${query ? `?${query}` : ''}`;
}

/** Navegación por hash: conserva atrás/adelante del navegador sin dependencias. */
export function useHashRoute() {
  const [route, setRoute] = useState(() => parseHash(typeof window === 'undefined' ? '' : window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((view, id = null, params = {}) => {
    const next = buildHash(view, id, params);
    if (window.location.hash !== next) window.location.hash = next;
    else setRoute(parseHash(next));
    window.scrollTo?.({ top: 0 });
  }, []);

  return [route, navigate];
}
