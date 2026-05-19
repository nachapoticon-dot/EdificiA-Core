"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applyTheme,
  DEFAULT_THEME,
  persistTheme,
  readStoredTheme,
  type Theme,
} from "@/lib/theme";

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    setThemeState(readStoredTheme());
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    persistTheme(next);
  }, []);

  return { theme, setTheme };
}
