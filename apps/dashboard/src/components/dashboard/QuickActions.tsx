import { useState, useEffect } from "react";
import { Pause, Play, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WaAccount {
  id: string;
  display_name: string;
  phone_number: string;
}

export function QuickActions() {
  const [sendEnabled, setSendEnabled] = useState(true);
  const [pauseLoading, setPauseLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);

  // Quick Send state
  const [quickSendOpen, setQuickSendOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accounts, setAccounts] = useState<WaAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Load global_send_enabled on mount
  useEffect(() => {
    async function loadConfig() {
      const { data, error } = await supabase
        .from("system_config")
        .select("value")
        .eq("key", "global_send_enabled")
        .single();

      if (!error && data) {
        setSendEnabled(Boolean(data.value));
      }
      setConfigLoading(false);
    }
    loadConfig();
  }, []);

  const handlePauseToggle = async () => {
    setPauseLoading(true);
    const newValue = !sendEnabled;

    const { error } = await supabase
      .from("system_config")
      .upsert({ key: "global_send_enabled", value: newValue }, { onConflict: "key" });

    setPauseLoading(false);
    if (error) {
      toast.error("Failed to update: " + error.message);
    } else {
      setSendEnabled(newValue);
      toast.success(newValue ? "Sending resumed." : "All sending paused.");
    }
  };

  const handleQuickSendOpen = async (open: boolean) => {
    setQuickSendOpen(open);
    if (open) {
      setAccountsLoading(true);
      const { data, error } = await supabase
        .from("wa_accounts")
        .select("id, display_name, phone_number")
        .eq("connection_status", "connected")
        .eq("is_archived", false)
        .order("display_name");

      if (!error && data) {
        setAccounts(data);
        if (data.length > 0) setSelectedAccountId(data[0].id);
      }
      setAccountsLoading(false);
    } else {
      // Reset on close
      setPhone("");
      setMessage("");
      setSelectedAccountId("");
    }
  };

  const handleSend = async () => {
    if (!phone.trim()) { toast.error("Phone number is required."); return; }
    if (!message.trim()) { toast.error("Message is required."); return; }
    if (!selectedAccountId) { toast.error("Select a WhatsApp account."); return; }

    setSending(true);
    const { error } = await supabase.from("message_queue").insert({
      recipient_phone: phone.trim(),
      message_template: message.trim(),
      message_body: message.trim(),
      status: "pending",
      assigned_account_id: selectedAccountId,
      scheduled_for: new Date().toISOString(),
      attempt_count: 0,
      max_attempts: 3,
    });

    setSending(false);
    if (error) {
      toast.error("Failed to queue message: " + error.message);
    } else {
      toast.success("Message queued — will send within 10s.");
      setQuickSendOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={sendEnabled ? "destructive" : "default"}
        size="sm"
        onClick={handlePauseToggle}
        disabled={pauseLoading || configLoading}
        className="gap-1.5 text-xs"
      >
        {pauseLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : sendEnabled ? (
          <><Pause className="h-3.5 w-3.5" /> Pause All</>
        ) : (
          <><Play className="h-3.5 w-3.5" /> Resume</>
        )}
      </Button>

      <Dialog open={quickSendOpen} onOpenChange={handleQuickSendOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Zap className="h-3.5 w-3.5" /> Quick Send
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Send</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">WhatsApp Account</Label>
              {accountsLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading accounts…
                </div>
              ) : accounts.length === 0 ? (
                <p className="text-xs text-destructive">No connected accounts available.</p>
              ) : (
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.display_name} ({acc.phone_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Phone Number</Label>
              <Input
                placeholder="+91 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Message</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[100px] resize-none"
                placeholder="Type your message… Spintax supported: {Hi|Hello|Hey}"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              size="sm"
              onClick={handleSend}
              disabled={sending || accounts.length === 0}
            >
              {sending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Queuing…</>
              ) : (
                <><Zap className="h-3.5 w-3.5 mr-1.5" /> Send Message</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
