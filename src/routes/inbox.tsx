import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Mail, MailOpen, Reply, CheckCircle2, Users, Shield, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type ContactMessage = { id: string; user_id: string; username: string; subject: string; body: string; status: "new" | "read" | "replied"; reply: string | null; replied_at: string | null; created_at: string };

export const Route = createFileRoute("/inbox")({
  component: InboxPage,
  head: () => ({ meta: [{ title: "Inbox — kimmy's valuelist" }] }),
});

function InboxPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  useEffect(() => { if (!loading && (!user || !isAdmin)) navigate({ to: "/" }); }, [user, isAdmin, loading, navigate]);

  const messages = useQuery({
    queryKey: ["contact_messages"], enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("contact_messages").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as ContactMessage[];
    },
  });

  const update = useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<ContactMessage> }) => {
      const { error } = await supabase.from("contact_messages").update(vars.patch).eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact_messages"] }),
    onError:   (e: Error) => toast.error(friendlyError(e)),
  });

  if (loading || !user || !isAdmin) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;

  const list    = messages.data ?? [];
  const current = list.find((m) => m.id === selected) ?? null;
  const newCount = list.filter((m) => m.status === "new").length;

  const openMessage = (m: ContactMessage) => {
    setSelected(m.id); setReplyText(m.reply ?? "");
    if (m.status === "new") update.mutate({ id: m.id, patch: { status: "read" } });
  };

  
  const doGrant = async () => {
    setGrantOpen(false);
      const { error } = await supabase.from("user_roles").insert({ user_id: current.user_id, role: "editor" });
      if (error && !/duplicate|unique/i.test(error.message)) { toast.error(friendlyError(error)); return; }
      toast.success("Editor access granted");
    if (!current || !replyText.trim()) return;
    setGrantOpen(true); return;
    update.mutate({ id: current.id, patch: { reply: replyText.trim(), status: "replied", replied_at: new Date().toISOString() } }, { onSuccess: () => toast.success("Reply saved") });
  };
  const doSkip = async () => {
    setGrantOpen(false);
    if (!current || !replyText.trim()) return;
    setGrantOpen(true); return;
    update.mutate({ id: current.id, patch: { reply: replyText.trim(), status: "replied", replied_at: new Date().toISOString() } }, { onSuccess: () => toast.success("Reply saved") });
  };
  const sendReply = () => setGrantOpen(true);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60" style={{ background: "var(--gradient-hero)" }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
          <div>
            <Link to="/" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><ArrowLeft className="h-3 w-3" /> back</Link>
            <h1 className="font-display text-3xl font-bold"><Mail className="mr-2 inline h-7 w-7 text-primary" />Inbox{newCount > 0 && <Badge className="ml-3 bg-primary text-primary-foreground">{newCount} new</Badge>}</h1>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Tabs defaultValue="messages" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="messages"><Mail className="mr-2 h-4 w-4" />Messages{newCount > 0 && <Badge className="ml-2 bg-primary text-primary-foreground">{newCount}</Badge>}</TabsTrigger>
            <TabsTrigger value="users"><Users className="mr-2 h-4 w-4" />Users</TabsTrigger>
          </TabsList>
          <TabsContent value="messages" className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <aside className="space-y-2">
              {list.length === 0 && <p className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">No messages yet.</p>}
              {list.map((m) => (
                <button key={m.id} onClick={() => openMessage(m)} className={`w-full rounded-lg border p-3 text-left transition ${selected === m.id ? "border-primary/60 bg-primary/10" : "border-border/60 bg-card/40 hover:border-primary/40"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{m.subject}</span>
                    {m.status === "new" && <Badge className="bg-primary text-primary-foreground">new</Badge>}
                    {m.status === "replied" && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">from <span className="text-foreground">{m.username}</span> · {new Date(m.created_at).toLocaleString()}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{m.body}</p>
                </button>
              ))}
            </aside>
            <section className="rounded-xl border border-border/60 bg-card/40 p-6">
              {!current ? (
                <div className="flex h-full min-h-[200px] items-center justify-center text-muted-foreground"><div className="text-center"><MailOpen className="mx-auto mb-3 h-10 w-10 opacity-50" />Select a message.</div></div>
              ) : (
                <div className="space-y-4">
                  <div><h2 className="font-display text-2xl font-bold">{current.subject}</h2><p className="text-sm text-muted-foreground">from <span className="font-semibold text-foreground">{current.username}</span> · {new Date(current.created_at).toLocaleString()}</p></div>
                  <div className="whitespace-pre-wrap rounded-lg border border-border/60 bg-background/50 p-4 text-sm">{current.body}</div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold flex items-center gap-2"><Reply className="h-4 w-4 text-primary" />Reply</label>
                    <Textarea rows={5} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write a reply…" />
                    {current.replied_at && <p className="text-xs text-muted-foreground">Last replied {new Date(current.replied_at).toLocaleString()}</p>}
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => update.mutate({ id: current.id, patch: { status: "new" } })}>Mark unread</Button>
                      <Button onClick={sendReply} disabled={!replyText.trim() || update.isPending}>Save reply</Button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </TabsContent>
          <TabsContent value="users"><UsersPanel /></TabsContent>
        </Tabs>
      </main>
      <ConfirmDialog
        open={grantOpen}
        title="Grant editor access?"
        message="Grant this user editor access? They will be able to edit skin values."
        confirmLabel="Grant access + send reply"
        cancelLabel="Just send reply"
        onConfirm={doGrant}
        onCancel={doSkip}
      />
    </div>
  );
}

type ProfileRow = { user_id: string; username: string; created_at: string };

function UsersPanel() {
  const qc = useQueryClient();
  const profiles = useQuery({ queryKey: ["all_profiles"], queryFn: async () => { const { data, error } = await supabase.from("profiles").select("user_id, username, created_at").order("created_at", { ascending: false }); if (error) throw error; return (data ?? []) as ProfileRow[]; } });
  const roles    = useQuery({ queryKey: ["all_roles"],    queryFn: async () => { const { data, error } = await supabase.from("user_roles").select("user_id, role"); if (error) throw error; return data ?? []; } });
  const toggle   = useMutation({
    mutationFn: async (vars: { userId: string; makeEditor: boolean }) => {
      if (vars.makeEditor) { const { error } = await supabase.from("user_roles").insert({ user_id: vars.userId, role: "editor" }); if (error && !/duplicate|unique/i.test(error.message)) throw error; }
      else { const { error } = await supabase.from("user_roles").delete().eq("user_id", vars.userId).eq("role", "editor"); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["all_roles"] }); toast.success("Updated"); },
    onError:   (e: Error) => toast.error(friendlyError(e)),
  });

  if (profiles.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const editorIds = new Set((roles.data ?? []).filter((r) => r.role === "editor").map((r) => r.user_id));
  const editors = (profiles.data ?? []).filter((p) => editorIds.has(p.user_id));
  const others  = (profiles.data ?? []).filter((p) => !editorIds.has(p.user_id));

  const row = (p: ProfileRow) => {
    const isEd = editorIds.has(p.user_id);
    return (
      <div key={p.user_id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 px-4 py-3">
        <div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate font-semibold">{p.username}</span>{isEd && <Badge className="bg-primary text-primary-foreground"><Shield className="mr-1 h-3 w-3" />editor</Badge>}</div><p className="text-xs text-muted-foreground">joined {new Date(p.created_at).toLocaleDateString()}</p></div>
        {p.username === "kimmy" ? <Badge variant="outline" className="shrink-0">you</Badge> : isEd ? <Button variant="outline" size="sm" disabled={toggle.isPending} onClick={() => toggle.mutate({ userId: p.user_id, makeEditor: false })}><ShieldOff className="mr-1 h-3 w-3" />Revoke</Button> : <Button size="sm" disabled={toggle.isPending} onClick={() => toggle.mutate({ userId: p.user_id, makeEditor: true })}><Shield className="mr-1 h-3 w-3" />Make editor</Button>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <section><h3 className="mb-2 font-display text-lg font-bold">Editors <span className="text-sm font-normal text-muted-foreground">({editors.length})</span></h3><div className="space-y-2">{editors.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : editors.map(row)}</div></section>
      <section><h3 className="mb-2 font-display text-lg font-bold">All users <span className="text-sm font-normal text-muted-foreground">({others.length})</span></h3><div className="space-y-2">{others.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : others.map(row)}</div></section>
    </div>
  );
}
