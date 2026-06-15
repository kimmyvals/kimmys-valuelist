import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { submitContactMessage } from "@/lib/contact";
import { friendlyError } from "@/lib/errors";

type Props = { open: boolean; onOpenChange: (o: boolean) => void; userId: string; username: string };

export function ContactDialog({ open, onOpenChange, userId, username }: Props) {
  const [subject, setSubject] = useState("");
  const [body, setBody]       = useState("");
  const [busy, setBusy]       = useState(false);

  const send = async () => {
    if (!subject.trim() || !body.trim()) return;
    setBusy(true);
    try {
      await submitContactMessage({ userId, username, subject: subject.trim().slice(0, 200), body: body.trim().slice(0, 4000) });
      toast.success("Message sent.");
      setSubject(""); setBody("");
      onOpenChange(false);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Contact kimmy</DialogTitle>
          <DialogDescription>Send a message about value changes, errors, or requesting editor access.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea rows={6} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={send} disabled={busy || !subject.trim() || !body.trim()}>
            {busy ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
