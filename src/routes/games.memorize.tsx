import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Flame, Target, Check, X, RefreshCw, Trophy } from "lucide-react";
import { toast } from "sonner";
import type { Skin } from "@/components/SkinCard";
import { SkinImage } from "@/components/SkinImage";
import { useCloudSave } from "@/lib/use-cloud-save";
import { GameTutorial, useTutorial } from "@/components/GameTutorial";

export const Route = createFileRoute("/games/memorize")({
  component: MemorizeGame,
  head: () => ({
    meta: [
      { title: "Value Trainer — kimmy's valuelist" },
      { name: "description", content: "Drill the Criminality value list with four rotating quiz modes." },
    ],
  }),
});

// Only value-based and image-based modes — no demand or unboxed questions
type Mode = "name-from-image" | "value-of-skin" | "true-or-false" | "image-from-name";
type Difficulty = "easy" | "medium" | "hard";

const MODES: { key: Mode; label: string; needsImage: boolean }[] = [
  { key: "name-from-image", label: "Name the skin",   needsImage: true  },
  { key: "value-of-skin",   label: "Pick the value",  needsImage: false },
  { key: "true-or-false",   label: "True or False",   needsImage: false },
  { key: "image-from-name", label: "Pick the image",  needsImage: true  },
];

const STORAGE = "valuegame.memorize.v1";
type Stats = { streak: number; best: number; answered: number; correct: number };

function loadStats(): Stats {
  if (typeof window === "undefined") return { streak: 0, best: 0, answered: 0, correct: 0 };
  try { return JSON.parse(localStorage.getItem(STORAGE) ?? "") || { streak: 0, best: 0, answered: 0, correct: 0 }; }
  catch { return { streak: 0, best: 0, answered: 0, correct: 0 }; }
}
function saveStats(s: Stats) { try { localStorage.setItem(STORAGE, JSON.stringify(s)); } catch { /**/ } }

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle<T>(arr: T[]): T[] { return [...arr].sort(() => Math.random() - 0.5); }

/**
 * Round distractor values to a plausible tick so players can't dismiss them
 * at a glance. Snaps to larger increments for higher-value skins.
 */
function snapToTick(v: number): number {
  if (v < 50)       return Math.max(1, Math.round(v));
  if (v < 100)      return Math.round(v / 5) * 5;
  if (v < 500)      return Math.round(v / 10) * 10;
  if (v < 2000)     return Math.round(v / 25) * 25;
  if (v < 10_000)   return Math.round(v / 50) * 50;
  if (v < 100_000)  return Math.round(v / 100) * 100;
  return Math.round(v / 500) * 500;
}

type Question =
  | { kind: "name-from-image"; skin: Skin; choices: Skin[]   }
  | { kind: "value-of-skin";   skin: Skin; choices: number[] }
  | { kind: "true-or-false";   skin: Skin; shown: number; correct: boolean }
  | { kind: "image-from-name"; skin: Skin; choices: Skin[]   };

