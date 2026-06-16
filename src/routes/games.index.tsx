import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Calendar, Brain, LineChart, Snowflake } from "lucide-react";

export const Route = createFileRoute("/games/")({
  component: GamesHub,
  head: () => ({
    meta: [
      { title: "Games — kimmy's valuelist" },
      { name: "description", content: "Practice the value list, run the market, build a snowfall empire, or take on a daily challenge." },
    ],
  }),
});

type GameDef = {
  to: string;
  title: string;
  tagline: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  preview: "daily" | "market" | "trainer" | "snowfall";
};

// Daily is first to drive engagement
const GAMES: GameDef[] = [
  {
    to: "/games/daily",
    title: "Daily Challenge",
    tagline: "One run. Every day.",
    description: "A fresh 10-question round every 24 hours, the same for everyone. Build a streak, earn rewards, and see where you land on the global board.",
    icon: <Calendar className="h-6 w-6" />,
    accent: "from-[#c9961a] to-[#a02424]",
    preview: "daily",
  },
  {
    to: "/games/market",
    title: "Market Tycoon",
    tagline: "Trade. Fulfill. Profit.",
    description: "A live simulated skin market. Search, sort, buy low, sell high, and fill incoming orders at a premium. Negotiators keep earning while you step away.",
    icon: <LineChart className="h-6 w-6" />,
    accent: "from-[#a02424] to-[#c9961a]",
    preview: "market",
  },
  {
    to: "/games/memorize",
    title: "Value Trainer",
    tagline: "Learn every value cold.",
    description: "Four rotating question types. Distractors snap to realistic price ticks so you can't shortcut the answer — you actually have to know the list.",
    icon: <Brain className="h-6 w-6" />,
    accent: "from-[#2c6fd1] to-[#5a8a3a]",
    preview: "trainer",
  },
  {
    to: "/games/snowfall",
    title: "Snowfall",
    tagline: "Idle. Build. Rebirth.",
    description: "Tap to gather flakes, build a winter empire, hunt shimmer events for big bursts, and rebirth into the Constellations tree for permanent gains.",
    icon: <Snowflake className="h-6 w-6" />,
    accent: "from-[#7dd3fc] to-[#3b82f6]",
    preview: "snowfall",
  },
];

function GamesHub() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60" style={{ background: "var(--gradient-hero)" }}>
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <Button asChild variant="ghost" size="sm" className="mb-4">
            <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
          </Button>
          <h1 className="font-display text-4xl font-bold sm:text-5xl">
            <span className="text-primary" style={{ textShadow: "var(--glow-primary)" }}>Games</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Progress saves locally and syncs to your account when signed in.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-2">
          {GAMES.map((g) => <GameCard key={g.to} {...g} />)}
        </div>
      </main>
    </div>
  );
}

function GameCard({ to, icon, title, tagline, description, accent, preview }: GameDef) {
  return (
    <Link to={to} className="group block">
      <Card className="relative h-full overflow-hidden border-border/60 p-0 transition-all hover:-translate-y-1 hover:border-primary/60 hover:shadow-2xl">
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent} z-10`} />
        <div className="relative h-28 w-full overflow-hidden bg-secondary/30">
          <GamePreview kind={preview} />
        </div>
        <div className="p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/15 p-2 text-primary">{icon}</div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-bold truncate">{title}</h2>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{tagline}</p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
          <div className="mt-4 text-sm font-medium text-primary group-hover:underline">Play →</div>
        </div>
      </Card>
    </Link>
  );
}

function GamePreview({ kind }: { kind: GameDef["preview"] }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let timer = 0;

    const resize = () => { if (canvas.clientWidth === 0 || canvas.clientHeight === 0) return;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    if (kind === "snowfall") {
      const flakes = Array.from({ length: 28 }, () => ({
        x: Math.random() * canvas.clientWidth,
        y: Math.random() * canvas.clientHeight,
        r: Math.random() * 2 + 1,
        v: Math.random() * 0.5 + 0.2,
      }));
      const draw = () => {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "rgba(255,255,255,0.82)";
        for (const f of flakes) {
          f.y += f.v;
          if (f.y > h) { f.y = -2; f.x = Math.random() * w; }
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
          ctx.fill();
        }
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
    } else if (kind === "market") {
      const pts = Array.from({ length: 40 }, () => Math.random() * 0.5 + 0.5);
      const draw = () => {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        ctx.clearRect(0, 0, w, h);
        pts.push(Math.max(0.1, Math.min(0.9, pts[pts.length - 1] + (Math.random() - 0.5) * 0.09)));
        pts.shift();
        const trend = pts[pts.length - 1] > pts[0];
        ctx.strokeStyle = trend ? "rgba(100,220,140,0.85)" : "rgba(220,100,100,0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        pts.forEach((v, i) => {
          const x = (i / (pts.length - 1)) * w;
          const y = h - v * h;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
        timer = window.setTimeout(() => { raf = requestAnimationFrame(draw); }, 200) as unknown as number;
      };
      raf = requestAnimationFrame(draw);
    } else if (kind === "daily") {
      let t = 0;
      const draw = () => {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        ctx.clearRect(0, 0, w, h);
        const day = new Date().getUTCDate();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `bold 38px system-ui`;
        ctx.fillStyle = `oklch(0.88 0.08 ${220 + Math.sin(t / 30) * 15})`;
        ctx.fillText(String(day), w / 2, h / 2 - 5);
        ctx.font = "10px system-ui";
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillText("TODAY", w / 2, h / 2 + 17);
        t++;
        timer = window.setTimeout(() => { raf = requestAnimationFrame(draw); }, 80) as unknown as number;
      };
      raf = requestAnimationFrame(draw);
    } else {
      // trainer — cycle through value-label pairs
      let i = 0;
      const pairs = [["Frostbite", "?"], ["320", "correct"], ["Balisong", "?"], ["180", "wrong"], ["M4A1", "?"]];
      const draw = () => {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        ctx.clearRect(0, 0, w, h);
        const [label, state] = pairs[i % pairs.length];
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "bold 20px system-ui";
        ctx.fillStyle = state === "correct" ? "rgba(100,220,140,0.9)" : state === "wrong" ? "rgba(220,100,100,0.9)" : "rgba(180,210,255,0.9)";
        ctx.fillText(label, w / 2, h / 2);
        i++;
        timer = window.setTimeout(() => { raf = requestAnimationFrame(draw); }, 900) as unknown as number;
      };
      raf = requestAnimationFrame(draw);
    }

    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [kind]);

  return <canvas ref={ref} className="h-full w-full" />;
}
