import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function LiveActivityFeed() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecentLogs = async () => {
    const { data, error } = await supabase
      .from("send_logs")
      .select(`
        id, 
        status, 
        error_message, 
        created_at, 
        message_queue (recipient_phone), 
        wa_accounts (display_name),
        campaigns (name)
      `)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error && data) {
      const formatted = data.map((l: any) => ({
        id: l.id,
        status: l.status,
        phone: l.message_queue?.recipient_phone || "Unknown",
        account: l.wa_accounts?.display_name || "System",
        time: formatTime(l.created_at),
        template: l.campaigns?.name || "Manual",
        error: l.error_message
      }));
      setActivities(formatted);
    }
    setLoading(false);
  };

  const formatTime = (dateStr: string) => {
    const diff = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  useEffect(() => {
    fetchRecentLogs();

    // Subscribe to real-time send_logs
    const channel = supabase
      .channel("live_activity")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "send_logs" }, () => {
        fetchRecentLogs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
              {a.status === "sent" && (
                <CheckCircle className="h-3.5 w-3.5 text-success flex-shrink-0" />
              )}
              {a.status === "failed" && (
                <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
              )}
              {a.status === "queued" && (
                <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-xs text-foreground truncate block">
                  {a.status === "sent" && `Sent to ${a.phone} via ${a.account}`}
                  {a.status === "failed" && `Failed: ${a.phone} (${a.error || 'Unknown Error'})`}
                  {a.status === "queued" && `Queued: ${a.phone}`}
                </span>
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
