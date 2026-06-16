export function friendlyError(e: unknown): string {
  const raw = (e instanceof Error ? e.message : String(e ?? "")).toLowerCase();
  if (!raw) return "Something went wrong. Please try again.";
  if (raw.includes("unique constraint") || raw.includes("duplicate key")) return "That entry already exists.";
  if (raw.includes("violates check constraint") || raw.includes("invalid input")) return "One or more values are invalid.";
  if (raw.includes("violates foreign key")) return "Referenced item could not be found.";
  if (raw.includes("violates not-null") || raw.includes("null value")) return "Please fill in all required fields.";
  if (raw.includes("row-level security") || raw.includes("permission denied") || raw.includes("rls")) return "You don't have permission to do that.";
  if (raw.includes("rate limit") || raw.includes("too many")) return "Too many requests — wait a moment and try again.";
  if (raw.includes("invalid login") || raw.includes("invalid credentials")) return "Incorrect email or password.";
  if (raw.includes("email not confirmed")) return "Please confirm your email before signing in.";
  if (raw.includes("user already registered") || raw.includes("already been registered")) return "An account with that email already exists.";
  if (raw.includes("password") && raw.includes("weak")) return "Please choose a stronger password.";
  if (raw.includes("payload too large") || raw.includes("exceeded the maximum")) return "That file is too large.";
  if (raw.includes("mime") || raw.includes("invalid file")) return "That file type isn't supported.";
  if (raw.includes("jwt") || raw.includes("token") || raw.includes("session")) return "Your session expired — please sign in again.";
  if (raw.includes("timeout") || raw.includes("timed out") || raw.includes("aborted")) return "Request timed out — check your connection and try again.";
  if (raw.includes("network") || raw.includes("fetch") || raw.includes("failed to fetch")) return "Network error — check your connection and try again.";
  return "Something went wrong. Please try again.";
}
