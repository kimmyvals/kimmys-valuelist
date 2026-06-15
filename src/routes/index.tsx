import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, LogIn, LogOut, Scale, Mail, Inbox, RefreshCw, Gamepad2 } from "lucide-react";
import { SkinCard, type Skin } from "@/components/SkinCard";
import { SkinDialog } from "@/components/SkinDialog";
import { RARITIES } from "@/lib/skin-options";
import { SettingsMenu } from "@/components/SettingsMenu";
import { AuthDialog } from "@/components/AuthDialog";
import { ContactDialog } from "@/components/ContactDialog";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings";
import { THEME_ICON } from "@/lib/theme-icons";
import { syncFromGoogleSheet, getSyncStatus } from "@/lib/sync.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "kimmy's valuelist — Skin Values & Trade Tracker" },
      { name: "description", content: "kimmy's valuelist: community-driven skin value list. Search, sort and filter by weapon, case and rarity." },
    ],
  }),
});

type Sort = "value-desc" | "value-asc" | "name-asc" | "updated-desc";

function Index() {
  const [tab, setTab]               = useState<"main" | "exotics">("main");
  const [search, setSearch]         = useState("");
  const [weapon, setWeapon]         = useState("all");
  const [caseFilter, setCaseFilter] = useState("all");
  const [rarity, setRarity]         = useState("all");
  const [sort, setSort]             = useState<Sort>("value-desc");
  const [selected, setSelected]     = useState<Skin | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isNew, setIsNew]           = useState(false);
  const [authOpen, setAuthOpen]     = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const { user, username, isEditor, isAdmin } = useAuth();
  const [settings] = useSettings();
  const ThemeIcon = THEME_ICON[settings.theme];

  const qc = useQueryClient();
  const { data: skins = [], isLoading } = useQuery({
    queryKey: ["skins"],
    queryFn: async () => {
      const { data, error } = await supabase.from("skins").select("*").limit(1000);
      if (error) throw error;
      return data as unknown as Skin[];
    },
  });

  const { data: syncStatus } = useQuery({ queryKey: ["sync-status"], queryFn: () => getSyncStatus(), refetchInterval: 60_000, staleTime: 30_000 });
  const syncMut    = useMutation({
    mutationFn: () => syncFromGoogleSheet(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["skins"] });
      qc.invalidateQueries({ queryKey: ["sync-status"] });
      if (res.skipped) toast.message("Sheet already synced recently — skipped.");
      else if (res.errors.length) toast.error(`Sync issues: ${res.errors.join("; ")}`);
      else toast.success(`Synced ${res.main + res.exotics} skins from sheet.`);
    },
    onError: () => toast.error("Sync failed. Please try again."),
  });

  const lastSyncedLabel = useMemo(() => {
    const ts = syncStatus?.lastSyncedAt;
    if (!ts) return "Never synced";
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "Synced just now";
    if (mins < 60) return `Synced ${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Synced ${hrs}h ago`;
    return `Synced ${Math.floor(hrs / 24)}d ago`;
  }, [syncStatus?.lastSyncedAt]);

  const tabSkins = useMemo(() => skins.filter((s) => (s.section ?? "main") === tab), [skins, tab]);
  const weapons  = useMemo(() => Array.from(new Set(tabSkins.map((s) => s.weapon_type))).sort(), [tabSkins]);
  const splitCases = (s: string) => (s ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  const cases = useMemo(() => {
    if (tab === "exotics") { const set = new Set<string>(); tabSkins.forEach((s) => splitCases(s.season).forEach((t) => set.add(t))); return Array.from(set).sort(); }
    return Array.from(new Set(tabSkins.map((s) => s.season))).sort();
  }, [tabSkins, tab]);

  const filtered = useMemo(() => {
    const q      = search.toLowerCase().trim();
    const tokens = q.split(/\s+/).filter(Boolean);
    const WEAPON_ALIASES: Record<string, string[]> = { Wrench: ["hammer"], Balisong: ["stiletto"], "Fire Axe": ["tactical"], Machete: ["zk"], Bat: ["cricket"], Rambo: ["bowie"] };
    let out = tabSkins.filter((s) => {
      if (weapon !== "all" && s.weapon_type !== weapon) return false;
      if (caseFilter !== "all") { if (tab === "exotics") { if (!splitCases(s.season).includes(caseFilter)) return false; } else if (s.season !== caseFilter) return false; }
      if (rarity !== "all" && s.rarity !== rarity) return false;
      if (tokens.length) {
        const nicks   = (s.nickname ?? "").toLowerCase().split(",").map((n) => n.trim()).filter(Boolean);
        const aliases = tab === "exotics" ? (WEAPON_ALIASES[s.weapon_type] ?? []) : [];
        const hay     = [s.name, s.weapon_type, ...nicks, ...aliases].join(" ").toLowerCase();
        if (!tokens.every((t) => hay.includes(t))) return false;
      }
      return true;
    });
    if (settings.lowPerf) { const seen = new Set<string>(); out = out.filter((s) => { const k = `${s.name}|${s.weapon_type}|${s.season}`; if (seen.has(k)) return false; seen.add(k); return true; }); }
    return [...out].sort((a, b) => {
      switch (sort) {
        case "value-desc":   return Number(b.value) - Number(a.value);
        case "value-asc":    return Number(a.value) - Number(b.value);
        case "name-asc":     return a.name.localeCompare(b.name);
        case "updated-desc": return b.updated_at.localeCompare(a.updated_at);
      }
    });
  }, [tabSkins, weapon, caseFilter, rarity, search, sort, settings.lowPerf]);

  const openEdit = (s: Skin) => { setSelected(s); setIsNew(false); setDialogOpen(true); };
  const openNew  = ()        => { setSelected(null); setIsNew(true); setDialogOpen(true); };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60" style={{ background: "var(--gradient-hero)" }}>
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
            <div className="flex flex-col items-start gap-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <ThemeIcon className="h-3 w-3" /> Criminality Value List
              </div>
              <h1 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">
                kimmy's <span className="text-primary" style={{ textShadow: "var(--glow-primary)" }}>valuelist</span>
              </h1>
              <p className="max-w-2xl text-muted-foreground">Created as a tool to help the community. Contact @wrruf on Discord for changes.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
              <Button asChild variant="outline" size="sm"><Link to="/calculator"><Scale className="mr-2 h-4 w-4" />Trade Calc</Link></Button>
              <Button asChild variant="outline" size="sm"><Link to="/games"><Gamepad2 className="mr-2 h-4 w-4" />Games</Link></Button>
              {user && isAdmin && <Button asChild variant="outline" size="sm"><Link to="/inbox"><Inbox className="mr-2 h-4 w-4" />Inbox</Link></Button>}
              {user && <Button variant="outline" size="sm" onClick={() => setContactOpen(true)}><Mail className="mr-2 h-4 w-4" />Contact</Button>}
              {isEditor && <Button variant="outline" size="sm" onClick={() => syncMut.mutate()} disabled={syncMut.isPending} title="Pull latest values from Google Sheet"><RefreshCw className={`mr-2 h-4 w-4 ${syncMut.isPending ? "animate-spin" : ""}`} />Sync sheet</Button>}
              <SettingsMenu />
              {user ? (
                <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()}><LogOut className="mr-2 h-4 w-4" />{username ? `Sign out (${username})` : "Sign out"}</Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setAuthOpen(true)}><LogIn className="mr-2 h-4 w-4" />Sign in</Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 pt-3 sm:px-6 lg:px-8">
          {(["main", "exotics"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setWeapon("all"); setCaseFilter("all"); setRarity("all"); }}
              className={`rounded-t-lg border border-b-0 px-4 py-2 text-sm font-medium transition ${tab === t ? "border-border/60 bg-background text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t === "main" ? "Main List" : "Exotics"}
            </button>
          ))}
        </div>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name or nickname..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={weapon} onValueChange={setWeapon}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent className="max-h-72"><SelectItem value="all">All weapons</SelectItem>{weapons.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
          <Select value={caseFilter} onValueChange={setCaseFilter}><SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger><SelectContent className="max-h-72"><SelectItem value="all">All cases</SelectItem>{cases.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
          <Select value={rarity} onValueChange={setRarity}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All rarities</SelectItem>{RARITIES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}><SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="value-desc">Value: High to Low</SelectItem><SelectItem value="value-asc">Value: Low to High</SelectItem><SelectItem value="name-asc">Name: A–Z</SelectItem><SelectItem value="updated-desc">Recently updated</SelectItem></SelectContent></Select>
          {isEditor && <Button onClick={openNew} className="gap-1"><Plus className="h-4 w-4" />Add skin</Button>}
        </div>
      </section>

      <main className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-card/40" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 py-20 text-center text-muted-foreground">No skins match your filters.</div>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">Showing <span className="text-foreground font-semibold">{filtered.length}</span> of {tabSkins.length} {tab === "exotics" ? "exotics" : "skins"}</p>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {filtered.map((s) => <SkinCard key={s.id} skin={s} onClick={() => openEdit(s)} />)}
            </div>
          </>
        )}
      </main>

      <SkinDialog skin={selected} open={dialogOpen} onOpenChange={setDialogOpen} isNew={isNew} weapons={weapons} cases={cases} canEdit={isEditor} defaultSection={tab} />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      {user && <ContactDialog open={contactOpen} onOpenChange={setContactOpen} userId={user.id} username={username ?? "user"} />}

      <div className="fixed bottom-3 right-3 z-30 flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur"
        title={syncStatus?.lastSyncedAt ? new Date(syncStatus.lastSyncedAt).toLocaleString() : "Not synced yet"}>
        <RefreshCw className={`h-3 w-3 ${syncMut.isPending ? "animate-spin" : ""}`} />
        <span>{syncMut.isPending ? "Syncing…" : lastSyncedLabel}</span>
      </div>
    </div>
  );
}
