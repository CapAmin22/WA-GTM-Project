import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Save, TestTube2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SettingSection {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SettingSection) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="text-sm font-medium mb-4">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label className="text-sm">{label}</Label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [sendEnabled, setSendEnabled] = useState(true);
  const [dailyLimit, setDailyLimit] = useState([500]);
  const [perAccountLimit, setPerAccountLimit] = useState([125]);
  const [jitterRange, setJitterRange] = useState([0.8, 1.2]);
  const [composingRange, setComposingRange] = useState([4, 9]);
  const [readProb, setReadProb] = useState([30]);
  const [offlineRange, setOfflineRange] = useState([5, 15]);
  const [autoCooldown, setAutoCooldown] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      const { data, error } = await supabase.from("system_config").select("*");
      if (error) {
        toast.error("Failed to load config: " + error.message);
      } else if (data) {
        const configMap = data.reduce((acc: any, curr: any) => {
          acc[curr.key] = curr.value;
          return acc;
        }, {});

        // Maps to UI state
        if (configMap.master_send_enabled !== undefined) setSendEnabled(configMap.master_send_enabled);
        if (configMap.daily_total_limit !== undefined) setDailyLimit([configMap.daily_total_limit]);
        if (configMap.per_account_limit !== undefined) setPerAccountLimit([configMap.per_account_limit]);
        if (configMap.jitter_range !== undefined) setJitterRange([configMap.jitter_range.min || 0.8, configMap.jitter_range.max || 1.2]);
        if (configMap.composing_range_sec !== undefined) setComposingRange([configMap.composing_range_sec.min || 4, configMap.composing_range_sec.max || 9]);
        if (configMap.auto_cooldown !== undefined) setAutoCooldown(configMap.auto_cooldown);
      }
      setLoading(false);
    }
    loadConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    
    // Convert UI states to DB array format
    const configs = [
      { key: "master_send_enabled", value: sendEnabled },
      { key: "daily_total_limit", value: dailyLimit[0] },
      { key: "per_account_limit", value: perAccountLimit[0] },
      { key: "jitter_range", value: { min: jitterRange[0], max: jitterRange[1] } },
      { key: "composing_range_sec", value: { min: composingRange[0], max: composingRange[1] } },
      { key: "auto_cooldown", value: autoCooldown }
    ];

    const { error } = await supabase.from("system_config").upsert(configs);
    
    setSaving(false);
    if (error) {
      toast.error("Failed to save settings: " + error.message);
    } else {
      toast.success("Settings saved successfully");
    }
  };

  if (loading) return <AppLayout><div className="flex justify-center py-20"><Loader2 className="animate-spin w-6 h-6 text-muted-foreground" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">System configuration and controls</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Save className="h-3.5 w-3.5" />} Save Changes
          </Button>
        </div>

        <Section title="General">
          <SettingRow label="Master Send Toggle" description="Enable or disable all message sending across all campaigns">
            <Switch checked={sendEnabled} onCheckedChange={setSendEnabled} />
          </SettingRow>
        </Section>

        <Section title="Volume Limits">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <Label>Daily Total Limit</Label>
              <span className="text-muted-foreground">{dailyLimit[0]}</span>
            </div>
            <Slider value={dailyLimit} onValueChange={setDailyLimit} min={100} max={5000} step={50} />
          </div>
          <div className="space-y-2 mt-4">
            <div className="flex justify-between text-xs">
              <Label>Per-Account Limit</Label>
              <span className="text-muted-foreground">{perAccountLimit[0]}</span>
            </div>
            <Slider value={perAccountLimit} onValueChange={setPerAccountLimit} min={25} max={1000} step={25} />
          </div>
        </Section>

        <Section title="Stealth Settings & Jitter">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <Label>Delay Multiplier (Jitter)</Label>
              <span className="text-muted-foreground">{jitterRange[0]}x – {jitterRange[1]}x</span>
            </div>
            <Slider value={jitterRange} onValueChange={setJitterRange} min={0.5} max={3.0} step={0.1} minStepsBetweenThumbs={1} />
            <p className="text-[10px] text-muted-foreground mt-1">Worker computes dynamic delays multiplying base interval by a random jitter in this range.</p>
          </div>
          <div className="space-y-2 mt-6">
            <div className="flex justify-between text-xs">
              <Label>Simulated Composing Duration (sec)</Label>
              <span className="text-muted-foreground">{composingRange[0]}s – {composingRange[1]}s</span>
            </div>
            <Slider value={composingRange} onValueChange={setComposingRange} min={1} max={30} step={1} minStepsBetweenThumbs={1} />
          </div>
          <div className="space-y-2 mt-6">
            <div className="flex justify-between text-xs">
              <Label>Random Read Receipt Probability</Label>
              <span className="text-muted-foreground">{readProb[0]}%</span>
            </div>
            <Slider value={readProb} onValueChange={setReadProb} min={0} max={100} step={5} />
          </div>
        </Section>

        <Section title="Protections">
          <SettingRow label="Auto-Cooldown on Rate Limit" description="Automatically pause accounts for a duration on heavy rate limits">
            <Switch checked={autoCooldown} onCheckedChange={setAutoCooldown} />
          </SettingRow>
        </Section>
        
        <Section title="Notifications">
          <SettingRow label="Global Email Alerts">
            <Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />
          </SettingRow>
        </Section>
      </div>
    </AppLayout>
  );
}
