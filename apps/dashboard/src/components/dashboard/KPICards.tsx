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
      // Get accounts
      const { data: accounts } = await supabase.from("wa_accounts").select("status, messages_sent_today, daily_limit").eq("is_archived", false);
      
      let _activeAccounts = 0;
      let _totalAccounts = accounts?.length || 0;
      let _sentToday = 0;
      let _dailyLimit = 0;

      if (accounts) {
        accounts.forEach(acc => {
          if (acc.status === "active") _activeAccounts++;
          _sentToday += acc.messages_sent_today;
          _dailyLimit += acc.daily_limit;
        });
      }

      // Get queue
      const { count: pendingCount } = await supabase.from("message_queue").select("*", { count: "exact", head: true }).eq("status", "pending");

      // Get today's logs for failure/delivery tracking
      const todayStart = new Date();
      todayStart.setHours(0,0,0,0);
      
      const { data: logs } = await supabase.from("send_logs").select("status").gte("created_at", todayStart.toISOString());
      
      let _failedToday = 0;
      let _deliveredToday = 0; // Assuming 'sent' implies delivery for now, or 'delivered' status if implemented
      
      if (logs) {
        logs.forEach(l => {
          if (l.status === "failed") _failedToday++;
          if (l.status === "sent" || l.status === "delivered") _deliveredToday++;
        });
      }

      const totalAttempted = _failedToday + _deliveredToday;
      const _deliveryRate = totalAttempted > 0 ? (_deliveredToday / totalAttempted) * 100 : 0;

      // Mocking reply rate for now since we don't have incoming webhook handling fully DB backed in this MVP slice
      const _replyRate = 12.3;

      setStats({
        sentToday: _sentToday,
        dailyLimit: _dailyLimit,
        deliveryRate: _deliveryRate,
        activeAccounts: _activeAccounts,
        totalAccounts: _totalAccounts,
        replyRate: _replyRate,
        queuePending: pendingCount || 0,
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
      subtitle: `${stats.totalAccounts - stats.activeAccounts} not active`,
      icon: Wifi,
      color: "text-warning",
      bgColor: "bg-warning/10",
      borderColor: "border-warning/20",
    },
    {
      title: "Reply Rate",
      value: `${stats.replyRate}%`,
      subtitle: "Last 7 days",
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
