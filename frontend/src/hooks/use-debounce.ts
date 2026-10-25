"use client";

import { useState, useEffect } from "react";

/**
 * Custom hook to debounce any fast-changing value.
 * Commonly used for search inputs to prevent excessive filtering or API requests.
 *
 * @param value The value to debounce
 * @param delay Milliseconds to wait before updating debounced value (default: 300ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // If empty string or nullish, update immediately for responsive clearing
    if (value === "" || value === null || value === undefined) {
      setDebouncedValue(value);
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
