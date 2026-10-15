import { useCallback, useEffect, useRef, useState } from 'react';

// Loads data now, and again every "ms" milliseconds while the page is open and visible.
// This is the "polling" used instead of Socket.io.
export default function usePolling(fetcher, ms = 0, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const ref = useRef(fetcher);
  ref.current = fetcher;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setData(await ref.current());
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (!ms) return undefined;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load(true); }, ms);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, load, ...deps]);

  return { data, error, loading, reload: () => load(true) };
}
