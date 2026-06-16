import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RotateCcw, Star, Sun, Lock } from "lucide-react";
import { toast } from "sonner";
import { useCloudSave } from "@/lib/use-cloud-save";
import { GameTutorial, useTutorial } from "@/components/GameTutorial";
import { BigSnowflakeSvg } from "@/components/BigSnowflakeSvg";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export const Route = createFileRoute("/games/snowfall")({
  component: SnowfallGame,
  head: () => ({
    meta: [
      { title: "Snowfall — kimmy's valuelist" },
      { name: "description", content: "An idle snowflake-gathering game with shimmer events, rebirth, and a constellation skill tree." },
    ],
  }),
});

// ----- Building definitions -----
type BuildingDef = {
  key: string;
  name: string;
  desc: string;
  baseCost: number;
  basePps: number;
  unlockAt: number;
  icon: string; // SVG path or emoji-free symbol
};

const BUILDINGS: BuildingDef[] = [
  { key: "catcher",  name: "Snow Catcher",    desc: "A small mitten that catches flakes as they drift by.",            baseCost: 15,      basePps: 0.2,    unlockAt: 0,       icon: "catcher" },
  { key: "cloud",    name: "Snow Cloud",      desc: "A low-hanging cloud that dusts your field with light powder.",    baseCost: 100,     basePps: 1,      unlockAt: 50,      icon: "cloud" },
  { key: "flurry",   name: "Flurry Engine",   desc: "Mechanical bellows that drive a steady stream of flurries.",      baseCost: 1_100,   basePps: 8,      unlockAt: 600,     icon: "flurry" },
  { key: "blizzard", name: "Blizzard Tower",  desc: "Channels arctic winds directly into your domain.",               baseCost: 12_000,  basePps: 47,     unlockAt: 7_000,   icon: "blizzard" },
  { key: "glacier",  name: "Glacier Forge",   desc: "Carves fresh snow from deep inside ancient ice.",                 baseCost: 130_000, basePps: 260,    unlockAt: 80_000,  icon: "glacier" },
  { key: "aurora",   name: "Aurora Loom",     desc: "Weaves the northern lights into a perpetual snowfall.",           baseCost: 1.4e6,   basePps: 1_400,  unlockAt: 900_000, icon: "aurora" },
  { key: "comet",    name: "Comet Reservoir", desc: "Harvests ice crystals from passing comets.",                      baseCost: 20e6,    basePps: 7_800,  unlockAt: 12e6,    icon: "comet" },
  { key: "rift",     name: "Winter Rift",     desc: "A tear in the sky that pours snow without end.",                  baseCost: 330e6,   basePps: 44_000, unlockAt: 200e6,   icon: "rift" },
];

// ----- Constellations -----
type ConstellationDef = {
  key: string;
  name: string;
  desc: string;
  maxRank: number;
  cost: (rank: number) => number;
  apply: (rank: number, base: BuffSet) => BuffSet;
  starPositions: { x: number; y: number }[]; // positions for star nodes in the constellation view
};

type BuffSet = {
  globalMult: number;
  buildingMult: Record<string, number>;
  clickMult: number;
  shimmerFreqMult: number;
  shimmerPowerMult: number;
  startingFlakes: number;
  offlineMult: number;
};

const emptyBuffs = (): BuffSet => ({
  globalMult: 1,
  buildingMult: {},
  clickMult: 1,
  shimmerFreqMult: 1,
  shimmerPowerMult: 1,
  startingFlakes: 0,
  offlineMult: 0.5,
});

