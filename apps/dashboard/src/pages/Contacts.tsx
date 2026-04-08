import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Upload, MoreHorizontal, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Papa from "papaparse";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [blacklist, setBlacklist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAll = async () => {
    const [contactsRes, segmentsRes, blacklistRes] = await Promise.all([
      supabase.from("contacts").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("contact_segments").select("*").order("created_at", { ascending: false }),
      supabase.from("blacklist").select("*").order("created_at", { ascending: false }),
    ]);
    setContacts(contactsRes.data || []);
    setSegments(segmentsRes.data || []);
    setBlacklist(blacklistRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = contacts.filter(
    (c) =>
      (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  const handleAddContact = async () => {
    if (!newPhone) return;
    setAdding(true);
    const { error } = await supabase.from("contacts").insert({
      name: newName || null,
      phone: newPhone,
      company: newCompany || null,
      email: newEmail || null,
      source: "manual",
    });
    setAdding(false);
    if (error) {
      toast.error("Failed: " + error.message);
    } else {
      toast.success("Contact added!");
      setNewName(""); setNewPhone(""); setNewCompany(""); setNewEmail("");
      setAddDialogOpen(false);
      fetchAll();
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        if (rows.length === 0) {
          toast.error("CSV is empty.");
          return;
        }

        const insertRows = rows
          .filter((r) => r.phone || r.Phone || r.PHONE)
          .map((r) => ({
            phone: (r.phone || r.Phone || r.PHONE || "").trim(),
            name: (r.name || r.Name || r.NAME || null),
            company: (r.company || r.Company || r.COMPANY || null),
            email: (r.email || r.Email || r.EMAIL || null),
            source: "csv",
            tags: r.tags ? (r.tags as string).split(",").map((t: string) => t.trim()) : [],
          }));

        if (insertRows.length === 0) {
          toast.error("No valid rows with 'phone' column found.");
          return;
        }

        const { error } = await supabase.from("contacts").insert(insertRows);
        if (error) {
          toast.error("CSV import failed: " + error.message);
        } else {
          toast.success(`Imported ${insertRows.length} contacts!`);
          fetchAll();
        }
      },
      error: (err) => {
        toast.error("CSV parse error: " + err.message);
      },
    });

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
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
            <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage contacts, segments, and blacklist</p>
          </div>
          <div className="flex gap-2">
            <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleCsvUpload} />
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Import CSV
            </Button>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1"><Label className="text-xs">Phone *</Label><Input placeholder="+91 9876543210" value={newPhone} onChange={e => setNewPhone(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Name</Label><Input placeholder="John Doe" value={newName} onChange={e => setNewName(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Company</Label><Input placeholder="Acme Corp" value={newCompany} onChange={e => setNewCompany(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Email</Label><Input placeholder="john@acme.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} /></div>
                  <Button onClick={handleAddContact} disabled={adding} className="w-full">
                    {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Add Contact
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="contacts">
          <TabsList className="bg-muted/50 border border-border">
            <TabsTrigger value="contacts" className="text-xs">Contacts ({contacts.length})</TabsTrigger>
            <TabsTrigger value="segments" className="text-xs">Segments ({segments.length})</TabsTrigger>
            <TabsTrigger value="blacklist" className="text-xs">Blacklist ({blacklist.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="space-y-4 mt-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search by name or phone..." className="pl-9 h-9 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Phone</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Company</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Tags</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Sent</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Replies</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">No contacts found.</td></tr>
                  ) : (
                    filtered.map((c) => (
                      <tr key={c.id} className="hover:bg-accent/30 transition-colors">
                        <td className="px-4 py-2.5 text-sm font-medium">{c.name || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{c.phone}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{c.company || "—"}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1 flex-wrap">
                            {(c.tags || []).map((t: string) => (
                              <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary">{t}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs">{c.total_messages_sent}</td>
                        <td className="px-4 py-2.5 text-xs text-success">{c.total_replies}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{c.source}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="segments" className="space-y-4 mt-4">
            {segments.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground text-sm">No segments created yet.</div>
            ) : (
              <div className="grid gap-3">
                {segments.map((s) => (
                  <div key={s.id} className="rounded-lg border border-border bg-card p-4 hover:bg-accent/30 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{s.name}</span>
                      <span className="text-xs text-muted-foreground">{s.contact_count} contacts</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="blacklist" className="space-y-4 mt-4">
            {blacklist.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground text-sm">Blacklist is empty.</div>
            ) : (
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Phone</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Reason</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {blacklist.map((b) => (
                      <tr key={b.id} className="hover:bg-accent/30 transition-colors">
                        <td className="px-4 py-2.5 text-xs font-mono">{b.phone}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{b.reason || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
