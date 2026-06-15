import { useEffect, useMemo, useState } from "react";
import { useSettings, type Theme } from "@/lib/settings";

const THEME_GLYPHS: Partial<Record<Theme, string[]>> = {
  winter: ["❄"],
  spring: ["🌸", "🌷", "🌿"],
  summer: ["☀️", "🌴", "🐚"],
  autumn: ["🍂", "🍁", "🌰"],
  halloween: ["🎃", "👻", "🦇"],
  valentines: ["💖", "💘", "🌹"],
  stpatricks: ["☘️", "🍀", "💚"],
  fourth: ["🎆", "⭐", "🇺🇸"],
  neon: ["✦", "✧", "◆"],
  midnight: ["✦", "·", "✧"],
};

export function Snowfall() {
  const [settings] = useSettings();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const intensity = Math.max(0, Math.min(2, settings.effectIntensity ?? 1));
  const base  = settings.lowPerf ? 15 : 60;
  const count = Math.round(base * intensity);
  const glyphs = THEME_GLYPHS[settings.theme];
  const enabled = !!glyphs && settings.theme !== "none" && !settings.reduceMotion && count > 0;

  const flakes = useMemo(() => {
    const g = glyphs ?? ["❄"];
    return Array.from({ length: count }).map((_, i) => ({
      i, size: Math.random() * 12 + 6, left: Math.random() * 100,
      duration: Math.random() * 10 + 8, delay: -Math.random() * 20,
      drift: `${(Math.random() - 0.5) * 200}px`, opacity: Math.random() * 0.6 + 0.4,
      glyph: g[i % g.length],
    }));
  }, [count, glyphs]);

  if (!mounted || !enabled) return null;

  return (
    <div className="snow-layer" aria-hidden>
      {flakes.map((f) => (
        <span key={f.i} className="snowflake" style={{ left: `${f.left}%`, fontSize: `${f.size}px`, animationDuration: `${f.duration}s`, animationDelay: `${f.delay}s`, opacity: f.opacity, ["--drift" as never]: f.drift }}>
          {f.glyph}
        </span>
      ))}
    </div>
  );
}
