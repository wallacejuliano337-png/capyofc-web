import { useCallback, useEffect, useRef, useState } from "react";
import { messageOf } from "../lib/supabase";
export function useAsync<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const id = ++sequence.current;
    setLoading(true);
    setError("");
    try {
      const value = await fn();
      if (id === sequence.current) setData(value);
    } catch (e) {
      if (id === sequence.current) setError(messageOf(e));
    } finally {
      if (id === sequence.current) setLoading(false);
    }
  }, [fn]);
  useEffect(() => {
    void reload();
    return () => {
      sequence.current++;
    };
  }, [reload]);
  return { data, setData, error, loading, reload };
}
