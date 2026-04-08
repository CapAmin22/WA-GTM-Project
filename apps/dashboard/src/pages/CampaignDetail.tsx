import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pause, Play, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const hourlyData = [
  { hour: "10AM", sent: 32, failed: 1 },
  { hour: "11AM", sent: 45, failed: 0 },
  { hour: "12PM", sent: 38, failed: 2 },
  { hour: "1PM", sent: 52, failed: 1 },
  { hour: "2PM", sent: 48, failed: 0 },
  { hour: "3PM", sent: 55, failed: 3 },
  { hour: "4PM", sent: 10, failed: 1 },
];

export default function CampaignDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/campaigns")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">Diwali Promo 2026</h1>
              <Badge variant="outline" className="bg-success/15 text-success border-success/30 text-[11px]">active</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">Festival greeting with offer link</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Pause className="h-3.5 w-3.5" /> Pause
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Sent", value: "280", sub: "/ 500" },
            { label: "Delivered", value: "272", sub: "97.1%" },
            { label: "Failed", value: "8", sub: "2.9%" },
            { label: "Replies", value: "34", sub: "12.5%" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-xl font-semibold mt-1">{s.value} <span className="text-sm text-muted-foreground font-normal">{s.sub}</span></div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Campaign Progress</span>
            <span className="text-muted-foreground">56%</span>
          </div>
          <Progress value={56} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">Estimated completion: ~4 hours remaining</p>
        </div>

        {/* Chart */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium mb-4">Hourly Send Rate</h3>
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
              <Area type="monotone" dataKey="sent" stroke="hsl(210, 100%, 56%)" fill="url(#sentGradDetail)" strokeWidth={2} />
              <Area type="monotone" dataKey="failed" stroke="hsl(0, 72%, 51%)" fill="transparent" strokeWidth={1.5} strokeDasharray="4 4" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Error Log */}
        <div className="rounded-lg border border-border bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium">Recent Errors</h3>
          </div>
          <div className="divide-y divide-border">
            {[
              { phone: "+91 12345XXXXX", error: "Connection timeout", time: "2:34 PM", account: "Account-C" },
              { phone: "+91 98765XXXXX", error: "Rate limit exceeded", time: "1:12 PM", account: "Account-A" },
              { phone: "+91 45678XXXXX", error: "Number not on WhatsApp", time: "12:45 PM", account: "Account-B" },
            ].map((e, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-destructive">✕</span>
                  <span className="text-foreground">{e.phone}</span>
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
      </div>
    </AppLayout>
  );
}
