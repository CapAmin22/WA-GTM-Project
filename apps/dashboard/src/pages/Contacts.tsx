import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Upload, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Papa from "papaparse";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [blacklist, setBlacklist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Add Contact dialog ────────────────────────────────────────
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);

  // ── Create Segment dialog ─────────────────────────────────────
  const [segDialogOpen, setSegDialogOpen] = useState(false);
  const [segName, setSegName] = useState("");
  const [segDescription, setSegDescription] = useState("");
  const [segTags, setSegTags] = useState(""); // comma-separated tags
  const [creatingSeg, setCreatingSeg] = useState(false);

  // ── Add to Blacklist dialog ───────────────────────────────────
  const [blDialogOpen, setBlDialogOpen] = useState(false);
  const [blPhone, setBlPhone] = useState("");
  const [blReason, setBlReason] = useState("");
  const [addingBl, setAddingBl] = useState(false);

  // ── Confirm dialog ────────────────────────────────────────────
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; description: string; onConfirm: () => void; danger?: boolean }>({ title: "", description: "", onConfirm: () => {} });

  const openConfirm = (config: typeof confirmConfig) => {
    setConfirmConfig(config);
    setConfirmOpen(true);
  };

  // ─────────────────────────────────────────────────────────────

  const fetchAll = async () => {
    const [cRes, sRes, bRes] = await Promise.all([
      supabase.from("contacts").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("contact_segments").select("*").order("created_at", { ascending: false }),
      supabase.from("blacklist").select("*").order("created_at", { ascending: false }),
    ]);
    setContacts(cRes.data || []);
    setSegments(sRes.data || []);
    setBlacklist(bRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = contacts.filter(
    (c) =>
      (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  ).sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
    return sortOrder === "asc" ? 1 : -1;
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // ── Add Contact ───────────────────────────────────────────────
  const handleAddContact = async () => {
    if (!newPhone.trim()) { toast.error("Phone number is required."); return; }
    setAdding(true);
    const { error } = await supabase.from("contacts").insert({
      phone: newPhone.trim(),
      name: newName.trim() || null,
      company: newCompany.trim() || null,
      email: newEmail.trim() || null,
      source: "manual",
    });
    setAdding(false);
    if (error) {
      toast.error(error.code === "23505" ? "Phone number already exists." : "Failed: " + error.message);
    } else {
      toast.success("Contact added!");
      setNewPhone(""); setNewName(""); setNewCompany(""); setNewEmail("");
      setAddDialogOpen(false);
      fetchAll();
    }
  };

  // ── CSV Import ────────────────────────────────────────────────
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please upload a .csv file.");
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        if (rows.length === 0) { toast.error("CSV is empty."); return; }

        // Normalize a row's keys: lowercase + strip spaces/underscores/hyphens/BOM
        // so "Phone Number", "phone_number", "Mobile", "PHONE" all resolve correctly
        const getField = (r: any, keys: string[]): string => {
          const normalized: Record<string, string> = {};
          for (const k of Object.keys(r)) {
            normalized[k.toLowerCase().replace(/[^a-z0-9]/g, "")] = r[k];
          }
          for (const key of keys) {
            const val = normalized[key];
            if (val !== undefined && val !== null && String(val).trim() !== "") {
              return String(val).trim();
            }
          }
          return "";
        };

        const findPhone = (r: any): string => {
          // 1. Try common header names
          const p = getField(r, ["phone", "phonenumber", "mobile", "number", "tel", "telephone", "contact", "contactnumber", "whatsapp", "whatsappnumber", "wa"]);
          if (p) return p;

          // 2. Fallback: Parse the raw keys/values to see if any matches a phone number pattern
          // This handles CSVs with NO headers (PapaParse uses the first row as headers)
          const phoneRegex = /^\+?[0-9\-\s\(\)]{8,20}$/;
          for (const k of Object.keys(r)) {
            // If the CSV had no header, the key itself might be the first person's phone number!
            if (phoneRegex.test(k.trim())) return k.trim();
            
            // Or maybe the column has a weird header name, check its value
            const v = String(r[k] || "").trim();
            if (phoneRegex.test(v)) return v;
          }
          return "";
        };

        const insertRows = rows
          .map((r, rowIndex) => {
            let phone = findPhone(r);
            
            // Edge case: If rowIndex === 0 and the key itself was the phone number, 
            // the above findPhone returns the key (which is the first row's data).
            // But PapaParse also parsed a value for it, which means we might lose the second row's data.
            // Wait, r is the row object. If k is the key, `r[k]` is the value.
            // If phone returned is the key, it's correct for row 1! But for row 2, we actually want `r[k]`!
            // Let's refine:
            // The key is constant for ALL rows in PapaParse.
            
            if (!phone) {
              // Try again looking specifically at values
              const phoneRegex = /^\+?[0-9]+$/;
              for (const k of Object.keys(r)) {
                const cleanedValue = String(r[k] || "").replace(/[^0-9+]/g, "");
                if (cleanedValue.length >= 8 && cleanedValue.length <= 15) {
                  phone = cleanedValue;
                  break;
                }
              }
            }

            // Still no phone? If this is the very first row and we matched a key earlier, 
            // we should also make sure we capture the row data.
            // Let's just do a clean regex check for the value first.
            let bestPhone = "";
            const cleanRegex = /^\+?[0-9]{8,15}$/;
            
            // First check standard fields
            const standardPhone = getField(r, ["phone", "phonenumber", "mobile", "number", "tel", "telephone", "contact", "contactnumber", "whatsapp", "whatsappnumber", "wa"]);
            if (standardPhone) {
              bestPhone = standardPhone;
            } else {
              // Check all values in the row to see if one looks like a phone number
              for (const k of Object.keys(r)) {
                const v = String(r[k] || "").replace(/[\s\-\(\)]/g, "");
                if (cleanRegex.test(v)) {
                  bestPhone = v;
                  break;
                }
              }
            }

            if (!bestPhone) return null;

            const rawTags = getField(r, ["tags", "tag", "label", "labels"]);
            const tags = rawTags
              ? rawTags.split(",").map((t: string) => t.trim()).filter(Boolean)
              : [];
              
            return {
              phone: bestPhone,
              name: getField(r, ["name", "fullname", "firstname", "contactname", "businessname"]) || null,
              company: getField(r, ["company", "organization", "org", "business", "businessname"]) || null,
              email: getField(r, ["email", "emailaddress", "mail"]) || null,
              tags,
              source: "csv_import",
            };
          })
          .filter(Boolean);

        // If the file lacked headers, the first row of data became the headers.
        // We need to fetch that "header" row and insert it as well if it contains a phone number!
        if (rows.length > 0) {
          const firstRowKeys = Object.keys(rows[0]);
          let keyPhone = "";
          const cleanRegex = /^\+?[0-9]{8,15}$/;
          
          for (const k of firstRowKeys) {
             const cleanK = k.replace(/[\s\-\(\)]/g, "");
             if (cleanRegex.test(cleanK)) {
                keyPhone = cleanK;
                break;
             }
          }
          
          if (keyPhone) {
             // The keys contain a phone number, which means the CSV had no header!
             // We should insert the header itself as a row.
             const headerRow = {
                phone: keyPhone,
                name: null,
                company: null,
                email: null,
                tags: [],
                source: "csv_import"
             };
             // Ensure we don't duplicate it
             if (!insertRows.find(r => r.phone === keyPhone)) {
                insertRows.unshift(headerRow);
             }
          }
        }

        if (insertRows.length === 0) {
          toast.error("No rows with a valid 'phone' column found.");
          return;
        }

        // Upsert to handle duplicates gracefully
        const { error, count } = await supabase
          .from("contacts")
          .upsert(insertRows as any[], { onConflict: "phone", ignoreDuplicates: true })
          .select("id", { count: "exact" });

        if (error) {
          toast.error("CSV import failed: " + error.message);
        } else {
          toast.success(`Imported ${insertRows.length} contacts (${count || 0} new, duplicates skipped).`);
          fetchAll();
        }
      },
      error: (err) => toast.error("CSV parse error: " + err.message),
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Create Segment ────────────────────────────────────────────
  const handleCreateSegment = async () => {
    if (!segName.trim()) { toast.error("Segment name is required."); return; }
    setCreatingSeg(true);

    // Build filter_rules from comma-separated tags
    const tagList = segTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const filterRules = tagList.map((tag) => ({
      field: "tags",
      operator: "contains",
      value: tag,
    }));

    // Count matching contacts
    let contactCount = contacts.length; // default: all
    if (filterRules.length > 0) {
      contactCount = contacts.filter((c) =>
        filterRules.every((r) => (c.tags || []).includes(r.value))
      ).length;
    }

    const { error } = await supabase.from("contact_segments").insert({
      name: segName.trim(),
      description: segDescription.trim() || null,
      filter_rules: filterRules,
      contact_count: contactCount,
    });

    setCreatingSeg(false);
    if (error) {
      toast.error("Failed to create segment: " + error.message);
    } else {
      toast.success(`Segment "${segName}" created with ~${contactCount} matching contacts.`);
      setSegName(""); setSegDescription(""); setSegTags("");
      setSegDialogOpen(false);
      fetchAll();
    }
  };

  // ── Delete Segment ────────────────────────────────────────────
  const handleDeleteSegment = (id: string, name: string) => {
    openConfirm({
      title: `Delete "${name}"?`,
      description: "This segment will be removed. Contacts will not be affected.",
      onConfirm: async () => {
        const { error } = await supabase.from("contact_segments").delete().eq("id", id);
        if (error) toast.error("Failed: " + error.message);
        else { toast.success("Segment deleted."); fetchAll(); }
      },
    });
  };

  // ── Add to Blacklist ──────────────────────────────────────────
  const handleAddBlacklist = async () => {
    if (!blPhone.trim()) { toast.error("Phone number is required."); return; }
    setAddingBl(true);

    const { error } = await supabase.from("blacklist").insert({
      phone: blPhone.trim(),
      reason: blReason.trim() || null,
      added_by: "dashboard",
    });

    if (!error) {
      // Also mark contact as blacklisted if exists
      await supabase
        .from("contacts")
        .update({ is_blacklisted: true })
        .eq("phone", blPhone.trim());
    }

    setAddingBl(false);
    if (error) {
      toast.error(error.code === "23505" ? "Phone already blacklisted." : "Failed: " + error.message);
    } else {
      toast.success("Added to blacklist.");
      setBlPhone(""); setBlReason("");
      setBlDialogOpen(false);
      fetchAll();
    }
  };

  // ── Remove from Blacklist ─────────────────────────────────────
  const handleRemoveBlacklist = async (phone: string) => {
    const { error } = await supabase.from("blacklist").delete().eq("phone", phone);
    if (!error) {
      await supabase.from("contacts").update({ is_blacklisted: false }).eq("phone", phone);
    }
    if (error) toast.error("Failed: " + error.message);
    else { toast.success("Removed from blacklist."); fetchAll(); }
  };

  // ── Delete Contact ──────────────────────────────────────────────
  const handleDeleteContact = (id: string, name: string) => {
    openConfirm({
      title: `Delete ${name || "this contact"}?`,
      description: "This contact will be permanently removed from your list.",
      danger: true,
      onConfirm: async () => {
        const { error } = await supabase.from("contacts").delete().eq("id", id);
        if (error) toast.error("Failed to delete contact: " + error.message);
        else { toast.success("Contact deleted."); fetchAll(); }
      },
    });
  };

  // ── Delete All Contacts ───────────────────────────────────────
  const handleDeleteAllContacts = () => {
    openConfirm({
      title: "Delete ALL contacts?",
      description: "This will permanently delete every contact in your list. This action cannot be undone.",
      danger: true,
      onConfirm: async () => {
        setLoading(true);
        const { error } = await supabase.from("contacts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) { toast.error("Failed to delete all contacts: " + error.message); setLoading(false); }
        else { toast.success("All contacts deleted."); fetchAll(); }
      },
    });
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
            <Button variant="outline" size="sm" className="gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20" onClick={handleDeleteAllContacts}>
              <Trash2 className="h-3.5 w-3.5" /> Delete All Contacts
            </Button>
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
                  <div className="space-y-1"><Label className="text-xs">Phone * (include country code)</Label><Input placeholder="+91 9876543210" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Name</Label><Input placeholder="John Doe" value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Company</Label><Input placeholder="Acme Corp" value={newCompany} onChange={(e) => setNewCompany(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Email</Label><Input placeholder="john@acme.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
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

          {/* ── Contacts Tab ── */}
          <TabsContent value="contacts" className="space-y-4 mt-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search by name or phone..." className="pl-9 h-9 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('name')}>Name {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('phone')}>Phone {sortField === 'phone' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('company')}>Company {sortField === 'company' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Tags</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('total_messages_sent')}>Sent {sortField === 'total_messages_sent' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('total_replies')}>Replies {sortField === 'total_replies' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('source')}>Source {sortField === 'source' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">No contacts found.</td></tr>
                  ) : (
                    filtered.map((c) => (
                      <tr key={c.id} className={cn("hover:bg-accent/30 transition-colors", c.is_blacklisted && "opacity-50")}>
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
                        <td className="px-4 py-2.5 text-right">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteContact(c.id, c.name || c.phone)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ── Segments Tab ── */}
          <TabsContent value="segments" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Dialog open={segDialogOpen} onOpenChange={setSegDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5 text-xs">
                    <Plus className="h-3.5 w-3.5" /> New Segment
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create Segment</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Segment Name *</Label>
                      <Input placeholder="e.g. VIP Customers" value={segName} onChange={(e) => setSegName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Description</Label>
                      <Input placeholder="Optional description" value={segDescription} onChange={(e) => setSegDescription(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Filter by Tags (comma-separated)</Label>
                      <Input
                        placeholder="e.g. VIP, premium, india"
                        value={segTags}
                        onChange={(e) => setSegTags(e.target.value)}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Contacts must have ALL listed tags to be included. Leave blank to include all contacts.
                      </p>
                    </div>
                    <Button onClick={handleCreateSegment} disabled={creatingSeg} className="w-full">
                      {creatingSeg ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Create Segment
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {segments.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground text-sm">
                No segments yet. Create one to target specific contacts in campaigns.
              </div>
            ) : (
              <div className="grid gap-3">
                {segments.map((s) => (
                  <div key={s.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-sm font-medium">{s.name}</span>
                        {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
                        {s.filter_rules?.length > 0 ? (
                          <div className="flex gap-1 flex-wrap mt-1.5">
                            {s.filter_rules.map((r: any, i: number) => (
                              <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary">
                                {r.field} {r.operator} "{r.value}"
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">All contacts (no tag filter)</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-muted-foreground">{s.contact_count} contacts</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteSegment(s.id, s.name)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Blacklist Tab ── */}
          <TabsContent value="blacklist" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Dialog open={blDialogOpen} onOpenChange={setBlDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="destructive" className="gap-1.5 text-xs">
                    <Plus className="h-3.5 w-3.5" /> Add to Blacklist
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add to Blacklist</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Phone Number *</Label>
                      <Input placeholder="+91 9876543210" value={blPhone} onChange={(e) => setBlPhone(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Reason (optional)</Label>
                      <Input placeholder="e.g. Opted out, spam complaint" value={blReason} onChange={(e) => setBlReason(e.target.value)} />
                    </div>
                    <Button onClick={handleAddBlacklist} disabled={addingBl} className="w-full bg-destructive hover:bg-destructive/90">
                      {addingBl ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Blacklist Number
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {blacklist.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground text-sm">
                Blacklist is empty. Numbers added here will never receive messages.
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Phone</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Reason</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Added</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {blacklist.map((b) => (
                      <tr key={b.id} className="hover:bg-accent/30 transition-colors">
                        <td className="px-4 py-2.5 text-xs font-mono">{b.phone}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{b.reason || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1"
                            onClick={() => handleRemoveBlacklist(b.phone)}
                          >
                            <Trash2 className="h-3 w-3" /> Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirmConfig.title}</DialogTitle>
            <DialogDescription>{confirmConfig.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              variant={confirmConfig.danger ? "destructive" : "default"}
              onClick={() => { setConfirmOpen(false); confirmConfig.onConfirm(); }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
