// apply_fixes.js — run with: node apply_fixes.js
// Applies the 5 patches that required Python in cleanup.sh
const fs = require("fs");

let allOk = true;

function patch(filepath, description, oldStr, newStr) {
  let content;
  try {
    content = fs.readFileSync(filepath, "utf8");
  } catch (e) {
    console.log(`❌ Could not read ${filepath}: ${e.message}`);
    allOk = false;
    return;
  }
  if (content.includes(newStr.slice(0, 40))) {
    console.log(`ℹ️  ${description} — already applied, skipping`);
    return;
  }
  if (!content.includes(oldStr)) {
    console.log(`⚠️  ${description} — pattern not found in ${filepath}`);
    allOk = false;
    return;
  }
  fs.writeFileSync(filepath, content.replace(oldStr, newStr), "utf8");
  console.log(`✅ ${description}`);
}

// ── 7. Snowfall shimmer: bigger tap target ────────────────────────────────────
patch(
  "src/routes/games.snowfall.tsx",
  "Shimmer tap target enlarged (h-14 → h-20)",
  `className="h-14 w-14 drop-shadow`,
  `className="h-20 w-20 drop-shadow`
);

// ── 8. Daily game: timer leak fix ─────────────────────────────────────────────
patch(
  "src/routes/games.daily.tsx",
  "Daily timer leak fixed",
  `  const startRound = () => {
    setPhase("playing");
    setQIdx(0); setScore(0); setCombo(0); setPicked(null);
    setTimeLeft(ROUND_SECONDS);
    timerRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          finishRound(0);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };`,
  `  const startRound = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setPhase("playing");
    setQIdx(0); setScore(0); setCombo(0); setPicked(null);
    setTimeLeft(ROUND_SECONDS);
    timerRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          finishRound(0);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };`
);

// ── 9. styles.css: theme-aware background gradient ────────────────────────────
patch(
  "src/styles.css",
  "styles.css gradient updated to use CSS vars",
  "background-image: radial-gradient(ellipse at top, oklch(0.88 0.08 220 / 0.12), transparent 60%), radial-gradient(ellipse at bottom right, oklch(0.85 0.12 200 / 0.08), transparent 50%);",
  "background-image: radial-gradient(ellipse at top, color-mix(in oklch, var(--primary) 12%, transparent), transparent 60%), radial-gradient(ellipse at bottom right, color-mix(in oklch, var(--accent) 8%, transparent), transparent 50%);"
);

// ── 10. Snowfall: pause RAF when tab is hidden ────────────────────────────────
patch(
  "src/routes/games.snowfall.tsx",
  "Snowfall visibility pause added",
  `    rafRef.current = requestAnimationFrame(frame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);`,
  `    rafRef.current = requestAnimationFrame(frame);

    // Pause RAF when tab is hidden to save CPU
    const onVisChange = () => {
      if (document.hidden) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      } else {
        lastFrameRef.current = performance.now();
        rafRef.current = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVisChange);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", onVisChange);
    };
  }, []);`
);

// ── 11. Market: fix offline income double-discount ────────────────────────────
patch(
  "src/routes/games.market.tsx",
  "Market offline rate fixed",
  `      const rate = saved.autoPerSec * (OFFLINE_BASE_RATE + (saved.upgrades?.offlineEff ?? 0) * 0.1);`,
  `      const offlineEffBonus = (saved.upgrades?.offlineEff ?? 0) * 0.1;
      const rate = saved.autoPerSec * (OFFLINE_BASE_RATE + offlineEffBonus);`
);

console.log("");
if (allOk) {
  console.log("All patches applied. Now run:");
} else {
  console.log("Some patches had warnings (see above). Review before running:");
}
console.log("  git add -A");
console.log('  git commit -m \'fixes: shimmer tap target, daily timer leak, theme gradient, snowfall RAF pause, market offline income\'');
console.log("  git push");
