/**
 * Realistic six-pointed snowflake with dendritic branches.
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
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <g stroke="url(#sf-grad)" fill="none" strokeLinecap="round" strokeLinejoin="round" filter="url(#sf-glow)">
        {arms.map((_, i) => {
          const angleDeg = i * 60;
          const angle = (angleDeg * Math.PI) / 180;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);

          // Main arm tip
          const tipX = 100 + cos * 80;
          const tipY = 100 + sin * 80;

          // Branch positions along the arm
          const branchDefs = [
            { dist: 28, len: 16, angleDelta: Math.PI / 3 },
            { dist: 45, len: 22, angleDelta: Math.PI / 3 },
            { dist: 62, len: 14, angleDelta: Math.PI / 4 },
          ];

          const branches = branchDefs.flatMap(({ dist, len, angleDelta }) => {
            const bx = 100 + cos * dist;
            const by = 100 + sin * dist;
            return [1, -1].map((dir) => {
              const ba = angle + dir * angleDelta;
              return {
                x1: bx, y1: by,
                x2: bx + Math.cos(ba) * len,
                y2: by + Math.sin(ba) * len,
              };
            });
          });

          // Tip fork
          const forkAngle1 = angle + Math.PI / 5;
          const forkAngle2 = angle - Math.PI / 5;
          const forkLen = 10;

          return (
            <g key={i}>
              {/* Main arm */}
              <line x1="100" y1="100" x2={tipX} y2={tipY} strokeWidth="4" />
              {/* Tip forks */}
              <line x1={tipX} y1={tipY} x2={tipX - Math.cos(forkAngle1) * forkLen} y2={tipY - Math.sin(forkAngle1) * forkLen} strokeWidth="2" />
              <line x1={tipX} y1={tipY} x2={tipX - Math.cos(forkAngle2) * forkLen} y2={tipY - Math.sin(forkAngle2) * forkLen} strokeWidth="2" />
              {/* Side branches */}
              {branches.map((b, j) => (
                <line key={j} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} strokeWidth={j < 4 ? 2.5 : 2} />
              ))}
            </g>
          );
        })}

        {/* Inner hexagon ring */}
        {arms.map((_, i) => {
          const a1 = (i * 60 * Math.PI) / 180;
          const a2 = ((i + 1) * 60 * Math.PI) / 180;
          const r = 18;
          return (
            <line
              key={`hex-${i}`}
              x1={100 + Math.cos(a1) * r}
              y1={100 + Math.sin(a1) * r}
              x2={100 + Math.cos(a2) * r}
              y2={100 + Math.sin(a2) * r}
              strokeWidth="2"
              strokeOpacity="0.7"
            />
          );
        })}
      </g>

      {/* Centre dot */}
      <circle cx="100" cy="100" r="6" fill="url(#sf-grad)" />

      {/* Tip dots */}
      {arms.map((_, i) => {
        const angle = (i * 60 * Math.PI) / 180;
        return (
          <circle
            key={`tip-${i}`}
            cx={100 + Math.cos(angle) * 80}
            cy={100 + Math.sin(angle) * 80}
            r="3.5"
            fill="url(#sf-grad)"
            opacity="0.9"
          />
        );
      })}
    </svg>
  );
}
