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

  // Discord webhook — only works if you have a Cloudflare Worker or similar proxy
  // that exposes the webhook URL. Skipped silently on static builds.
  try {
    const webhookUrl = (import.meta as Record<string, unknown> & { env?: Record<string, string> }).env?.VITE_DISCORD_WEBHOOK_URL;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "Valuelist Inbox",
          embeds: [{
            title: `New message from ${username}`,
            description: data.body.slice(0, 1800),
            color: 0x5865f2,
            fields: [{ name: "Subject", value: data.subject.slice(0, 256) }],
            timestamp: new Date().toISOString(),
          }],
        }),
      });
    }
  } catch { /* ignore — notification failure shouldn't block the message */ }

  return { id: row.id };
}
