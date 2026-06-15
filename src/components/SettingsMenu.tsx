import { Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings, type Theme } from "@/lib/settings";
import { THEME_LABEL } from "@/lib/theme-icons";

const THEMES = Object.keys(THEME_LABEL) as Theme[];

export function SettingsMenu() {
  const [settings, update] = useSettings();
  const intensity = settings.effectIntensity ?? 1;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Settings">
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-[80vh] w-72 space-y-4 overflow-y-auto">
        <h4 className="font-semibold">Display</h4>

        <div className="space-y-2">
          <Label>Seasonal theme</Label>
          <Select value={settings.theme} onValueChange={(v) => { if (v !== settings.theme) update({ theme: v as Theme }); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {THEMES.map((t) => <SelectItem key={t} value={t}>{THEME_LABEL[t]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Row id="show-images" label="Show skin images"  checked={settings.showImages}   onChange={(v) => update({ showImages: v })} />
        <Row id="show-effects" label="Theme effects"   checked={settings.showEffects}   onChange={(v) => update({ showEffects: v })} />
        <Row id="reduce-motion" label="Reduce motion"  checked={settings.reduceMotion}  onChange={(v) => update({ reduceMotion: v })} />
        <Row id="low-perf" label="Low-performance mode" checked={settings.lowPerf}      onChange={(v) => update({ lowPerf: v })} />

        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <Label>Effect amount</Label>
            <span className="text-xs text-muted-foreground">{Math.round(intensity * 100)}%</span>
          </div>
          <Slider value={[intensity]} min={0} max={2} step={0.25} onValueChange={([v]) => update({ effectIntensity: v })} />
          {intensity === 0 && <p className="text-[11px] text-muted-foreground leading-snug">Effects are off. Drag to bring them back.</p>}
        </div>

        <h4 className="pt-2 font-semibold">Quality of life</h4>
        <Row id="compact"      label="Compact cards"      checked={settings.compact}     onChange={(v) => update({ compact: v })} />
        <Row id="hide-values"  label="Hide values (blur)" checked={settings.hideValues}  onChange={(v) => update({ hideValues: v })} />
      </PopoverContent>
    </Popover>
  );
}

function Row({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label htmlFor={id} className="cursor-pointer">{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
