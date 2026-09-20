import { useEffect, useState } from 'react';

type State<T> = { data: T | undefined; error: Error | undefined; loading: boolean };

export function useFetch<T>(fetcher: (signal: AbortSignal) => Promise<T>, deps: readonly unknown[]) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<State<T>>({ data: undefined, error: undefined, loading: true });

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setState((prev) => ({ ...prev, loading: true }));
    fetcher(controller.signal)
      .then((data) => {
        if (alive) setState({ data, error: undefined, loading: false });
      })
      .catch((err: unknown) => {
        if (alive && !controller.signal.aborted) {
          setState({ data: undefined, error: err instanceof Error ? err : new Error(String(err)), loading: false });
        }
      });
    return () => {
      alive = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  return {
    data: state.data,
    error: state.error,
    loading: state.loading,
    refresh: () => setVersion((v) => v + 1),
  };
}