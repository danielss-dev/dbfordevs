import { useUIStore } from "@/stores/ui";

/**
 * Per-connection environment accent.
 *
 * When the active connection belongs to a group with a color (e.g. the
 * Production preset's red), the app's primary accent is re-tinted to that
 * color via inline CSS variable overrides, so the environment you are
 * connected to is visible in every accent-colored surface: active tab
 * underline, buttons, focus rings, selection states.
 */

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;

  const r = parseInt(match[1].slice(0, 2), 16) / 255;
  const g = parseInt(match[1].slice(2, 4), 16) / 255;
  const b = parseInt(match[1].slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: Math.round(l * 100) };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  if (max === r) {
    h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  } else if (max === g) {
    h = ((b - r) / d + 2) / 6;
  } else {
    h = ((r - g) / d + 4) / 6;
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

const ACCENT_VARS = ["--primary", "--primary-foreground", "--ring"] as const;

/**
 * Apply (or clear, when `hexColor` is null) the environment accent override.
 */
export function applyConnectionAccent(hexColor: string | null): void {
  const root = document.documentElement;

  if (!hexColor) {
    const hadOverride = ACCENT_VARS.some((v) => root.style.getPropertyValue(v));
    ACCENT_VARS.forEach((v) => root.style.removeProperty(v));
    // Custom themes also set their colors as inline variables; removing ours
    // strips theirs too, so re-apply the theme to restore them.
    if (hadOverride) {
      const { theme, setTheme } = useUIStore.getState();
      if (theme.startsWith("custom:")) {
        setTheme(theme);
      }
    }
    return;
  }

  const hsl = hexToHsl(hexColor);
  if (!hsl) return;

  const triplet = `${hsl.h} ${hsl.s}% ${hsl.l}%`;
  // Pick a readable foreground for fills using the accent's lightness
  const foreground = hsl.l > 60 ? "20 10% 10%" : "0 0% 100%";

  root.style.setProperty("--primary", triplet);
  root.style.setProperty("--ring", triplet);
  root.style.setProperty("--primary-foreground", foreground);
}
