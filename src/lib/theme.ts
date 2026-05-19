export const THEMES = ["editorial", "plano", "oscuro"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "editorial";
export const STORAGE_KEY = "edificia-theme";

const DARK_THEMES: ReadonlySet<Theme> = new Set(["plano", "oscuro"]);

export const THEME_LABELS: Record<Theme, string> = {
  editorial: "Editorial",
  plano: "Plano operativo",
  oscuro: "Oscuro operativo",
};

export const THEME_DESCRIPTIONS: Record<Theme, string> = {
  editorial: "Paper warm + acento terracota",
  plano: "Blueprint navy + cyan",
  oscuro: "Graphite + cobre apagado",
};

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.classList.toggle("dark", DARK_THEMES.has(theme));
}

export function readStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(raw) ? raw : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function persistTheme(theme: Theme): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage no disponible
  }
}
