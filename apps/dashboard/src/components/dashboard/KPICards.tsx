import { useState, useEffect } from "react";
import {
  Send,
  CheckCircle,
  Wifi,
  MessageSquare,
  Clock,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export function KPICards() {
  const [stats, setStats] = useState({
    sentToday: 0,
    dailyLimit: 0,
    deliveryRate: 0,
    activeAccounts: 0,
    totalAccounts: 0,
    replyRate: 0,
    queuePending: 0,
    failedToday: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Run all queries in parallel
      const [accountsRes, pendingRes, logsRes, repliesRes] = await Promise.all([
        supabase.from("wa_accounts").select("connection_status, daily_limit").eq("is_archived", false),
        supabase.from("message_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
        // Use send_logs as the authoritative source for today's sends — avoids inflated messages_sent_today
        supabase.from("send_logs").select("status").gte("created_at", todayStart.toISOString()),
        // Real reply rate from contacts table
        supabase.from("contacts").select("total_replies"),
      ]);

      const accounts = accountsRes.data || [];
      let _activeAccounts = 0;
      let _dailyLimit = 0;
      accounts.forEach(acc => {
        if (acc.connection_status === "connected") _activeAccounts++;
        _dailyLimit += acc.daily_limit || 0;
      });

      const logs = logsRes.data || [];
      let _sentToday = 0;
      let _failedToday = 0;
      logs.forEach(l => {
        if (l.status === "sent" || l.status === "delivered") _sentToday++;
        if (l.status === "failed") _failedToday++;
      });
      const totalAttempted = _sentToday + _failedToday;
      const _deliveryRate = totalAttempted > 0 ? (_sentToday / totalAttempted) * 100 : 0;

      // Real reply rate: total replies / total sent (all-time)
      const totalReplies = (repliesRes.data || []).reduce((sum, c) => sum + (c.total_replies || 0), 0);
      const { count: totalSentAllTime } = await supabase
        .from("send_logs")
        .select("id", { count: "exact", head: true })
        .eq("status", "sent");
      const _replyRate = totalSentAllTime && totalSentAllTime > 0
        ? (totalReplies / totalSentAllTime) * 100
        : 0;

      setStats({
        sentToday: _sentToday,
        dailyLimit: _dailyLimit,
        deliveryRate: _deliveryRate,
        activeAccounts: _activeAccounts,
        totalAccounts: accounts.length,
        replyRate: _replyRate,
        queuePending: pendingRes.count || 0,
        failedToday: _failedToday
      });
      setLoading(false);
    }

    fetchStats();

    // Auto-refresh every 30s
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const kpis = [
    {
      title: "Messages Sent (Today)",
      value: `${stats.sentToday} / ${stats.dailyLimit}`,
      subtitle: stats.dailyLimit > 0 ? `${((stats.sentToday / stats.dailyLimit) * 100).toFixed(1)}%` : "0%",
      icon: Send,
      color: "text-primary",
      bgColor: "bg-primary/10",
      borderColor: "border-primary/20",
    },
    {
      title: "Delivery Rate (Today)",
      value: `${stats.deliveryRate.toFixed(1)}%`,
      subtitle: "Last 24h",
      icon: CheckCircle,
      color: "text-success",
      bgColor: "bg-success/10",
      borderColor: "border-success/20",
    },
    {
      title: "Active Accounts",
      value: `${stats.activeAccounts} / ${stats.totalAccounts}`,
      subtitle: `${stats.totalAccounts - stats.activeAccounts} disconnected`,
      icon: Wifi,
      color: "text-warning",
      bgColor: "bg-warning/10",
      borderColor: "border-warning/20",
    },
    {
      title: "Reply Rate",
      value: `${stats.replyRate.toFixed(1)}%`,
      subtitle: "replies / sent (all-time)",
      icon: MessageSquare,
      color: "text-primary",
      bgColor: "bg-primary/10",
      borderColor: "border-primary/20",
    },
    {
      title: "Queue Pending",
      value: stats.queuePending.toString(),
      subtitle: "messages waiting",
      icon: Clock,
      color: "text-muted-foreground",
      bgColor: "bg-muted/50",
      borderColor: "border-border",
    },
    {
      title: "Failed Today",
      value: stats.failedToday.toString(),
      subtitle: "errors encountered",
      icon: AlertTriangle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      borderColor: "border-destructive/20",
    },
  ];

  if (loading) return <div className="h-32 flex items-center justify-center border rounded-lg bg-card"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((kpi) => (
        <div
          key={kpi.title}
          className={cn(
            "rounded-lg border p-4 transition-colors hover:bg-accent/50",
            kpi.borderColor,
            "bg-card"
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md",
                kpi.bgColor
              )}
            >
              <kpi.icon className={cn("h-4 w-4", kpi.color)} />
            </div>
          </div>
          <div className="text-xl font-semibold tracking-tight">{kpi.value}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {kpi.title}
          </div>
        </div>
      ))}
    </div>
  );
}
