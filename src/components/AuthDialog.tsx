import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import { loginWithIdentifier } from "@/lib/auth.functions";

type Mode = "login" | "signup" | "forgot";

export function AuthDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [mode, setMode]         = useState<Mode>("login");
  const [email, setEmail]       = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy]         = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === "login") {
        await loginWithIdentifier(email, password);
        toast.success("Signed in");
        onOpenChange(false);
      } else if (mode === "signup") {
        if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) throw new Error("Username must be 3–24 chars, letters/numbers/underscore.");
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/`, data: { username } } });
        if (error) throw error;
        toast.success("Account created — check your email to confirm.");
        onOpenChange(false);
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        toast.success("Reset link sent — check your inbox.");
        setMode("login");
      }
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const title = mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password";
  const canSubmit = !busy && (mode === "forgot" ? !!email : mode === "signup" ? !!email && !!password && !!username : !!email && !!password);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
          <DialogDescription>
            {mode === "forgot"
              ? "Enter your email and we'll send a password-reset link."
              : "Only editors can add or change skins. Anyone can browse."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>{mode === "login" ? "Email or username" : "Email"}</Label>
            <Input type={mode === "login" ? "text" : "email"} autoComplete={mode === "login" ? "username" : "email"} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {mode === "signup" && (
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="3–24 chars, a–z 0–9 _" autoComplete="username" />
            </div>
          )}
          {mode !== "forgot" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Password</Label>
                {mode === "login" && (
                  <button type="button" onClick={() => setMode("forgot")} className="text-xs text-primary underline-offset-4 hover:underline">
                    Forgot password?
                  </button>
                )}
              </div>
              <Input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
            {mode === "signup" ? "Have an account?" : mode === "forgot" ? "Back to sign in" : "Need an account?"}
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {mode === "login" ? "Sign in" : mode === "signup" ? "Sign up" : "Send link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
