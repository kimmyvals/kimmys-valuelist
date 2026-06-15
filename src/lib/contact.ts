import { sendContactMessage } from "./contact.functions";

export async function submitContactMessage(opts: {
  userId: string;
  username: string;
  subject: string;
  body: string;
}) {
  return sendContactMessage({ subject: opts.subject, body: opts.body });
}

export function encodeImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  try { return encodeURI(url); } catch { return url; }
}
