import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, TrendingUp, TrendingDown, Minus, Hammer, RotateCcw, Inbox, Search,
} from "lucide-react";
import { toast } from "sonner";
import type { Skin } from "@/components/SkinCard";
import { SkinImage } from "@/components/SkinImage";
import { useCloudSave } from "@/lib/use-cloud-save";
import { GameTutorial, useTutorial } from "@/components/GameTutorial";

export const Route = createFileRoute("/games/market")({
  component: MarketGame,
  head: () => ({
    meta: [
      { title: "Market Tycoon — kimmy's valuelist" },
      { name: "description", content: "Trade skins on a live simulated market. Buy low, sell high, fill orders, earn ValueCoin." },
    ],
  }),
});

type GameSkin = Skin & { _baseValue: number };
type MarketEntry = { id: string; mult: number; trend: number };
type InventoryEntry = { id: string; count: number; avgCost: number };
type Order = { id: string; skinId: string; qty: number; pricePer: number; expiresAt: number };

type SaveState = {
  vc: number;
  autoPerSec: number;
  market: Record<string, MarketEntry>;
  inventory: Record<string, InventoryEntry>;
  orders: Order[];
  totalEarned: number;
  ordersFilled: number;
  trades: number;
  upgrades: { auto: number; orderRate: number; orderPay: number; offlineEff: number };
  lastTickAt: number;
  scrip?: number;
};

const STORAGE_KEY = "valuegame.market.v2";
const LEGACY_KEY  = "valuegame.market.v1";
const TICK_MS     = 1500;
const ORDER_MAX   = 8;
const OFFLINE_CAP_HOURS = 8;
const OFFLINE_BASE_RATE = 0.25;
// Market price is capped at ±40% of the skin's real base value
const MAX_MULT = 1.40;
const MIN_MULT = 0.60;

function loadSave(): SaveState | null {
  if (typeof window === "undefined") return null;
  try {
    const v2 = localStorage.getItem(STORAGE_KEY);
    if (v2) return JSON.parse(v2);
    const v1 = localStorage.getItem(LEGACY_KEY);
    if (v1) {
      const old = JSON.parse(v1);
      return {
        vc: old.scrip ?? 50,
        autoPerSec: old.autoPerSec ?? 0,
        market: old.market ?? {},
        inventory: old.inventory ?? {},
        orders: old.orders ?? [],
        totalEarned: old.totalEarned ?? 0,
        ordersFilled: old.ordersFilled ?? 0,
        trades: 0,
        upgrades: {
          auto: old.upgrades?.auto ?? 0,
          orderRate: old.upgrades?.orderRate ?? 0,
          orderPay: old.upgrades?.orderPay ?? 0,
          offlineEff: 0,
        },
        lastTickAt: Date.now(),
      };
    }
  } catch { /* ignore */ }
  return null;
}

function saveSave(s: SaveState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /**/ }
}

function fmt(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return Math.floor(n).toLocaleString();
}

