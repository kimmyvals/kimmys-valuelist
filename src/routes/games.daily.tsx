import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Flame, Trophy } from "lucide-react";
import { toast } from "sonner";
import type { Skin } from "@/components/SkinCard";
import { SkinImage } from "@/components/SkinImage";
import { useAuth } from "@/lib/auth";
import { useCloudSave } from "@/lib/use-cloud-save";
import { GameTutorial, useTutorial } from "@/components/GameTutorial";
import { dailyRng, getDailyLeaderboard, submitDailyScore, todayKey } from "@/lib/daily.functions";

export const Route = createFileRoute("/games/daily")({
  component: DailyGame,
  head: () => ({
    meta: [
      { title: "Daily Challenge — kimmy's valuelist" },
      { name: "description", content: "A new challenge every 24 hours. Build a streak, climb the global leaderboard." },
    ],
  }),
});

type SaveState = {
  lastPlayedDate: string | null;
  streak: number;
  bestStreak: number;
  totalPlays: number;
  rewardsVC: number;
  bestScoreByDate: Record<string, number>;
};

const STORAGE      = "valuegame.daily.v1";
const ROUND_SECONDS = 60;
const QUESTIONS     = 10;

function loadSave(): SaveState | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(STORAGE) ?? "null"); } catch { return null; }
}
function persist(s: SaveState) { try { localStorage.setItem(STORAGE, JSON.stringify(s)); } catch { /**/ } }

