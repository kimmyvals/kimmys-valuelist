import { supabase } from "@/integrations/supabase/client";

/**
 * Sign in with either an email address or a username.
 * The `email_for_username` function is granted to `anon` in the migration,
 * so this works without a server-side proxy.
 */
export async function loginWithIdentifier(identifier: string, password: string): Promise<void> {
  identifier = identifier.trim();
  let email = identifier;

  if (!identifier.includes("@")) {
    const { data: lookup, error } = await supabase.rpc("email_for_username", { _username: identifier });
    if (error || !lookup) throw new Error("Invalid login credentials.");
    email = lookup as string;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Invalid login credentials.");
}
