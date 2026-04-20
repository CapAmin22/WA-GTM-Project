import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Save, Loader2, Power, Gauge, Shield, Bell, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Key names exactly as defined in migration 004 seed data ──────
const CONFIG_KEYS = {
  SEND_ENABLED: "global_send_enabled",
  DAILY_LIMIT: "daily_total_limit",
  PER_ACCOUNT_LIMIT: "per_account_limit",
  JITTER_MIN: "jitter_min",
  JITTER_MAX: "jitter_max",
  COMPOSING_MIN: "presence_composing_min_sec",
  COMPOSING_MAX: "presence_composing_max_sec",
  READ_PROB: "presence_read_probability",
  OFFLINE_MIN: "presence_offline_min_sec",
  OFFLINE_MAX: "presence_offline_max_sec",
  AUTO_COOLDOWN: "auto_cooldown_on_rate_limit",
  EMAIL_ALERTS: "email_alerts_enabled",
  ALERT_ON_BAN: "alert_on_ban",
  ALERT_ON_LOGOUT: "alert_on_logout",
};

function Section({ title, icon: Icon, description, children }: { title: string; icon?: any; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start gap-3 mb-4">
        {Icon && <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0"><Icon className="h-4 w-4" /></div>}
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{description}</p>}
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label className="text-sm">{label}</Label>
        {description && <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function SafetyHint({ level, text }: { level: "safe" | "warning" | "danger"; text: string }) {
  const styles = {
    safe: "bg-success/10 border-success/20 text-success",
    warning: "bg-warning/10 border-warning/20 text-warning",
    danger: "bg-destructive/10 border-destructive/20 text-destructive",
  };
  return (
    <div className={`flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded text-[10px] border ${styles[level]}`}>
      {level === "safe" ? "✅" : level === "warning" ? "⚠️" : "🚨"} {text}
    </div>
  );
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [sendEnabled, setSendEnabled] = useState(true);
  const [dailyLimit, setDailyLimit] = useState([150]);
  const [perAccountLimit, setPerAccountLimit] = useState([40]);
  const [jitterRange, setJitterRange] = useState([0.7, 2.0]);
  const [composingRange, setComposingRange] = useState([4, 9]);
  const [readProb, setReadProb] = useState([30]);
  const [offlineRange, setOfflineRange] = useState([5, 15]);
  const [autoCooldown, setAutoCooldown] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [alertOnBan, setAlertOnBan] = useState(true);
  const [alertOnLogout, setAlertOnLogout] = useState(true);

  useEffect(() => {
    async function loadConfig() {
      const { data, error } = await supabase.from("system_config").select("*");
      if (error) {
        toast.error("Failed to load config: " + error.message);
        setLoading(false);
        return;
      }

      const map: Record<string, any> = {};
      for (const row of data || []) {
        map[row.key] = row.value;
      }

      if (map[CONFIG_KEYS.SEND_ENABLED] !== undefined)   setSendEnabled(Boolean(map[CONFIG_KEYS.SEND_ENABLED]));
      if (map[CONFIG_KEYS.DAILY_LIMIT] !== undefined)    setDailyLimit([Number(map[CONFIG_KEYS.DAILY_LIMIT])]);
      if (map[CONFIG_KEYS.PER_ACCOUNT_LIMIT] !== undefined) setPerAccountLimit([Number(map[CONFIG_KEYS.PER_ACCOUNT_LIMIT])]);
      if (map[CONFIG_KEYS.JITTER_MIN] !== undefined && map[CONFIG_KEYS.JITTER_MAX] !== undefined) {
        setJitterRange([Number(map[CONFIG_KEYS.JITTER_MIN]), Number(map[CONFIG_KEYS.JITTER_MAX])]);
      }
      if (map[CONFIG_KEYS.COMPOSING_MIN] !== undefined && map[CONFIG_KEYS.COMPOSING_MAX] !== undefined) {
        setComposingRange([Number(map[CONFIG_KEYS.COMPOSING_MIN]), Number(map[CONFIG_KEYS.COMPOSING_MAX])]);
      }
      if (map[CONFIG_KEYS.READ_PROB] !== undefined) {
        setReadProb([Math.round(Number(map[CONFIG_KEYS.READ_PROB]) * 100)]);
      }
      if (map[CONFIG_KEYS.OFFLINE_MIN] !== undefined && map[CONFIG_KEYS.OFFLINE_MAX] !== undefined) {
        setOfflineRange([Number(map[CONFIG_KEYS.OFFLINE_MIN]), Number(map[CONFIG_KEYS.OFFLINE_MAX])]);
      }
      if (map[CONFIG_KEYS.AUTO_COOLDOWN] !== undefined)  setAutoCooldown(Boolean(map[CONFIG_KEYS.AUTO_COOLDOWN]));
      if (map[CONFIG_KEYS.EMAIL_ALERTS] !== undefined)   setEmailAlerts(Boolean(map[CONFIG_KEYS.EMAIL_ALERTS]));
      if (map[CONFIG_KEYS.ALERT_ON_BAN] !== undefined)   setAlertOnBan(Boolean(map[CONFIG_KEYS.ALERT_ON_BAN]));
      if (map[CONFIG_KEYS.ALERT_ON_LOGOUT] !== undefined) setAlertOnLogout(Boolean(map[CONFIG_KEYS.ALERT_ON_LOGOUT]));

      setLoading(false);
    }
    loadConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);

    const rows = [
      { key: CONFIG_KEYS.SEND_ENABLED,      value: sendEnabled },
      { key: CONFIG_KEYS.DAILY_LIMIT,       value: dailyLimit[0] },
      { key: CONFIG_KEYS.PER_ACCOUNT_LIMIT, value: perAccountLimit[0] },
      { key: CONFIG_KEYS.JITTER_MIN,        value: jitterRange[0] },
      { key: CONFIG_KEYS.JITTER_MAX,        value: jitterRange[1] },
      { key: CONFIG_KEYS.COMPOSING_MIN,     value: composingRange[0] },
      { key: CONFIG_KEYS.COMPOSING_MAX,     value: composingRange[1] },
      { key: CONFIG_KEYS.READ_PROB,         value: readProb[0] / 100 },
      { key: CONFIG_KEYS.OFFLINE_MIN,       value: offlineRange[0] },
      { key: CONFIG_KEYS.OFFLINE_MAX,       value: offlineRange[1] },
      { key: CONFIG_KEYS.AUTO_COOLDOWN,     value: autoCooldown },
      { key: CONFIG_KEYS.EMAIL_ALERTS,      value: emailAlerts },
      { key: CONFIG_KEYS.ALERT_ON_BAN,      value: alertOnBan },
      { key: CONFIG_KEYS.ALERT_ON_LOGOUT,   value: alertOnLogout },
    ];

    const { error } = await supabase
      .from("system_config")
      .upsert(rows, { onConflict: "key" });

    setSaving(false);
    if (error) {
      toast.error("Failed to save settings: " + error.message);
    } else {
      toast.success("Settings saved successfully.");
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin w-6 h-6 text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  // Safety level helpers
  const dailySafety: "safe" | "warning" | "danger" = dailyLimit[0] <= 150 ? "safe" : dailyLimit[0] <= 400 ? "warning" : "danger";
  const dailySafetyText = dailyLimit[0] <= 150 ? "Conservative — very low ban risk" : dailyLimit[0] <= 400 ? "Moderate — acceptable for established accounts" : "Aggressive — high ban risk for new accounts";
  const perAccSafety: "safe" | "warning" | "danger" = perAccountLimit[0] <= 40 ? "safe" : perAccountLimit[0] <= 100 ? "warning" : "danger";
  const perAccSafetyText = perAccountLimit[0] <= 40 ? "Safe — well within WhatsApp's tolerance" : perAccountLimit[0] <= 100 ? "Moderate — monitor for rate-limiting" : "Aggressive — may trigger temporary bans";

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">Configure how the worker sends messages and protects your accounts.</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Changes
          </Button>
        </div>

        {/* General */}
        <Section title="General" icon={Power} description="Master controls for the entire messaging system. Turning off the Master Send Toggle will immediately halt all outgoing messages across all campaigns.">
          <SettingRow
            label="Master Send Toggle"
            description="When OFF, the worker will still poll the queue but will NOT send any messages. Use this as an emergency kill switch."
          >
            <Switch checked={sendEnabled} onCheckedChange={setSendEnabled} />
          </SettingRow>
          {!sendEnabled && (
            <SafetyHint level="warning" text="All message sending is currently PAUSED. No messages will go out until you turn this back on." />
          )}
        </Section>

        {/* Volume Limits */}
        <Section title="Volume Limits" icon={Gauge} description="Throttle how many messages are sent per day. Lower limits keep your accounts safer from WhatsApp's anti-spam detection. These are GLOBAL limits that apply across all campaigns.">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <Label className="font-medium">Daily Total Limit</Label>
              <span className="text-muted-foreground font-mono">{dailyLimit[0].toLocaleString()} messages</span>
            </div>
            <Slider value={dailyLimit} onValueChange={setDailyLimit} min={50} max={5000} step={50} />
            <p className="text-[10px] text-muted-foreground">Maximum messages sent per day across ALL connected WhatsApp accounts combined. Once hit, remaining messages queue for the next day.</p>
            <SafetyHint level={dailySafety} text={dailySafetyText} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <Label className="font-medium">Per-Account Daily Limit</Label>
              <span className="text-muted-foreground font-mono">{perAccountLimit[0].toLocaleString()} messages</span>
            </div>
            <Slider value={perAccountLimit} onValueChange={setPerAccountLimit} min={10} max={500} step={10} />
            <p className="text-[10px] text-muted-foreground">Maximum messages a single WhatsApp account can send per day. Prevents any one account from being overworked. Accounts that hit this limit are rotated out.</p>
            <SafetyHint level={perAccSafety} text={perAccSafetyText} />
          </div>
        </Section>

        {/* Stealth & Jitter */}
        <Section title="Stealth & Anti-Detection" icon={Shield} description="These settings make your automated messages appear human-typed. WhatsApp monitors for bot patterns like identical timing and instant sends. Properly configured stealth is your #1 defense against account bans.">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <Label className="font-medium">🎲 Delay Jitter (Multiplier Range)</Label>
              <span className="text-muted-foreground font-mono">{jitterRange[0]}× – {jitterRange[1]}×</span>
            </div>
            <Slider value={jitterRange} onValueChange={setJitterRange} min={0.3} max={3.0} step={0.1} minStepsBetweenThumbs={1} />
            <p className="text-[10px] text-muted-foreground">The base delay between messages (15s) is multiplied by a random value in this range. At 0.7×–2.0×, the actual gap is randomly 10–30 seconds. Wider range = more human-like.</p>
            {jitterRange[1] - jitterRange[0] < 0.5 && (
              <SafetyHint level="warning" text="Jitter range is very narrow. Messages will have nearly identical timing, which looks bot-like." />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <Label className="font-medium">⌨️ Typing Indicator Duration</Label>
              <span className="text-muted-foreground font-mono">{composingRange[0]}s – {composingRange[1]}s</span>
            </div>
            <Slider value={composingRange} onValueChange={setComposingRange} min={1} max={30} step={1} minStepsBetweenThumbs={1} />
            <p className="text-[10px] text-muted-foreground">Before each message, the bot shows a "typing..." indicator for a random duration in this range. Makes it look like a real person composing. Recommended: 5–12 seconds.</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <Label className="font-medium">👁️ Read Receipt Probability</Label>
              <span className="text-muted-foreground font-mono">{readProb[0]}%</span>
            </div>
            <Slider value={readProb} onValueChange={setReadProb} min={0} max={100} step={5} />
            <p className="text-[10px] text-muted-foreground">Chance the bot marks incoming messages as "read" (blue ticks). Lower = messages stay on grey ticks, mimicking a busy person. Set 0% for max stealth.</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <Label className="font-medium">💤 Offline Period After Send</Label>
              <span className="text-muted-foreground font-mono">{offlineRange[0]}s – {offlineRange[1]}s</span>
            </div>
            <Slider value={offlineRange} onValueChange={setOfflineRange} min={1} max={60} step={1} minStepsBetweenThumbs={1} />
            <p className="text-[10px] text-muted-foreground">After sending, the bot briefly goes "offline" for a random duration. Simulates a human closing the app after sending. Avoids always-online bot patterns.</p>
          </div>
        </Section>

        {/* Protections */}
        <Section title="Protections" icon={AlertTriangle} description="Automatic safety mechanisms that kick in when WhatsApp starts pushing back. Keep these ON unless you have a specific reason to disable them.">
          <SettingRow
            label="Auto-Cooldown on Rate Limit"
            description="When WhatsApp rate-limits an account (429/slow-down signals), automatically pause that account for 30 minutes. Prevents escalation from a warning to a permanent ban."
          >
            <Switch checked={autoCooldown} onCheckedChange={setAutoCooldown} />
          </SettingRow>
          {!autoCooldown && (
            <SafetyHint level="danger" text="Auto-cooldown is OFF. If WhatsApp rate-limits an account, the worker will keep trying, which can result in a permanent ban." />
          )}
        </Section>

        {/* Notifications */}
        <Section title="Notifications" icon={Bell} description="Get alerted when critical events happen. Email alerts require SMTP to be configured in your worker environment.">
          <SettingRow label="Global Email Alerts" description="Enable email notifications for critical system events.">
            <Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />
          </SettingRow>
          {emailAlerts && (
            <>
              <SettingRow label="Alert on Account Ban" description="Receive an immediate email if any WhatsApp account is permanently banned.">
                <Switch checked={alertOnBan} onCheckedChange={setAlertOnBan} />
              </SettingRow>
              <SettingRow label="Alert on Account Logout" description="Get notified when a WhatsApp account logs out and needs re-pairing.">
                <Switch checked={alertOnLogout} onCheckedChange={setAlertOnLogout} />
              </SettingRow>
            </>
          )}
        </Section>
      </div>
    </AppLayout>
  );
}
