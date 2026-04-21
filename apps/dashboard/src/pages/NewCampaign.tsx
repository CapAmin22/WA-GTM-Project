import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Clock, Shield, Zap, Users, MessageSquare, FlaskConical, Rocket, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// ── Step metadata for rich UI ────────────────────────────────────
const stepMeta = [
  { icon: Rocket, title: "Campaign Basics", subtitle: "Name your campaign, add a description, and optionally schedule a launch time." },
  { icon: Users, title: "Select Audience", subtitle: "Choose which contacts will receive this campaign. You can target everyone or a filtered subset." },
  { icon: MessageSquare, title: "Choose Message", subtitle: "Pick the message template that will be sent. You can preview how it looks before selecting." },
  { icon: FlaskConical, title: "A/B Testing", subtitle: "Optionally split your audience to test different message variants and find what converts best." },
  { icon: Clock, title: "Send Schedule", subtitle: "Control when and how fast messages go out. Set hourly windows and daily throttle limits." },
  { icon: Shield, title: "Stealth Settings", subtitle: "Fine-tune anti-detection behavior to keep your accounts safe from WhatsApp's automated ban systems." },
  { icon: Zap, title: "Review & Launch", subtitle: "Double-check every setting before launching. Once launched, messages will begin queuing immediately." },
];

const steps = [
  "Campaign Basics",
  "Select Audience",
  "Choose Message",
  "A/B Testing",
  "Send Schedule",
  "Stealth Settings",
  "Review & Launch",
];

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Apply a segment's filter_rules to a contacts array.
 * filter_rules schema: [{ field: "tags", operator: "contains", value: "tagname" }]
 * An empty filter_rules means "all contacts".
 */
function applySegmentFilter(contacts: any[], filterRules: any[]): any[] {
  if (!filterRules || filterRules.length === 0) return contacts;
  return contacts.filter((contact) => {
    return filterRules.every((rule: any) => {
      if (rule.field === "tags" && rule.operator === "contains") {
        return (contact.tags || []).includes(rule.value);
      }
      // Extend here for other rule types as needed
      return true;
    });
  });
}

