import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const severityStyles: Record<string, string> = {
  info: "bg-primary/10 text-primary border-primary/20",
  success: "bg-success/10 text-success border-success/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  error: "bg-destructive/10 text-destructive border-destructive/20",
  warning: "bg-warning/10 text-warning border-warning/20",
};

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchLogs = async () => {
    // Note: send_logs usually tracks message sends. We might also have a system_events table.
    // For MVP, we will query send_logs and format it.
    const { data, error } = await supabase
      .from("send_logs")
      .select("id, status, error_message, created_at, message_queue(recipient_phone, recipient_name), wa_accounts(display_name)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      toast.error("Failed to load logs: " + error.message);
    } else if (data) {
      const formatted = data.map((l: any) => ({
        id: l.id,
        time: new Date(l.created_at).toLocaleString(),
        event: l.status === "failed" ? "message_failed" : `message_${l.status}`,
        details: l.status === "failed" 
          ? `Failed to send to ${l.message_queue?.recipient_phone} via ${l.wa_accounts?.display_name || 'System'}: ${l.error_message}`
          : `Sent to ${l.message_queue?.recipient_phone} via ${l.wa_accounts?.display_name || 'System'}`,
        severity: l.status === "failed" ? "error" : "success"
      }));
      setLogs(formatted);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();

    const channel = supabase
      .channel('public:send_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'send_logs' }, () => {
        fetchLogs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = logs.filter(
    (l) =>
      l.event.includes(search.toLowerCase()) ||
      l.details.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <AppLayout><div className="flex justify-center p-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activity Log</h1>
          <p className="text-sm text-muted-foreground mt-1">Audit trail of system messaging events</p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search events..." className="pl-9 h-9 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center flex flex-col items-center">
            <AlertCircle className="w-8 h-8 text-muted-foreground mb-3 opacity-50" />
            <p className="text-muted-foreground text-sm">No activity logs found.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="divide-y divide-border">
              {filtered.map((log) => (
                <div key={log.id} className="flex items-center gap-4 px-4 py-3 hover:bg-accent/30 transition-colors">
                  <span className="text-xs text-muted-foreground font-mono w-[160px] flex-shrink-0">{log.time}</span>
                  <Badge variant="outline" className={cn("text-[10px] capitalize w-[110px] justify-center flex-shrink-0", severityStyles[log.severity])}>
                    {log.event.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-xs text-foreground flex-1 break-all">{log.details}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
