import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pause, Play, Trash2, Loader2, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  active:    "bg-success/15 text-success border-success/30",
  completed: "bg-primary/15 text-primary border-primary/30",
  draft:     "bg-muted text-muted-foreground border-border",
  paused:    "bg-warning/15 text-warning border-warning/30",
  scheduled: "bg-info/15 text-info border-info/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};

interface HourlyPoint {
  hour: string;
  sent: number;
  failed: number;
}

interface ErrorRow {
  phone: string;
  error: string;
  time: string;
  account: string;
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<any>(null);
  const [hourlyData, setHourlyData] = useState<HourlyPoint[]>([]);
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  // Fetch campaign record only (lightweight — called on RT updates too)
  const fetchCampaign = async () => {
    if (!id) return;
    const { data: camp, error: campErr } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .single();
    if (campErr || !camp) {
      toast.error("Campaign not found.");
      navigate("/campaigns");
      return null;
    }
    setCampaign(camp);
    return camp;
  };

  // Fetch send_logs for chart + error table (heavy — only on mount & manual refresh)
  const fetchLogs = async () => {
    if (!id) return;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: logs } = await supabase
      .from("send_logs")
      .select("status, created_at, error_message, queue_item_id, account_id, wa_accounts(display_name), message_queue(recipient_phone)")
      .eq("campaign_id", id)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(500);

    if (!logs) return;