const CONSTELLATIONS: ConstellationDef[] = [
  {
    key: "ursa", name: "Ursa", desc: "+10% all production per rank.",
    maxRank: 20, cost: (r) => Math.ceil(1 * Math.pow(1.5, r)),
    apply: (r, b) => ({ ...b, globalMult: b.globalMult * (1 + 0.1 * r) }),
    starPositions: [{ x: 20, y: 30 }, { x: 35, y: 20 }, { x: 50, y: 25 }, { x: 65, y: 15 }, { x: 80, y: 25 }, { x: 70, y: 40 }, { x: 55, y: 50 }],
  },
  {
    key: "aquila", name: "Aquila", desc: "+25% Catcher and Cloud per rank.",
    maxRank: 10, cost: (r) => Math.ceil(2 * Math.pow(1.6, r)),
    apply: (r, b) => ({ ...b, buildingMult: { ...b.buildingMult, catcher: (b.buildingMult.catcher ?? 1) * (1 + 0.25 * r), cloud: (b.buildingMult.cloud ?? 1) * (1 + 0.25 * r) } }),
    starPositions: [{ x: 50, y: 15 }, { x: 40, y: 35 }, { x: 60, y: 35 }, { x: 25, y: 55 }, { x: 75, y: 55 }],
  },
  {
    key: "lyra", name: "Lyra", desc: "+1 flake per click per rank, ×2 click multiplier.",
    maxRank: 10, cost: (r) => Math.ceil(3 * Math.pow(1.7, r)),
    apply: (r, b) => ({ ...b, clickMult: b.clickMult * Math.pow(2, r) }),
    starPositions: [{ x: 50, y: 20 }, { x: 35, y: 40 }, { x: 65, y: 40 }, { x: 30, y: 60 }, { x: 70, y: 60 }, { x: 50, y: 70 }],
  },
  {
    key: "polaris", name: "Polaris", desc: "Shimmers appear twice as often per rank.",
    maxRank: 5, cost: (r) => Math.ceil(5 * Math.pow(2, r)),
    apply: (r, b) => ({ ...b, shimmerFreqMult: b.shimmerFreqMult * Math.pow(0.5, r) }),
    starPositions: [{ x: 50, y: 50 }, { x: 50, y: 20 }, { x: 75, y: 65 }, { x: 25, y: 65 }],
  },
  {
    key: "perseus", name: "Perseus", desc: "Shimmer buffs are 50% stronger per rank.",
    maxRank: 5, cost: (r) => Math.ceil(6 * Math.pow(2, r)),
    apply: (r, b) => ({ ...b, shimmerPowerMult: b.shimmerPowerMult * (1 + 0.5 * r) }),
    starPositions: [{ x: 20, y: 25 }, { x: 35, y: 40 }, { x: 50, y: 35 }, { x: 65, y: 50 }, { x: 80, y: 40 }],
  },
  {
    key: "orion", name: "Orion", desc: "Start each Winter with 500×10^rank flakes.",
    maxRank: 6, cost: (r) => Math.ceil(10 * Math.pow(2.2, r)),
    apply: (r, b) => ({ ...b, startingFlakes: b.startingFlakes + 500 * Math.pow(10, r) }),
    starPositions: [{ x: 30, y: 20 }, { x: 50, y: 25 }, { x: 70, y: 20 }, { x: 25, y: 50 }, { x: 75, y: 50 }, { x: 35, y: 75 }, { x: 65, y: 75 }],
  },
  {
    key: "draco", name: "Draco", desc: "+15% offline income per rank (starts at 50%).",
    maxRank: 10, cost: (r) => Math.ceil(8 * Math.pow(1.9, r)),
    apply: (r, b) => ({ ...b, offlineMult: b.offlineMult + 0.15 * r }),
    starPositions: [{ x: 15, y: 30 }, { x: 30, y: 20 }, { x: 45, y: 30 }, { x: 55, y: 45 }, { x: 70, y: 40 }, { x: 80, y: 55 }, { x: 75, y: 70 }],
  },
];

// ----- Save state -----
type SaveState = {
  flakes: number;
  totalFlakes: number;
  lifetimeFlakes: number;
  buildings: Record<string, number>;
  constellations: Record<string, number>;
  frost: number;
  rebirths: number;
  lastTickAt: number;
  shimmerNextAt: number;
  activeBuff: { until: number; mult: number } | null;
  clicks: number;
};

const STORAGE = "valuegame.snowfall.v1";
const OFFLINE_CAP_HOURS = 12;

function makeFreshSave(buffs: BuffSet): SaveState {
  return {
    flakes: buffs.startingFlakes,
    totalFlakes: buffs.startingFlakes,
    lifetimeFlakes: 0,
    buildings: {},
    constellations: {},
    frost: 0,
    rebirths: 0,
    lastTickAt: Date.now(),
    shimmerNextAt: Date.now() + 240_000 + Math.random() * 360_000,
    activeBuff: null,
    clicks: 0,
  };
}

