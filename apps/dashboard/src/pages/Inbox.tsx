import { useState, useEffect, useRef, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Send, Search, Loader2, MessageSquare, Phone, RefreshCw,
  Check, CheckCheck, Clock, Wifi, WifiOff, ChevronDown, Copy, ExternalLink,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────
interface WaMessage {
  id: string;
  account_id: string;
  wa_message_id: string | null;
  contact_phone: string;
  from_me: boolean;
  body: string | null;
  message_type: string;
  status: string;
  timestamp: string;
  created_at: string;
}

interface Conversation {
  phone: string;
  contactName: string | null;
  lastBody: string;
  lastTime: string;
  unreadCount: number;
  lastFromMe: boolean;
  accountId: string;
}

interface WaAccount {
  id: string;
  display_name: string;
  phone_number: string;
  connection_status: string;
  status: string;
}

// ── Helpers ────────────────────────────────────────────────────────
function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function fullTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function MessageStatusIcon({ status, fromMe }: { status: string; fromMe: boolean }) {
  if (!fromMe) return null;
  if (status === "read") return <CheckCheck className="h-3 w-3 text-blue-400" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
  if (status === "sent") return <Check className="h-3 w-3 text-muted-foreground" />;
  return <Clock className="h-3 w-3 text-muted-foreground" />;
}

// ── Main Component ─────────────────────────────────────────────────
export default function InboxPage() {
  const [accounts, setAccounts] = useState<WaAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contactNames, setContactNames] = useState<Record<string, string>>({});
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesBoxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Load accounts ─────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from("wa_accounts")
      .select("id, display_name, phone_number, connection_status, status")
      .eq("is_archived", false)
      .then(({ data }) => {
        const accs = (data || []) as WaAccount[];
        setAccounts(accs);
        if (accs.length > 0) setSelectedAccountId(accs[0].id);
      });
  }, []);

  // ── Load contact name map ─────────────────────────────────────
  useEffect(() => {
    supabase
      .from("contacts")
      .select("phone, name")
      .then(({ data }) => {
        const map: Record<string, string> = {};
        for (const c of data || []) {
          if (c.name) map[c.phone] = c.name;
        }
        setContactNames(map);
      });
  }, []);

  // ── Load conversations for selected account ───────────────────
  const loadConversations = useCallback(async (accountId: string) => {
    if (!accountId) return;
    setLoadingConvs(true);

    const { data, error } = await supabase
      .from("wa_messages")
      .select("contact_phone, body, from_me, timestamp, account_id, status")
      .eq("account_id", accountId)
      .order("timestamp", { ascending: false })
      .limit(1000);

    if (error) {
      if (error.message.includes("relation") || error.message.includes("does not exist")) {
        setMigrationMissing(true);
      } else {
        toast.error("Failed to load inbox: " + error.message);
      }
      setLoadingConvs(false);
      return;
    }

    setMigrationMissing(false);

    // Group by contact_phone — keep the latest message per conversation
    const convMap: Record<string, Conversation> = {};
    for (const msg of data || []) {
      const phone = msg.contact_phone;
      if (!convMap[phone]) {
        convMap[phone] = {
          phone,
          contactName: contactNames[phone] || null,
          lastBody: msg.body || "(media)",
          lastTime: msg.timestamp,
          unreadCount: 0,
          lastFromMe: msg.from_me,
          accountId: msg.account_id,
        };
      }
      // Count unread (inbound, not from me)
      if (!msg.from_me && msg.status === "received") {
        convMap[phone].unreadCount++;
      }
    }

    const sorted = Object.values(convMap).sort(
      (a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime()
    );
    setConversations(sorted);
    setLoadingConvs(false);
  }, [contactNames]);

  useEffect(() => {
    if (selectedAccountId) loadConversations(selectedAccountId);
  }, [selectedAccountId, loadConversations]);

  // ── Load messages for selected conversation ───────────────────
  const loadMessages = useCallback(async (phone: string, accountId: string) => {
    setLoadingMsgs(true);
    const { data, error } = await supabase
      .from("wa_messages")
      .select("*")
      .eq("account_id", accountId)
      .eq("contact_phone", phone)
      .order("timestamp", { ascending: true })
      .limit(300);

    if (!error) setMessages((data || []) as WaMessage[]);
    setLoadingMsgs(false);
  }, []);

  useEffect(() => {
    if (selectedPhone && selectedAccountId) {
      loadMessages(selectedPhone, selectedAccountId);
    }
  }, [selectedPhone, selectedAccountId, loadMessages]);

  // ── Realtime subscription ─────────────────────────────────────
  useEffect(() => {
    if (!selectedAccountId) return;

    const channel = supabase
      .channel(`inbox_${selectedAccountId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wa_messages",
          filter: `account_id=eq.${selectedAccountId}` },
        (payload) => {
          const newMsg = payload.new as WaMessage;
          // Add to open conversation if it matches
          if (newMsg.contact_phone === selectedPhone) {
            setMessages((prev) => {
              if (prev.find((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
          // Refresh conversation list
          loadConversations(selectedAccountId);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedAccountId, selectedPhone, loadConversations]);

  // ── Auto-scroll to bottom ─────────────────────────────────────
  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

  const handleScroll = () => {
    const box = messagesBoxRef.current;
    if (!box) return;
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    setAutoScroll(atBottom);
  };

  // ── Select conversation ───────────────────────────────────────
  const selectConversation = (conv: Conversation) => {
    setSelectedPhone(conv.phone);
    setAutoScroll(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── Send reply ────────────────────────────────────────────────
  const sendReply = async () => {
    if (!replyText.trim() || !selectedPhone || !selectedAccountId) return;
    setSending(true);

    const body = replyText.trim();
    setReplyText("");

    // Optimistically add to thread
    const optimistic: WaMessage = {
      id: `opt_${Date.now()}`,
      account_id: selectedAccountId,
      wa_message_id: null,
      contact_phone: selectedPhone,
      from_me: true,
      body,
      message_type: "text",
      status: "pending",
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setAutoScroll(true);

    // Queue via message_queue — worker picks up within 12s
    const { error } = await supabase.from("message_queue").insert({
      recipient_phone: selectedPhone,
      message_template: body,
      message_body: body,
      status: "pending",
      assigned_account_id: selectedAccountId,
      scheduled_for: new Date().toISOString(),
      attempt_count: 0,
      max_attempts: 3,
    });

    setSending(false);

    if (error) {
      toast.error("Failed to send: " + error.message);
      // Remove optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setReplyText(body);
    } else {
      toast.success("Message queued — sending within 12s");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  };

  // ── Derived state ─────────────────────────────────────────────
  const filteredConvs = conversations.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.phone.includes(q) ||
      (c.contactName?.toLowerCase().includes(q)) ||
      (c.lastBody?.toLowerCase().includes(q))
    );
  });

  const activeAccount = accounts.find((a) => a.id === selectedAccountId);
  const selectedConv = conversations.find((c) => c.phone === selectedPhone);

  // ── Migration missing banner ──────────────────────────────────
  const MIGRATION_SQL = `CREATE TABLE IF NOT EXISTS wa_messages (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id    UUID NOT NULL REFERENCES wa_accounts(id) ON DELETE CASCADE,
  wa_message_id TEXT,
  remote_jid    TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  from_me       BOOLEAN NOT NULL DEFAULT false,
  body          TEXT,
  message_type  TEXT NOT NULL DEFAULT 'text',
  status        TEXT NOT NULL DEFAULT 'received'
                CHECK (status IN ('pending','sent','delivered','read','received','failed')),
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wa_messages_wa_id_unique UNIQUE (wa_message_id)
);
CREATE INDEX IF NOT EXISTS idx_wa_messages_conversation
  ON wa_messages(account_id, contact_phone, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_recent
  ON wa_messages(account_id, timestamp DESC);
ALTER TABLE wa_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_messages_select" ON wa_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "wa_messages_insert" ON wa_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wa_messages_update" ON wa_messages FOR UPDATE TO authenticated USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE wa_messages;`;

  if (migrationMissing) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[70vh] text-center gap-5 max-w-2xl mx-auto px-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <MessageSquare className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">One-time database migration needed</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The Inbox needs a <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">wa_messages</code> table.
              Takes 30 seconds — paste the SQL below into the Supabase SQL Editor and click Run.
            </p>
          </div>

          <div className="flex gap-3">
            <a
              href="https://supabase.com/dashboard/project/vihvqnuqhrhkfmfleqfv/sql/new"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open SQL Editor
            </a>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(MIGRATION_SQL);
                toast.success("SQL copied to clipboard!");
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-2" /> Copy SQL
            </Button>
          </div>

          <div className="w-full rounded-lg border border-border bg-muted/40 p-4 text-left">
            <p className="text-[10px] text-muted-foreground font-medium mb-2 uppercase tracking-wide">Migration SQL — copy and run in Supabase SQL Editor:</p>
            <pre className="text-[10.5px] text-foreground overflow-x-auto whitespace-pre-wrap leading-relaxed font-mono">
              {MIGRATION_SQL}
            </pre>
          </div>

          <Button variant="outline" size="sm" onClick={() => loadConversations(selectedAccountId)}>
            <RefreshCw className="h-3.5 w-3.5 mr-2" /> I've run the SQL — retry
          </Button>
        </div>
      </AppLayout>
    );
  }

  // ── Main Layout ───────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] -mt-6 -mx-6 overflow-hidden">

        {/* ── LEFT PANEL: Conversation List ── */}
        <div className="w-80 flex-shrink-0 flex flex-col border-r border-border bg-card">

          {/* Header */}
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-base font-semibold">Inbox</h1>
              <button
                onClick={() => loadConversations(selectedAccountId)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {/* Account selector */}
            {accounts.length > 1 && (
              <div className="relative">
                <select
                  value={selectedAccountId}
                  onChange={(e) => { setSelectedAccountId(e.target.value); setSelectedPhone(null); }}
                  className="w-full text-xs bg-muted border border-border rounded-md px-3 py-1.5 pr-6 appearance-none cursor-pointer text-foreground"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.display_name} ({a.phone_number})</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
              </div>
            )}

            {/* Active account status pill */}
            {activeAccount && accounts.length === 1 && (
              <div className="flex items-center gap-2">
                <div className={cn(
                  "flex items-center gap-1.5 text-xs px-2 py-1 rounded-full",
                  activeAccount.connection_status === "connected"
                    ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                )}>
                  {activeAccount.connection_status === "connected"
                    ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  {activeAccount.display_name}
                </div>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search conversations…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {loadingConvs ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredConvs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {search ? "No conversations match your search" : "No messages yet. Start the worker to capture conversations."}
                </p>
              </div>
            ) : (
              filteredConvs.map((conv) => (
                <button
                  key={conv.phone}
                  onClick={() => selectConversation(conv)}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3 border-b border-border/50 hover:bg-accent/40 transition-colors text-left",
                    selectedPhone === conv.phone && "bg-accent"
                  )}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold text-sm">
                    {(conv.contactName || conv.phone).charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-medium truncate">
                        {conv.contactName || `+${conv.phone}`}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-1">
                        {relativeTime(conv.lastTime)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs text-muted-foreground truncate">
                        {conv.lastFromMe && <span className="text-primary/70">You: </span>}
                        {conv.lastBody || "(media)"}
                      </p>
                      {conv.unreadCount > 0 && (
                        <Badge className="h-4 min-w-4 px-1 text-[10px] bg-primary text-primary-foreground flex-shrink-0">
                          {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer: total count */}
          <div className="p-3 border-t border-border text-center">
            <p className="text-[10px] text-muted-foreground">
              {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* ── RIGHT PANEL: Conversation Thread ── */}
        {selectedPhone ? (
          <div className="flex-1 flex flex-col min-w-0">

            {/* Thread header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-card">
              <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                {(selectedConv?.contactName || selectedPhone).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {selectedConv?.contactName || `+${selectedPhone}`}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> +{selectedPhone}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {activeAccount && (
                  <div className={cn(
                    "text-xs px-2 py-0.5 rounded-full flex items-center gap-1",
                    activeAccount.connection_status === "connected"
                      ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                  )}>
                    {activeAccount.connection_status === "connected"
                      ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                    {activeAccount.display_name}
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div
              ref={messagesBoxRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-5 py-4 space-y-1"
              style={{ background: "hsl(var(--muted)/0.3)" }}
            >
              {loadingMsgs ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No messages yet in this conversation</p>
                </div>
              ) : (
                <>
                  {messages.map((msg, idx) => {
                    const prevMsg = messages[idx - 1];
                    const showDateDivider = !prevMsg ||
                      new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();

                    return (
                      <div key={msg.id}>
                        {/* Date divider */}
                        {showDateDivider && (
                          <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                              {new Date(msg.timestamp).toLocaleDateString("en-IN", {
                                weekday: "short", day: "numeric", month: "short",
                              })}
                            </span>
                            <div className="flex-1 h-px bg-border" />
                          </div>
                        )}

                        {/* Bubble */}
                        <div className={cn(
                          "flex",
                          msg.from_me ? "justify-end" : "justify-start"
                        )}>
                          <div className={cn(
                            "max-w-[65%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                            msg.from_me
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-card text-foreground border border-border rounded-bl-sm"
                          )}>
                            {/* Body */}
                            <p className="whitespace-pre-wrap break-words leading-relaxed">
                              {msg.body || <span className="italic opacity-60">(media)</span>}
                            </p>

                            {/* Footer: time + status */}
                            <div className={cn(
                              "flex items-center gap-1 mt-1",
                              msg.from_me ? "justify-end" : "justify-start"
                            )}>
                              <span className={cn(
                                "text-[10px]",
                                msg.from_me ? "text-primary-foreground/70" : "text-muted-foreground"
                              )}>
                                {fullTime(msg.timestamp)}
                              </span>
                              <MessageStatusIcon status={msg.status} fromMe={msg.from_me} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Scroll-to-bottom button */}
            {!autoScroll && (
              <div className="absolute bottom-24 right-8">
                <button
                  onClick={() => {
                    setAutoScroll(true);
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Reply bar */}
            <div className="px-4 py-3 border-t border-border bg-card">
              {activeAccount?.connection_status !== "connected" && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                  <WifiOff className="h-3 w-3" />
                  Account is not connected — messages will queue and send when reconnected.
                </p>
              )}
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <Input
                    ref={inputRef}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message +${selectedPhone}…`}
                    className="pr-4 text-sm min-h-[40px]"
                    disabled={sending}
                  />
                </div>
                <Button
                  size="icon"
                  onClick={sendReply}
                  disabled={sending || !replyText.trim()}
                  className="h-10 w-10 flex-shrink-0"
                >
                  {sending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Send className="h-4 w-4" />
                  }
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Press Enter to send · Shift+Enter for new line
              </p>
            </div>
          </div>
        ) : (
          /* ── No conversation selected placeholder ── */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-10 w-10 text-primary/60" />
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-1">WhatsApp Inbox</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Select a conversation on the left to read messages and reply in real-time.
              </p>
            </div>
            {conversations.length === 0 && !loadingConvs && (
              <p className="text-xs text-muted-foreground bg-muted px-4 py-2 rounded-lg">
                No conversations yet — start the worker and send a campaign to see messages here.
              </p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
