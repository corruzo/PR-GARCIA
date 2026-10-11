import { useCallback, useEffect, useState } from 'react';

/**
 * Carga datos remotos con estados explícitos de carga y error.
 * `deps` controla cuándo se vuelve a consultar; `reload()` fuerza la consulta.
 */
export function useRemote(loader, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const [version, setVersion] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(loader, deps);

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    load()
      .then((data) => { if (!cancelled) setState({ data, loading: false, error: '' }); })
      .catch((error) => { if (!cancelled) setState({ data: null, loading: false, error: error.message }); });
    return () => { cancelled = true; };
  }, [load, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
