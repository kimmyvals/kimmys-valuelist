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
  if (!url || typeof url !== "string") return "";
  try { return encodeURI(decodeURI(url)); } catch { return url; }
}
