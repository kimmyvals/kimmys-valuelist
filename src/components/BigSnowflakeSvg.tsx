/**
 * Crisp six-pointed snowflake with inner detail rings.
 * Much sharper than the previous version — proper geometric snowflake.
 */
export function BigSnowflakeSvg({ className }: { className?: string }) {
  const arms = Array.from({ length: 6 });
  return (
    <svg
      viewBox="0 0 200 200"
      className={className ?? "relative h-44 w-44 transition-transform group-hover:scale-105 group-active:scale-95"}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="sf-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e0f2fe" stopOpacity="1" />
          <stop offset="50%" stopColor="#7dd3fc" stopOpacity="1" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.8" />
        </linearGradient>
        <filter id="sf-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <g stroke="url(#sf-grad)" fill="none" strokeLinecap="round" strokeLinejoin="round" filter="url(#sf-glow)">
        {/* Main six arms */}
        {arms.map((_, i) => {
          const angle = (i * 60 * Math.PI) / 180;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          // Main arm endpoint
          const x2 = 100 + cos * 82;
          const y2 = 100 + sin * 82;
          // Large fork positions (60% out)
          const fx1x = 100 + cos * 55;
          const fx1y = 100 + sin * 55;
          const la = angle + Math.PI / 4;
          const lb = angle - Math.PI / 4;
          const f1ax = fx1x + Math.cos(la) * 18;
          const f1ay = fx1y + Math.sin(la) * 18;
          const f1bx = fx1x + Math.cos(lb) * 18;
          const f1by = fx1y + Math.sin(lb) * 18;
          // Small fork positions (35% out)
          const fx2x = 100 + cos * 35;
          const fx2y = 100 + sin * 35;
          const f2ax = fx2x + Math.cos(la) * 11;
          const f2ay = fx2y + Math.sin(la) * 11;
          const f2bx = fx2x + Math.cos(lb) * 11;
          const f2by = fx2y + Math.sin(lb) * 11;

          return (
            <g key={i}>
              {/* Main arm */}
              <line x1="100" y1="100" x2={x2} y2={y2} strokeWidth="5" />
              {/* Outer fork */}
              <line x1={fx1x} y1={fx1y} x2={f1ax} y2={f1ay} strokeWidth="3.5" />
              <line x1={fx1x} y1={fx1y} x2={f1bx} y2={f1by} strokeWidth="3.5" />
              {/* Inner fork */}
              <line x1={fx2x} y1={fx2y} x2={f2ax} y2={f2ay} strokeWidth="2.5" />
              <line x1={fx2x} y1={fx2y} x2={f2bx} y2={f2by} strokeWidth="2.5" />
            </g>
          );
        })}
        {/* Hexagonal inner ring */}
        {arms.map((_, i) => {
          const a1 = (i * 60 * Math.PI) / 180;
          const a2 = ((i + 1) * 60 * Math.PI) / 180;
          const r = 22;
          return (
            <line
              key={`hex-${i}`}
              x1={100 + Math.cos(a1) * r}
              y1={100 + Math.sin(a1) * r}
              x2={100 + Math.cos(a2) * r}
              y2={100 + Math.sin(a2) * r}
              strokeWidth="2"
              strokeOpacity="0.6"
            />
          );
        })}
      </g>
      {/* Centre dot */}
      <circle cx="100" cy="100" r="7" fill="url(#sf-grad)" />
      {/* Tip dots */}
      {arms.map((_, i) => {
        const angle = (i * 60 * Math.PI) / 180;
        return (
          <circle
            key={`tip-${i}`}
            cx={100 + Math.cos(angle) * 82}
            cy={100 + Math.sin(angle) * 82}
            r="4"
            fill="url(#sf-grad)"
            opacity="0.9"
          />
        );
      })}
    </svg>
  );
}
