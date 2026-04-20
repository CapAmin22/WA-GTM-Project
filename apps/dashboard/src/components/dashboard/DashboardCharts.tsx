import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell,
  Line,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-lg">
        <p className="text-foreground font-medium mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function DashboardCharts() {
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [accountLoad, setAccountLoad] = useState<any[]>([]);
  const [campaignProgress, setCampaignProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChartsData = async () => {
    // 1. Fetch Weekly Trend (Last 7 Days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: logsRes } = await supabase
      .from("send_logs")
      .select("status, created_at")
      .gte("created_at", sevenDaysAgo.toISOString());

    if (logsRes) {
      const days: Record<string, any> = {};
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      
      // Initialize days
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (6-i));
        const key = d.toISOString().split('T')[0];
        days[key] = { day: dayNames[d.getDay()], sent: 0, failed: 0 };
      }

      logsRes.forEach(l => {
        const key = l.created_at.split('T')[0];
        if (days[key]) {
          if (l.status === "sent") days[key].sent++;
          else if (l.status === "failed") days[key].failed++;
        }
      });
      setWeeklyData(Object.values(days));
    }

    // 2. Fetch Account Load from send_logs (source of truth — avoids inflated messages_sent_today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: accountsRes } = await supabase
      .from("wa_accounts")
      .select("id, display_name")
      .eq("is_archived", false);

    const { data: todayLogs } = await supabase
      .from("send_logs")
      .select("account_id")
      .eq("status", "sent")
      .gte("created_at", todayStart.toISOString());

    if (accountsRes) {
      const countByAccount: Record<string, number> = {};
      for (const log of todayLogs || []) {
        countByAccount[log.account_id] = (countByAccount[log.account_id] || 0) + 1;
      }
      const colors = ["hsl(210, 100%, 56%)", "hsl(152, 69%, 45%)", "hsl(38, 92%, 50%)", "hsl(280, 65%, 60%)"];
      const formatted = accountsRes.map((a, i) => ({
        name: a.display_name,
        value: countByAccount[a.id] || 0,
        color: colors[i % colors.length]
      }));
      setAccountLoad(formatted);
    }

    // 3. Fetch Active Campaigns
    const { data: campaignsRes } = await supabase
      .from("campaigns")
      .select("name, sent_count, total_recipients, failed_count")
      .in("status", ["active", "scheduled"])
      .order("created_at", { ascending: false })
      .limit(3);

    if (campaignsRes) {
      setCampaignProgress(campaignsRes.map(c => ({
        name: c.name,
        sent: c.sent_count,
        total: c.total_recipients,
        failed: c.failed_count
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchChartsData();
  }, []);

  if (loading) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 7-Day Trend */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium mb-4">7-Day Volume Trend</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={weeklyData}>
            <defs>
              <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(210, 100%, 56%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(210, 100%, 56%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(215, 14%, 50%)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(215, 14%, 50%)" }} axisLine={false} tickLine={false} width={30} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="sent" name="Sent" stroke="hsl(210, 100%, 56%)" fill="url(#sentGrad)" strokeWidth={2} />
            <Line type="monotone" dataKey="failed" name="Failed" stroke="hsl(0, 72%, 51%)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Account Load */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium mb-4">Daily Account Utilization</h3>
        <div className="flex items-center justify-center">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={accountLoad}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
              >
                {accountLoad.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 mt-2 flex-wrap">
          {accountLoad.map((a) => (
            <div key={a.name} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <div className="h-2 w-2 rounded-full" style={{ background: a.color }} />
              {a.name}: {a.value}
            </div>
          ))}
        </div>
      </div>

      {/* Campaign Progress */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium mb-4">Live Campaign Progress</h3>
        <div className="space-y-4">
          {campaignProgress.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No active campaigns.</p>
          ) : (
            campaignProgress.map((c) => (
              <div key={c.name}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-foreground font-medium">{c.name}</span>
                  <span className="text-muted-foreground">
                    {c.sent}/{c.total} sent
                  </span>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                  <div
                    className="bg-primary/80 transition-all"
                    style={{ width: `${(c.sent / c.total) * 100}%` }}
                  />
                  {c.failed > 0 && (
                    <div
                      className="bg-destructive transition-all"
                      style={{ width: `${(c.failed / c.total) * 100}%` }}
                    />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