export default function NewCampaignPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  // Data loaded for selections
  const [templates, setTemplates] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [experiments, setExperiments] = useState<any[]>([]);
  const [totalContactsCount, setTotalContactsCount] = useState(0);
  const [loadingData, setLoadingData] = useState(true);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDateTime, setScheduledDateTime] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [abEnabled, setAbEnabled] = useState(false);
  const [experimentId, setExperimentId] = useState("");

  // Schedule — conservative defaults for max safety
  const [sendWindowStart, setSendWindowStart] = useState(10);
  const [sendWindowEnd, setSendWindowEnd] = useState(18);
  const [dailyLimit, setDailyLimit] = useState(150);
  const [perAccountLimit, setPerAccountLimit] = useState(40);

  // Stealth — safe defaults to prevent WhatsApp bans
  const [jitterMin, setJitterMin] = useState(0.7);
  const [jitterMax, setJitterMax] = useState(2.0);
  const [presenceMin, setPresenceMin] = useState(5);
  const [presenceMax, setPresenceMax] = useState(12);

  // Segment Creation State
  const [segDialogOpen, setSegDialogOpen] = useState(false);
  const [segName, setSegName] = useState("");
  const [segDescription, setSegDescription] = useState("");
  const [segTags, setSegTags] = useState("");
  const [creatingSeg, setCreatingSeg] = useState(false);

  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [tRes, sRes, eRes, countRes] = await Promise.all([
          supabase.from("message_templates").select("id, name, body").eq("is_archived", false),
          supabase.from("contact_segments").select("id, name, description, contact_count, filter_rules"),
          supabase.from("ab_experiments").select("id, name, status").eq("status", "draft"),
          supabase.from("contacts").select("id", { count: "exact", head: true }).eq("is_blacklisted", false),
        ]);
        setTemplates(tRes.data || []);
        setSegments(sRes.data || []);
        setExperiments(eRes.data || []);
        setTotalContactsCount(countRes.count || 0);
      } catch (err: any) {
        toast.error("Failed to load campaign data: " + err.message);
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

  const validate = () => {
    if (!name.trim()) { toast.error("Campaign name is required."); return false; }
    if (!segmentId) { toast.error("Please select an audience segment."); return false; }
    if (!templateId && !abEnabled) { toast.error("Please select a message template."); return false; }
    if (abEnabled && !experimentId) { toast.error("Please select an A/B experiment."); return false; }
    if (sendWindowStart >= sendWindowEnd) { toast.error("Send window end must be after start."); return false; }
    if (jitterMin >= jitterMax) { toast.error("Jitter max must be greater than jitter min."); return false; }
    if (presenceMin >= presenceMax) { toast.error("Composing max must be greater than min."); return false; }
    return true;
  };

  const handleCreateSegment = async () => {
    if (!segName.trim()) { toast.error("Segment name is required."); return; }
    setCreatingSeg(true);

    const tagList = segTags.split(",").map((t) => t.trim()).filter(Boolean);
    const filterRules = tagList.map((tag) => ({ field: "tags", operator: "contains", value: tag }));

    let query = supabase.from("contacts").select("id", { count: "exact", head: true }).eq("is_blacklisted", false);
    if (tagList.length > 0) { query = query.contains("tags", tagList); }
    const { count } = await query;

    const { data: newSeg, error } = await supabase.from("contact_segments").insert({
      name: segName.trim(),
      description: segDescription.trim() || null,
      filter_rules: filterRules,
      contact_count: count || 0,
    }).select().single();

    setCreatingSeg(false);
    if (error) {
      toast.error("Failed to create segment: " + error.message);
    } else {
      toast.success(`Segment created successfully targeting ~${count} contacts.`);
      setSegments([newSeg, ...segments]);
      setSegmentId(newSeg.id);
      setSegName(""); setSegDescription(""); setSegTags("");
      setSegDialogOpen(false);
    }
  };

  const handleLaunch = async () => {
    if (!validate()) return;
    setLaunching(true);

    try {
      // 1. Find the selected segment and its filter_rules
      const selectedSegment = segments.find((s) => s.id === segmentId);
      const filterRules = selectedSegment?.filter_rules || [];

      // 2. Fetch all non-blacklisted contacts
      const { data: allContacts, error: contactsErr } = await supabase
        .from("contacts")
        .select("id, phone, name, tags")
        .eq("is_blacklisted", false);

      if (contactsErr) throw contactsErr;

      // 3. Apply segment filter
      const targetContacts = segmentId === "ALL_CONTACTS" ? allContacts || [] : applySegmentFilter(allContacts || [], filterRules);

      if (targetContacts.length === 0) {
        toast.error("No contacts match the selected segment. Add contacts with matching tags first.");
        setLaunching(false);
        return;
      }

      // 4. Determine template body (from template or A/B experiment)
      let defaultTemplateBody = "";
      let resolvedTemplateId = templateId || null;

      if (!abEnabled && templateId) {
        const tmpl = templates.find((t) => t.id === templateId);
        defaultTemplateBody = tmpl?.body || "";
      }

      // 5. Create campaign record
      const { data: campaign, error: campErr } = await supabase
        .from("campaigns")
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          segment_id: segmentId === "ALL_CONTACTS" ? null : segmentId,
          template_id: resolvedTemplateId,
          ab_experiment_id: abEnabled && experimentId ? experimentId : null,
          scheduled_date: scheduledDateTime ? scheduledDateTime.split("T")[0] : null,
          send_window_start: sendWindowStart,
          send_window_end: sendWindowEnd,
          daily_limit: dailyLimit,
          per_account_limit: perAccountLimit,
          jitter_min: jitterMin,
          jitter_max: jitterMax,
          presence_min_sec: presenceMin,
          presence_max_sec: presenceMax,
          total_recipients: targetContacts.length,
          status: scheduledDateTime ? "scheduled" : "active",
        })
        .select()
        .single();

      if (campErr) throw campErr;

      // 6. Fetch active/connected accounts for assignment
      const { data: activeAccounts } = await supabase
        .from("wa_accounts")
        .select("id, messages_sent_today, daily_limit")
        .eq("connection_status", "connected")
        .eq("is_archived", false);

      if (!activeAccounts || activeAccounts.length === 0) {
        // Still queue messages — worker will handle once accounts connect
        toast.warning("No accounts currently connected. Messages queued and will send when an account connects.");
      }

      // 7. Fetch A/B variants if experiment selected
      let variants: any[] = [];
      if (abEnabled && experimentId) {
        const { data: varData } = await supabase
          .from("ab_variants")
          .select("id, variant_label, template_id, message_templates(body)")
          .eq("experiment_id", experimentId);
        variants = varData || [];

        if (variants.length < 2) {
          toast.error(`A/B Testing requires at least 2 message variants. This experiment only has ${variants.length}. Go to A/B Testing to add more variants.`);
          setLaunching(false);
          return;
        }
      }

      // 8. Build message_queue inserts in chunks of 500
      const now = new Date().toISOString();
      const scheduledFor = scheduledDateTime
        ? new Date(scheduledDateTime).toISOString()
        : now;

      // Round-robin account assignment
      const queueInserts = targetContacts.map((contact, idx) => {
        // Assign account round-robin (null if no accounts available)
        const account = activeAccounts && activeAccounts.length > 0
          ? activeAccounts[idx % activeAccounts.length]
          : null;

        // If A/B testing, assign variant by even split
        let variantId: string | null = null;
        let msgTemplate = defaultTemplateBody;

        if (abEnabled && variants.length > 0) {
          const variant = variants[idx % variants.length];
          variantId = variant.id;
          msgTemplate = (variant as any).message_templates?.body || defaultTemplateBody;
        }

        return {
          campaign_id: campaign.id,
          recipient_phone: contact.phone,
          recipient_name: contact.name || null,
          message_template: msgTemplate,
          message_body: null, // resolved by worker via Spintax
          status: "pending" as const,
          scheduled_for: scheduledFor,
          assigned_account_id: account?.id || null,
          variant_id: variantId,
          attempt_count: 0,
          max_attempts: 3,
        };
      });

      // Insert in chunks to avoid payload limits
      const CHUNK = 500;
      for (let i = 0; i < queueInserts.length; i += CHUNK) {
        const { error: qErr } = await supabase
          .from("message_queue")
          .insert(queueInserts.slice(i, i + CHUNK));
        if (qErr) throw qErr;
      }

      // 9. Update contact_segments contact_count (if not ALL_CONTACTS)
      if (segmentId && segmentId !== "ALL_CONTACTS") {
        await supabase
          .from("contact_segments")
          .update({ contact_count: targetContacts.length })
          .eq("id", segmentId);
      }

      toast.success(
        `Campaign "${name}" launched with ${targetContacts.length} messages queued!`
      );
      navigate("/campaigns");
    } catch (err: any) {
      toast.error("Launch failed: " + err.message);
    } finally {
      setLaunching(false);
    }
  };

  const getSummary = () => {
    const seg = segmentId === "ALL_CONTACTS" ? { name: "All Contacts" } : segments.find((s) => s.id === segmentId);
    const tmpl = templates.find((t) => t.id === templateId);
    const exp = experiments.find((e) => e.id === experimentId);
    return {
      sName: seg?.name || "Not selected",
      tName: abEnabled ? (exp?.name || "Not selected") : (tmpl?.name || "Not selected"),
    };
  };

  if (loadingData) {
    return (
      <AppLayout>
        <div className="flex justify-center p-20">
          <Loader2 className="animate-spin text-muted-foreground w-6 h-6" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/campaigns")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Create Campaign</h1>
            <p className="text-sm text-muted-foreground">Step {currentStep + 1} of {steps.length}</p>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1">
          {steps.map((step, i) => (
            <div key={step} className="flex items-center gap-1 flex-1">
              <button
                onClick={() => setCurrentStep(i)}
                className={cn(
                  "flex items-center justify-center h-7 w-7 rounded-full text-xs font-medium transition-colors flex-shrink-0",
                  i < currentStep
                    ? "bg-success text-success-foreground"
                    : i === currentStep
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {i < currentStep ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </button>
              {i < steps.length - 1 && (
                <div className={cn("flex-1 h-px", i < currentStep ? "bg-success" : "bg-border")} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="rounded-lg border border-border bg-card p-6 min-h-[300px]">
          {/* Dynamic Step Header */}
          <div className="flex items-start gap-3 mb-5 pb-4 border-b border-border/50">
            {(() => { const StepIcon = stepMeta[currentStep].icon; return <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0"><StepIcon className="h-5 w-5" /></div>; })()}
            <div>
              <h2 className="text-base font-semibold">{stepMeta[currentStep].title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{stepMeta[currentStep].subtitle}</p>
            </div>
          </div>

          {/* Step 0 — Basics */}
          {currentStep === 0 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Campaign Name *</Label>
                <Input placeholder="e.g. Diwali Promo 2026, Product Launch Wave 1" value={name} onChange={(e) => setName(e.target.value)} />
                <p className="text-[10px] text-muted-foreground">Give a clear name so you can easily find this campaign later in your dashboard.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Description <span className="text-muted-foreground">(optional)</span></Label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="e.g. Promoting our new service to the fitness leads batch from March..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">Internal note for your team. Not visible to recipients.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Schedule Launch</Label>
                <Input type="datetime-local" value={scheduledDateTime} onChange={(e) => setScheduledDateTime(e.target.value)} />
                <div className="flex items-start gap-2 p-2.5 rounded-md bg-muted/30 border border-border/50">
                  <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    <strong>Leave blank</strong> to start sending as soon as you hit Launch.<br/>
                    <strong>Set a date & time</strong> to queue messages now but hold delivery until that exact moment. Messages will begin dripping out from the scheduled time within your Send Window hours.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 1 — Audience */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Select Target Audience</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Choose who receives this campaign.</p>
                </div>
                {totalContactsCount > 0 && (
                  <Dialog open={segDialogOpen} onOpenChange={setSegDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs text-primary border-primary/20 hover:bg-primary/10">
                        <Plus className="h-3.5 w-3.5" /> Filter by Tags
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Create Custom Audience</DialogTitle></DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Audience Name *</Label>
                          <Input placeholder="e.g. VIP Customers" value={segName} onChange={(e) => setSegName(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Filter by Tags (comma-separated)</Label>
                          <Input placeholder="e.g. VIP, premium, india" value={segTags} onChange={(e) => setSegTags(e.target.value)} />
                          <p className="text-[10px] text-muted-foreground mt-1">If you entered tags while importing CSVs, type them here. Contacts must have ALL listed tags to be included in this campaign.</p>
                        </div>
                        <Button onClick={handleCreateSegment} disabled={creatingSeg} className="w-full">
                          {creatingSeg ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Create & Select Custom Audience
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              <div className="space-y-3">
              {totalContactsCount === 0 ? (
                <div className="text-sm text-muted-foreground p-4 rounded-md bg-muted/30 border border-border">
                  You don't have any contacts yet.{" "}
                  <button className="text-primary underline" onClick={() => navigate("/contacts")}>
                    Add or import contacts first.
                  </button>
                </div>
              ) : (
                <>
                  {/* Always provide the "All Contacts" option */}
                  <label
                    className={cn(
                      "flex items-center justify-between p-3 rounded-md border hover:bg-accent/30 transition-colors cursor-pointer",
                      segmentId === "ALL_CONTACTS" ? "border-primary bg-primary/5" : "border-border"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="audience"
                        checked={segmentId === "ALL_CONTACTS"}
                        onChange={() => setSegmentId("ALL_CONTACTS")}
                        className="accent-[hsl(210,100%,56%)]"
                      />
                      <div>
                        <span className="text-sm font-medium">All Contacts</span>
                        <p className="text-xs text-muted-foreground">Send to every active contact in your database.</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">~{totalContactsCount} contacts</span>
                  </label>
                  
                  {/* Then list any specific segments */}
                  {segments.map((s) => (
                    <label
                      key={s.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-md border hover:bg-accent/30 transition-colors cursor-pointer",
                        segmentId === s.id ? "border-primary bg-primary/5" : "border-border"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="audience"
                          checked={segmentId === s.id}
                          onChange={() => setSegmentId(s.id)}
                          className="accent-[hsl(210,100%,56%)]"
                        />
                        <div>
                          <span className="text-sm font-medium">{s.name}</span>
                          {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                          {s.filter_rules?.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Filters: {s.filter_rules.map((r: any) => `${r.field} ${r.operator} "${r.value}"`).join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">~{s.contact_count} contacts</span>
                    </label>
                  ))}
                </>
              )}
              </div>
            </div>
          )}

          {/* Step 2 — Template */}
          {currentStep === 2 && (
            <div className="space-y-4">
              {templates.length === 0 ? (
                <div className="text-sm text-muted-foreground p-5 rounded-md bg-muted/30 border border-border text-center">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p>You haven't created any message templates yet.</p>
                  <button className="text-primary underline mt-1 text-sm" onClick={() => navigate("/templates/new")}>
                    Create your first template →
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-2 p-2.5 rounded-md bg-muted/30 border border-border/50">
                    <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Select the message that each contact will receive. You can use <code className="bg-muted px-1 rounded text-[9px]">{'{{name}}'}</code> placeholders in your templates — they'll be auto-replaced with each contact's real name at send time.
                    </p>
                  </div>
                  {templates.map((t) => (
                    <label
                      key={t.id}
                      className={cn(
                        "flex items-start gap-3 p-4 rounded-md border hover:bg-accent/30 transition-all cursor-pointer",
                        templateId === t.id ? "border-primary bg-primary/5 shadow-sm shadow-primary/10" : "border-border"
                      )}
                    >
                      <input
                        type="radio"
                        name="template"
                        checked={templateId === t.id}
                        onChange={() => setTemplateId(t.id)}
                        className="accent-[hsl(210,100%,56%)] mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium block">{t.name}</span>
                        <div className="mt-1.5 p-2 rounded bg-muted/40 border border-border/50">
                          <span className="text-xs text-muted-foreground font-mono block whitespace-pre-wrap">{t.body}</span>
                        </div>
                      </div>
                    </label>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Step 3 — A/B Testing */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-muted/30 border border-border/50">
                <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  <strong>A/B Testing</strong> lets you send different message variants to equal portions of your audience. After delivery, compare reply/read rates to discover which wording performs best. This is <strong>optional</strong> — skip it if you want to send a single message to everyone.
                </p>
              </div>

              <label className="flex items-center gap-3 p-3 rounded-md border border-border hover:bg-accent/30 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={abEnabled}
                  onChange={(e) => setAbEnabled(e.target.checked)}
                  className="accent-[hsl(210,100%,56%)] h-4 w-4"
                />
                <div>
                  <span className="text-sm font-medium">Enable A/B Testing</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Split your audience across message variants to test what works best.</p>
                </div>
              </label>

              {abEnabled && (
                <div className="space-y-3 pl-1">
                  <div>
                    <Label className="text-xs font-medium">Select Experiment</Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Only <strong>draft</strong> experiments appear here. Once started, an experiment moves to "running" and can no longer be assigned to new campaigns.</p>
                  </div>
                  {experiments.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-5 rounded-md bg-muted/30 border border-border text-center">
                      <FlaskConical className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p>No draft experiments found.</p>
                      <button className="text-primary underline mt-1 text-sm" onClick={() => navigate("/experiments")}>
                        Create an experiment first →
                      </button>
                    </div>
                  ) : (
                    experiments.map((e) => (
                      <label
                        key={e.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-md border cursor-pointer hover:bg-accent/30 transition-all",
                          experimentId === e.id ? "border-primary bg-primary/5 shadow-sm shadow-primary/10" : "border-border"
                        )}
                      >
                        <input
                          type="radio"
                          name="experiment"
                          checked={experimentId === e.id}
                          onChange={() => setExperimentId(e.id)}
                          className="accent-[hsl(210,100%,56%)]"
                        />
                        <span className="text-sm font-medium">{e.name}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 4 — Schedule */}
          {currentStep === 4 && (
            <div className="space-y-5">
              {/* Info Banner */}
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-primary/5 border border-primary/20">
                <Clock className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  <strong>Send Schedule</strong> controls <em>when</em> and <em>how fast</em> messages go out each day. The worker only sends messages within your <strong>Send Window</strong> hours. Outside this window, messages stay queued and resume the next day. Use this to avoid messaging people at night or during off-hours.
                </p>
              </div>

              {/* Send Window */}
              <div>
                <Label className="text-xs font-medium mb-1 block">⏰ Active Send Window</Label>
                <p className="text-[10px] text-muted-foreground mb-2">Messages will ONLY be sent between these hours (24-hour format). e.g. 10 → 10:00 AM, 22 → 10:00 PM.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Start Hour</Label>
                    <Input
                      type="number"
                      value={sendWindowStart}
                      onChange={(e) => setSendWindowStart(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                      min={0} max={23}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">End Hour</Label>
                    <Input
                      type="number"
                      value={sendWindowEnd}
                      onChange={(e) => setSendWindowEnd(Math.max(0, Math.min(23, parseInt(e.target.value) || 23)))}
                      min={0} max={23}
                    />
                  </div>
                </div>
                {sendWindowStart >= sendWindowEnd && (
                  <div className="flex items-center gap-1.5 mt-2 text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    <p className="text-xs">End hour must be after start hour.</p>
                  </div>
                )}
                <div className="mt-2 p-2 rounded bg-muted/30 border border-border/50">
                  <p className="text-[10px] text-muted-foreground">
                    📌 <strong>Current setting:</strong> Messages will be sent between <strong>{String(sendWindowStart).padStart(2,'0')}:00</strong> and <strong>{String(sendWindowEnd).padStart(2,'0')}:00</strong> ({sendWindowEnd - sendWindowStart} active hours per day).
                  </p>
                </div>
              </div>

              {/* Daily Limits */}
              <div>
                <Label className="text-xs font-medium mb-1 block">📊 Daily Message Limits</Label>
                <p className="text-[10px] text-muted-foreground mb-2">Throttle how many messages go out per day to stay under WhatsApp's radar. Lower limits = higher account safety.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Total Daily Limit (all accounts combined)</Label>
                    <Input
                      type="number"
                      value={dailyLimit}
                      onChange={(e) => setDailyLimit(Math.max(1, parseInt(e.target.value) || 0))}
                      min={1}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Per-Account Daily Limit</Label>
                    <Input
                      type="number"
                      value={perAccountLimit}
                      onChange={(e) => setPerAccountLimit(Math.max(1, parseInt(e.target.value) || 0))}
                      min={1}
                    />
                  </div>
                </div>
                <div className="mt-2 p-2 rounded bg-muted/30 border border-border/50">
                  <p className="text-[10px] text-muted-foreground">
                    📌 <strong>Current setting:</strong> Up to <strong>{dailyLimit}</strong> messages/day across all accounts, with each account capped at <strong>{perAccountLimit}</strong> messages/day.
                    {dailyLimit > 200 && <><br/><span className="text-warning">⚠️ Aggressive: sending more than 200/day increases the risk of account throttling. Consider lowering this for new/fresh accounts.</span></>}
                  </p>
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <Label className="text-xs font-medium mb-2 block">⚡ Quick Presets</Label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { label: "🐢 Conservative", start: 10, end: 18, daily: 100, perAcc: 30, desc: "Safe for new accounts" },
                    { label: "⚖️ Balanced", start: 9, end: 21, daily: 300, perAcc: 80, desc: "Recommended" },
                    { label: "🚀 Aggressive", start: 8, end: 23, daily: 800, perAcc: 200, desc: "Risky — established accounts only" },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className="text-left px-3 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-xs"
                      onClick={() => { setSendWindowStart(preset.start); setSendWindowEnd(preset.end); setDailyLimit(preset.daily); setPerAccountLimit(preset.perAcc); }}
                    >
                      <span className="font-medium block">{preset.label}</span>
                      <span className="text-[10px] text-muted-foreground">{preset.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 5 — Stealth */}
          {currentStep === 5 && (
            <div className="space-y-5">
              {/* Info Banner */}
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-primary/5 border border-primary/20">
                <Shield className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  <strong>Stealth Settings</strong> make your automated messages look like they're being typed by a real human. WhatsApp monitors for bot-like patterns — identical timing, instant sends, no typing indicator. These settings add <strong>random delays</strong> and <strong>fake typing indicators</strong> to each message, drastically reducing ban risk. <em>If you're unsure, keep the defaults — they work well.</em>
                </p>
              </div>

              {/* Jitter / Delay */}
              <div>
                <Label className="text-xs font-medium mb-1 block">🎲 Delay Jitter (Randomization Multiplier)</Label>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Controls the random delay <strong>between consecutive messages</strong>. The base delay is multiplied by a random value within this range. Example: with Min 0.8 and Max 1.5, a 10-second base delay becomes randomly 8–15 seconds.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Min Multiplier</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={jitterMin}
                      onChange={(e) => setJitterMin(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Max Multiplier</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={jitterMax}
                      onChange={(e) => setJitterMax(Math.max(0.2, parseFloat(e.target.value) || 1.2))}
                    />
                  </div>
                </div>
                {jitterMin >= jitterMax && (
                  <div className="flex items-center gap-1.5 mt-2 text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    <p className="text-xs">Max multiplier must be greater than min.</p>
                  </div>
                )}
                <div className="mt-2 p-2 rounded bg-muted/30 border border-border/50">
                  <p className="text-[10px] text-muted-foreground">
                    📌 <strong>Current setting:</strong> Each delay is randomized between <strong>{jitterMin}x</strong> and <strong>{jitterMax}x</strong> of the base interval. Higher range = more human-like.
                  </p>
                </div>
              </div>

              {/* Composing / Typing */}
              <div>
                <Label className="text-xs font-medium mb-1 block">⌨️ Typing Indicator Duration (seconds)</Label>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Before sending each message, the bot shows a <strong>"typing..."</strong> indicator to the recipient for a random duration in this range. This makes it look like a real person is composing the message.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Min Duration (sec)</Label>
                    <Input
                      type="number"
                      value={presenceMin}
                      onChange={(e) => setPresenceMin(Math.max(1, parseInt(e.target.value) || 1))}
                      min={1}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Max Duration (sec)</Label>
                    <Input
                      type="number"
                      value={presenceMax}
                      onChange={(e) => setPresenceMax(Math.max(2, parseInt(e.target.value) || 9))}
                      min={2}
                    />
                  </div>
                </div>
                {presenceMin >= presenceMax && (
                  <div className="flex items-center gap-1.5 mt-2 text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    <p className="text-xs">Max duration must be greater than min.</p>
                  </div>
                )}
                <div className="mt-2 p-2 rounded bg-muted/30 border border-border/50">
                  <p className="text-[10px] text-muted-foreground">
                    📌 <strong>Current setting:</strong> The recipient will see "typing..." for <strong>{presenceMin}–{presenceMax} seconds</strong> before each message arrives.
                  </p>
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <Label className="text-xs font-medium mb-2 block">⚡ Stealth Presets</Label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { label: "🛡️ Maximum Safety", jMin: 0.5, jMax: 2.0, pMin: 6, pMax: 15, desc: "Slow but very safe" },
                    { label: "⚖️ Balanced", jMin: 0.8, jMax: 1.2, pMin: 4, pMax: 9, desc: "Default — recommended" },
                    { label: "⚡ Speed Priority", jMin: 0.9, jMax: 1.0, pMin: 2, pMax: 4, desc: "Faster, higher risk" },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className="text-left px-3 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-xs"
                      onClick={() => { setJitterMin(preset.jMin); setJitterMax(preset.jMax); setPresenceMin(preset.pMin); setPresenceMax(preset.pMax); }}
                    >
                      <span className="font-medium block">{preset.label}</span>
                      <span className="text-[10px] text-muted-foreground">{preset.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 6 — Review */}
          {currentStep === 6 && (
            <div className="space-y-5">
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-success/10 border border-success/20">
                <Zap className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  You're almost there! Review every detail below. Click on any step number above to go back and change a setting. Once you hit <strong>"Launch Campaign"</strong>, messages will be queued {scheduledDateTime ? `and will start sending at ${new Date(scheduledDateTime).toLocaleString()}` : "and will start sending immediately"}.
                </p>
              </div>

              <div className="rounded-md bg-muted/30 border border-border overflow-hidden">
                {[
                  { label: "Campaign Name", value: name || "—", step: 0 },
                  { label: "Description", value: description || "—", step: 0 },
                  { label: "Audience", value: getSummary().sName, step: 1 },
                  { label: abEnabled ? "A/B Experiment" : "Message Template", value: getSummary().tName, step: abEnabled ? 3 : 2 },
                  { label: "Send Window", value: `${String(sendWindowStart).padStart(2,'0')}:00 – ${String(sendWindowEnd).padStart(2,'0')}:00 (${sendWindowEnd - sendWindowStart}h/day)`, step: 4 },
                  { label: "Daily Limit", value: `${dailyLimit} total / ${perAccountLimit} per account`, step: 4 },
                  { label: "Delay Jitter", value: `${jitterMin}x – ${jitterMax}x`, step: 5 },
                  { label: "Typing Duration", value: `${presenceMin}s – ${presenceMax}s`, step: 5 },
                  { label: "Launch Plan", value: scheduledDateTime ? new Date(scheduledDateTime).toLocaleString() : "🚀 Immediate (as soon as you click Launch)", step: 0 },
                ].map((row, idx) => (
                  <div
                    key={row.label}
                    className={cn(
                      "flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer hover:bg-accent/20 transition-colors",
                      idx < 8 && "border-b border-border/50"
                    )}
                    onClick={() => setCurrentStep(row.step)}
                  >
                    <span className="text-muted-foreground text-xs">{row.label}</span>
                    <span className="font-medium text-xs text-right truncate max-w-[55%]">{row.value}</span>
                  </div>
                ))}
              </div>

              {scheduledDateTime && new Date(scheduledDateTime) < new Date() && (
                <div className="flex items-center gap-1.5 p-2.5 rounded-md bg-warning/10 border border-warning/20">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
                  <p className="text-[10px] text-warning">The scheduled time is in the past. Messages will start sending immediately after launch.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0 || launching}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Previous
          </Button>
          {currentStep < steps.length - 1 ? (
            <Button size="sm" onClick={() => setCurrentStep(currentStep + 1)}>
              Next <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          ) : (
            <Button
              size="sm"
              className="bg-success hover:bg-success/90 text-success-foreground"
              onClick={handleLaunch}
              disabled={launching}
            >
              {launching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Launch Campaign
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