function MemorizeGame() {
  const tut = useTutorial("memorize");

  const { data: skinsRaw = [], isLoading } = useQuery({
    queryKey: ["skins-train"],
    queryFn: async () => {
      const { data, error } = await supabase.from("skins").select("*").limit(2000);
      if (error) throw error;
      return (data as unknown as Skin[]).filter((s) => Number(s.value) > 0);
    },
    staleTime: 5 * 60_000,
  });

  const [mode, setMode]             = useState<Mode | "random">("random");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [stats, setStats]           = useState<Stats>(() => loadStats());
  useEffect(() => saveStats(stats), [stats]);
  useCloudSave({ key: "memorize", storageKey: STORAGE, state: stats, setState: setStats });

  const pool = useMemo(() => {
    const wantedRarities =
      difficulty === "easy"   ? ["Legendary", "Exotic"] :
      difficulty === "medium" ? ["Legendary", "Exotic", "Epic"] :
      null;
    return wantedRarities ? skinsRaw.filter((s) => wantedRarities.includes(s.rarity)) : skinsRaw;
  }, [skinsRaw, difficulty]);

  const imagePool = useMemo(() => pool.filter((s) => !!s.image_url), [pool]);

  const [q, setQ]           = useState<Question | null>(null);
  const [picked, setPicked] = useState<string | number | boolean | null>(null);
  const [revealed, setRevealed] = useState(false);

  const nextQuestion = useRef<() => void>(() => {});
  nextQuestion.current = () => {
    if (pool.length < 4) return;

    let kind: Mode;
    if (mode === "random") {
      const candidates = imagePool.length >= 4 ? MODES : MODES.filter((m) => !m.needsImage);
      kind = pick(candidates).key;
    } else {
      kind = mode;
    }

    // Fall back to value quiz if not enough images
    if ((kind === "name-from-image" || kind === "image-from-name") && imagePool.length < 4) {
      kind = "value-of-skin";
    }

    const sourcePool = (kind === "name-from-image" || kind === "image-from-name") ? imagePool : pool;
    const skin = pick(sourcePool);

    if (kind === "value-of-skin") {
      const real = Math.round(Number(skin.value));
      const distractors = new Set<number>();
      let guard = 0;
      while (distractors.size < 3 && guard++ < 50) {
        const factor = 0.55 + Math.random() * 1.1;
        let v = snapToTick(Math.round(real * factor));
        if (v === real) v = snapToTick(real + (Math.random() < 0.5 ? -1 : 1) * Math.max(5, Math.round(real * 0.08)));
        if (v <= 0) v = snapToTick(real + 50);
        if (v !== real) distractors.add(v);
      }
      setQ({ kind, skin, choices: shuffle([real, ...Array.from(distractors)]) });

    } else if (kind === "true-or-false") {
      const real    = Math.round(Number(skin.value));
      const truthy  = Math.random() < 0.5;
      let shown     = real;
      if (!truthy) {
        const factor = 0.6 + Math.random() * 0.9;
        shown = snapToTick(Math.max(1, Math.round(real * factor)));
        if (shown === real) shown = snapToTick(real + Math.max(5, Math.round(real * 0.08)));
      }
      setQ({ kind, skin, shown, correct: shown === real });

    } else {
      // name-from-image or image-from-name
      const others  = shuffle(sourcePool.filter((s) => s.id !== skin.id)).slice(0, 3);
      setQ({ kind, skin, choices: shuffle([skin, ...others]) });
    }

    setPicked(null);
    setRevealed(false);
  };

  useEffect(() => { if (pool.length >= 4 && !q) nextQuestion.current(); }, [pool, q]);
  // Re-pick when mode or difficulty changes
  useEffect(() => {
    if (pool.length >= 4) nextQuestion.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, difficulty]);

  const submit = (answer: string | number | boolean) => {
    if (!q || revealed) return;
    setPicked(answer);
    setRevealed(true);

    let isCorrect = false;
    if (q.kind === "value-of-skin")   isCorrect = answer === Math.round(Number(q.skin.value));
    else if (q.kind === "true-or-false") isCorrect = answer === q.correct;
    else isCorrect = answer === q.skin.id;

    setStats((s) => {
      const newStreak = isCorrect ? s.streak + 1 : 0;
      return { streak: newStreak, best: Math.max(s.best, newStreak), answered: s.answered + 1, correct: s.correct + (isCorrect ? 1 : 0) };
    });

    if (isCorrect) toast.success("Correct!");
    else toast.error("Wrong answer");
  };

  const accuracy = stats.answered === 0 ? 0 : Math.round((stats.correct / stats.answered) * 100);

  if (isLoading || pool.length < 4) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        {isLoading ? "Loading skins…" : "Not enough skins at this difficulty — try switching to Hard."}
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      <GameTutorial {...tut.props} title="Value Trainer" steps={[
        { title: "Four question types", body: "Random mode cycles through all of them: name the skin from its image, pick the right value, say whether a shown value is correct or fake, or match the image to a name." },
        { title: "Realistic distractors", body: "Wrong values are rounded to sensible price ticks — you can't spot them by looking for an obviously odd number. You actually need to know the list." },
        { title: "Build a streak", body: "Every correct answer extends your streak. Your best streak and accuracy are saved. Pick Easy to focus on the top rarities, or Hard to drill everything." },
      ]} />

      <header className="border-b border-border/60" style={{ background: "var(--gradient-hero)" }}>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" size="sm">
                <Link to="/games"><ArrowLeft className="mr-2 h-4 w-4" /> Games</Link>
              </Button>
              <h1 className="font-display text-2xl font-bold sm:text-3xl">Value Trainer</h1>
            </div>
            <tut.Trigger />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={<Flame className="h-4 w-4 text-orange-400" />}  label="Streak"   value={String(stats.streak)}   />
            <Stat icon={<Trophy className="h-4 w-4 text-yellow-400" />} label="Best"     value={String(stats.best)}     />
            <Stat icon={<Target className="h-4 w-4 text-green-400" />}  label="Accuracy" value={`${accuracy}%`}         />
            <Stat icon={<Check className="h-4 w-4 text-primary" />}     label="Answered" value={String(stats.answered)} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {/* Mode and difficulty pills */}
        <div className="mb-4 flex flex-wrap gap-2">
          <Pill active={mode === "random"} onClick={() => setMode("random")}>Random</Pill>
          {MODES.map((m) => (
            <Pill key={m.key} active={mode === m.key} onClick={() => setMode(m.key)}>{m.label}</Pill>
          ))}
          <div className="ml-auto flex gap-1">
            {(["easy", "medium", "hard"] as const).map((d) => (
              <Pill key={d} active={difficulty === d} onClick={() => setDifficulty(d)} capitalize>{d}</Pill>
            ))}
          </div>
        </div>

        {q && (
          <Card className="overflow-hidden p-6">
            <QuestionView q={q} picked={picked} revealed={revealed} onPick={submit} />
            {revealed && (
              <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4">
                <div className="text-sm">
                  <span className="text-muted-foreground">Answer: </span>
                  <span className="font-semibold">{q.skin.name}</span>
                  <span className="text-muted-foreground"> · value </span>
                  <span className="font-mono text-primary">{Math.round(Number(q.skin.value)).toLocaleString()}</span>
                </div>
                <Button onClick={() => nextQuestion.current()}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Next
                </Button>
              </div>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}

// ---- Question renderer ----
function QuestionView({
  q, picked, revealed, onPick,
}: { q: Question; picked: string | number | boolean | null; revealed: boolean; onPick: (a: string | number | boolean) => void }) {

  if (q.kind === "name-from-image") {
    return (
      <div>
        <p className="mb-4 text-sm text-muted-foreground">What skin is this?</p>
        <div className="mx-auto mb-6 h-48 w-full rounded-lg border border-border/60 bg-secondary/40 p-4">
          <SkinImage src={q.skin.image_url} alt="mystery skin" className="h-full w-full" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {q.choices.map((c) => (
            <ChoiceButton
              key={c.id}
              active={picked === c.id}
              correct={revealed && c.id === q.skin.id}
              wrong={revealed && picked === c.id && c.id !== q.skin.id}
              onClick={() => onPick(c.id)}
              disabled={revealed}
            >
              {c.name}
            </ChoiceButton>
          ))}
        </div>
      </div>
    );
  }

  if (q.kind === "image-from-name") {
    return (
      <div>
        <p className="mb-2 text-sm text-muted-foreground">Which image is</p>
        <p className="mb-4 font-display text-2xl font-bold">
          {q.skin.name}
          <span className="text-muted-foreground text-base"> ({q.skin.weapon_type})</span>
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {q.choices.map((c) => (
            <button
              key={c.id}
              disabled={revealed}
              onClick={() => onPick(c.id)}
              className={`relative flex h-28 items-center justify-center rounded-lg border-2 bg-secondary/40 p-2 transition-all ${
                revealed && c.id === q.skin.id ? "border-green-500 ring-2 ring-green-500/40" :
                revealed && picked === c.id    ? "border-red-500" :
                "border-border/60 hover:border-primary/60"
              }`}
            >
              <SkinImage src={c.image_url} alt={c.name} className="h-full w-full" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (q.kind === "value-of-skin") {
    const real = Math.round(Number(q.skin.value));
    return (
      <div>
        <p className="mb-1 text-sm text-muted-foreground">What is the value of</p>
        <p className="mb-4 font-display text-2xl font-bold">
          {q.skin.name}
          <span className="text-muted-foreground text-base"> ({q.skin.weapon_type} · {q.skin.season})</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {q.choices.map((c) => (
            <ChoiceButton
              key={c}
              active={picked === c}
              correct={revealed && c === real}
              wrong={revealed && picked === c && c !== real}
              onClick={() => onPick(c)}
              disabled={revealed}
            >
              <span className="font-mono">{c.toLocaleString()}</span>
            </ChoiceButton>
          ))}
        </div>
      </div>
    );
  }

  // true-or-false
  return (
    <div>
      <p className="mb-1 text-sm text-muted-foreground">Is this value correct for</p>
      <p className="font-display text-xl font-bold">
        {q.skin.name}
        <span className="text-muted-foreground text-base"> ({q.skin.weapon_type})</span>
      </p>
      <div className="my-6 text-center">
        <div className="font-mono text-5xl font-bold text-primary">{q.shown.toLocaleString()}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ChoiceButton
          active={picked === true}
          correct={revealed && q.correct}
          wrong={revealed && picked === true && !q.correct}
          onClick={() => onPick(true)}
          disabled={revealed}
        >
          <Check className="mr-2 inline h-5 w-5" /> Correct
        </ChoiceButton>
        <ChoiceButton
          active={picked === false}
          correct={revealed && !q.correct}
          wrong={revealed && picked === false && q.correct}
          onClick={() => onPick(false)}
          disabled={revealed}
        >
          <X className="mr-2 inline h-5 w-5" /> Fake
        </ChoiceButton>
      </div>
    </div>
  );
}

function ChoiceButton({
  children, onClick, disabled, active, correct, wrong,
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean; correct?: boolean; wrong?: boolean }) {
  let cls = "border-border/60 hover:border-primary/60 hover:bg-primary/5";
  if (correct) cls = "border-green-500 bg-green-500/15 text-green-100";
  else if (wrong)  cls = "border-red-500 bg-red-500/15 text-red-100";
  else if (active) cls = "border-primary/60 bg-primary/10";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border-2 px-4 py-3 text-left text-sm font-medium transition-all disabled:cursor-default ${cls}`}
    >
      {children}
    </button>
  );
}

function Pill({ children, active, onClick, capitalize }: { children: React.ReactNode; active?: boolean; onClick: () => void; capitalize?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${capitalize ? "capitalize" : ""} ${
        active ? "border-primary bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:bg-secondary/50"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">{icon} {label}</div>
      <div className="font-mono text-lg font-bold">{value}</div>
    </div>
  );
}
