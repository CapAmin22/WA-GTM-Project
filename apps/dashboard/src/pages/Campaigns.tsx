import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  active:    "bg-success/15 text-success border-success/30",
  completed: "bg-primary/15 text-primary border-primary/30",
  draft:     "bg-muted text-muted-foreground border-border",
  paused:    "bg-warning/15 text-warning border-warning/30",
  scheduled: "bg-info/15 text-info border-info/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        toast.error("Failed to load campaigns: " + error.message);
      } else {
        setCampaigns(data || []);
      }
    } catch (err: any) {
      toast.error("Error loading campaigns: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();

    // Real-time: update counters live as worker processes messages
    const channel = supabase
      .channel("campaigns_list")
      .on("postgres_changes", { event: "*", schema: "public", table: "campaigns" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setCampaigns((prev) => [payload.new as any, ...prev]);
        } else if (payload.eventType === "UPDATE") {
          setCampaigns((prev) =>
            prev.map((c) => (c.id === payload.new.id ? { ...c, ...payload.new } : c))
          );
        } else if (payload.eventType === "DELETE") {
          setCampaigns((prev) => prev.filter((c) => c.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = campaigns.filter((c) =>
    (c.name || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage and monitor your messaging campaigns</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => navigate("/campaigns/new")}>
            <Plus className="h-3.5 w-3.5" /> New Campaign
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search campaigns..." className="pl-9 h-9 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">No campaigns yet.</div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Campaign</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Progress</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Failed</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-accent/30 transition-colors cursor-pointer" onClick={() => navigate(`/campaigns/${c.id}`)}>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium">{c.name}</span>
                      {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn("text-[11px] capitalize", statusColors[c.status] || statusColors.draft)}>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Progress value={c.total_recipients > 0 ? (c.sent_count / c.total_recipients) * 100 : 0} className="h-1.5 w-24" />
                        <span className="text-xs text-muted-foreground">{c.sent_count}/{c.total_recipients}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-destructive">{c.failed_count || 0}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
