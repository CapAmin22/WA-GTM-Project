import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

function formatTime(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function LiveActivityFeed() {
  // Store raw ISO timestamps; compute display time reactively via ticker
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchRecentLogs = useCallback(async () => {
    const { data, error } = await supabase
      .from("send_logs")
      .select(`id, status, error_message, created_at,
        message_queue (recipient_phone),
        wa_accounts (display_name),
        campaigns (name)`)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error && data) {
      setRawLogs(data.map((l: any) => ({
        id: l.id,
        status: l.status,
        phone: l.message_queue?.recipient_phone || "Unknown",
        account: l.wa_accounts?.display_name || "System",
        createdAt: l.created_at,
        campaign: l.campaigns?.name || null,
        error: l.error_message,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRecentLogs();

    const channel = supabase
      .channel("live_activity")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "send_logs" }, fetchRecentLogs)
      .subscribe();

    // Tick every 30s so relative timestamps stay fresh
    const ticker = setInterval(() => setTick((t) => t + 1), 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(ticker);
    };
  }, [fetchRecentLogs]);

  // Derive display-ready activities on each tick
  const activities = rawLogs.map((l) => ({ ...l, time: formatTime(l.createdAt) }));

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-medium">Live Activity Feed</h3>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          Live
        </div>
      </div>
      <div className="divide-y divide-border max-h-[320px] overflow-y-auto">
        {activities.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">No recent activity.</div>
        ) : (
          activities.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 transition-colors cursor-pointer"
            >
              {a.status === "sent"
                ? <CheckCircle className="h-3.5 w-3.5 text-success flex-shrink-0" />
                : <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <span className="text-xs text-foreground truncate block">
                  {a.status === "sent"
                    ? `Sent to ${a.phone} via ${a.account}`
                    : `Failed: ${a.phone} — ${a.error || 'Unknown Error'}`
                  }
                </span>
                {a.campaign && (
                  <span className="text-[10px] text-muted-foreground truncate block">{a.campaign}</span>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground flex-shrink-0">
                {a.time}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
