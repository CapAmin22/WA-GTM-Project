import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, AlertCircle, CheckCircle2, XCircle, Filter, RefreshCw, ChevronLeft, ChevronRight, Activity, TrendingUp, TrendingDown } from "lucide-react";
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

type FilterType = "all" | "sent" | "failed";

const PAGE_SIZE = 50;

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(0);

  const fetchLogs = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);

    const { data, error } = await supabase
      .from("send_logs")
      .select("id, status, error_message, latency_ms, created_at, account_id, campaign_id, message_queue(recipient_phone, recipient_name), wa_accounts(display_name), campaigns(name)")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      toast.error("Failed to load logs: " + error.message);
    } else if (data) {
      const formatted = data.map((l: any) => ({
        id: l.id,
        timestamp: l.created_at,
        time: new Date(l.created_at).toLocaleString(),
        relativeTime: getRelativeTime(l.created_at),
        phone: l.message_queue?.recipient_phone || "Unknown",
        recipientName: l.message_queue?.recipient_name || null,
        account: l.wa_accounts?.display_name || "System",
        campaign: l.campaigns?.name || null,
        status: l.status,
        errorMessage: l.error_message || null,
        latency: l.latency_ms || null,
        event: l.status === "failed" ? "message_failed" : `message_${l.status}`,
        details: l.status === "failed"
          ? `Failed to send to ${l.message_queue?.recipient_phone || "?"} via ${l.wa_accounts?.display_name || "System"}: ${l.error_message}`
          : `Sent to ${l.message_queue?.recipient_phone || "?"} via ${l.wa_accounts?.display_name || "System"}`,
        severity: l.status === "failed" ? "error" : "success"
      }));
      setLogs(formatted);
    }
    setLoading(false);
    setRefreshing(false);
  };

  function getRelativeTime(isoDate: string) {
    const now = Date.now();
    const then = new Date(isoDate).getTime();
    const diffSec = Math.floor((now - then) / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  }

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

  // Stats
  const stats = useMemo(() => {
    const total = logs.length;
    const sent = logs.filter(l => l.status === "sent").length;
    const failed = logs.filter(l => l.status === "failed").length;
    const rate = total > 0 ? ((sent / total) * 100).toFixed(1) : "0";
    const avgLatency = logs.filter(l => l.latency && l.status === "sent")
      .reduce((acc, l, _, arr) => acc + (l.latency / arr.length), 0);
    return { total, sent, failed, rate, avgLatency: Math.round(avgLatency) };
  }, [logs]);

  // Filtered + searched + paginated
  const filtered = useMemo(() => {
    let result = logs;
    if (filter === "sent") result = result.filter(l => l.status === "sent");
    if (filter === "failed") result = result.filter(l => l.status === "failed");
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        l => l.phone?.toLowerCase().includes(q) ||
          l.account?.toLowerCase().includes(q) ||
          l.campaign?.toLowerCase().includes(q) ||
          l.errorMessage?.toLowerCase().includes(q) ||
          l.details.toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [filter, search]);

  if (loading) return <AppLayout><div className="flex justify-center p-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Activity Log</h1>
            <p className="text-sm text-muted-foreground mt-1">Real-time audit trail of all message sending events</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fetchLogs(true)} disabled={refreshing}>
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Activity className="h-3.5 w-3.5" />
              Total Events
            </div>
            <p className="text-xl font-semibold">{stats.total}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-success mb-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Sent Successfully
            </div>
            <p className="text-xl font-semibold text-success">{stats.sent}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-destructive mb-1">
              <XCircle className="h-3.5 w-3.5" />
              Failed
            </div>
            <p className="text-xl font-semibold text-destructive">{stats.failed}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Success Rate
            </div>
            <p className="text-xl font-semibold">{stats.rate}%</p>
          </div>
        </div>

        {/* Toolbar: Search + Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search by phone, account, campaign, error..." className="pl-9 h-9 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5 border border-border">
            {([
              { key: "all", label: "All", count: logs.length },
              { key: "sent", label: "Sent", count: stats.sent },
              { key: "failed", label: "Failed", count: stats.failed },
            ] as { key: FilterType; label: string; count: number }[]).map(f => (
              <button
                key={f.key}
                className={cn(
                  "px-3 py-1 text-xs rounded font-medium transition-colors",
                  filter === f.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setFilter(f.key)}
              >
                {f.label} <span className="text-[10px] opacity-60 ml-0.5">({f.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Log Table */}
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center flex flex-col items-center">
            <AlertCircle className="w-8 h-8 text-muted-foreground mb-3 opacity-50" />
            <p className="text-muted-foreground text-sm">No events match your filters.</p>
            <button className="text-primary text-xs underline mt-1" onClick={() => { setSearch(""); setFilter("all"); }}>Clear filters</button>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="grid grid-cols-[140px_90px_110px_100px_1fr_60px] gap-2 px-4 py-2 bg-muted/30 border-b border-border text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                <span>Time</span>
                <span>Status</span>
                <span>Recipient</span>
                <span>Account</span>
                <span>Details</span>
                <span className="text-right">Latency</span>
              </div>
              <div className="divide-y divide-border">
                {paged.map((log) => (
                  <div
                    key={log.id}
                    className={cn(
                      "grid grid-cols-[140px_90px_110px_100px_1fr_60px] gap-2 px-4 py-2.5 hover:bg-accent/20 transition-colors items-center",
                      log.status === "failed" && "bg-destructive/[0.02]"
                    )}
                  >
                    {/* Time */}
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground font-mono">{log.relativeTime}</span>
                      <span className="text-[9px] text-muted-foreground/60">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>

                    {/* Status Badge */}
                    <Badge variant="outline" className={cn("text-[9px] capitalize w-fit", severityStyles[log.severity])}>
                      {log.status === "sent" ? "✓ Sent" : "✗ Failed"}
                    </Badge>

                    {/* Recipient */}
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-mono truncate">{log.phone}</span>
                      {log.recipientName && <span className="text-[9px] text-muted-foreground truncate">{log.recipientName}</span>}
                    </div>

                    {/* Account */}
                    <span className="text-xs text-muted-foreground truncate">{log.account}</span>

                    {/* Details */}
                    <div className="min-w-0">
                      {log.campaign && (
                        <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded mr-1">{log.campaign}</span>
                      )}
                      {log.status === "failed" && log.errorMessage && (
                        <span className="text-[10px] text-destructive">{log.errorMessage}</span>
                      )}
                    </div>

                    {/* Latency */}
                    <span className="text-[10px] text-muted-foreground text-right font-mono">
                      {log.latency ? `${(log.latency / 1000).toFixed(1)}s` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length} events</span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === 0} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="px-2">Page {page + 1} of {totalPages}</span>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
