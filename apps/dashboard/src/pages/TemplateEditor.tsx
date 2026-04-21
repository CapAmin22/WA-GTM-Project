import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCw, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const variables = ["Name", "Company", "City", "Phone", "Amount"];

function resolveSpintax(template: string): string {
  let result = template.replace(/{([^{}]+)}/g, (_match, group: string) => {
    const options = group.split("|");
    return options[Math.floor(Math.random() * options.length)];
  });
  result = result.replace(/\[([^\[\]]+)\]/g, (_match, key: string) => {
    const defaults: Record<string, string> = { Name: "Rahul", Company: "Acme Corp", City: "Mumbai", Phone: "+91 9876543210", Amount: "₹2,500" };
    return defaults[key] || `[${key}]`;
  });
  return result.trim();
}

function countVariations(template: string): number {
  let count = 1;
  const regex = /{([^{}]+)}/g;
  let match;
  while ((match = regex.exec(template)) !== null) {
    count *= match[1].split("|").length;
  }
  return count;
}

export default function TemplateEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("general");
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-refresh preview as user types (debounced 500ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (body) setPreview(resolveSpintax(body));
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [body]);

  useEffect(() => {
    if (isEditing) {
      supabase.from("message_templates").select("*").eq("id", id).single().then(({ data, error }) => {
        if (error || !data) {
          toast.error("Template not found.");
          navigate("/templates");
          return;
        }
        setName(data.name);
        setBody(data.body);
        setCategory(data.category);
        setPreview(resolveSpintax(data.body));
        setLoading(false);
      });
    }
  }, [id]);

  const handleSave = async () => {
    if (!name || !body) { toast.error("Name and body are required."); return; }
    setSaving(true);

    const payload = { name, body, category };
    let result;
    if (isEditing) {
      result = await supabase.from("message_templates").update(payload).eq("id", id);
    } else {
      result = await supabase.from("message_templates").insert(payload);
    }

    setSaving(false);
    if (result.error) {
      toast.error("Save failed: " + result.error.message);
    } else {
      toast.success(isEditing ? "Template updated!" : "Template created!");
      navigate("/templates");
    }
  };

  const insertVariable = (v: string) => {
    setBody((prev) => prev + `[${v}]`);
  };

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/templates")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold tracking-tight">{isEditing ? "Edit Template" : "New Template"}</h1>
          </div>
          <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Template
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editor */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Template Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Diwali Greeting v2" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Category</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="general">General</option>
                <option value="promotional">Promotional</option>
                <option value="marketing">Marketing</option>
                <option value="transactional">Transactional</option>
                <option value="follow_up">Follow-up</option>
                <option value="greeting">Greeting</option>
                <option value="utility">Utility</option>
              </select>
            </div>

            {/* Variable toolbar */}
            <div className="flex flex-wrap gap-1.5">
              {variables.map((v) => (
                <button
                  key={v}
                  onClick={() => insertVariable(v)}
                  className="px-2 py-1 rounded text-[11px] font-medium bg-success/15 text-success border border-success/30 hover:bg-success/25 transition-colors"
                >
                  [{v}]
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Message Body (Spintax supported)</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono min-h-[200px] focus:outline-none focus:ring-1 focus:ring-ring"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="{Hello|Hi|Hey} [Name], {wishing you|hope you enjoy} a wonderful Diwali! 🪔"
              />
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>~{countVariations(body)} unique variations</span>
              <span>·</span>
              <span>Max length: ~{body.length} chars</span>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Live Preview</Label>
              <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={() => setPreview(resolveSpintax(body))}>
                <RefreshCw className="h-3 w-3" /> Refresh
              </Button>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-6">
              <div className="max-w-[280px] mx-auto">
                <div className="bg-[hsl(152,25%,18%)] rounded-lg p-3">
                  <p className="text-sm text-foreground leading-relaxed">{preview || resolveSpintax(body)}</p>
                  <p className="text-[10px] text-muted-foreground text-right mt-1">12:34 PM ✓✓</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