function snapToTick(v: number): number {
  if (v < 50)      return Math.max(1, Math.round(v));
  if (v < 100)     return Math.round(v / 5) * 5;
  if (v < 500)     return Math.round(v / 10) * 10;
  if (v < 2000)    return Math.round(v / 25) * 25;
  if (v < 10_000)  return Math.round(v / 50) * 50;
  if (v < 100_000) return Math.round(v / 100) * 100;
  return Math.round(v / 500) * 500;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function DailyGame() {
  const tut      = useTutorial("daily");
  const { user } = useAuth();
  const today    = todayKey();

  const { data: skinsAll = [], isLoading } = useQuery({
    queryKey: ["skins-daily"],
    queryFn: async () => {
      const { data, error } = await supabase.from("skins").select("*").limit(2000);
      if (error) throw error;
      return (data as unknown as Skin[]).filter((s) => Number(s.value) > 0);
    },
    staleTime: 10 * 60_000,
  });

  // Deterministic question set for the day — same for everyone worldwide
  const dailyQuestions = useMemo(() => {
    if (!skinsAll.length) return [];
    const rng  = dailyRng(today);
    const pool = [...skinsAll];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, QUESTIONS).map((skin) => {
      const real = Math.round(Number(skin.value));
      const tick = real >= 500 ? 50 : real >= 100 ? 10 : 5;
      const dist = new Set<number>();
      let guard  = 0;
      while (dist.size < 3 && guard++ < 40) {
        const factor = 0.55 + rng() * 1.1;
        let v = snapToTick(Math.max(1, Math.round(real * factor)));
        if (v === real) v = snapToTick(real + tick * (rng() < 0.5 ? -1 : 1));
        if (v !== real && v > 0) dist.add(v);
      }
      const choices = [real, ...Array.from(dist)];
      for (let i = choices.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [choices[i], choices[j]] = [choices[j], choices[i]];
      }
      return { skin, real, choices };
    });
  }, [skinsAll, today]);

  // Save state
  const [save, setSave] = useState<SaveState | null>(null);
  useEffect(() => {
    if (save) return;
    setSave(loadSave() ?? { lastPlayedDate: null, streak: 0, bestStreak: 0, totalPlays: 0, rewardsVC: 0, bestScoreByDate: {} });
  }, [save]);
  useEffect(() => { if (save) persist(save); }, [save]);
  useCloudSave({ key: "daily", storageKey: STORAGE, state: save, setState: setSave });

  // Game flow
  const [phase, setPhase]   = useState<"intro" | "playing" | "done">("intro");
  const [qIdx, setQIdx]     = useState(0);
  const [score, setScore]   = useState(0);
  const [combo, setCombo]   = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [picked, setPicked] = useState<number | null>(null);
  const timerRef            = useRef<number | null>(null);

  useEffect(() => () => { if (timerRef.current) window.clearInterval(timerRef.current); }, []);

  const startRound = () => {
    setPhase("playing");
    setQIdx(0); setScore(0); setCombo(0); setPicked(null);
    setTimeLeft(ROUND_SECONDS);
    timerRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          finishRound(0);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const submitScore = submitDailyScore;

  const finishRound = (extra: number) => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    const finalScore = score + extra;
    setScore(finalScore);
    setPhase("done");
    setSave((s) => {
      if (!s) return s;
      const alreadyToday = s.lastPlayedDate === today;
      const newStreak    = alreadyToday ? s.streak : (s.lastPlayedDate === yesterdayKey() ? s.streak + 1 : 1);
      const bestForDay   = Math.max(s.bestScoreByDate[today] ?? 0, finalScore);
      const milestone    = !alreadyToday && newStreak > 0 && newStreak % 7 === 0;
      const reward       = milestone ? 500 + newStreak * 100 : 0;
      if (milestone) toast.success(`${newStreak}-day streak — earned ${reward} VC (claim in Market)`);
      return {
        ...s,
        lastPlayedDate:   today,
        streak:           newStreak,
        bestStreak:       Math.max(s.bestStreak, newStreak),
        totalPlays:       s.totalPlays + (alreadyToday ? 0 : 1),
        rewardsVC:        s.rewardsVC + reward,
        bestScoreByDate:  { ...s.bestScoreByDate, [today]: bestForDay },
      };
    });
    if (user && finalScore > 0) {
      submitScore(finalScore).catch(() => {/* silent */});
    }
  };

  const submitAnswer = (choice: number) => {
    if (picked != null) return;
    setPicked(choice);
    const q        = dailyQuestions[qIdx];
    const correct  = choice === q.real;
    const newCombo = correct ? combo + 1 : 0;
    const gained   = correct ? 100 + Math.min(200, newCombo * 25) + Math.floor(timeLeft / QUESTIONS) * 5 : 0;
    setScore((s) => s + gained);
    setCombo(newCombo);
    window.setTimeout(() => {
      setPicked(null);
      if (qIdx + 1 >= dailyQuestions.length) finishRound(0);
      else setQIdx((i) => i + 1);
    }, 600);
  };

  // Leaderboard
  const { data: leaderboard } = useQuery({
    queryKey: ["daily-leaderboard", today, phase],
    queryFn:  () => getDailyLeaderboard(),
    refetchInterval: phase === "done" ? 15_000 : false,
  });

  if (isLoading || !dailyQuestions.length || !save) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading today's challenge…</div>;
  }

  return (
    <div className="min-h-screen pb-16">
      <GameTutorial {...tut.props} title="Daily Challenge" steps={[
        { title: "One round per day", body: "Ten questions unlock every day at midnight UTC. Everyone worldwide gets the same set, so scores on the leaderboard are directly comparable." },
        { title: "Keep your streak alive", body: "Play every day to keep your streak going. Every seventh consecutive day earns a ValueCoin bonus — and the longer your streak, the bigger the payout." },
        { title: "Score higher with combos", body: "Correct answers in a row build a combo multiplier. You also get a small bonus for the time you have left on the clock, so answering quickly matters." },
        { title: "Leaderboard", body: "Sign in to post your score. Scores are public — only your best attempt of the day is kept." },
      ]} />

      <header className="border-b border-border/60" style={{ background: "var(--gradient-hero)" }}>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" size="sm">
                <Link to="/games"><ArrowLeft className="mr-2 h-4 w-4" /> Games</Link>
              </Button>
              <h1 className="font-display text-2xl font-bold sm:text-3xl">Daily Challenge</h1>
            </div>
            <tut.Trigger />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={<Calendar className="h-4 w-4 text-primary" />}        label="Today"      value={today}                              />
            <Stat icon={<Flame className="h-4 w-4 text-orange-400" />}        label="Streak"     value={String(save.streak)}                />
            <Stat icon={<Trophy className="h-4 w-4 text-yellow-400" />}       label="Best streak" value={String(save.bestStreak)}           />
            <Stat icon={<Trophy className="h-4 w-4 text-amber-300" />}        label="Today best"  value={String(save.bestScoreByDate[today] ?? 0)} />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-3">
        {/* Game area */}
        <div className="lg:col-span-2">
          {phase === "intro" && (
            <Card className="p-6 text-center">
              <h2 className="font-display text-2xl font-bold">Ready?</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {QUESTIONS} questions · {ROUND_SECONDS}s · combo and time bonuses
              </p>
              {save.lastPlayedDate === today && (
                <p className="mt-2 text-xs text-muted-foreground">
                  You've already played today. Replaying won't update your streak.
                </p>
              )}
              <Button onClick={startRound} size="lg" className="mt-6">Start</Button>
              {!user && (
                <p className="mt-3 text-xs text-muted-foreground">Sign in to post your score to the leaderboard.</p>
              )}
            </Card>
          )}

          {phase === "playing" && (() => {
            const q = dailyQuestions[qIdx];
            return (
              <Card className="p-6">
                <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Question {qIdx + 1} of {dailyQuestions.length}</span>
                  <span className="font-mono text-foreground">{timeLeft}s</span>
                </div>
                <div className="mx-auto mb-4 h-40 w-full max-w-xs rounded-lg border border-border/60 bg-secondary/40 p-2">
                  <SkinImage src={q.skin.image_url} alt={q.skin.name} className="h-full w-full" />
                </div>
                <div className="text-center">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">What is the value of</div>
                  <div className="font-display text-xl font-bold">
                    {q.skin.name} <span className="text-muted-foreground">({q.skin.weapon_type})</span>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {q.choices.map((c) => {
                    const isPicked  = picked === c;
                    const isCorrect = picked != null && c === q.real;
                    const isWrong   = isPicked && c !== q.real;
                    return (
                      <button
                        key={c}
                        disabled={picked != null}
                        onClick={() => submitAnswer(c)}
                        className={`rounded-lg border-2 px-4 py-3 font-mono text-sm font-medium transition-all ${
                          isCorrect ? "border-green-500 bg-green-500/15" :
                          isWrong   ? "border-red-500 bg-red-500/15" :
                          "border-border/60 hover:border-primary/60 hover:bg-primary/5"
                        }`}
                      >
                        {c.toLocaleString()}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Score</span>
                  <span className="font-mono text-lg font-bold text-primary">{score}</span>
                </div>
                {combo > 0 && (
                  <div className="mt-1 text-right text-xs text-amber-300">{combo}× combo</div>
                )}
              </Card>
            );
          })()}

          {phase === "done" && (
            <Card className="p-6 text-center">
              <h2 className="font-display text-2xl font-bold">Round complete</h2>
              <div className="mt-2 font-mono text-5xl font-bold text-primary">{score}</div>
              <div className="mt-2 text-xs text-muted-foreground">
                Streak: {save.streak} day{save.streak === 1 ? "" : "s"}
              </div>
              <Button onClick={startRound} variant="outline" className="mt-6">
                Play again (streak won't change)
              </Button>
            </Card>
          )}
        </div>

        {/* Leaderboard */}
        <div>
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">Today's leaderboard</div>
              <Badge variant="outline">{leaderboard?.entries.length ?? 0}</Badge>
            </div>
            {!leaderboard || leaderboard.entries.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No scores yet — be first.</p>
            ) : (
              <ol className="space-y-1">
                {leaderboard.entries.map((e, i) => (
                  <li key={i} className="flex items-center justify-between rounded border border-border/60 bg-card/40 px-2 py-1 text-xs">
                    <span className="flex items-center gap-2">
                      <span className="w-5 font-mono text-muted-foreground">#{i + 1}</span>
                      <span className="truncate font-medium">{e.username}</span>
                    </span>
                    <span className="font-mono font-bold text-primary">{e.score}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">{icon} {label}</div>
      <div className="font-mono text-base font-bold truncate">{value}</div>
    </div>
  );
}
