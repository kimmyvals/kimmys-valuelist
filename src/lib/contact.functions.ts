import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const ContactSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
});

export async function sendContactMessage(opts: { subject: string; body: string }): Promise<{ id: string }> {
  const data = ContactSchema.parse(opts);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("You must be signed in to send a message.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("user_id", session.user.id)
    .maybeSingle();
  const username = profile?.username ?? "unknown";

  const { data: row, error } = await supabase
    .from("contact_messages")
    .insert({ user_id: session.user.id, username, subject: data.subject, body: data.body })
    .select()
    .single();
  if (error) {
    console.error("[contact] insert error:", error.message);
    throw new Error("Failed to send message.");
  }

  // Discord webhook — read from env at build time (VITE_ prefix exposes it client-side)
  // To keep it secret, proxy through a Cloudflare Worker or Supabase Edge Function instead.
  try {
    const webhookUrl = import.meta.env.VITE_DISCORD_WEBHOOK_URL as string | undefined;
    if (webhookUrl && webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "Valuelist Inbox",
          embeds: [{
            title: `📨 New message from ${username}`,
            description: data.body.slice(0, 1800),
            color: 0x5865f2,
            fields: [{ name: "Subject", value: data.subject.slice(0, 256) }],
            timestamp: new Date().toISOString(),
          }],
        }),
      });
      if (!res.ok) {
        console.warn("[contact] Discord webhook failed:", res.status, await res.text());
      }
    }
  } catch (e) {
    console.warn("[contact] Discord webhook error (non-fatal):", e);
  }

  return { id: row.id };
}
