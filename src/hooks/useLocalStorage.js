import { useEffect, useState } from "react";

export default function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const stored = window.localStorage.getItem(key);
      if (!stored) return initialValue;

      const parsed = JSON.parse(stored);
      
      // Check if data has timestamp and is older than 24 hours
      if (parsed.timestamp) {
        const now = Date.now();
        const ageInMs = now - parsed.timestamp;
        const HOURS_24_IN_MS = 24 * 60 * 60 * 1000;
        
        if (ageInMs > HOURS_24_IN_MS) {
          // Data expired, clear it
          window.localStorage.removeItem(key);
          return initialValue;
        }
        
        // Return the actual data (without timestamp wrapper)
        return parsed.data;
      }
      
      return parsed;
    } catch (err) {
      console.error("useLocalStorage parse error", err);
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      // Wrap data with timestamp for 24-hour expiration
      const dataToStore = {
        timestamp: Date.now(),
        data: value
      };
      window.localStorage.setItem(key, JSON.stringify(dataToStore));
    } catch (err) {
      console.error("useLocalStorage write error", err);
    }
  }, [key, value]);

  return [value, setValue];
}
