import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, HelpCircle } from "lucide-react";

export type TutorialStep = { title: string; body: React.ReactNode };

export function GameTutorial({ storageKey, title, steps, open, onOpenChange }: {
  storageKey: string; title: string; steps: TutorialStep[]; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const [i, setI] = useState(0);
  useEffect(() => { if (open) setI(0); }, [open]);

  const step = steps[i];
  const last = i === steps.length - 1;

  const dismiss = () => {
    try { localStorage.setItem(storageKey, "1"); } catch { /* */ }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{title}</DialogTitle>
        </DialogHeader>
        <div className="min-h-[140px]">
          <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Step {i + 1} of {steps.length}</div>
          <div className="mb-1 font-semibold">{step?.title}</div>
          <div className="text-sm text-muted-foreground leading-relaxed">{step?.body}</div>
        </div>
        <div className="flex gap-1">
          {steps.map((_, idx) => (
            <div key={idx} className={`h-1 flex-1 rounded-full ${idx <= i ? "bg-primary" : "bg-secondary"}`} />
          ))}
        </div>
        <DialogFooter className="flex flex-row justify-between gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={dismiss}>Skip</Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={i === 0} onClick={() => setI((x) => x - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {last ? (
              <Button size="sm" onClick={dismiss}>Start playing</Button>
            ) : (
              <Button size="sm" onClick={() => setI((x) => x + 1)}>
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useTutorial(gameKey: string) {
  const storageKey = `valuegame.tutorial.${gameKey}.v1`;
  // Always start closed; open automatically only if never seen
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!localStorage.getItem(storageKey)) setOpen(true);
    } catch { /* ignore */ }
  }, [storageKey]);

  // Expose a stable open handler so button clicks always work
  const openTutorial = () => setOpen(true);

  const Trigger = () => (
    <Button variant="ghost" size="sm" onClick={openTutorial} title="How to play">
      <HelpCircle className="mr-2 h-4 w-4" /> How to play
    </Button>
  );

  return { Trigger, openTutorial, props: { storageKey, open, onOpenChange: setOpen } };
}