    // Build hourly buckets sorted by hour (0–23)
    const buckets: Record<number, { sent: number; failed: number }> = {};
    for (const log of logs) {
      const hour = new Date(log.created_at).getHours();
      if (!buckets[hour]) buckets[hour] = { sent: 0, failed: 0 };
      if (log.status === "sent") buckets[hour].sent++;
      else buckets[hour].failed++;
    }
    setHourlyData(
      Object.entries(buckets)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([h, v]) => {
          const hour = Number(h);
          const label = `${hour % 12 || 12}${hour < 12 ? "AM" : "PM"}`;
          return { hour: label, ...v };
        })
    );

    // Error rows from failed logs (last 20)
    setErrors(
      logs
        .filter((l) => l.status === "failed")
        .slice(-20)
        .map((l) => ({
          phone: (l as any).message_queue?.recipient_phone || "Unknown",
          error: l.error_message || "Unknown error",
          time: new Date(l.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          account: (l as any).wa_accounts?.display_name || "Unknown",
        }))
    );
  };

  useEffect(() => {
    // Initial load: fetch campaign + logs together
    const init = async () => {
      await Promise.all([fetchCampaign(), fetchLogs()]);
      setLoading(false);
    };
    init();

    // Real-time subscription: update counters only from payload — no log re-fetch
    const channel = supabase
      .channel(`campaign_detail_${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "campaigns", filter: `id=eq.${id}` },
        (payload) => {
          // Merge updated fields directly — avoids re-fetching send_logs on every send
          setCampaign((prev: any) => prev ? { ...prev, ...payload.new } : payload.new);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const handleTogglePause = async () => {
    if (!campaign) return;
    setToggling(true);
    const isPausingNow = campaign.status !== "paused";
    const newStatus = isPausingNow ? "paused" : "active";

    // 1. Update campaign status
    const { error } = await supabase
      .from("campaigns")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      setToggling(false);
      toast.error("Failed to update campaign: " + error.message);
      return;
    }

    // 2. Pause: cancel all pending queue items so the worker stops picking them up
    //    Resume: re-queue all cancelled items so the worker resumes processing
    if (isPausingNow) {
      await supabase
        .from("message_queue")
        .update({ status: "cancelled" })
        .eq("campaign_id", id)
        .eq("status", "pending");
    } else {
      await supabase
        .from("message_queue")
        .update({ status: "pending" })
        .eq("campaign_id", id)
        .eq("status", "cancelled");
    }

    setToggling(false);
    toast.success(isPausingNow ? "Campaign paused — sending stopped." : "Campaign resumed — sending restarted.");
    setCampaign((prev: any) => ({ ...prev, status: newStatus }));
  };

  const handleDelete = async () => {
    const { error } = await supabase
      .from("campaigns")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) {
      toast.error("Failed to cancel campaign: " + error.message);
    } else {
      toast.success("Campaign cancelled.");
      navigate("/campaigns");
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!campaign) return null;

  const deliveryRate =
    campaign.sent_count > 0
      ? (((campaign.sent_count - campaign.failed_count) / campaign.sent_count) * 100).toFixed(1)
      : "0.0";
  const failRate =
    campaign.sent_count > 0
      ? ((campaign.failed_count / campaign.sent_count) * 100).toFixed(1)
      : "0.0";
  const progress =
    campaign.total_recipients > 0
      ? Math.min(((campaign.sent_count + campaign.failed_count) / campaign.total_recipients) * 100, 100)
      : 0;
  const delivered = campaign.sent_count - campaign.failed_count;
  // Pending = total minus everything already processed (sent + failed)
  const pending = Math.max(0, campaign.total_recipients - campaign.sent_count - campaign.failed_count);
  const isPaused = campaign.status === "paused";

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/campaigns")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{campaign.name}</h1>
              <Badge
                variant="outline"
                className={cn("text-[11px] capitalize", statusColors[campaign.status] || statusColors.draft)}
              >
                {campaign.status}
              </Badge>
            </div>
            {campaign.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{campaign.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            {campaign.status !== "completed" && campaign.status !== "cancelled" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={handleTogglePause}
                disabled={toggling}
              >
                {toggling ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isPaused ? (
                  <Play className="h-3.5 w-3.5" />
                ) : (
                  <Pause className="h-3.5 w-3.5" />
                )}
                {isPaused ? "Resume" : "Pause"}
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" /> Cancel
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Campaign?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark the campaign as cancelled and stop all pending messages. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Campaign</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                    Cancel Campaign
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Sent", value: campaign.sent_count.toLocaleString(), sub: `/ ${campaign.total_recipients.toLocaleString()}` },
            { label: "Delivered", value: delivered.toLocaleString(), sub: `${deliveryRate}%` },
            { label: "Failed", value: campaign.failed_count.toLocaleString(), sub: `${failRate}%` },
            { label: "Pending", value: pending.toLocaleString(), sub: isPaused ? "paused" : "in queue" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-xl font-semibold mt-1">
                {s.value}{" "}
                <span className="text-sm text-muted-foreground font-normal">{s.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Campaign Progress</span>
            <span className="text-muted-foreground">{progress.toFixed(1)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {campaign.sent_count} sent of {campaign.total_recipients} total recipients
          </p>
        </div>

        {/* Hourly Chart */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Hourly Send Rate (last 24h)</h3>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={fetchLogs} title="Refresh chart">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
          {hourlyData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No send activity yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={hourlyData}>
                <defs>
                  <linearGradient id="sentGradDetail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(210, 100%, 56%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(210, 100%, 56%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "hsl(215, 14%, 50%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(215, 14%, 50%)" }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(220, 13%, 9%)",
                    border: "1px solid hsl(220, 13%, 15%)",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                />
                <Area type="monotone" dataKey="sent" name="Sent" stroke="hsl(210, 100%, 56%)" fill="url(#sentGradDetail)" strokeWidth={2} />
                <Area type="monotone" dataKey="failed" name="Failed" stroke="hsl(0, 72%, 51%)" fill="transparent" strokeWidth={1.5} strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Error Log */}
        {errors.length > 0 && (
          <div className="rounded-lg border border-border bg-card">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-medium">Recent Errors</h3>
            </div>
            <div className="divide-y divide-border">
              {errors.map((e, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-destructive">✕</span>
                    <span className="text-foreground font-mono">{e.phone}</span>
                    <span className="text-muted-foreground">{e.error}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{e.account}</span>
                    <span>{e.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Campaign Settings Summary */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium mb-3">Campaign Configuration</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            {[
              { label: "Send Window", value: `${campaign.send_window_start}:00 – ${campaign.send_window_end}:00` },
              { label: "Daily Limit", value: campaign.daily_limit?.toLocaleString() },
              { label: "Per-Account Limit", value: campaign.per_account_limit?.toLocaleString() },
              { label: "Jitter", value: `${campaign.jitter_min}× – ${campaign.jitter_max}×` },
              { label: "Composing", value: `${campaign.presence_min_sec}s – ${campaign.presence_max_sec}s` },
              { label: "Created", value: new Date(campaign.created_at).toLocaleDateString() },
            ].map((s) => (
              <div key={s.label} className="space-y-0.5">
                <div className="text-muted-foreground">{s.label}</div>
                <div className="font-medium">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