function loadSave(): SaveState | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(STORAGE) ?? "null"); } catch { return null; }
}
function saveSave(s: SaveState) { try { localStorage.setItem(STORAGE, JSON.stringify(s)); } catch { /**/ } }

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "inf";
  if (n < 1) return n.toFixed(2);
  if (n < 1_000) return Math.floor(n).toLocaleString();
  const units = ["K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
  let i = -1; let v = n;
  while (v >= 1000 && i < units.length - 1) { v /= 1000; i++; }
  return v.toFixed(2) + units[i];
}

function buildingCost(b: BuildingDef, owned: number) {
  return Math.ceil(b.baseCost * Math.pow(1.15, owned));
}

function pendingFrost(totalFlakes: number, currentRebirths: number): number {
  const REQ = 1_000_000;
  if (totalFlakes < REQ) return 0;
  const raw = Math.floor(Math.sqrt(totalFlakes / REQ) * (1 + currentRebirths * 0.05));
  return Math.max(1, raw);
}

// ---- Building icon SVGs (no emoji) ----
function BuildingIcon({ kind, className }: { kind: string; className?: string }) {
  const base = `h-5 w-5 ${className ?? ""}`;
  if (kind === "catcher") return (
    <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 3 C8 3 5 6 5 10 L5 16 L19 16 L19 10 C19 6 16 3 12 3Z" />
      <line x1="9" y1="16" x2="9" y2="20" /><line x1="15" y1="16" x2="15" y2="20" />
      <line x1="7" y1="20" x2="17" y2="20" />
    </svg>
  );
  if (kind === "cloud") return (
    <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      <line x1="9" y1="22" x2="8" y2="19" strokeWidth="1.2" strokeOpacity="0.6" />
      <line x1="12" y1="22" x2="12" y2="19" strokeWidth="1.2" strokeOpacity="0.6" />
      <line x1="15" y1="22" x2="16" y2="19" strokeWidth="1.2" strokeOpacity="0.6" />
    </svg>
  );
  if (kind === "flurry") return (
    <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <path d="M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M19.07 4.93l-2.83 2.83M7.76 16.24l-2.83 2.83" />
    </svg>
  );
  if (kind === "blizzard") return (
    <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 7v10M7 12h10M8.5 8.5l7 7M15.5 8.5l-7 7" strokeWidth="1.4" />
    </svg>
  );
  if (kind === "glacier") return (
    <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <polygon points="12,2 22,20 2,20" />
      <polygon points="12,8 18,20 6,20" fill="currentColor" fillOpacity="0.15" />
      <line x1="12" y1="8" x2="12" y2="14" strokeWidth="1.2" />
    </svg>
  );
  // aurora, comet, rift — geometric fallbacks
  return (
    <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" strokeDasharray="3 2" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

// ---- Constellation View (space scene) ----

// Wrap ConstellationsPanel in a proper Dialog so it doesn't push layout around
function ConstellationDialog({ open, save, onBuy, onClose }: {
  open: boolean; save: SaveState; onBuy: (k: string) => void; onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl w-full p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        <ConstellationsPanel save={save} onBuy={onBuy} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}

function ConstellationsPanel({
  save, onBuy, onClose,
}: { save: SaveState; onBuy: (k: string) => void; onClose: () => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [justBought, setJustBought] = useState<string | null>(null);

  const handleBuy = (key: string) => {
    onBuy(key);
    setJustBought(key);
    setTimeout(() => setJustBought(null), 1000);
  };

  return (
    <div className="border-b border-border/60 bg-[oklch(0.08_0.06_260)] backdrop-blur relative overflow-hidden">
      {/* Starfield background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        {Array.from({ length: 80 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 2 + 0.5 + "px",
              height: Math.random() * 2 + 0.5 + "px",
              left: Math.random() * 100 + "%",
              top: Math.random() * 100 + "%",
              opacity: Math.random() * 0.6 + 0.2,
              animation: `twinkle ${2 + Math.random() * 4}s ${Math.random() * 3}s ease-in-out infinite alternate`,
            }}
          />
        ))}
      </div>

      <style>{`@keyframes twinkle { from { opacity: 0.2; } to { opacity: 0.9; } }`}</style>

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-sky-300/70">Constellations</div>
            <div className="font-display text-xl font-bold text-white">
              Spend <span className="text-sky-300">{fmt(save.frost)} Frost</span> for lasting upgrades
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-sky-200 hover:text-white">Close</Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CONSTELLATIONS.map((c) => {
            const rank = save.constellations[c.key] ?? 0;
            const max = rank >= c.maxRank;
            const cost = max ? 0 : c.cost(rank);
            const can = !max && save.frost >= cost;
            const isHovered = hovered === c.key;
            const wasBought = justBought === c.key;

            return (
              <button
                key={c.key}
                onClick={() => !max && can && handleBuy(c.key)}
                onMouseEnter={() => setHovered(c.key)}
                onMouseLeave={() => setHovered(null)}
                disabled={!can && !max}
                className={`relative rounded-xl border p-3 text-left transition-all duration-200 ${
                  max
                    ? "border-sky-400/60 bg-sky-400/10 shadow-lg shadow-sky-400/20"
                    : can
                    ? "border-sky-400/40 bg-white/5 hover:border-sky-400/70 hover:bg-white/10 cursor-pointer"
                    : "border-white/10 bg-white/3 opacity-50 cursor-not-allowed"
                } ${wasBought ? "animate-pulse scale-105" : ""}`}
              >
                {/* Mini constellation SVG */}
                <svg viewBox="0 0 100 80" className="mb-2 w-full h-16 opacity-80">
                  {/* Lines between stars */}
                  {c.starPositions.slice(0, -1).map((pos, i) => {
                    const next = c.starPositions[i + 1];
                    const filled = i < rank;
                    return (
                      <line
                        key={`l-${i}`}
                        x1={pos.x} y1={pos.y} x2={next.x} y2={next.y}
                        stroke={filled ? "#7dd3fc" : "#ffffff30"}
                        strokeWidth={filled ? "1.5" : "1"}
                        strokeDasharray={filled ? undefined : "3 2"}
                      />
                    );
                  })}
                  {/* Stars */}
                  {c.starPositions.map((pos, i) => {
                    const filled = i < rank;
                    const isNext = i === rank && !max;
                    return (
                      <circle
                        key={`s-${i}`}
                        cx={pos.x} cy={pos.y} r={filled ? 4 : isNext ? 3.5 : 2.5}
                        fill={filled ? "#7dd3fc" : isNext ? "#ffffff60" : "#ffffff20"}
                        stroke={filled ? "#e0f2fe" : isNext ? "#ffffff40" : "none"}
                        strokeWidth="1"
                        className={filled ? "drop-shadow" : ""}
                        style={filled ? { filter: "drop-shadow(0 0 4px #7dd3fc)" } : {}}
                      />
                    );
                  })}
                  {/* Black-hole dots for locked future ranks */}
                  {Array.from({ length: Math.max(0, c.maxRank - c.starPositions.length) }).map((_, i) => (
                    <circle key={`bh-${i}`} cx={85 + i * 6} cy={70} r="2.5" fill="#00000080" stroke="#ffffff20" strokeWidth="1" />
                  ))}
                </svg>

                <div className="flex items-center gap-2">
                  <Star className={`h-3.5 w-3.5 shrink-0 ${max ? "text-sky-300" : "text-white/50"}`} />
                  <span className={`text-sm font-semibold ${max ? "text-sky-200" : "text-white/80"}`}>{c.name}</span>
                  <span className="ml-auto text-[10px] text-white/40">{rank}/{c.maxRank}</span>
                </div>
                <div className={`mt-1 text-xs ${isHovered ? "text-sky-200" : "text-white/50"}`}>{c.desc}</div>
                <div className="mt-1.5 font-mono text-xs">
                  {max ? (
                    <span className="text-sky-300">Maxed</span>
                  ) : (
                    <span className={can ? "text-sky-400" : "text-white/30"}>{fmt(cost)} Frost</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SnowfallGame() {
  const tut = useTutorial("snowfall");
  const [save, setSave] = useState<SaveState | null>(null);
  const [offlineEarned, setOfflineEarned] = useState<number | null>(null);
  const [showConst, setShowConst] = useState(false);
  const [confirmRebirth, setConfirmRebirth] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const pendingFrostRef = useRef(0);
  const [now, setNow] = useState(Date.now());

  // Keep `now` updated for shimmer countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const buffs = useMemo<BuffSet>(() => {
    let b = emptyBuffs();
    if (!save) return b;
    for (const c of CONSTELLATIONS) {
      const r = save.constellations[c.key] ?? 0;
      if (r > 0) b = c.apply(r, b);
    }
    return b;
  }, [save]);

  const basePps = useMemo(() => {
    if (!save) return 0;
    let total = 0;
    for (const b of BUILDINGS) {
      const owned = save.buildings[b.key] ?? 0;
      const mult = b.basePps * (buffs.buildingMult[b.key] ?? 1) * buffs.globalMult;
      total += owned * mult;
    }
    return total;
  }, [save, buffs]);

  const buffMult = save?.activeBuff && save.activeBuff.until > now ? save.activeBuff.mult : 1;
  const pps = basePps * buffMult;

  // Hydrate
  useEffect(() => {
    if (save) return;
    const existing = loadSave();
    if (existing) {
      let b = emptyBuffs();
      for (const c of CONSTELLATIONS) {
        const r = existing.constellations[c.key] ?? 0;
        if (r > 0) b = c.apply(r, b);
      }
      let basePpsLoaded = 0;
      for (const def of BUILDINGS) {
        const owned = existing.buildings[def.key] ?? 0;
        basePpsLoaded += owned * def.basePps * (b.buildingMult[def.key] ?? 1) * b.globalMult;
      }
      const elapsed = Math.min(OFFLINE_CAP_HOURS * 3600_000, Math.max(0, Date.now() - existing.lastTickAt));
      const earned = (basePpsLoaded * b.offlineMult * elapsed) / 1000;
      if (Number.isFinite(earned) && earned > 1) setOfflineEarned(earned);
      setSave({ ...existing, flakes: existing.flakes + earned, totalFlakes: existing.totalFlakes + earned, lifetimeFlakes: existing.lifetimeFlakes + earned, lastTickAt: Date.now() });
    } else {
      setSave(makeFreshSave(emptyBuffs()));
    }
  }, [save]);

  const saveThrottleRef = useRef(0);
  useEffect(() => {
    if (!save) return;
    const now = Date.now();
    if (now - saveThrottleRef.current < 5000) return;
    saveThrottleRef.current = now;
    saveSave(save);
  }, [save]);
  useCloudSave({ key: "snowfall", storageKey: STORAGE, state: save, setState: setSave });

  // RAF tick
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(performance.now());

  useEffect(() => {
    function frame(ts: number) {
      const dt = Math.min(0.1, (ts - lastFrameRef.current) / 1000);
      lastFrameRef.current = ts;
      setSave((s) => {
        if (!s) return s;
        let buffs = emptyBuffs();
        for (const c of CONSTELLATIONS) {
          const r = s.constellations[c.key] ?? 0;
          if (r > 0) buffs = c.apply(r, buffs);
        }
        let base = 0;
        for (const def of BUILDINGS) {
          const owned = s.buildings[def.key] ?? 0;
          base += owned * def.basePps * (buffs.buildingMult[def.key] ?? 1) * buffs.globalMult;
        }
        const mult = s.activeBuff && s.activeBuff.until > Date.now() ? s.activeBuff.mult : 1;
        const gain = base * mult * dt;
        const activeBuff = s.activeBuff && s.activeBuff.until <= Date.now() ? null : s.activeBuff;
        return { ...s, flakes: s.flakes + gain, totalFlakes: s.totalFlakes + gain, lifetimeFlakes: s.lifetimeFlakes + gain, activeBuff, lastTickAt: Date.now() };
      });
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  // Shimmer events
  const [shimmer, setShimmer] = useState<{ id: number; x: number; y: number; created: number } | null>(null);
  const shimmerIdRef = useRef(0);
  useEffect(() => {
    const id = setInterval(() => {
      setSave((s) => {
        if (!s) return s;
        if (Date.now() >= s.shimmerNextAt && !shimmer) {
          shimmerIdRef.current += 1;
          setShimmer({ id: shimmerIdRef.current, x: 10 + Math.random() * 80, y: 20 + Math.random() * 60, created: Date.now() });
          const freq = 240_000 + Math.random() * 360_000;
          return { ...s, shimmerNextAt: Date.now() + freq * buffs.shimmerFreqMult };
        }
        return s;
      });
      if (shimmer && Date.now() - shimmer.created > 14_000) setShimmer(null);
    }, 500);
    return () => clearInterval(id);
  }, []); // stable — reads via refs

  const catchShimmer = () => {
    setShimmer(null);
    setSave((s) => {
      if (!s) return s;
      const roll = Math.random();
      if (roll < 0.45) {
        const mult = 7 * buffs.shimmerPowerMult;
        toast.success(`Shimmer — ${mult.toFixed(0)}× production for 60 seconds`);
        return { ...s, activeBuff: { until: Date.now() + 60_000, mult } };
      }
      if (roll < 0.85) {
        const gain = basePps * 900 * buffs.shimmerPowerMult;
        toast.success(`Shimmer — +${fmt(gain)} flakes`);
        return { ...s, flakes: s.flakes + gain, totalFlakes: s.totalFlakes + gain, lifetimeFlakes: s.lifetimeFlakes + gain };
      }
      const mult = 15 * buffs.shimmerPowerMult;
      toast.success(`Brilliant shimmer — ${mult.toFixed(0)}× for 90 seconds`);
      return { ...s, activeBuff: { until: Date.now() + 90_000, mult } };
    });
  };

  const clickFlake = useCallback(() => {
    setSave((s) => {
      if (!s) return s;
      const click = (1 + basePps * 0.01) * buffs.clickMult * buffMult;
      return { ...s, flakes: s.flakes + click, totalFlakes: s.totalFlakes + click, lifetimeFlakes: s.lifetimeFlakes + click, clicks: s.clicks + 1 };
    });
  }, [basePps, buffs.clickMult, buffMult]);

  const buy = (key: string) => {
    setSave((s) => {
      if (!s) return s;
      const def = BUILDINGS.find((b) => b.key === key)!;
      const owned = s.buildings[key] ?? 0;
      const cost = buildingCost(def, owned);
      if (s.flakes < cost) { toast.error("Not enough flakes"); return s; }
      return { ...s, flakes: s.flakes - cost, buildings: { ...s.buildings, [key]: owned + 1 } };
    });
  };

  const rebirth = () => {
    if (!save) return;
    const frostGain = pendingFrost(save.totalFlakes, save.rebirths);
    if (frostGain <= 0) { toast.error("Reach 1,000,000 flakes this Winter to rebirth"); return; }
    pendingFrostRef.current = frostGain;
    setConfirmRebirth(true);
  };

  const doRebirth = () => {
    const frostGain = pendingFrostRef.current;
    setSave((s) => {
      if (!s) return s;
      let b = emptyBuffs();
      for (const c of CONSTELLATIONS) {
        const r = s.constellations[c.key] ?? 0;
        if (r > 0) b = c.apply(r, b);
      }
      return { ...s, flakes: b.startingFlakes, totalFlakes: b.startingFlakes, buildings: {}, frost: s.frost + frostGain, rebirths: s.rebirths + 1, activeBuff: null, shimmerNextAt: Date.now() + 240_000, lastTickAt: Date.now() };
    });
    toast.success(`+${frostGain} Frost earned. Spend it in Constellations.`);
    setShowConst(true);
  };

  const buyConst = (key: string) => {
    setSave((s) => {
      if (!s) return s;
      const def = CONSTELLATIONS.find((c) => c.key === key)!;
      const rank = s.constellations[key] ?? 0;
      if (rank >= def.maxRank) return s;
      const cost = def.cost(rank);
      if (s.frost < cost) { toast.error("Not enough Frost"); return s; }
      toast.success(`${def.name} reached rank ${rank + 1}`);
      return { ...s, frost: s.frost - cost, constellations: { ...s.constellations, [key]: rank + 1 } };
    });
  };

  const reset = () => setConfirmReset(true);

  const doReset = () => {
    localStorage.removeItem(STORAGE);
    setSave(null);
    setTimeout(() => window.location.reload(), 50);
  };

  if (!save) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const frostPending = pendingFrost(save.totalFlakes, save.rebirths);
  const shimmerInMin = Math.max(0, Math.ceil((save.shimmerNextAt - now) / 60_000));
  const shimmerInSec = Math.max(0, Math.ceil((save.shimmerNextAt - now) / 1000));

  return (
    <div className="min-h-screen pb-12">
      <ConfirmDialog
        open={confirmRebirth}
        title="Start a new Winter?"
        message={`You'll earn ${pendingFrostRef.current} Frost. Flakes and buildings reset — Frost and Constellations stay.`}
        confirmLabel={`Rebirth (+${pendingFrostRef.current} Frost)`}
        cancelLabel="Stay here"
        onConfirm={() => { setConfirmRebirth(false); doRebirth(); }}
        onCancel={() => setConfirmRebirth(false)}
      />
      <ConfirmDialog
        open={confirmReset}
        title="Wipe all progress?"
        message="This deletes your flakes, buildings, Frost, and Constellations permanently. Cannot be undone."
        confirmLabel="Reset everything"
        cancelLabel="Keep playing"
        destructive
        onConfirm={() => { setConfirmReset(false); doReset(); }}
        onCancel={() => setConfirmReset(false)}
      />
      <GameTutorial {...tut.props} title="Snowfall" steps={[
        { title: "Tap the snowflake", body: "Each tap gathers a small number of flakes. Buildings do the real work — click to get started, then build." },
        { title: "Buy buildings", body: "The panel on the right lists buildings that produce flakes automatically. Each one you buy raises the cost of the next, so buying many types is usually better than stacking one." },
        { title: "Watch for the shimmer", body: "Every few minutes a golden shape drifts across the screen. Tap it fast — it grants a big burst of production or a pile of flakes instantly." },
        { title: "Rebirth into Winter", body: "Once you hit one million flakes you can start a new Winter. You lose flakes and buildings but gain Frost, which is permanent." },
        { title: "Spend Frost in Constellations", body: "The Constellations screen lets you spend Frost on permanent upgrades — faster production, stronger clicks, more shimmers, and a bigger head start on your next run." },
      ]} />

      {/* Shimmer overlay */}
      {shimmer && (
        <button
          onClick={catchShimmer}
          aria-label="Catch the shimmer"
          onTouchStart={(e) => { e.preventDefault(); catchShimmer(); }}
          className="pointer-events-auto fixed z-40 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${shimmer.x}vw`, top: `${shimmer.y}vh` }}
        >
          <svg viewBox="0 0 60 60" className="h-20 w-20 drop-shadow-[0_0_16px_rgba(252,211,77,0.9)] animate-pulse" fill="none">
            <polygon points="30,2 36,22 58,22 41,35 47,55 30,42 13,55 19,35 2,22 24,22" fill="#fde68a" stroke="#f59e0b" strokeWidth="1.5" />
          </svg>
        </button>
      )}

      <header className="border-b border-border/60" style={{ background: "var(--gradient-hero)" }}>
        <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm"><Link to="/games"><ArrowLeft className="mr-1 h-4 w-4" /> Games</Link></Button>
              <h1 className="font-display text-xl font-bold sm:text-2xl">Snowfall</h1>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <Button variant="ghost" size="sm" onClick={tut.openTutorial}> How to play</Button>
              <Button variant="outline" size="sm" onClick={() => setShowConst((x) => !x)}>
                <Star className="mr-1 h-3.5 w-3.5" /> Constellations {save.frost > 0 && <Badge className="ml-1.5 text-[10px] px-1">{save.frost}</Badge>}
              </Button>
              <Button variant="ghost" size="sm" onClick={reset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Flakes" value={fmt(save.flakes)} highlight />
            <Stat label="Per second" value={fmt(pps)} sub={buffMult > 1 ? `${buffMult.toFixed(1)}× buff` : undefined} />
            <Stat label="Frost" value={fmt(save.frost)} sub={`Winter ${save.rebirths + 1}`} />
            <Stat label="All time" value={fmt(save.lifetimeFlakes)} />
          </div>
          {offlineEarned != null && offlineEarned > 1 && (
            <div className="mt-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
              Gathered <span className="font-mono font-bold text-primary">{fmt(offlineEarned)}</span> flakes while away.
              <button className="ml-2 text-xs underline" onClick={() => setOfflineEarned(null)}>dismiss</button>
            </div>
          )}
        </div>
      </header>

      <ConstellationDialog open={showConst} save={save} onBuy={buyConst} onClose={() => setShowConst(false)} />

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12">
          {/* Click zone */}
          <div className="lg:col-span-5">
            <Card className="p-4 sm:p-6" style={{ background: "var(--gradient-card)" }}>
              <div className="flex flex-col items-center">
                <button
                  onClick={clickFlake}
                  aria-label="Gather a flake"
                  className="group relative my-4 flex h-44 w-44 items-center justify-center rounded-full active:scale-95 transition-transform sm:h-52 sm:w-52"
                  style={{ filter: "drop-shadow(0 0 18px rgba(180,210,255,0.4))" }}
                  onTouchStart={(e) => { e.preventDefault(); clickFlake(); }}
                >
                  <div className="absolute inset-0 animate-spin rounded-full" style={{ animationDuration: "32s", background: "conic-gradient(from 0deg, rgba(255,255,255,0.03), rgba(160,210,255,0.15), rgba(255,255,255,0.03))" }} />
                  <BigSnowflakeSvg className="relative h-36 w-36 transition-transform group-hover:scale-105 group-active:scale-95 sm:h-44 sm:w-44" />
                </button>
                <div className="text-center text-xs text-muted-foreground">
                  <div>Each click: <span className="font-mono text-foreground">{fmt((1 + basePps * 0.01) * buffs.clickMult * buffMult)}</span></div>
                  <div className="mt-0.5">
                    {shimmer
                      ? "Shimmer active — catch it!"
                      : shimmerInSec < 60
                      ? `Shimmer arriving in ${shimmerInSec}s`
                      : `Next shimmer in ~${shimmerInMin}m`
                    }
                  </div>
                </div>
              </div>
              <div className="mt-4 border-t border-border/60 pt-4 text-center">
                <div className="mb-2 text-xs text-muted-foreground">Convert progress into Frost for permanent upgrades</div>
                <Button
                  onClick={rebirth}
                  disabled={frostPending <= 0}
                  variant={frostPending > 0 ? "default" : "outline"}
                  className="w-full sm:w-auto"
                >
                  <Sun className="mr-2 h-4 w-4" />
                  {frostPending > 0
                    ? `New Winter (+${frostPending} Frost)`
                    : `${fmt(Math.max(0, 1_000_000 - save.totalFlakes))} more flakes to rebirth`
                  }
                </Button>
              </div>
            </Card>
          </div>

          {/* Buildings */}
          <div className="lg:col-span-7">
            <Card className="p-3 sm:p-4">
              <div className="mb-3 text-sm font-semibold">Buildings</div>
              <div className="space-y-1.5">
                {BUILDINGS.map((b) => {
                  const owned = save.buildings[b.key] ?? 0;
                  const cost = buildingCost(b, owned);
                  const locked = save.lifetimeFlakes < b.unlockAt && owned === 0;
                  if (locked && save.lifetimeFlakes < b.unlockAt * 0.5) return null;
                  const can = save.flakes >= cost && !locked;
                  const out = b.basePps * (buffs.buildingMult[b.key] ?? 1) * buffs.globalMult;
                  const pct = owned > 0 ? Math.min(1, owned / 10) : 0;

                  return (
                    <button
                      key={b.key}
                      onClick={() => !locked && buy(b.key)}
                      onTouchEnd={(e) => { e.preventDefault(); if (!locked) buy(b.key); }}
                      disabled={!can}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        locked ? "border-border/30 bg-secondary/10 opacity-50" :
                        can ? "border-primary/40 hover:bg-primary/10 active:bg-primary/20" :
                        "border-border/50 opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${locked ? "bg-secondary/30" : "bg-secondary/50"}`}>
                          {locked
                            ? <Lock className="h-4 w-4 text-muted-foreground" />
                            : <BuildingIcon kind={b.icon} className={`h-5 w-5 ${can ? "text-sky-300" : "text-muted-foreground"}`} />
                          }
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold truncate">{locked ? "???" : b.name}</span>
                            <span className="ml-auto shrink-0 text-xs text-muted-foreground font-mono">×{owned}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {locked ? `Unlocks at ${fmt(b.unlockAt)} lifetime flakes` : b.desc}
                          </div>
                          {/* Progress bar for owned count */}
                          {owned > 0 && (
                            <div className="mt-1 h-1 rounded-full bg-border/60 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-sky-400/70 transition-all duration-300"
                                style={{ width: `${Math.min(100, (owned % 10) * 10)}%` }}
                              />
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-mono text-sm font-bold text-primary">{fmt(cost)}</div>
                          <div className="text-[10px] text-muted-foreground">+{fmt(out)}/s</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-2.5 py-2 ${highlight ? "border-primary/40 bg-primary/10" : "border-border/60 bg-card/40"}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono text-base font-bold leading-tight ${highlight ? "text-primary" : ""}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
