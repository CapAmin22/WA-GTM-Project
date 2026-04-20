import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Loader2, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const statusMap: Record<string, string> = {
  running:   "bg-success/15 text-success border-success/30",
  completed: "bg-primary/15 text-primary border-primary/30",
  draft:     "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};

interface Variant {
  label: string;
  templateId: string;
}

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Create dialog ─────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expName, setExpName] = useState("");
  const [expHypothesis, setExpHypothesis] = useState("");
  const [primaryMetric, setPrimaryMetric] = useState<"delivery_rate" | "reply_rate">("delivery_rate");
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.95);
  const [variants, setVariants] = useState<Variant[]>([
    { label: "A", templateId: "" },
    { label: "B", templateId: "" },
  ]);
  const [creating, setCreating] = useState(false);

  // ─────────────────────────────────────────────────────────────

  const fetchAll = async () => {
    setLoading(true);
    const [eRes, tRes] = await Promise.all([
      supabase.from("ab_experiments").select("*").order("created_at", { ascending: false }),
      supabase.from("message_templates").select("id, name").eq("is_archived", false),
    ]);

    const exps = eRes.data || [];
    setTemplates(tRes.data || []);

    if (exps.length === 0) { setExperiments([]); setLoading(false); return; }

    // Fetch all variants for these experiments
    const expIds = exps.map((e) => e.id);
    const { data: varData } = await supabase
      .from("ab_variants")
      .select("*, message_templates(name)")
      .in("experiment_id", expIds);

    const varMap: Record<string, any[]> = {};
    for (const v of varData || []) {
      if (!varMap[v.experiment_id]) varMap[v.experiment_id] = [];
      varMap[v.experiment_id].push(v);
    }

    setExperiments(
      exps.map((e) => ({
        ...e,
        variants: varMap[e.id] || [],
        totalSends: (varMap[e.id] || []).reduce((s: number, v: any) => s + v.send_count, 0),
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = experiments.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  // ── Variant helpers ───────────────────────────────────────────
  const addVariant = () => {
    const nextLabel = String.fromCharCode(65 + variants.length); // A, B, C, D...
    setVariants([...variants, { label: nextLabel, templateId: "" }]);
  };

  const removeVariant = (idx: number) => {
    if (variants.length <= 2) { toast.error("Minimum 2 variants required."); return; }
    setVariants(variants.filter((_, i) => i !== idx));
  };

  const updateVariant = (idx: number, key: keyof Variant, value: string) => {
    setVariants(variants.map((v, i) => i === idx ? { ...v, [key]: value } : v));
  };

  // ── Create Experiment ─────────────────────────────────────────
  const handleCreate = async () => {
    if (!expName.trim()) { toast.error("Experiment name is required."); return; }
    for (const v of variants) {
      if (!v.templateId) { toast.error(`Select a template for Variant ${v.label}.`); return; }
    }

    setCreating(true);

    // Build traffic_split (equal split)
    const split: Record<string, number> = {};
    const perVariant = parseFloat((1 / variants.length).toFixed(2));
    variants.forEach((v) => { split[v.label] = perVariant; });

    // Insert experiment
    const { data: exp, error: expErr } = await supabase
      .from("ab_experiments")
      .insert({
        name: expName.trim(),
        hypothesis: expHypothesis.trim() || null,
        status: "draft",
        primary_metric: primaryMetric,
        confidence_threshold: confidenceThreshold,
        min_sample_per_variant: 50,
        auto_select_winner: true,
        traffic_split: split,
      })
      .select()
      .single();

    if (expErr || !exp) {
      toast.error("Failed to create experiment: " + expErr?.message);
      setCreating(false);
      return;
    }

    // Insert variants
    const variantRows = variants.map((v) => ({
      experiment_id: exp.id,
      variant_label: v.label,
      template_id: v.templateId,
    }));

    const { error: varErr } = await supabase.from("ab_variants").insert(variantRows);
    if (varErr) {
      toast.error("Experiment created but variants failed: " + varErr.message);
    } else {
      toast.success(`Experiment "${expName}" created with ${variants.length} variants.`);
    }

    // Reset form
    setExpName(""); setExpHypothesis(""); setPrimaryMetric("delivery_rate");
    setConfidenceThreshold(0.95);
    setVariants([{ label: "A", templateId: "" }, { label: "B", templateId: "" }]);
    setDialogOpen(false);
    setCreating(false);
    fetchAll();
  };

  // ── Delete Experiment ─────────────────────────────────────────
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete experiment "${name}"? This will also delete all its variants.`)) return;
    const { error } = await supabase.from("ab_experiments").delete().eq("id", id);
    if (error) toast.error("Failed: " + error.message);
    else { toast.success("Experiment deleted."); fetchAll(); }
  };

  // ── Mark Running / Completed ──────────────────────────────────
  const handleSetStatus = async (id: string, status: string) => {
    const updates: any = { status };
    if (status === "running") updates.started_at = new Date().toISOString();
    if (status === "completed") updates.completed_at = new Date().toISOString();
    const { error } = await supabase.from("ab_experiments").update(updates).eq("id", id);
    if (error) toast.error("Failed: " + error.message);
    else { toast.success(`Experiment marked as ${status}.`); fetchAll(); }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">A/B Testing Lab</h1>
            <p className="text-sm text-muted-foreground mt-1">Create and monitor message variant experiments</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New Experiment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create A/B Experiment</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs">Experiment Name *</Label>
                  <Input placeholder="e.g. Greeting Style Test" value={expName} onChange={(e) => setExpName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hypothesis (optional)</Label>
                  <textarea
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Casual greetings will have higher reply rates than formal ones."
                    value={expHypothesis}
                    onChange={(e) => setExpHypothesis(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Primary Metric</Label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      value={primaryMetric}
                      onChange={(e) => setPrimaryMetric(e.target.value as any)}
                    >
                      <option value="delivery_rate">Delivery Rate</option>
                      <option value="reply_rate">Reply Rate</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Confidence Threshold</Label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      value={confidenceThreshold}
                      onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                    >
                      <option value={0.8}>80%</option>
                      <option value={0.9}>90%</option>
                      <option value={0.95}>95%</option>
                      <option value={0.99}>99%</option>
                    </select>
                  </div>
                </div>

                {/* Variants */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Variants</Label>
                    <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={addVariant}>
                      <Plus className="h-3 w-3" /> Add Variant
                    </Button>
                  </div>
                  {variants.map((v, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-semibold w-4 shrink-0">{v.label}</span>
                      <select
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        value={v.templateId}
                        onChange={(e) => updateVariant(idx, "templateId", e.target.value)}
                      >
                        <option value="">— Select template —</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      {variants.length > 2 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => removeVariant(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground">Traffic is split equally across all variants.</p>
                </div>

                <Button onClick={handleCreate} disabled={creating} className="w-full">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Experiment
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search experiments..."
            className="pl-9 h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground text-sm">
            No experiments yet. Create your first A/B test to compare message variants.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((exp) => {
              const isExpanded = expandedId === exp.id;
              return (
                <div key={exp.id} className="rounded-lg border border-border bg-card overflow-hidden">
                  {/* Experiment Header */}
                  <div
                    className="flex items-start justify-between p-4 cursor-pointer hover:bg-accent/20 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : exp.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{exp.name}</span>
                          <Badge variant="outline" className={cn("text-[10px] capitalize", statusMap[exp.status] || statusMap.draft)}>
                            {exp.status}
                          </Badge>
                        </div>
                        {exp.hypothesis && (
                          <p className="text-xs text-muted-foreground mt-0.5 max-w-lg">{exp.hypothesis}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span>{exp.variants.length} variants</span>
                          <span>·</span>
                          <span>{exp.totalSends} total sends</span>
                          <span>·</span>
                          <span>Metric: {exp.primary_metric.replace("_", " ")}</span>
                          <span>·</span>
                          <span>{(exp.confidence_threshold * 100).toFixed(0)}% confidence target</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      {exp.status === "draft" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={(e) => { e.stopPropagation(); handleSetStatus(exp.id, "running"); }}
                        >
                          Start
                        </Button>
                      )}
                      {exp.status === "running" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={(e) => { e.stopPropagation(); handleSetStatus(exp.id, "completed"); }}
                        >
                          Complete
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDelete(exp.id, exp.name); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Variant Stats (expanded) */}
                  {isExpanded && (
                    <div className="border-t border-border p-4 bg-muted/20">
                      {exp.variants.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No variants found for this experiment.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {exp.variants.map((v: any) => {
                            const delivRate = v.send_count > 0
                              ? ((v.delivered_count / v.send_count) * 100).toFixed(1)
                              : "—";
                            const replyRate = v.send_count > 0
                              ? ((v.reply_count / v.send_count) * 100).toFixed(1)
                              : "—";
                            const failRate = v.send_count > 0
                              ? ((v.fail_count / v.send_count) * 100).toFixed(1)
                              : "—";
                            const isWinner = v.is_winner || exp.winner_variant_id === v.id;

                            return (
                              <div
                                key={v.id}
                                className={cn(
                                  "p-3 rounded-md border text-xs",
                                  isWinner
                                    ? "bg-success/10 border-success/30"
                                    : "bg-background border-border"
                                )}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="font-bold text-sm">Variant {v.variant_label}</span>
                                  {v.message_templates?.name && (
                                    <span className="text-muted-foreground truncate">{v.message_templates.name}</span>
                                  )}
                                  {isWinner && (
                                    <span className="ml-auto text-success font-semibold">✓ Winner</span>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Sent</span>
                                    <span className="font-medium">{v.send_count}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Failed</span>
                                    <span className="font-medium text-destructive">{v.fail_count}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Delivery</span>
                                    <span className="font-medium text-success">{delivRate}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Reply</span>
                                    <span className="font-medium">{replyRate}%</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
