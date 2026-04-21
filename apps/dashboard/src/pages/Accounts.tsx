import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wifi, WifiOff, QrCode, Plus, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

// QR codes from Baileys expire after ~20 seconds. We show a countdown
// so users know when a fresh code is coming and don't scan a stale one.
const QR_TTL_SECONDS = 20;

function QrPanel({ qr, status }: { qr: string | null; status: string }) {
  const [secondsLeft, setSecondsLeft] = useState(QR_TTL_SECONDS);

  // Reset countdown whenever a new QR arrives
  useEffect(() => {
    setSecondsLeft(QR_TTL_SECONDS);
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(t); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [qr]);

  // Waiting for QR to be generated
  if (status === "pairing" && !qr) {
    return (
      <div className="mb-4 p-4 rounded-lg bg-muted/60 border border-border flex flex-col items-center gap-3 min-h-[180px] justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground text-center">
          Generating QR code…<br />
          <span className="text-[10px]">The worker is connecting to WhatsApp</span>
        </p>
      </div>
    );
  }

  if (!qr) return null;

  const expired = secondsLeft === 0;

  return (
    <div className="mb-4 rounded-lg border border-border overflow-hidden">
      {/* Countdown bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border">
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
          Scan with WhatsApp
        </span>
        {expired ? (
          <span className="text-[10px] text-destructive flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Expired — new code coming…
          </span>
        ) : (
          <span className={cn(
            "text-[10px] font-mono font-semibold",
            secondsLeft <= 5 ? "text-destructive" : "text-muted-foreground"
          )}>
            {secondsLeft}s
          </span>
        )}
      </div>

      {/* QR Code — rendered locally, no external service */}
      <div className={cn(
        "flex items-center justify-center p-4 bg-white transition-opacity",
        expired && "opacity-30"
      )}>
        <QRCodeSVG
          value={qr}
          size={192}
          level="M"
          includeMargin={false}
        />
      </div>

      <p className="text-[10px] text-center text-muted-foreground py-1.5 bg-muted/30">
        Open WhatsApp → Linked Devices → Link a device
      </p>
    </div>
  );
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [todaySentMap, setTodaySentMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [rePairing, setRePairing] = useState<Record<string, boolean>>({});

  const fetchAccounts = useCallback(async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [accRes, logsRes] = await Promise.all([
      supabase
        .from("wa_accounts")
        .select("*")
        .eq("is_archived", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("send_logs")
        .select("account_id")
        .eq("status", "sent")
        .gte("created_at", todayStart.toISOString()),
    ]);

    if (accRes.error) {
      toast.error("Failed to load accounts: " + accRes.error.message);
    } else {
      setAccounts(accRes.data || []);
    }

    const countMap: Record<string, number> = {};
    for (const log of logsRes.data || []) {
      countMap[log.account_id] = (countMap[log.account_id] || 0) + 1;
    }
    setTodaySentMap(countMap);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAccounts();

    // Realtime — refresh accounts on any change
    const channel = supabase
      .channel("wa_accounts_ui")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wa_accounts" },
        () => { fetchAccounts(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchAccounts]);

  const handleAddAccount = async () => {
    if (!newName.trim() || !newPhone.trim()) {
      toast.error("Name and phone number are required");
      return;
    }
    setAdding(true);

    const normalizedPhone = newPhone.replace(/\s+/g, "");

    const { error } = await supabase.from("wa_accounts").upsert(
      {
        display_name: newName.trim(),
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
      toast.success("Account added! Worker will start pairing shortly.");
      setNewName("");
      setNewPhone("");
      setDialogOpen(false);
    }
  };

  const handleRePair = async (id: string) => {
    setRePairing((p) => ({ ...p, [id]: true }));

    // Signal the worker: clear QR + set pairing state.
    // Worker detects status='pairing' + connection_status='disconnected' + pairing_qr=null
    // → deletes auth files → creates fresh socket → generates new QR.
    const { error } = await supabase
      .from("wa_accounts")
      .update({
        status: "pairing",
        connection_status: "disconnected",
        pairing_qr: null,
      })
      .eq("id", id);

    setRePairing((p) => ({ ...p, [id]: false }));

    if (error) {
      toast.error("Re-pair failed: " + error.message);
    } else {
      toast.info("Re-pair signal sent. QR code will appear in a few seconds.");
    }
  };

  const handleArchive = async (id: string) => {
    const { error } = await supabase
      .from("wa_accounts")
      .update({ is_archived: true })
      .eq("id", id);

    if (error) {
      toast.error("Failed to archive: " + error.message);
    } else {
      toast.success("Account archived.");
    }
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Account Command Center</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {accounts.length} WhatsApp account{accounts.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchAccounts} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
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
                    <Input
                      placeholder="e.g. Account-A"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Phone Number (with country code)</Label>
                    <Input
                      placeholder="+91 9876543210"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                    />
                  </div>
                  <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">After adding:</p>
                    <p>1. Make sure the <strong>worker</strong> is running</p>
                    <p>2. A QR code will appear below the account card</p>
                    <p>3. Open WhatsApp → Linked Devices → Link a device</p>
                    <p>4. Scan the QR code (it refreshes every ~20s)</p>
                  </div>
                  <Button
                    onClick={handleAddAccount}
                    disabled={adding || !newName.trim() || !newPhone.trim()}
                    className="w-full"
                  >
                    {adding && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Add Account
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Empty state */}
        {accounts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-16 text-center space-y-3">
            <QrCode className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-medium">No accounts yet</p>
            <p className="text-xs text-muted-foreground">Add your first WhatsApp account to start sending campaigns.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((acc) => {
              const sentToday = todaySentMap[acc.id] || 0;
              const pct = acc.daily_limit > 0
                ? Math.min((sentToday / acc.daily_limit) * 100, 100)
                : 0;
              const isConnected = acc.connection_status === "connected";
              const isPairing = acc.status === "pairing";

              return (
                <div key={acc.id} className="rounded-lg border border-border bg-card p-5">
                  {/* Card header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg",
                        isConnected
                          ? "bg-success/10"
                          : isPairing
                          ? "bg-primary/10"
                          : "bg-destructive/10"
                      )}>
                        {isConnected ? (
                          <Wifi className="h-5 w-5 text-success" />
                        ) : isPairing ? (
                          <QrCode className="h-5 w-5 text-primary" />
                        ) : (
                          <WifiOff className="h-5 w-5 text-destructive" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{acc.display_name}</span>
                          <div className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            isConnected
                              ? "bg-success animate-pulse"
                              : isPairing
                              ? "bg-primary animate-pulse"
                              : "bg-destructive"
                          )} />
                        </div>
                        <span className="text-xs text-muted-foreground">{acc.phone_number}</span>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] capitalize",
                        acc.status === "active"
                          ? "bg-success/15 text-success border-success/30"
                          : acc.status === "cooldown"
                          ? "bg-warning/15 text-warning border-warning/30"
                          : acc.status === "pairing"
                          ? "bg-primary/15 text-primary border-primary/30"
                          : "bg-muted text-muted-foreground border-border"
                      )}
                    >
                      {acc.connection_status === "reconnecting"
                        ? "reconnecting"
                        : acc.status}
                    </Badge>
                  </div>

                  {/* Daily send progress */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">Messages Today</span>
                      <span>{sentToday} / {acc.daily_limit || "∞"}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          pct > 90 ? "bg-destructive" : pct > 70 ? "bg-warning" : "bg-primary"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* QR Code — only when pairing */}
                  <QrPanel qr={acc.pairing_qr} status={acc.status} />

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs gap-1.5"
                      onClick={() => handleRePair(acc.id)}
                      disabled={rePairing[acc.id]}
                    >
                      {rePairing[acc.id]
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <QrCode className="h-3 w-3" />}
                      {isConnected ? "Re-link" : "Pair / Retry"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleArchive(acc.id)}
                    >
                      Archive
                    </Button>
                  </div>

                  {/* Connection status note */}
                  {acc.connection_status === "reconnecting" && (
                    <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-400 text-center">
                      Auto-reconnecting… If stuck, click "Pair / Retry"
                    </p>
                  )}
                  {acc.status === "disconnected" && acc.connection_status === "disconnected" && (
                    <p className="mt-2 text-[10px] text-destructive text-center">
                      Session expired or logged out — click "Pair / Retry" to re-link
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
