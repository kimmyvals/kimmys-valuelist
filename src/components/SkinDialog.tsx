import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Trash2, History, Plus, Upload, Loader2 } from "lucide-react";
import { RARITIES } from "@/lib/skin-options";
import { friendlyError } from "@/lib/errors";
import { encodeImageUrl } from "@/lib/contact";
import { SkinImage } from "@/components/SkinImage";
import type { Skin } from "./SkinCard";

type Props = {
  skin: Skin | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isNew?: boolean;
  weapons: string[];
  cases: string[];
  canEdit: boolean;
  defaultSection?: string;
};

const ADD_NEW = "__add_new__";

const emptySkin = {
  name: "", nickname: "", image_url: "", weapon_type: "M4A1", season: "Misc",
  value: 0, demand: "" as string | number, rarity: "Common",
  kt_value: "" as string | number, sv_value: "" as string | number,
  kt_sv_demand: "" as string | number,
  amount_unboxed: "",
  section: "main",
};

function ExtensibleSelect({
  label, value, options, onChange, promptLabel, disabled,
}: {
  label: string; value: string; options: string[];
  onChange: (v: string) => void; promptLabel: string; disabled?: boolean;
}) {
  const merged = Array.from(new Set([value, ...options].filter(Boolean))).sort();
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(v) => {
          if (v === ADD_NEW) {
            const next = window.prompt(`New ${promptLabel}:`)?.trim();
            if (next) onChange(next);
          } else onChange(v);
        }}
      >
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent className="max-h-72">
          {merged.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          <SelectSeparator />
          <SelectItem value={ADD_NEW}>
            <span className="flex items-center gap-2 text-primary"><Plus className="h-3 w-3" /> Add {promptLabel}…</span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function SkinDialog({ skin, open, onOpenChange, isNew, weapons, cases, canEdit, defaultSection }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptySkin);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (skin && !isNew) {
      setForm({
        name: skin.name, nickname: skin.nickname ?? "", image_url: skin.image_url ?? "",
        weapon_type: skin.weapon_type, season: skin.season,
        value: Number(skin.value), demand: skin.demand ?? "", rarity: skin.rarity,
        kt_value: skin.kt_value ?? "", sv_value: skin.sv_value ?? "",
        kt_sv_demand: skin.kt_sv_demand ?? "",
        amount_unboxed: skin.amount_unboxed ?? "",
        section: skin.section ?? "main",
      });
    } else if (isNew) setForm({ ...emptySkin, section: defaultSection ?? "main" });
  }, [skin, isNew, open, defaultSection]);

  const history = useQuery({
    queryKey: ["history", skin?.id],
    enabled: !!skin && !isNew && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skin_value_history").select("value, changed_at")
        .eq("skin_id", skin!.id).order("changed_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const handleUpload = async (file: File) => {
    const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
    if (!ALLOWED_TYPES.has(file.type)) {
      toast.error("Only JPEG, PNG, WebP, GIF, and AVIF are allowed.");
      return;
    }
    const header = await file.slice(0, 16).arrayBuffer();
    const bytes  = new Uint8Array(header);
    const isPng  = bytes[0] === 0x89 && bytes[1] === 0x50;
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45;
    const isGif  = bytes[0] === 0x47 && bytes[1] === 0x49;
    const isAvif = bytes[4] === 0x66 && bytes[5] === 0x74;
    if (!isPng && !isJpeg && !isWebp && !isGif && !isAvif) {
      toast.error("File content doesn't look like a supported image.");
      return;
    }
    setUploading(true);
    try {
      const SAFE_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };
      const ext  = SAFE_EXT[file.type] ?? "png";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("skin-images").upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("skin-images").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: data.publicUrl }));
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const isInfect = form.season === "Infect '24";
      const payload = {
        name: form.name,
        nickname: form.nickname.trim() || null,
        image_url: form.image_url || null,
        weapon_type: form.weapon_type,
        season: form.season,
        value: Number(form.value),
        demand: form.demand === "" ? null : Number(form.demand),
        rarity: form.rarity,
        kt_value: isInfect ? null : (form.kt_value === "" ? null : Number(form.kt_value)),
        sv_value: isInfect ? (form.sv_value === "" ? null : Number(form.sv_value)) : null,
        kt_sv_demand: form.kt_sv_demand === "" ? null : Number(form.kt_sv_demand),
        amount_unboxed: form.amount_unboxed.trim() || null,
        section: form.section || "main",
      };
      const { error } = isNew
        ? await supabase.from("skins").insert(payload)
        : await supabase.from("skins").update(payload).eq("id", skin!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["skins"] });
      qc.invalidateQueries({ queryKey: ["history"] });
      toast.success(isNew ? "Skin added" : "Skin updated");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("skins").delete().eq("id", skin!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["skins"] });
      toast.success("Skin removed");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const ro = !canEdit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {isNew ? "Add skin" : skin?.name}
          </DialogTitle>
        </DialogHeader>

        {ro && (
          <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
            Sign in as an editor to make changes.
          </div>
        )}
        {canEdit && !isNew && (
          <div className="rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            Value, KT/SV, demand, trend and copy count are synced from the Google Sheet. Manual edits here will be overwritten on the next sync.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input disabled={ro} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Nicknames (comma-separated)</Label>
            <Input disabled={ro} value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Value</Label>
            <Input disabled={ro} type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label>Demand (0–10)</Label>
            <Input disabled={ro} type="number" step="0.5" min="0" max="10" value={form.demand} placeholder="e.g. 6.5" onChange={(e) => setForm({ ...form, demand: e.target.value })} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Skin image</Label>
            <div className="flex gap-2">
              <Input disabled={ro} value={form.image_url} placeholder="Paste a URL or upload" onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
              <Button type="button" variant="outline" disabled={ro || uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              </Button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
            </div>
            {form.image_url && (
              <SkinImage
                src={form.image_url}
                alt="preview"
                className="mt-2 h-32 w-32 border border-border/60 bg-secondary/40"
                rounded="rounded-md"
              />
            )}
          </div>

          <ExtensibleSelect label="Weapon" value={form.weapon_type} options={weapons} disabled={ro}
            onChange={(v) => setForm({ ...form, weapon_type: v })} promptLabel="weapon" />
          <ExtensibleSelect label="Case" value={form.season} options={cases} disabled={ro}
            onChange={(v) => setForm({ ...form, season: v })} promptLabel="case" />
          <ExtensibleSelect label="Rarity" value={form.rarity} options={[...RARITIES]} disabled={ro}
            onChange={(v) => setForm({ ...form, rarity: v })} promptLabel="rarity" />

          {form.season === "Infect '24" ? (
            <div className="space-y-2 md:col-span-2">
              <Label>SV value</Label>
              <Input disabled={ro} type="number" value={form.sv_value} placeholder="optional"
                onChange={(e) => setForm({ ...form, sv_value: e.target.value, kt_value: "" })} />
            </div>
          ) : (
            <div className="space-y-2 md:col-span-2">
              <Label>KT value</Label>
              <Input disabled={ro} type="number" value={form.kt_value} placeholder="optional"
                onChange={(e) => setForm({ ...form, kt_value: e.target.value, sv_value: "" })} />
            </div>
          )}
          <div className="space-y-2 md:col-span-2">
            <Label>KT/SV demand</Label>
            <Input disabled={ro} type="number" value={form.kt_sv_demand} placeholder="optional"
              onChange={(e) => setForm({ ...form, kt_sv_demand: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Approximate copies unboxed</Label>
            <Input disabled={ro} value={form.amount_unboxed} placeholder='e.g. 1200, "Obtainable", or "?"'
              onChange={(e) => setForm({ ...form, amount_unboxed: e.target.value })} />
          </div>
        </div>

        {!isNew && (
          <div className="mt-2 space-y-3 rounded-lg border border-border/60 bg-card/40 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <History className="h-4 w-4 text-primary" /> Value history
            </div>
            {history.data && history.data.length > 1 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history.data.map((h) => ({ value: Number(h.value), date: new Date(h.changed_at).toLocaleDateString() }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.36 0.04 230)" />
                    <XAxis dataKey="date" stroke="oklch(0.78 0.02 220)" fontSize={11} />
                    <YAxis stroke="oklch(0.78 0.02 220)" fontSize={11} />
                    <Tooltip contentStyle={{ background: "oklch(0.24 0.045 240)", border: "1px solid oklch(0.36 0.04 230)", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="value" stroke="oklch(0.88 0.08 220)" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No price history yet. Update the value to start tracking.</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {!isNew && canEdit ? (
            <Button variant="destructive" onClick={() => del.mutate()} disabled={del.isPending}>
              <Trash2 className="mr-2 h-4 w-4" /> Remove
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            {canEdit && (
              <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name}>
                {isNew ? "Add skin" : "Save changes"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
