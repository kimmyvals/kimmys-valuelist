import { Snowflake, Flower2, Sun, Leaf, Ghost, Heart, Clover, Flag, Zap, Moon, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Theme } from "@/lib/settings";

export const THEME_ICON: Record<Theme, LucideIcon> = {
  winter: Snowflake, spring: Flower2, summer: Sun, autumn: Leaf,
  halloween: Ghost, valentines: Heart, stpatricks: Clover, fourth: Flag,
  neon: Zap, midnight: Moon, none: Sparkles,
};

export const THEME_LABEL: Record<Theme, string> = {
  winter: "Winter", spring: "Spring", summer: "Summer", autumn: "Autumn",
  halloween: "Halloween", valentines: "Valentines", stpatricks: "St. Patrick's",
  fourth: "4th of July", neon: "Neon", midnight: "Midnight", none: "None",
};
