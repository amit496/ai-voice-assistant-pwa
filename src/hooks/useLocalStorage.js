import { useEffect, useState } from "react";

export default function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    } catch (err) {
      console.error("useLocalStorage parse error", err);
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error("useLocalStorage write error", err);
    }
  }, [key, value]);

  return [value, setValue];
}
