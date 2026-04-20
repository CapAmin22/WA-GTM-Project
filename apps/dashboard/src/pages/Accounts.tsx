import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wifi, WifiOff, RefreshCw, QrCode, MoreHorizontal, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [todaySentMap, setTodaySentMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  const fetchAccounts = async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [accRes, logsRes] = await Promise.all([
      supabase.from("wa_accounts").select("*").eq("is_archived", false).order("created_at", { ascending: false }),
      // Accurate today's count from send_logs (source of truth)
      supabase.from("send_logs").select("account_id").eq("status", "sent").gte("created_at", todayStart.toISOString()),
    ]);

    if (accRes.error) {
      toast.error("Failed to load accounts: " + accRes.error.message);
    } else {
      setAccounts(accRes.data || []);
    }

    // Build per-account today count map
    const countMap: Record<string, number> = {};
    for (const log of logsRes.data || []) {
      countMap[log.account_id] = (countMap[log.account_id] || 0) + 1;
    }
    setTodaySentMap(countMap);

    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("wa_accounts_ui")
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_accounts" }, () => {
        fetchAccounts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAddAccount = async () => {
    if (!newName || !newPhone) return;
    setAdding(true);

    // Normalize phone: strip spaces so "+91 8329556730" and "+918329556730" are the same
    const normalizedPhone = newPhone.replace(/\s+/g, "");

    // Upsert on phone_number — if account exists (even archived), restore it instead of erroring
    const { error } = await supabase.from("wa_accounts").upsert(
      {
        display_name: newName,
        phone_number: normalizedPhone,
        status: "pairing",
        connection_status: "disconnected",
        is_archived: false,
        pairing_qr: null,
      },
      { onConflict: "phone_number" }
    );
    setAdding(false);
    if (error) {
      toast.error("Failed to add account: " + error.message);
    } else {
      toast.success("Account added! The worker will begin pairing.");
      setNewName("");
      setNewPhone("");
      setDialogOpen(false);
      fetchAccounts();
    }
  };

  const handleRePair = async (id: string) => {
    await supabase.from("wa_accounts").update({ status: "pairing", connection_status: "disconnected", pairing_qr: null }).eq("id", id);
    toast.info("Re-pair signal sent to worker.");
    fetchAccounts();
  };

  const handleArchive = async (id: string) => {
    await supabase.from("wa_accounts").update({ is_archived: true }).eq("id", id);
    toast.success("Account archived.");
    fetchAccounts();
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Account Command Center</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your {accounts.length} WhatsApp accounts</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add WhatsApp Account</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-xs">Display Name</Label>
                  <Input placeholder="e.g. Account-E" value={newName} onChange={e => setNewName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Phone Number</Label>
                  <Input placeholder="+91 9876543210" value={newPhone} onChange={e => setNewPhone(e.target.value)} />
                </div>
                <Button onClick={handleAddAccount} disabled={adding} className="w-full">
                  {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add Account
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {accounts.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">No accounts yet. Add your first WhatsApp account to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((acc) => (
              <div key={acc.id} className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      acc.connection_status === "connected" ? "bg-success/10" : "bg-destructive/10"
                    )}>
                      {acc.connection_status === "connected" ? (
                        <Wifi className="h-5 w-5 text-success" />
                      ) : (
                        <WifiOff className="h-5 w-5 text-destructive" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{acc.display_name}</span>
                        <div className={cn(
                          acc.connection_status === "connected" ? "status-dot-connected" : "status-dot-disconnected"
                        )} />
                      </div>
                      <span className="text-xs text-muted-foreground">{acc.phone_number}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn(
                    "text-[10px] capitalize",
                    acc.status === "active" ? "bg-success/15 text-success border-success/30" :
                    acc.status === "cooldown" ? "bg-warning/15 text-warning border-warning/30" :
                    acc.status === "pairing" ? "bg-primary/15 text-primary border-primary/30" :
                    "bg-muted text-muted-foreground border-border"
                  )}>
                    {acc.status}
                  </Badge>
                </div>

                {/* Progress — uses send_logs as source of truth for today's sends */}
                {(() => {
                  const sentToday = todaySentMap[acc.id] || 0;
                  const pct = acc.daily_limit > 0 ? Math.min((sentToday / acc.daily_limit) * 100, 100) : 0;
                  return (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">Messages Today</span>
                        <span>{sentToday} / {acc.daily_limit}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            pct > 90 ? "bg-destructive" : pct > 70 ? "bg-warning" : "bg-primary"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* QR Code Display */}
                {acc.pairing_qr && (
                  <div className="mb-4 p-3 rounded-md bg-white flex items-center justify-center">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(acc.pairing_qr)}`} alt="QR Code" className="w-48 h-48" />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 text-xs gap-1" onClick={() => handleRePair(acc.id)}>
                    <QrCode className="h-3 w-3" /> Re-pair
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => handleArchive(acc.id)}>
                    Archive
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
