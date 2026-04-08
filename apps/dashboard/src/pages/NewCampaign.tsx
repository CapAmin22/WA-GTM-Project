import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const steps = [
  "Campaign Basics",
  "Select Audience",
  "Choose Message",
  "A/B Testing",
  "Send Schedule",
  "Stealth Settings",
  "Review & Launch",
];

export default function NewCampaignPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  // Data loaded for selections
  const [templates, setTemplates] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  
  const [segmentId, setSegmentId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [abEnabled, setAbEnabled] = useState(false);

  // Limits & Schedule
  const [sendWindowStart, setSendWindowStart] = useState(10);
  const [sendWindowEnd, setSendWindowEnd] = useState(22);
  const [dailyLimit, setDailyLimit] = useState(500);
  const [perAccountLimit, setPerAccountLimit] = useState(125);

  // Stealth
  const [jitterMin, setJitterMin] = useState(0.8);
  const [jitterMax, setJitterMax] = useState(1.2);
  const [presenceMin, setPresenceMin] = useState(4);
  const [presenceMax, setPresenceMax] = useState(9);

  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    async function loadData() {
      const [tRes, sRes] = await Promise.all([
        supabase.from("message_templates").select("id, name, body").eq("is_archived", false),
        supabase.from("contact_segments").select("id, name, contact_count"),
      ]);
      setTemplates(tRes.data || []);
      setSegments(sRes.data || []);
      setLoadingData(false);
    }
    loadData();
  }, []);

  const handleLaunch = async () => {
    if (!name || !segmentId || !templateId) {
      toast.error("Please ensure Name, Segment, and Template are selected.");
      return;
    }

    setLaunching(true);

    try {
      // 1. Fetch contacts for this segment
      // NOTE: For MVP, if they select segment, we just pull ALL contacts with any tag as a placeholder if proper segment filtering logic isn't fully implemented in DB yet. 
      // We'll mimic pulling recipients here:
      const { data: routeContacts } = await supabase.from("contacts").select("id, phone, name").eq("is_blacklisted", false);
      const targetContacts = routeContacts || []; // In real app, apply segment rules

      if (targetContacts.length === 0) {
        toast.error("Selected audience has no valid contacts.");
        setLaunching(false);
        return;
      }

      // 2. Create Campaign
      const { data: campaign, error: campErr } = await supabase.from("campaigns").insert({
        name,
        description,
        segment_id: segmentId,
        template_id: templateId,
        scheduled_date: scheduledDate || null,
        send_window_start: sendWindowStart,
        send_window_end: sendWindowEnd,
        daily_limit: dailyLimit,
        per_account_limit: perAccountLimit,
        jitter_min: jitterMin,
        jitter_max: jitterMax,
        presence_min_sec: presenceMin,
        presence_max_sec: presenceMax,
        total_recipients: targetContacts.length,
        status: scheduledDate ? "scheduled" : "active",
      }).select().single();

      if (campErr) throw campErr;

      // 3. Queue Messages
      const selectedTemplate = templates.find(t => t.id === templateId);
      
      const queueInserts = targetContacts.map(contact => ({
        campaign_id: campaign.id,
        recipient_phone: contact.phone,
        recipient_name: contact.name,
        message_template: selectedTemplate?.body || "",
        status: "pending",
        scheduled_for: new Date().toISOString() // Or scheduled date
      }));

      // Insert in chunks to avoid huge payload limits
      const chunked = [];
      for(let i = 0; i < queueInserts.length; i += 500) {
        chunked.push(queueInserts.slice(i, i+500));
      }

      for (const batch of chunked) {
        const { error: qErr } = await supabase.from("message_queue").insert(batch);
        if (qErr) throw qErr;
      }

      toast.success("Campaign launched successfully!");
      navigate("/campaigns");

    } catch (err: any) {
      toast.error("Launch failed: " + err.message);
    } finally {
      setLaunching(false);
    }
  };

  const getSummary = () => {
    const sName = segments.find(s => s.id === segmentId)?.name || "Not selected";
    const tName = templates.find(t => t.id === templateId)?.name || "Not selected";
    return { sName, tName };
  };

  if (loadingData) return <AppLayout><div className="flex justify-center p-20"><Loader2 className="animate-spin text-muted-foreground w-6 h-6" /></div></AppLayout>;

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
          <h2 className="text-base font-medium mb-4">{steps[currentStep]}</h2>

          {currentStep === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Campaign Name *</Label>
                <Input placeholder="e.g., Diwali Promo 2026" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Description</Label>
                <textarea 
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-1 focus:ring-ring" 
                  placeholder="Describe this campaign..." 
                  value={description} onChange={e => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Scheduled Date (optional - leave blank for immediate)</Label>
                <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              {segments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No segments available. Create one in Contacts first.</p>
              ) : (
                segments.map((s) => (
                  <label key={s.id} className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-accent/30 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input type="radio" name="audience" checked={segmentId === s.id} onChange={() => setSegmentId(s.id)} className="accent-[hsl(210,100%,56%)]" />
                      <span className="text-sm font-medium">{s.name}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">{s.contact_count} contacts</Badge>
                  </label>
                ))
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No templates available. Create one first.</p>
              ) : (
                templates.map((t) => (
                  <label key={t.id} className="flex items-start gap-3 p-4 rounded-md border border-border hover:bg-accent/30 transition-colors cursor-pointer">
                    <input type="radio" name="template" checked={templateId === t.id} onChange={() => setTemplateId(t.id)} className="accent-[hsl(210,100%,56%)] mt-1" />
                    <div>
                      <span className="text-sm font-medium block">{t.name}</span>
                      <span className="text-xs text-muted-foreground font-mono mt-1 block line-clamp-2">{t.body}</span>
                    </div>
                  </label>
                ))
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={abEnabled} onChange={e => setAbEnabled(e.target.checked)} className="accent-[hsl(210,100%,56%)]" />
                <span className="text-sm font-medium">Enable A/B Testing</span>
              </label>
              <p className="text-xs text-muted-foreground">Currently A/B test setup must be done through the A/B Testing Lab first if you want complex split logic.</p>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Send Window Start (Hour)</Label>
                  <Input type="number" value={sendWindowStart} onChange={e => setSendWindowStart(parseInt(e.target.value)||0)} min={0} max={23} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Send Window End (Hour)</Label>
                  <Input type="number" value={sendWindowEnd} onChange={e => setSendWindowEnd(parseInt(e.target.value)||23)} min={0} max={23} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Daily Limit (Total messages across all accounts)</Label>
                <Input type="number" value={dailyLimit} onChange={e => setDailyLimit(parseInt(e.target.value)||0)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Per-Account Daily Limit</Label>
                <Input type="number" value={perAccountLimit} onChange={e => setPerAccountLimit(parseInt(e.target.value)||0)} />
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Jitter Min (Multiplier)</Label>
                  <Input type="number" step="0.1" value={jitterMin} onChange={e => setJitterMin(parseFloat(e.target.value)||0)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Jitter Max (Multiplier)</Label>
                  <Input type="number" step="0.1" value={jitterMax} onChange={e => setJitterMax(parseFloat(e.target.value)||0)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Composing Presence Min (sec)</Label>
                  <Input type="number" value={presenceMin} onChange={e => setPresenceMin(parseInt(e.target.value)||0)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Composing Presence Max (sec)</Label>
                  <Input type="number" value={presenceMax} onChange={e => setPresenceMax(parseInt(e.target.value)||0)} />
                </div>
              </div>
            </div>
          )}

          {currentStep === 6 && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted/50 p-4 text-sm space-y-3">
                <div className="flex justify-between border-b border-border/50 pb-2"><span className="text-muted-foreground">Campaign:</span><span className="font-medium text-right">{name || "—"}</span></div>
                <div className="flex justify-between border-b border-border/50 pb-2"><span className="text-muted-foreground">Audience:</span><span className="font-medium text-right">{getSummary().sName}</span></div>
                <div className="flex justify-between border-b border-border/50 pb-2"><span className="text-muted-foreground">Template:</span><span className="font-medium text-right truncate max-w-[200px]">{getSummary().tName}</span></div>
                <div className="flex justify-between border-b border-border/50 pb-2"><span className="text-muted-foreground">Window:</span><span className="font-medium text-right">{sendWindowStart}:00 - {sendWindowEnd}:00</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Daily Limit:</span><span className="font-medium text-right">{dailyLimit} messages</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="outline" size="sm" onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0 || launching}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Previous
          </Button>
          {currentStep < steps.length - 1 ? (
            <Button size="sm" onClick={() => setCurrentStep(currentStep + 1)}>
              Next <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          ) : (
            <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={handleLaunch} disabled={launching}>
              {launching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Launch Campaign
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
