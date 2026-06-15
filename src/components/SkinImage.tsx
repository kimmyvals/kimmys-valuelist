import { useEffect, useRef, useState } from "react";
import { encodeImageUrl } from "@/lib/contact";

/**
 * Reliable skin image renderer.
 * - Native lazy-loading + async decoding
 * - Skeleton placeholder until loaded
 * - Auto-retry up to 3× with exponential backoff + cache-bust
 * - Initials fallback when all retries fail
 */
export function SkinImage({
  src,
  alt,
  className,
  imgClassName,
  fallbackLabel,
  rounded = "rounded-md",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  imgClassName?: string;
  fallbackLabel?: string;
  rounded?: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setAttempt(0);
    setLoaded(false);
    setFailed(false);
  }, [src]);

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  if (!src || failed) {
    const initials = (fallbackLabel ?? alt ?? "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("");
    return (
      <div
        className={`flex items-center justify-center bg-secondary/40 text-muted-foreground select-none ${rounded} ${className ?? ""}`}
        aria-label={alt}
      >
        {initials ? (
          <span className="font-display text-sm font-bold tracking-wider opacity-60">{initials}</span>
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6 opacity-30" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18M3.75 3h16.5M3.75 6.75h16.5M3.75 10.5h16.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    );
  }

  const finalSrc =
    attempt === 0
      ? encodeImageUrl(src)
      : `${encodeImageUrl(src)}${src.includes("?") ? "&" : "?"}_r=${attempt}`;

  return (
    <div className={`relative overflow-hidden ${rounded} ${className ?? ""}`}>
      {!loaded && (
        <div className={`absolute inset-0 animate-pulse bg-secondary/40 ${rounded}`} aria-hidden />
      )}
      <img
        key={attempt}
        src={finalSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (attempt < 3) {
            const delay = 250 * Math.pow(2, attempt);
            timerRef.current = window.setTimeout(() => setAttempt((a) => a + 1), delay);
          } else {
            setFailed(true);
          }
        }}
        className={`relative h-full w-full transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"} ${imgClassName ?? "object-contain"}`}
      />
    </div>
  );
}
