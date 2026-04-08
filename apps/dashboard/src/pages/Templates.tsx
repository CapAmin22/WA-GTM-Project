import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Copy, MoreHorizontal, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const categoryColors: Record<string, string> = {
  promotional: "bg-primary/15 text-primary border-primary/30",
  marketing: "bg-primary/15 text-primary border-primary/30",
  follow_up: "bg-warning/15 text-warning border-warning/30",
  greeting: "bg-success/15 text-success border-success/30",
  transactional: "bg-info/15 text-info border-info/30",
  utility: "bg-info/15 text-info border-info/30",
  general: "bg-muted text-muted-foreground border-border",
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("message_templates")
      .select("*")
      .eq("is_archived", false)
      .order("updated_at", { ascending: false });

    if (error) toast.error("Failed to load templates: " + error.message);
    else setTemplates(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Message Studio</h1>
            <p className="text-sm text-muted-foreground mt-1">Create and manage message templates with Spintax</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => navigate("/templates/new")}>
            <Plus className="h-3.5 w-3.5" /> New Template
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search templates..." className="pl-9 h-9 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">No templates yet. Create your first template.</div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((t) => (
              <div
                key={t.id}
                className="rounded-lg border border-border bg-card p-4 hover:bg-accent/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/templates/${t.id}/edit`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{t.name}</span>
                    <Badge variant="outline" className={cn("text-[10px] capitalize", categoryColors[t.category] || categoryColors.general)}>
                      {(t.category || "general").replace("_", " ")}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground font-mono bg-muted/30 rounded px-2 py-1.5 mb-3">
                  {t.body}
                </p>
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span>{t.total_sent || 0} sent</span>
                  <span>·</span>
                  <span className="text-success">{t.total_sent > 0 ? ((t.total_delivered / t.total_sent) * 100).toFixed(1) : 0}% delivered</span>
                  <span>·</span>
                  <span>{t.total_sent > 0 ? ((t.total_replied / t.total_sent) * 100).toFixed(1) : 0}% reply rate</span>
                  <span className="ml-auto">{new Date(t.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
