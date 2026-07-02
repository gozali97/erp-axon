import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/cms/")({
  component: LandingEditor,
});

type ContentRow = { key: string; value: Record<string, string> };

const fields: { key: string; label: string; subfields: { name: string; label: string; multiline?: boolean }[] }[] = [
  {
    key: "hero",
    label: "Hero",
    subfields: [
      { name: "eyebrow", label: "Eyebrow" },
      { name: "title", label: "Title" },
      { name: "subtitle", label: "Subtitle", multiline: true },
      { name: "ctaPrimary", label: "Primary CTA" },
      { name: "ctaSecondary", label: "Secondary CTA" },
    ],
  },
  {
    key: "tagline",
    label: "Tagline strip",
    subfields: [{ name: "text", label: "Text" }],
  },
  {
    key: "cta",
    label: "Bottom CTA",
    subfields: [
      { name: "title", label: "Title" },
      { name: "subtitle", label: "Subtitle", multiline: true },
      { name: "button", label: "Button label" },
    ],
  },
];

function LandingEditor() {
  const [state, setState] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("cms_landing_content").select("key, value");
      if (error) {
        toast.error(error.message);
      } else {
        const map: Record<string, Record<string, string>> = {};
        (data as ContentRow[]).forEach((row) => (map[row.key] = row.value ?? {}));
        setState(map);
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const rows = fields.map((f) => ({ key: f.key, value: state[f.key] ?? {} }));
    const { error } = await supabase.from("cms_landing_content").upsert(rows, { onConflict: "key" });
    if (error) toast.error(error.message);
    else toast.success("Landing content tersimpan");
    setSaving(false);
  };

  if (loading) return <div className="text-muted-foreground text-sm">Memuat…</div>;

  return (
    <div className="space-y-8 max-w-3xl">
      {fields.map((f) => (
        <div key={f.key} className="border border-border rounded-lg p-5 bg-card">
          <h3 className="font-bold mb-4">{f.label}</h3>
          <div className="space-y-4">
            {f.subfields.map((sf) => (
              <div key={sf.name}>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{sf.label}</Label>
                {sf.multiline ? (
                  <Textarea
                    rows={3}
                    value={state[f.key]?.[sf.name] ?? ""}
                    onChange={(e) =>
                      setState((s) => ({ ...s, [f.key]: { ...(s[f.key] ?? {}), [sf.name]: e.target.value } }))
                    }
                  />
                ) : (
                  <Input
                    value={state[f.key]?.[sf.name] ?? ""}
                    onChange={(e) =>
                      setState((s) => ({ ...s, [f.key]: { ...(s[f.key] ?? {}), [sf.name]: e.target.value } }))
                    }
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Menyimpan…" : "Simpan perubahan"}
        </Button>
        <Button variant="outline" asChild>
          <a href="/" target="_blank" rel="noreferrer">
            Preview landing
          </a>
        </Button>
      </div>
    </div>
  );
}
