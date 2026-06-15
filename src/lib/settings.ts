import { useEffect, useState } from "react";

export type Theme =
  | "winter" | "spring" | "summer" | "autumn" | "halloween"
  | "valentines" | "stpatricks" | "fourth" | "neon" | "midnight" | "none";

export type AppSettings = {
  showImages: boolean;
  showEffects: boolean;
  lowPerf: boolean;
  theme: Theme;
  compact: boolean;
  hideValues: boolean;
  reduceMotion: boolean;
  effectIntensity: number;
};

const KEY = "kimmy-valuelist-settings";
const DEFAULTS: AppSettings = {
  showImages: true, showEffects: true, lowPerf: false, theme: "winter",
  compact: false, hideValues: false, reduceMotion: false, effectIntensity: 1,
};

const VALID_THEMES = new Set<Theme>([
  "winter","spring","summer","autumn","halloween",
  "valentines","stpatricks","fourth","neon","midnight","none",
]);

function read(): AppSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    if (parsed.showSnow != null && parsed.showEffects == null) parsed.showEffects = parsed.showSnow;
    if (parsed.theme && !VALID_THEMES.has(parsed.theme as Theme)) parsed.theme = DEFAULTS.theme;
    if (parsed.effectIntensity === 0) parsed.showEffects = false;
    return { ...DEFAULTS, ...parsed };
  } catch { return DEFAULTS; }
}

const listeners = new Set<() => void>();

export function useSettings(): [AppSettings, (next: Partial<AppSettings>) => void] {
  const [state, setState] = useState<AppSettings>(DEFAULTS);

  useEffect(() => {
    setState(read());
    const cb = () => setState(read());
    listeners.add(cb);
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setState(read()); };
    window.addEventListener("storage", onStorage);
    return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = state.theme;
      document.documentElement.dataset.lowPerf = state.lowPerf ? "1" : "0";
      document.documentElement.dataset.reduceMotion = state.reduceMotion ? "1" : "0";
    }
  }, [state.theme, state.lowPerf, state.reduceMotion]);

  const update = (next: Partial<AppSettings>) => {
    const current = read();
    let merged = { ...current, ...next };
    if ("effectIntensity" in next) {
      if (next.effectIntensity === 0) merged.showEffects = false;
      if ((next.effectIntensity ?? 0) > 0 && !current.showEffects) merged.showEffects = true;
    }
    if ("showEffects" in next) {
      if (!next.showEffects) merged.effectIntensity = 0;
      if (next.showEffects && merged.effectIntensity === 0) merged.effectIntensity = 1;
    }
    localStorage.setItem(KEY, JSON.stringify(merged));
    listeners.forEach((l) => l());
  };

  return [state, update];
}
