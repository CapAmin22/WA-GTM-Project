import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";

const dailyVolume = [
  { date: "Mar 31", sent: 420, delivered: 415, failed: 5 },
  { date: "Apr 1", sent: 480, delivered: 472, failed: 8 },
  { date: "Apr 2", sent: 510, delivered: 500, failed: 10 },
  { date: "Apr 3", sent: 390, delivered: 385, failed: 5 },
  { date: "Apr 4", sent: 450, delivered: 446, failed: 4 },
  { date: "Apr 5", sent: 320, delivered: 318, failed: 2 },
  { date: "Apr 6", sent: 312, delivered: 308, failed: 4 },
];

const accountPerf = [
  { name: "Account-A", sent: 1200, delivered: 1185, failed: 15 },
  { name: "Account-B", sent: 1100, delivered: 1088, failed: 12 },
  { name: "Account-C", sent: 980, delivered: 965, failed: 15 },
  { name: "Account-D", sent: 720, delivered: 710, failed: 10 },
];

const replyByHour = Array.from({ length: 13 }, (_, i) => ({
  hour: `${10 + i}:00`,
  replies: Math.floor(Math.random() * 20 + 5),
}));

const campaignPerf = [
  { name: "Diwali Promo", deliveryRate: 97.2, replyRate: 12.5, sent: 1250 },
  { name: "Follow-up", deliveryRate: 98.0, replyRate: 14.1, sent: 890 },
  { name: "Onboarding", deliveryRate: 99.4, replyRate: 14.1, sent: 320 },
  { name: "Product Launch", deliveryRate: 98.3, replyRate: 12.7, sent: 2100 },
];

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

export default function AnalyticsPage() {
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

          <TabsContent value="overview" className="mt-4 space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Sent (7d)", value: "2,882" },
                { label: "Avg Delivery Rate", value: "98.4%" },
                { label: "Total Replies", value: "356" },
                { label: "Avg Reply Rate", value: "12.3%" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-card p-4">
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                  <div className="text-xl font-semibold mt-1">{s.value}</div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-medium mb-4">Daily Volume (7 Days)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={dailyVolume}>
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
                  <Area type="monotone" dataKey="delivered" name="Delivered" stroke="hsl(152, 69%, 45%)" fill="transparent" strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="delivery" className="mt-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-medium mb-4">Delivery vs Failed</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyVolume}>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(215, 14%, 50%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(215, 14%, 50%)" }} axisLine={false} tickLine={false} width={35} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="delivered" name="Delivered" fill="hsl(152, 69%, 45%)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="failed" name="Failed" fill="hsl(0, 72%, 51%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="accounts" className="mt-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-medium mb-4">Account Performance</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={accountPerf} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(215, 14%, 50%)" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(215, 14%, 50%)" }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="delivered" name="Delivered" fill="hsl(210, 100%, 56%)" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="failed" name="Failed" fill="hsl(0, 72%, 51%)" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="campaigns" className="mt-4">
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Campaign</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Sent</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Delivery Rate</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Reply Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {campaignPerf.map((c) => (
                    <tr key={c.name} className="hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{c.sent.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-success">{c.deliveryRate}%</td>
                      <td className="px-4 py-3 text-sm">{c.replyRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="replies" className="mt-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-medium mb-4">Replies by Hour</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={replyByHour}>
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "hsl(215, 14%, 50%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(215, 14%, 50%)" }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="replies" name="Replies" fill="hsl(280, 65%, 60%)" radius={[3, 3, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="errors" className="mt-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-medium mb-4">Error Breakdown</h3>
              <div className="space-y-3">
                {[
                  { error: "Connection timeout", count: 18, pct: 38 },
                  { error: "Rate limit exceeded", count: 12, pct: 25 },
                  { error: "Number not on WhatsApp", count: 10, pct: 21 },
                  { error: "Session expired", count: 5, pct: 11 },
                  { error: "Unknown error", count: 3, pct: 6 },
                ].map((e) => (
                  <div key={e.error}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{e.error}</span>
                      <span className="text-muted-foreground">{e.count} ({e.pct}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-destructive rounded-full" style={{ width: `${e.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="timing" className="mt-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-medium mb-2">Avg Latency by Hour</h3>
              <p className="text-xs text-muted-foreground mb-4">Average send latency in milliseconds</p>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={replyByHour.map((h, i) => ({ ...h, latency: Math.floor(Math.random() * 800 + 200) }))}>
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "hsl(215, 14%, 50%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(215, 14%, 50%)" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="latency" name="Latency (ms)" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={{ fill: "hsl(38, 92%, 50%)", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="ab" className="mt-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-medium mb-4">Experiment Results Summary</h3>
              <div className="space-y-4">
                {[
                  { name: "Greeting Style", variantA: "Formal (96.2%)", variantB: "Casual (97.8%)", winner: "Casual", confidence: 87 },
                  { name: "CTA Placement", variantA: "CTA First (98.1%)", variantB: "CTA Last (95.4%)", winner: "CTA First", confidence: 96 },
                ].map((exp) => (
                  <div key={exp.name} className="p-3 rounded-md bg-muted/30 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{exp.name}</span>
                      <span className="text-xs text-success">{exp.confidence}% confidence</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-2 rounded bg-muted/50">
                        <span className="text-muted-foreground">A: </span>{exp.variantA}
                      </div>
                      <div className="p-2 rounded bg-success/10 border border-success/20">
                        <span className="text-muted-foreground">B: </span>{exp.variantB} ✓
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
