import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

// ── Shared tooltip ──────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-lg">
        <p className="text-foreground font-medium mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ color: entry.color }}>{entry.name}: {entry.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

function LoadingCard() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center justify-center h-64">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────
function last7DaysISO() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AnalyticsPage() {
  // ── Overview / Delivery (shared 7-day data) ──────────────────
  const [volumeData, setVolumeData] = useState<any[]>([]);
  const [volumeLoading, setVolumeLoading] = useState(true);
  const [summary, setSummary] = useState({ total: 0, delivered: 0, failed: 0 });

  // ── Accounts ────────────────────────────────────────────────
  const [accountData, setAccountData] = useState<any[]>([]);
  const [accountLoading, setAccountLoading] = useState(true);

  // ── Campaigns ───────────────────────────────────────────────
  const [campaignData, setCampaignData] = useState<any[]>([]);
  const [campaignLoading, setCampaignLoading] = useState(true);

  // ── Errors ──────────────────────────────────────────────────
  const [errorData, setErrorData] = useState<any[]>([]);
  const [errorLoading, setErrorLoading] = useState(true);

  // ── Timing ──────────────────────────────────────────────────
  const [timingData, setTimingData] = useState<any[]>([]);
  const [timingLoading, setTimingLoading] = useState(true);

  // ── A/B Results ─────────────────────────────────────────────
  const [abData, setAbData] = useState<any[]>([]);
  const [abLoading, setAbLoading] = useState(true);

  // ── Replies ─────────────────────────────────────────────────
  const [replyTotal, setReplyTotal] = useState(0);
  const [replyLoading, setReplyLoading] = useState(true);

  // ────────────────────────────────────────────────────────────
  // Data loading
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    loadVolume();
    loadAccounts();
    loadCampaigns();
    loadErrors();
    loadTiming();
    loadAb();
    loadReplies();
  }, []);

  async function loadVolume() {
    setVolumeLoading(true);
    const { data } = await supabase
      .from("send_logs")
      .select("created_at, status")
      .gte("created_at", last7DaysISO())
      .order("created_at", { ascending: true });

    if (!data) { setVolumeLoading(false); return; }

    // Bucket by date
    const buckets: Record<string, { sent: number; failed: number }> = {};
    // Pre-fill last 7 days so gaps show as 0
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = dateLabel(d.toISOString());
      buckets[label] = { sent: 0, failed: 0 };
    }
    for (const row of data) {
      const label = dateLabel(row.created_at);
      if (!buckets[label]) buckets[label] = { sent: 0, failed: 0 };
      if (row.status === "sent") buckets[label].sent++;
      else buckets[label].failed++;
    }

    const arr = Object.entries(buckets).map(([date, v]) => ({ date, ...v, delivered: v.sent }));
    const total = arr.reduce((s, r) => s + r.sent, 0);
    const failed = arr.reduce((s, r) => s + r.failed, 0);
    setVolumeData(arr);
    setSummary({ total, delivered: total - failed, failed });
    setVolumeLoading(false);
  }

  async function loadAccounts() {
    setAccountLoading(true);
    const { data: logs } = await supabase
      .from("send_logs")
      .select("account_id, status, wa_accounts(display_name)")
      .gte("created_at", last7DaysISO());

    if (!logs) { setAccountLoading(false); return; }

    const map: Record<string, { name: string; sent: number; failed: number }> = {};
    for (const log of logs) {
      const id = log.account_id;
      const name = (log as any).wa_accounts?.display_name || id.slice(0, 8);
      if (!map[id]) map[id] = { name, sent: 0, failed: 0 };
      if (log.status === "sent") map[id].sent++;
      else map[id].failed++;
    }
    setAccountData(Object.values(map).sort((a, b) => b.sent - a.sent));
    setAccountLoading(false);
  }

  async function loadCampaigns() {
    setCampaignLoading(true);
    const { data } = await supabase
      .from("campaigns")
      .select("name, sent_count, failed_count, total_recipients, status")
      .neq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!data) { setCampaignLoading(false); return; }

    setCampaignData(
      data.map((c) => ({
        ...c,
        deliveryRate:
          c.sent_count > 0
            ? (((c.sent_count - c.failed_count) / c.sent_count) * 100).toFixed(1)
            : "—",
        replyRate: "—", // reply tracking via contacts.total_replies (no timestamp)
      }))
    );
    setCampaignLoading(false);
  }

  async function loadErrors() {
    setErrorLoading(true);
    const { data } = await supabase
      .from("send_logs")
      .select("error_message")
      .eq("status", "failed")
      .gte("created_at", last7DaysISO())
      .not("error_message", "is", null);

    if (!data) { setErrorLoading(false); return; }

    const map: Record<string, number> = {};
    for (const row of data) {
      const msg = row.error_message || "Unknown error";
      // Normalise long error strings to a short key
      const key = msg.length > 50 ? msg.slice(0, 50) + "…" : msg;
      map[key] = (map[key] || 0) + 1;
    }
    const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
    setErrorData(
      Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([error, count]) => ({ error, count, pct: Math.round((count / total) * 100) }))
    );
    setErrorLoading(false);
  }

  async function loadTiming() {
    setTimingLoading(true);
    const { data } = await supabase
      .from("send_logs")
      .select("created_at, latency_ms")
      .eq("status", "sent")
      .gte("created_at", last7DaysISO())
      .not("latency_ms", "is", null);

    if (!data) { setTimingLoading(false); return; }

    // Bucket by hour (0–23)
    const buckets: Record<number, { sum: number; count: number }> = {};
    for (const row of data) {
      const hour = new Date(row.created_at).getHours();
      if (!buckets[hour]) buckets[hour] = { sum: 0, count: 0 };
      buckets[hour].sum += row.latency_ms || 0;
      buckets[hour].count++;
    }
    setTimingData(
      Object.entries(buckets)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([h, v]) => ({
          hour: `${Number(h) % 12 || 12}${Number(h) < 12 ? "AM" : "PM"}`,
          latency: v.count > 0 ? Math.round(v.sum / v.count) : 0,
        }))
    );
    setTimingLoading(false);
  }

  async function loadAb() {
    setAbLoading(true);
    const { data: exps } = await supabase
      .from("ab_experiments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    if (!exps || exps.length === 0) { setAbLoading(false); return; }

    const expIds = exps.map((e) => e.id);
    const { data: variants } = await supabase
      .from("ab_variants")
      .select("*, message_templates(name)")
      .in("experiment_id", expIds);

    const varMap: Record<string, any[]> = {};
    for (const v of variants || []) {
      if (!varMap[v.experiment_id]) varMap[v.experiment_id] = [];
      varMap[v.experiment_id].push(v);
    }

    setAbData(
      exps.map((e) => ({
        ...e,
        variants: varMap[e.id] || [],
      }))
    );
    setAbLoading(false);
  }

  async function loadReplies() {
    setReplyLoading(true);
    const { data } = await supabase
      .from("contacts")
      .select("total_replies");

    const total = (data || []).reduce((s, c) => s + (c.total_replies || 0), 0);
    setReplyTotal(total);
    setReplyLoading(false);
  }

  // ────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Comprehensive performance insights</p>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="bg-muted/50 border border-border flex-wrap">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="delivery" className="text-xs">Delivery</TabsTrigger>
            <TabsTrigger value="accounts" className="text-xs">Accounts</TabsTrigger>
            <TabsTrigger value="campaigns" className="text-xs">Campaigns</TabsTrigger>
            <TabsTrigger value="replies" className="text-xs">Replies</TabsTrigger>
            <TabsTrigger value="errors" className="text-xs">Errors</TabsTrigger>
            <TabsTrigger value="timing" className="text-xs">Timing</TabsTrigger>
            <TabsTrigger value="ab" className="text-xs">A/B Results</TabsTrigger>
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {volumeLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-lg border border-border bg-card p-4 animate-pulse h-16" />
                ))
              ) : (
                [
                  { label: "Total Sent (7d)", value: summary.total.toLocaleString() },
                  { label: "Delivered (7d)", value: summary.delivered.toLocaleString() },
                  { label: "Failed (7d)", value: summary.failed.toLocaleString() },
                  {
                    label: "Avg Delivery Rate",
                    value: summary.total > 0
                      ? `${((summary.delivered / summary.total) * 100).toFixed(1)}%`
                      : "—",
                  },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-border bg-card p-4">
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                    <div className="text-xl font-semibold mt-1">{s.value}</div>
                  </div>
                ))
              )}
            </div>
            {volumeLoading ? <LoadingCard /> : (
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-sm font-medium mb-4">Daily Volume (7 Days)</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={volumeData}>
                    <defs>
                      <linearGradient id="sentG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(210, 100%, 56%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(210, 100%, 56%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(215, 14%, 50%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(215, 14%, 50%)" }} axisLine={false} tickLine={false} width={35} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="sent" name="Sent" stroke="hsl(210, 100%, 56%)" fill="url(#sentG)" strokeWidth={2} />
                    <Area type="monotone" dataKey="failed" name="Failed" stroke="hsl(0, 72%, 51%)" fill="transparent" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>

          {/* ── Delivery ── */}
          <TabsContent value="delivery" className="mt-4">
            {volumeLoading ? <LoadingCard /> : (
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-sm font-medium mb-4">Delivery vs Failed (7 Days)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={volumeData}>
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(215, 14%, 50%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(215, 14%, 50%)" }} axisLine={false} tickLine={false} width={35} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="delivered" name="Delivered" fill="hsl(152, 69%, 45%)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="failed" name="Failed" fill="hsl(0, 72%, 51%)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>

          {/* ── Accounts ── */}
          <TabsContent value="accounts" className="mt-4">
            {accountLoading ? <LoadingCard /> : (
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-sm font-medium mb-4">Account Performance (7 Days)</h3>
                {accountData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No send activity yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(200, accountData.length * 50)}>
                    <BarChart data={accountData} layout="vertical">
                      <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(215, 14%, 50%)" }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(215, 14%, 50%)" }} axisLine={false} tickLine={false} width={100} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="sent" name="Sent" fill="hsl(210, 100%, 56%)" radius={[0, 3, 3, 0]} />
                      <Bar dataKey="failed" name="Failed" fill="hsl(0, 72%, 51%)" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Campaigns ── */}
          <TabsContent value="campaigns" className="mt-4">
            {campaignLoading ? <LoadingCard /> : (
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Campaign</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Sent</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Failed</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Delivery Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {campaignData.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No campaigns found.</td></tr>
                    ) : (
                      campaignData.map((c) => (
                        <tr key={c.name + c.status} className="hover:bg-accent/30 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium">{c.name}</td>
                          <td className="px-4 py-3 text-xs capitalize text-muted-foreground">{c.status}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{c.sent_count?.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-destructive">{c.failed_count?.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-success">{c.deliveryRate}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ── Replies ── */}
          <TabsContent value="replies" className="mt-4">
            {replyLoading ? <LoadingCard /> : (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-card p-6 text-center">
                  <div className="text-3xl font-bold">{replyTotal.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground mt-1">Total replies received across all contacts</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                  <p>Reply timestamps are tracked on the contact record. Per-hour reply breakdown requires Baileys incoming message handling to be active and the worker to be connected.</p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── Errors ── */}
          <TabsContent value="errors" className="mt-4">
            {errorLoading ? <LoadingCard /> : (
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-sm font-medium mb-4">Error Breakdown (7 Days)</h3>
                {errorData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No errors in the last 7 days.</p>
                ) : (
                  <div className="space-y-3">
                    {errorData.map((e) => (
                      <div key={e.error}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="truncate max-w-[70%]">{e.error}</span>
                          <span className="text-muted-foreground shrink-0">{e.count} ({e.pct}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-destructive rounded-full" style={{ width: `${e.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Timing ── */}
          <TabsContent value="timing" className="mt-4">
            {timingLoading ? <LoadingCard /> : (
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-sm font-medium mb-2">Avg Send Latency by Hour</h3>
                <p className="text-xs text-muted-foreground mb-4">Average milliseconds from queue creation to successful send</p>
                {timingData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No latency data yet. Messages must be sent first.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={timingData}>
                      <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "hsl(215, 14%, 50%)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(215, 14%, 50%)" }} axisLine={false} tickLine={false} width={45} unit="ms" />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="latency" name="Latency (ms)" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={{ fill: "hsl(38, 92%, 50%)", r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── A/B Results ── */}
          <TabsContent value="ab" className="mt-4">
            {abLoading ? <LoadingCard /> : (
              <div className="space-y-4">
                {abData.length === 0 ? (
                  <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                    No A/B experiments yet. Create one in the A/B Testing Lab.
                  </div>
                ) : (
                  abData.map((exp) => (
                    <div key={exp.id} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="text-sm font-medium">{exp.name}</span>
                          {exp.hypothesis && (
                            <p className="text-xs text-muted-foreground mt-0.5">{exp.hypothesis}</p>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                          exp.status === "running" ? "bg-success/15 text-success" :
                          exp.status === "completed" ? "bg-primary/15 text-primary" :
                          "bg-muted text-muted-foreground"
                        }`}>{exp.status}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {exp.variants.map((v: any) => {
                          const delivRate = v.send_count > 0
                            ? ((v.delivered_count / v.send_count) * 100).toFixed(1)
                            : "0.0";
                          const replyRate = v.send_count > 0
                            ? ((v.reply_count / v.send_count) * 100).toFixed(1)
                            : "0.0";
                          const isWinner = v.is_winner || exp.winner_variant_id === v.id;
                          return (
                            <div
                              key={v.id}
                              className={`p-3 rounded-md border text-xs ${
                                isWinner
                                  ? "bg-success/10 border-success/30"
                                  : "bg-muted/30 border-border"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-semibold">Variant {v.variant_label}</span>
                                {v.message_templates?.name && (
                                  <span className="text-muted-foreground truncate">{v.message_templates.name}</span>
                                )}
                                {isWinner && <span className="ml-auto text-success font-semibold">✓ Winner</span>}
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                                <span>Sent: <strong className="text-foreground">{v.send_count}</strong></span>
                                <span>Failed: <strong className="text-foreground">{v.fail_count}</strong></span>
                                <span>Delivery: <strong className="text-success">{delivRate}%</strong></span>
                                <span>Reply: <strong className="text-foreground">{replyRate}%</strong></span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