function MarketGame() {
  const tut = useTutorial("market");

  const { data: skins = [], isLoading } = useQuery({
    queryKey: ["skins-game"],
    queryFn: async () => {
      const { data, error } = await supabase.from("skins").select("*").limit(2000);
      if (error) throw error;
      return (data as unknown as Skin[]).filter((s) => Number(s.value) > 0);
    },
    staleTime: 5 * 60_000,
  });

  const skinMap = useMemo(() => {
    const m = new Map<string, GameSkin>();
    skins.forEach((s) => m.set(s.id, { ...s, _baseValue: Number(s.value) || 1 }));
    return m;
  }, [skins]);

  const [state, setState] = useState<SaveState | null>(null);
  const [offlineEarned, setOfflineEarned] = useState<number | null>(null);

  useEffect(() => {
    if (!skins.length || state) return;
    const saved = loadSave();
    if (saved) {
      const validIds = new Set(skins.map((s) => s.id));
      const market: Record<string, MarketEntry> = {};
      Object.entries(saved.market ?? {}).forEach(([k, v]) => {
        if (validIds.has(k)) {
          // Clamp existing multipliers on load
          market[k] = { ...v, mult: Math.max(MIN_MULT, Math.min(MAX_MULT, v.mult)) };
        }
      });
      const inv: Record<string, InventoryEntry> = {};
      Object.entries(saved.inventory ?? {}).forEach(([k, v]) => { if (validIds.has(k)) inv[k] = v; });
      const orders = (saved.orders ?? []).filter((o) => validIds.has(o.skinId));

      const rate = saved.autoPerSec * (OFFLINE_BASE_RATE + (saved.upgrades?.offlineEff ?? 0) * 0.1);
      const elapsedMs = Math.max(0, Date.now() - (saved.lastTickAt ?? Date.now()));
      const cappedMs  = Math.min(elapsedMs, OFFLINE_CAP_HOURS * 3600_000);
      const earned    = (rate * cappedMs) / 1000;
      if (earned > 1) setOfflineEarned(earned);

      setState({ ...saved, market, inventory: inv, orders, vc: saved.vc + earned, totalEarned: saved.totalEarned + earned, lastTickAt: Date.now() });
    } else {
      setState({
        vc: 100, autoPerSec: 1, market: {}, inventory: {}, orders: [],
        totalEarned: 0, ordersFilled: 0, trades: 0,
        upgrades: { auto: 0, orderRate: 0, orderPay: 0, offlineEff: 0 },
        lastTickAt: Date.now(),
      });
    }
  }, [skins, state]);

  useEffect(() => {
    if (!state) return;
    const id = setTimeout(() => saveSave({ ...state, lastTickAt: Date.now() }), 300);
    return () => clearTimeout(id);
  }, [state]);

  useCloudSave({ key: "market", storageKey: STORAGE_KEY, state, setState });

  // Market simulation tick — price drifts but stays within ±40% of base value
  useEffect(() => {
    if (!skins.length) return;
    const interval = setInterval(() => {
      setState((s) => {
        if (!s) return s;
        const market = { ...s.market };

        for (const sk of skins) {
          if (!market[sk.id]) {
            market[sk.id] = { id: sk.id, mult: 1, trend: 0 };
          }
        }

        for (const k in market) {
          const e = market[k];
          const shock    = (Math.random() - 0.5) * 0.06;
          const newTrend = e.trend * 0.85 + shock;
          // Mean-reversion towards 1.0 keeps prices near real values
          let newMult = e.mult * (1 + newTrend) + (1 - e.mult) * 0.04;
          // Hard cap: never deviate more than 40% from the skin's real price
          newMult = Math.max(MIN_MULT, Math.min(MAX_MULT, newMult));
          market[k] = { id: k, mult: newMult, trend: newTrend };
        }

        const vcGain = (s.autoPerSec * TICK_MS) / 1000;
        let orders = s.orders.filter((o) => o.expiresAt > Date.now());
        const targetOrders = Math.min(ORDER_MAX, 3 + s.upgrades.orderRate);

        if (orders.length < targetOrders && skins.length) {
          const skin    = skins[Math.floor(Math.random() * skins.length)];
          const mkt     = market[skin.id];
          const price   = Math.max(1, (Number(skin.value) || 1) * mkt.mult);
          const premium = 1.18 + Math.random() * 0.4 + s.upgrades.orderPay * 0.07;
          const qty     = 1 + Math.floor(Math.random() * 3);
          const lifeMs  = 30_000 + Math.floor(Math.random() * 45_000);
          orders = [...orders, {
            id: Math.random().toString(36).slice(2),
            skinId: skin.id, qty,
            pricePer: Math.round(price * premium),
            expiresAt: Date.now() + lifeMs,
          }];
        }

        return { ...s, market, orders, vc: s.vc + vcGain, totalEarned: s.totalEarned + vcGain, lastTickAt: Date.now() };
      });
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [skins.length]);

  // Force re-render each second for order countdown timers
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const portfolioValue = useMemo(() => {
    if (!state) return 0;
    let v = 0;
    for (const k in state.inventory) {
      const inv = state.inventory[k];
      const sk  = skinMap.get(k);
      if (!sk) continue;
      const mkt  = state.market[k];
      const mult = mkt?.mult ?? 1;
      v += inv.count * sk._baseValue * mult;
    }
    return v;
  }, [state, skinMap]);

  const [marketSort, setMarketSort]   = useState<"trending" | "cheap" | "expensive" | "rising" | "falling">("trending");
  const [marketSearch, setMarketSearch] = useState("");
  const [orderSearch,  setOrderSearch]  = useState("");

  const marketList = useMemo(() => {
    if (!state) return [];
    const q = marketSearch.trim().toLowerCase();
    let arr = skins
      .filter((s) => !q || (s.name + " " + s.weapon_type).toLowerCase().includes(q))
      .map((s) => {
        const gs: GameSkin = { ...(s as Skin), _baseValue: Number(s.value) || 1 };
        return { skin: gs, mkt: state.market[s.id] ?? { id: s.id, mult: 1, trend: 0 } };
      });

    switch (marketSort) {
      case "trending":   arr.sort((a, b) => Math.abs(b.mkt.trend) - Math.abs(a.mkt.trend)); break;
      case "rising":     arr.sort((a, b) => b.mkt.trend - a.mkt.trend); break;
      case "falling":    arr.sort((a, b) => a.mkt.trend - b.mkt.trend); break;
      case "cheap":      arr.sort((a, b) => a.skin._baseValue * a.mkt.mult - b.skin._baseValue * b.mkt.mult); break;
      case "expensive":  arr.sort((a, b) => b.skin._baseValue * b.mkt.mult - a.skin._baseValue * a.mkt.mult); break;
    }
    return arr.slice(0, 40);
  }, [skins, state, marketSort, marketSearch]);

  const filteredOrders = useMemo(() => {
    if (!state) return [];
    const q = orderSearch.trim().toLowerCase();
    if (!q) return state.orders;
    return state.orders.filter((o) => {
      const sk = skinMap.get(o.skinId);
      return sk && (sk.name + " " + sk.weapon_type).toLowerCase().includes(q);
    });
  }, [state, orderSearch, skinMap]);

  const buy = (skinId: string) => {
    setState((s) => {
      if (!s) return s;
      const sk    = skinMap.get(skinId);
      if (!sk) return s;
      const mkt   = s.market[skinId];
      const price = Math.max(1, Math.round(sk._baseValue * (mkt?.mult ?? 1)));
      if (s.vc < price) { toast.error("Not enough ValueCoin"); return s; }
      const inv      = s.inventory[skinId] ?? { id: skinId, count: 0, avgCost: 0 };
      const newCount = inv.count + 1;
      const avgCost  = (inv.avgCost * inv.count + price) / newCount;
      return { ...s, vc: s.vc - price, trades: s.trades + 1, inventory: { ...s.inventory, [skinId]: { id: skinId, count: newCount, avgCost } } };
    });
  };

  const sell = (skinId: string) => {
    setState((s) => {
      if (!s) return s;
      const inv = s.inventory[skinId];
      if (!inv || inv.count <= 0) return s;
      const sk    = skinMap.get(skinId);
      if (!sk) return s;
      const mkt   = s.market[skinId];
      const price = Math.max(1, Math.round(sk._baseValue * (mkt?.mult ?? 1)));
      const newCount = inv.count - 1;
      const newInv   = { ...s.inventory };
      if (newCount <= 0) delete newInv[skinId];
      else newInv[skinId] = { ...inv, count: newCount };
      return { ...s, vc: s.vc + price, trades: s.trades + 1, totalEarned: s.totalEarned + Math.max(0, price - inv.avgCost), inventory: newInv };
    });
  };

  const fulfill = (orderId: string) => {
    setState((s) => {
      if (!s) return s;
      const order = s.orders.find((o) => o.id === orderId);
      if (!order) return s;
      const inv = s.inventory[order.skinId];
      if (!inv || inv.count < order.qty) { toast.error("You don't have enough of that skin"); return s; }
      const newCount = inv.count - order.qty;
      const newInv   = { ...s.inventory };
      if (newCount <= 0) delete newInv[order.skinId];
      else newInv[order.skinId] = { ...inv, count: newCount };
      const payout = order.pricePer * order.qty;
      toast.success(`+${fmt(payout)} VC — order filled`);
      return { ...s, inventory: newInv, orders: s.orders.filter((o) => o.id !== orderId), vc: s.vc + payout, totalEarned: s.totalEarned + payout, ordersFilled: s.ordersFilled + 1 };
    });
  };

  const upgrades = [
    {
      key: "auto" as const, name: "Hire Negotiator", desc: "+1 VC/sec passively (also raises offline income)", icon: <Hammer className="h-4 w-4" />,
      cost: (lvl: number) => Math.round(80 * Math.pow(1.55, lvl)),
      apply: (s: SaveState) => ({ ...s, autoPerSec: s.autoPerSec + 1, upgrades: { ...s.upgrades, auto: s.upgrades.auto + 1 } }),
    },
    {
      key: "orderRate" as const, name: "Bigger Inbox", desc: "+1 max simultaneous order", icon: <Inbox className="h-4 w-4" />,
      cost: (lvl: number) => Math.round(450 * Math.pow(1.9, lvl)),
      apply: (s: SaveState) => ({ ...s, upgrades: { ...s.upgrades, orderRate: s.upgrades.orderRate + 1 } }),
    },
    {
      key: "orderPay" as const, name: "Better Rates", desc: "+7% pay on all orders", icon: <TrendingUp className="h-4 w-4" />,
      cost: (lvl: number) => Math.round(650 * Math.pow(1.75, lvl)),
      apply: (s: SaveState) => ({ ...s, upgrades: { ...s.upgrades, orderPay: s.upgrades.orderPay + 1 } }),
    },
    {
      key: "offlineEff" as const, name: "Night Shift", desc: "+10% offline income rate (capped at 8h)", icon: <Minus className="h-4 w-4" />,
      cost: (lvl: number) => Math.round(900 * Math.pow(1.85, lvl)),
      apply: (s: SaveState) => ({ ...s, upgrades: { ...s.upgrades, offlineEff: s.upgrades.offlineEff + 1 } }),
    },
  ];

  const buyUpgrade = (key: typeof upgrades[number]["key"]) => {
    setState((s) => {
      if (!s) return s;
      const u    = upgrades.find((x) => x.key === key)!;
      const lvl  = s.upgrades[key];
      const cost = u.cost(lvl);
      if (s.vc < cost) { toast.error("Not enough ValueCoin"); return s; }
      toast.success(`${u.name} — level ${lvl + 1}`);
      return u.apply({ ...s, vc: s.vc - cost });
    });
  };

  const reset = () => {
    if (!confirm("Wipe all market progress and start over?")) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY);
    setState(null);
    setTimeout(() => window.location.reload(), 50);
  };

  if (isLoading || !state) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading market…</div>;
  }

  return (
    <div className="min-h-screen pb-16">
      <GameTutorial {...tut.props} title="Market Tycoon" steps={[
        { title: "A living market", body: "Skin prices shift every couple of seconds within a realistic range — never more than 40% above or below the real value. Your goal is to grow ValueCoin (VC) by trading smart." },
        { title: "Buy low, sell high", body: "The market panel lists real skins with current prices. Sort by Rising or Falling to spot trends. Buy when a price dips, sell when it climbs back." },
        { title: "Fill orders for a bonus", body: "The orders inbox pays a premium (18–60% above market) for skins you already hold. Keep an eye on the timer — orders expire." },
        { title: "Grow passive income", body: "Upgrades on the left hire negotiators who earn VC automatically, even when you step away. Income accrues offline for up to 8 hours." },
        { title: "ValueCoin (VC)", body: "Your currency. Progress saves locally and syncs to your account when signed in — so guest progress carries over." },
      ]} />

      <header className="border-b border-border/60" style={{ background: "var(--gradient-hero)" }}>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" size="sm"><Link to="/games"><ArrowLeft className="mr-2 h-4 w-4" /> Games</Link></Button>
              <h1 className="font-display text-2xl font-bold sm:text-3xl">Market Tycoon</h1>
            </div>
            <div className="flex gap-2">
              <tut.Trigger />
              <Button variant="ghost" size="sm" onClick={reset}><RotateCcw className="mr-2 h-4 w-4" /> Reset</Button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="ValueCoin" value={fmt(state.vc)} highlight />
            <Stat label="Portfolio" value={fmt(portfolioValue)} />
            <Stat label="Per sec" value={`+${state.autoPerSec}`} />
            <Stat label="Orders filled" value={String(state.ordersFilled)} />
          </div>
          {offlineEarned != null && offlineEarned > 1 && (
            <div className="mt-3 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
              Your negotiators earned <span className="font-mono font-bold text-primary">{fmt(offlineEarned)} VC</span> while you were away.
              <button className="ml-2 text-xs underline" onClick={() => setOfflineEarned(null)}>dismiss</button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-12 lg:px-8">
        {/* Upgrades */}
        <div className="space-y-4 lg:col-span-3">
          <Card className="p-4">
            <div className="mb-3 text-sm font-semibold">Upgrades</div>
            <div className="space-y-2">
              {upgrades.map((u) => {
                const lvl  = state.upgrades[u.key];
                const cost = u.cost(lvl);
                const can  = state.vc >= cost;
                return (
                  <button key={u.key} onClick={() => buyUpgrade(u.key)} disabled={!can}
                    className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${can ? "border-primary/40 hover:bg-primary/10" : "border-border/60 opacity-60"}`}>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {u.icon} {u.name}
                      <span className="ml-auto text-xs text-muted-foreground">lvl {lvl}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{u.desc}</div>
                    <div className="mt-1 text-xs font-mono text-primary">{fmt(cost)} VC</div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Orders */}
        <div className="space-y-4 lg:col-span-5">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Inbox className="h-4 w-4 text-primary" /> Orders
              </div>
              <Badge variant="outline">{state.orders.length}/{Math.min(ORDER_MAX, 3 + state.upgrades.orderRate)}</Badge>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} placeholder="Filter orders…" className="pl-9 h-9" />
            </div>
            {filteredOrders.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {orderSearch ? "No matching orders." : "No orders yet — they'll appear shortly."}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredOrders.map((o) => {
                  const sk   = skinMap.get(o.skinId);
                  if (!sk) return null;
                  const have   = state.inventory[o.skinId]?.count ?? 0;
                  const can    = have >= o.qty;
                  const remain = Math.max(0, o.expiresAt - Date.now());
                  return (
                    <div key={o.id} className="rounded-md border border-border/60 p-3">
                      <div className="flex items-center gap-3">
                        <SkinImage src={sk.image_url} alt={sk.name} className="h-12 w-12" fallbackLabel={sk.name} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{sk.name}</div>
                          <div className="text-xs text-muted-foreground">{sk.weapon_type} · {sk.season}</div>
                          <div className="mt-1 text-xs">
                            Need <span className="font-bold">×{o.qty}</span> · pays <span className="font-mono text-primary">{fmt(o.pricePer * o.qty)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <Button size="sm" disabled={!can} onClick={() => fulfill(o.id)}>
                            {can ? "Fill" : `Need ${o.qty - have} more`}
                          </Button>
                          <div className="mt-1 font-mono text-[10px] text-muted-foreground">{Math.ceil(remain / 1000)}s</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Market */}
        <div className="space-y-4 lg:col-span-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Live market</div>
              <select value={marketSort} onChange={(e) => setMarketSort(e.target.value as typeof marketSort)}
                className="rounded border border-border/60 bg-background px-2 py-1 text-xs">
                <option value="trending">Most active</option>
                <option value="rising">Rising</option>
                <option value="falling">Falling</option>
                <option value="cheap">Cheapest</option>
                <option value="expensive">Most expensive</option>
              </select>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={marketSearch} onChange={(e) => setMarketSearch(e.target.value)} placeholder="Search market…" className="pl-9 h-9" />
            </div>
            <div className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
              {marketList.map(({ skin, mkt }) => {
                const price    = Math.max(1, Math.round(skin._baseValue * mkt.mult));
                const have     = state.inventory[skin.id]?.count ?? 0;
                const trendPct = mkt.trend * 100;
                const TrendIcon = trendPct > 0.2 ? TrendingUp : trendPct < -0.2 ? TrendingDown : Minus;
                const trendCol  = trendPct > 0.2 ? "text-emerald-400" : trendPct < -0.2 ? "text-rose-400" : "text-muted-foreground";
                return (
                  <div key={skin.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-card/40 p-2">
                    <SkinImage src={skin.image_url} alt={skin.name} className="h-9 w-9 shrink-0" fallbackLabel={skin.name} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold">{skin.name}</div>
                      <div className="text-[10px] text-muted-foreground">{skin.weapon_type}</div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-mono font-bold text-primary">{fmt(price)}</div>
                      <div className={`flex items-center justify-end gap-0.5 text-[10px] ${trendCol}`}>
                        <TrendIcon className="h-3 w-3" />
                        {Math.abs(trendPct).toFixed(2)}%
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => buy(skin.id)} disabled={state.vc < price}>Buy</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => sell(skin.id)} disabled={have <= 0}>
                        Sell{have ? ` (${have})` : ""}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${highlight ? "border-primary/40 bg-primary/10" : "border-border/60 bg-card/40"}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono text-lg font-bold ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
