"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/ui/BottomNav";
import { useTheme } from "@/lib/ThemeProvider";
import { sendPushTo } from "@/hooks/usePushNotifications";

// ── Types ─────────────────────────────────────────────────────
type Statut = "En préparation" | "Confirmé" | "En cours" | "Terminé";

interface Evenement {
  id: string;
  nom: string;
  date: string;
  lieu: string;
  description: string | null;
  statut: Statut;
  created_by: string;
  created_at: string;
}

interface ChecklistItem {
  id: string;
  event_id: string;
  texte: string;
  done: boolean;
  status: "todo" | "in_progress" | "done" | null;
  assignee_id: string | null;
  assignee_name: string | null;
  created_at: string;
}

interface EventPhoto {
  id: string;
  event_id: string;
  url: string;
  uploaded_by: string | null;
  created_at: string;
}

interface EventReport {
  tickets: number;
  recettes: number;
  depenses: number;
}

// ── Config ────────────────────────────────────────────────────
const STATUTS: Statut[] = ["En préparation", "Confirmé", "En cours", "Terminé"];

const STATUT_STYLE: Record<Statut, { color: string; bg: string; border: string }> = {
  "En préparation": { color: "#1E90FF", bg: "#001428", border: "#0a4a8a" },
  "Confirmé":       { color: "#009A44", bg: "#001a0d", border: "#005c28" },
  "En cours":       { color: "#FFD700", bg: "#1a1400", border: "#665800" },
  "Terminé":        { color: "#555",    bg: "#111",    border: "#333"    },
};

const CAN_EDIT = ["CEO", "Chef de Projet Événementiel", "Event Planner"];

const PREDEFINED_TASKS = [
  "🎵 Sono / Musique", "💡 Lumières / Éclairage", "🎤 Micros / Scène",
  "🚪 Accueil / Entrées", "🔒 Sécurité", "🍽️ Catering / Buffet",
  "📸 Photographe", "🎬 Vidéo / Retransmission", "🎪 Décoration / Scéno",
  "🪑 Mobilier / Chaises", "📢 Communication", "🚗 Logistique",
  "🎟️ Billetterie", "🌐 Réseaux sociaux", "🧹 Nettoyage / Rangement",
];

const TASK_STATUS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  "todo":        { label: "À faire",  color: "#666",    bg: "transparent",  border: "#444"    },
  "in_progress": { label: "En cours", color: "#1E90FF", bg: "#001428",      border: "#0a4a8a" },
  "done":        { label: "Terminé",  color: "#009A44", bg: "#001a0d",      border: "#005c28" },
};

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "long", year: "numeric" });
}

function fmtMontant(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n)) + " FC";
}

// Compte à rebours jusqu'à une date
function getCountdown(dateStr: string): { text: string; urgent: boolean } {
  const eventDate = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const diff = eventDate.getTime() - now.getTime();
  if (diff <= 0) return { text: "", urgent: false };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (days === 0 && hours === 0) return { text: `${mins}min`, urgent: true };
  if (days === 0) return { text: `${hours}h${mins > 0 ? mins + "m" : ""}`, urgent: true };
  if (days <= 3) return { text: `J-${days}`, urgent: true };
  return { text: `J-${days}`, urgent: false };
}

// ── Composant principal ───────────────────────────────────────
export default function EvenementsPage() {
  const supabase = createClient();

  const [events, setEvents]           = useState<Evenement[]>([]);
  const [userRole, setUserRole]       = useState<string | null>(null);
  const [userId, setUserId]           = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [formError, setFormError]     = useState("");
  const [editId, setEditId]           = useState<string | null>(null);
  const [tick, setTick]               = useState(0); // pour le compte à rebours

  // Checklist
  const [checklists, setChecklists]   = useState<Record<string, ChecklistItem[]>>({});
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [newItem, setNewItem]         = useState<Record<string, string>>({});

  // Rapport
  const [reportEventId, setReportEventId] = useState<string | null>(null);
  const [report, setReport]               = useState<EventReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Galerie
  const [photos, setPhotos]               = useState<Record<string, EventPhoto[]>>({});
  const [galleryExpandedId, setGalleryExpandedId] = useState<string | null>(null);
  const [lightbox, setLightbox]           = useState<string | null>(null);
  const [uploading, setUploading]         = useState(false);

  // Équipe pour assignations
  const [teamProfiles, setTeamProfiles]   = useState<{ id: string; full_name: string }[]>([]);

  // Tâches prédéfinies panel
  const [showPredef, setShowPredef]       = useState<string | null>(null);

  // PDF
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  // Formulaire
  const [fNom, setFNom]       = useState("");
  const [fDate, setFDate]     = useState("");
  const [fLieu, setFLieu]     = useState("");
  const [fDesc, setFDesc]     = useState("");
  const [fStatut, setFStatut] = useState<Statut>("En préparation");

  // Compte à rebours : rafraîchir chaque minute
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (p) setUserRole(p.role);
    }
    const { data } = await supabase.from("evenements").select("*").order("date", { ascending: true });
    if (data) setEvents(data as Evenement[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const canEdit = userRole ? CAN_EDIT.includes(userRole) : false;
  const today = new Date().toISOString().slice(0, 10);
  const aVenir = events.filter(e => e.date >= today && e.statut !== "Terminé");
  const passés  = events.filter(e => e.date < today  || e.statut === "Terminé");

  function openEdit(ev: Evenement) {
    setEditId(ev.id); setFNom(ev.nom); setFDate(ev.date); setFLieu(ev.lieu);
    setFDesc(ev.description ?? ""); setFStatut(ev.statut);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditId(null); setFNom(""); setFDate(""); setFLieu(""); setFDesc(""); setFStatut("En préparation");
    setFormError(""); setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setFormError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (editId) {
      const { error } = await supabase.from("evenements").update({
        nom: fNom.trim(), date: fDate, lieu: fLieu.trim(),
        description: fDesc.trim() || null, statut: fStatut,
      }).eq("id", editId);
      if (error) { setFormError(error.message); setSubmitting(false); return; }
    } else {
      const { data: newEv, error } = await supabase.from("evenements").insert({
        nom: fNom.trim(), date: fDate, lieu: fLieu.trim(),
        description: fDesc.trim() || null, statut: fStatut, created_by: user.id,
      }).select().single();
      if (error) { setFormError(error.message); setSubmitting(false); return; }

      // ── Tâches types auto-ajoutées ────────────────────────────
      if (newEv) {
        const defaultTasks = [
          "📢 Briefing équipe",
          "🎵 Sono / Musique",
          "💡 Lumières / Éclairage",
          "🚪 Accueil / Entrées",
          "🔒 Sécurité",
          "🍽️ Catering / Buffet",
          "🎪 Décoration / Scéno",
        ];
        await supabase.from("event_checklist").insert(
          defaultTasks.map(texte => ({
            event_id: newEv.id, texte, done: false, status: "todo", created_by: user.id,
          }))
        );
        sendPushTo({
          toAll: true,
          excludeUserId: user.id,
          title: `Nouvel événement — ${fNom.trim()}`,
          body: `${fDate} · ${fLieu.trim()}`,
          url: "/evenements",
          tag: "new-event",
        });
      }
    }
    resetForm();
    await fetchAll();
    setSubmitting(false);
  }

  async function updateStatut(id: string, statut: Statut) {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, statut } : e));
    await supabase.from("evenements").update({ statut }).eq("id", id);
  }

  async function handleDelete(id: string, nom: string) {
    if (!confirm(`Supprimer "${nom}" ?`)) return;
    setEvents(prev => prev.filter(e => e.id !== id));
    await supabase.from("evenements").delete().eq("id", id);
  }

  // ── Checklist ─────────────────────────────────────────────────
  async function fetchChecklist(eventId: string) {
    const { data } = await supabase.from("event_checklist").select("*").eq("event_id", eventId).order("created_at");
    if (data) setChecklists(prev => ({ ...prev, [eventId]: data as ChecklistItem[] }));
  }

  function toggleExpand(eventId: string) {
    if (expandedId === eventId) {
      setExpandedId(null);
    } else {
      setExpandedId(eventId);
      if (!checklists[eventId]) fetchChecklist(eventId);
    }
  }

  async function addChecklistItem(eventId: string) {
    const texte = newItem[eventId]?.trim();
    if (!texte || !userId) return;
    const { data } = await supabase.from("event_checklist").insert({
      event_id: eventId, texte, done: false, created_by: userId,
    }).select().single();
    if (data) {
      setChecklists(prev => ({ ...prev, [eventId]: [...(prev[eventId] ?? []), data as ChecklistItem] }));
      setNewItem(prev => ({ ...prev, [eventId]: "" }));
    }
  }

  async function toggleChecklistItem(eventId: string, itemId: string, done: boolean) {
    setChecklists(prev => ({
      ...prev,
      [eventId]: prev[eventId].map(i => i.id === itemId ? { ...i, done: !done } : i),
    }));
    await supabase.from("event_checklist").update({ done: !done }).eq("id", itemId);
  }

  async function deleteChecklistItem(eventId: string, itemId: string) {
    setChecklists(prev => ({
      ...prev,
      [eventId]: prev[eventId].filter(i => i.id !== itemId),
    }));
    await supabase.from("event_checklist").delete().eq("id", itemId);
  }

  // ── Rapport ───────────────────────────────────────────────────
  async function fetchReport(ev: Evenement) {
    setReportEventId(ev.id);
    setReport(null);
    setLoadingReport(true);
    const [ticketRes, recRes, depRes] = await Promise.all([
      supabase.from("tickets").select("id", { count: "exact", head: true }).gte("created_at", ev.date + "T00:00:00").lte("created_at", ev.date + "T23:59:59"),
      supabase.from("finances").select("montant").eq("date", ev.date).eq("type", "Recette"),
      supabase.from("finances").select("montant").eq("date", ev.date).eq("type", "Dépense"),
    ]);
    setReport({
      tickets: ticketRes.count ?? 0,
      recettes: (recRes.data ?? []).reduce((s: number, e: { montant: number }) => s + e.montant, 0),
      depenses: (depRes.data ?? []).reduce((s: number, e: { montant: number }) => s + e.montant, 0),
    });
    setLoadingReport(false);
  }

  // ── Équipe ────────────────────────────────────────────────────
  const fetchTeamProfiles = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("id, full_name").order("full_name");
    if (data) setTeamProfiles(data as { id: string; full_name: string }[]);
  }, [supabase]);

  useEffect(() => { fetchTeamProfiles(); }, [fetchTeamProfiles]);

  // ── Checklist : status + assignee ─────────────────────────────
  async function cycleChecklistStatus(eventId: string, item: ChecklistItem) {
    const order: Array<ChecklistItem["status"]> = ["todo", "in_progress", "done"];
    const cur = item.status ?? (item.done ? "done" : "todo");
    const next = order[(order.indexOf(cur as ChecklistItem["status"]) + 1) % order.length];
    const isDone = next === "done";
    setChecklists(prev => ({
      ...prev,
      [eventId]: prev[eventId].map(i => i.id === item.id ? { ...i, status: next, done: isDone } : i),
    }));
    await supabase.from("event_checklist").update({ status: next, done: isDone }).eq("id", item.id);
  }

  async function updateChecklistAssignee(eventId: string, itemId: string, assigneeId: string, assigneeName: string) {
    setChecklists(prev => ({
      ...prev,
      [eventId]: prev[eventId].map(i => i.id === itemId
        ? { ...i, assignee_id: assigneeId || null, assignee_name: assigneeName || null }
        : i),
    }));
    await supabase.from("event_checklist").update({
      assignee_id: assigneeId || null,
      assignee_name: assigneeName || null,
    }).eq("id", itemId);
  }

  async function addPredefinedTask(eventId: string, texte: string) {
    if (!userId) return;
    const { data } = await supabase.from("event_checklist").insert({
      event_id: eventId, texte, done: false, status: "todo", created_by: userId,
    }).select().single();
    if (data) setChecklists(prev => ({ ...prev, [eventId]: [...(prev[eventId] ?? []), data as ChecklistItem] }));
  }

  // ── Galerie ───────────────────────────────────────────────────
  async function fetchPhotos(eventId: string) {
    const { data } = await supabase.from("event_photos").select("*").eq("event_id", eventId).order("created_at");
    if (data) setPhotos(prev => ({ ...prev, [eventId]: data as EventPhoto[] }));
  }

  function toggleGallery(eventId: string) {
    if (galleryExpandedId === eventId) {
      setGalleryExpandedId(null);
    } else {
      setGalleryExpandedId(eventId);
      if (!photos[eventId]) fetchPhotos(eventId);
    }
  }

  async function uploadPhoto(eventId: string, file: File) {
    if (!userId || uploading) return;
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const safeExt = ["jpg","jpeg","png","gif","webp","heic","heif"].includes(ext) ? ext : "jpg";
    const path = `${eventId}/${Date.now()}.${safeExt}`;
    const { error: upErr } = await supabase.storage.from("event-gallery").upload(path, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
    if (upErr) {
      console.error("Erreur upload photo :", upErr.message);
      alert(`Erreur upload : ${upErr.message}`);
      setUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("event-gallery").getPublicUrl(path);
    const { data, error: dbErr } = await supabase.from("event_photos").insert({
      event_id: eventId, url: publicUrl, uploaded_by: userId,
    }).select().single();
    if (dbErr) {
      console.error("Erreur insertion photo :", dbErr.message);
    } else if (data) {
      setPhotos(prev => ({ ...prev, [eventId]: [...(prev[eventId] ?? []), data as EventPhoto] }));
    }
    setUploading(false);
  }

  async function deletePhoto(eventId: string, photoId: string, url: string) {
    const parts = url.split("/event-gallery/");
    if (parts.length === 2) await supabase.storage.from("event-gallery").remove([parts[1]]);
    await supabase.from("event_photos").delete().eq("id", photoId);
    setPhotos(prev => ({ ...prev, [eventId]: (prev[eventId] ?? []).filter(p => p.id !== photoId) }));
  }

  // ── Rapport PDF ───────────────────────────────────────────────
  async function generateEventPDF(ev: Evenement) {
    setGeneratingPdf(ev.id);
    try {
      const [{ default: jsPDF }, finRes, checkRes, teamRes] = await Promise.all([
        import("jspdf"),
        supabase.from("finances").select("montant,type,libelle").eq("date", ev.date),
        supabase.from("event_checklist").select("texte,status,done,assignee_name").eq("event_id", ev.id).order("created_at"),
        supabase.from("profiles").select("full_name,role").order("role"),
      ]);

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210;
      let y = 0;

      // ── En-tête couleurs comoriennes ──
      doc.setFillColor(0, 154, 68);   doc.rect(0, 0,  W, 10, "F");
      doc.setFillColor(255, 255, 255); doc.rect(0, 10, W, 5,  "F");
      doc.setFillColor(228, 0, 43);    doc.rect(0, 15, W, 10, "F");
      doc.setFillColor(30, 144, 255);  doc.rect(0, 25, W, 5,  "F");
      doc.setFillColor(255, 215, 0);   doc.rect(0, 30, W, 5,  "F");

      // ── Fond titre ──
      doc.setFillColor(8, 8, 8);
      doc.rect(0, 35, W, 26, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("LIL'Z EVENT AGENCY", W / 2, 47, { align: "center" });
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 154, 68);
      doc.text("RAPPORT D'ÉVÉNEMENT", W / 2, 54, { align: "center" });
      doc.setTextColor(120, 120, 120);
      doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}`, W / 2, 59, { align: "center" });

      y = 72;

      // ── Infos événement ──
      doc.setFillColor(245, 249, 245);
      doc.roundedRect(14, y, W - 28, ev.description ? 34 : 28, 3, 3, "F");
      doc.setDrawColor(0, 154, 68);
      doc.setLineWidth(0.5);
      doc.roundedRect(14, y, W - 28, ev.description ? 34 : 28, 3, 3, "S");
      doc.setTextColor(0, 154, 68);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(ev.nom, W / 2, y + 9, { align: "center" });
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Date: ${fmtDate(ev.date)}   |   Lieu: ${ev.lieu}`, W / 2, y + 17, { align: "center" });
      if (ev.description) {
        doc.setTextColor(100, 100, 100);
        doc.text(ev.description, W / 2, y + 25, { align: "center", maxWidth: W - 48 });
      }
      y += (ev.description ? 34 : 28) + 10;

      // ── Finances ──
      const recettes = (finRes.data ?? []).filter((f: { type: string }) => f.type === "Recette").reduce((s: number, f: { montant: number }) => s + f.montant, 0);
      const depenses = (finRes.data ?? []).filter((f: { type: string }) => f.type === "Dépense").reduce((s: number, f: { montant: number }) => s + f.montant, 0);
      const bilan = recettes - depenses;

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("FINANCES", 14, y + 5);
      doc.setDrawColor(0, 154, 68);
      doc.setLineWidth(0.8);
      doc.line(14, y + 7, W - 14, y + 7);
      y += 12;

      const fcols: { label: string; val: string; color: [number, number, number] }[] = [
        { label: "Recettes",  val: fmtMontant(recettes),                            color: [0, 154, 68]   },
        { label: "Dépenses",  val: fmtMontant(depenses),                            color: [228, 0, 43]   },
        { label: "Bilan net", val: (bilan >= 0 ? "+" : "") + fmtMontant(bilan),     color: bilan >= 0 ? [0, 154, 68] : [228, 0, 43] },
      ];
      const cw = (W - 28 - 8) / 3;
      fcols.forEach(({ label, val, color }, i) => {
        const x = 14 + i * (cw + 4);
        doc.setFillColor(245, 249, 245);
        doc.roundedRect(x, y, cw, 18, 2, 2, "F");
        doc.setTextColor(...color);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(val, x + cw / 2, y + 8, { align: "center" });
        doc.setTextColor(140, 140, 140);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(label, x + cw / 2, y + 14, { align: "center" });
      });
      y += 24;

      // ── Checklist ──
      if (checkRes.data && checkRes.data.length > 0) {
        if (y > 230) { doc.addPage(); y = 20; }
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("CHECKLIST", 14, y + 5);
        doc.setDrawColor(0, 154, 68);
        doc.setLineWidth(0.8);
        doc.line(14, y + 7, W - 14, y + 7);
        y += 12;

        const doneCount = checkRes.data.filter((c: { done: boolean }) => c.done).length;
        const total = checkRes.data.length;
        const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(`Progression : ${doneCount}/${total} tâches complétées (${pct}%)`, 14, y);
        y += 5;

        // Barre progression
        doc.setFillColor(220, 220, 220);
        doc.roundedRect(14, y, W - 28, 3.5, 1, 1, "F");
        if (pct > 0) {
          doc.setFillColor(0, 154, 68);
          doc.roundedRect(14, y, Math.max((W - 28) * (pct / 100), 2), 3.5, 1, 1, "F");
        }
        y += 8;

        const items = checkRes.data as { texte: string; done: boolean; assignee_name: string | null }[];
        items.forEach(item => {
          if (y > 255) { doc.addPage(); y = 20; }
          const isDoneItem = item.done;
          doc.setTextColor(isDoneItem ? 0 : 50, isDoneItem ? 154 : 50, isDoneItem ? 68 : 50);
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.text(isDoneItem ? "[X]" : "[ ]", 16, y);
          doc.setFont("helvetica", isDoneItem ? "italic" : "normal");
          doc.setTextColor(isDoneItem ? 140 : 50, isDoneItem ? 140 : 50, isDoneItem ? 140 : 50);
          const assignTxt = item.assignee_name ? `  (${item.assignee_name})` : "";
          doc.text(`${item.texte}${assignTxt}`, 22, y, { maxWidth: W - 40 });
          y += 6;
        });
        y += 4;
      }

      // ── Équipe ──
      if (teamRes.data && teamRes.data.length > 0) {
        if (y > 220) { doc.addPage(); y = 20; }
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("ÉQUIPE", 14, y + 5);
        doc.setDrawColor(0, 154, 68);
        doc.setLineWidth(0.8);
        doc.line(14, y + 7, W - 14, y + 7);
        y += 12;

        const team = teamRes.data as { full_name: string; role: string }[];
        team.forEach((m, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const x = 14 + col * ((W - 28) / 2 + 2);
          const yy = y + row * 10;
          if (yy > 255) return;
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(50, 50, 50);
          doc.text(m.full_name, x, yy);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(130, 130, 130);
          doc.setFontSize(7);
          doc.text(m.role, x, yy + 4.5, { maxWidth: (W - 28) / 2 - 4 });
        });
        y += Math.ceil(team.length / 2) * 10 + 6;
      }

      // ── Footer sur chaque page ──
      const total = doc.getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        const yf = 282;
        doc.setFillColor(0, 154, 68);  doc.rect(0, yf,     W, 4, "F");
        doc.setFillColor(228, 0, 43);  doc.rect(0, yf + 4, W, 3, "F");
        doc.setFillColor(8, 8, 8);     doc.rect(0, yf + 7, W, 10, "F");
        doc.setTextColor(180, 180, 180);
        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.text("Chaque instant marque l'histoire  |  Kylian Cheikh Ahmed", W / 2, yf + 13, { align: "center" });
        doc.setTextColor(100, 100, 100);
        doc.text(`Page ${p}/${total}`, W - 14, yf + 13, { align: "right" });
      }

      doc.save(`${ev.nom.replace(/[^a-zA-Z0-9\u00C0-\u024F ]/g, "_")}_rapport.pdf`);
    } catch (err) {
      console.error("Erreur PDF :", err);
    } finally {
      setGeneratingPdf(null);
    }
  }

  // ── Thème ─────────────────────────────────────────────────────
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const T = {
    bg:        isDark ? "#0a0a0a"              : "#ffffff",
    card:      isDark ? "#111111"              : "#ffffff",
    brd:       isDark ? "#1f3d25"              : "#e0e8e2",
    txt:       isDark ? "#ffffff"              : "#111111",
    sub:       isDark ? "#666666"              : "#888888",
    muted:     isDark ? "#555555"              : "#aaaaaa",
    inp:       isDark ? "#0a0a0a"              : "#f8fafb",
    headerBg:  isDark ? "rgba(10,10,10,0.97)" : "rgba(255,255,255,0.97)",
    secBg:     isDark ? "#0a0a0a"             : "#f5f8f5",
    checkBg:   isDark ? "#111111"             : "#f8fafb",
    formBg:    isDark ? "#0d1000"             : "#fffdf0",
  };

  // ── Styles ────────────────────────────────────────────────────
  const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, backgroundColor: T.inp, border: `1px solid ${T.brd}`, color: T.txt, fontSize: 13, outline: "none", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 3, display: "block" };

  // ── Carte d'événement ─────────────────────────────────────────
  function EventCard({ ev }: { ev: Evenement }) {
    const st = STATUT_STYLE[ev.statut];
    const cd = getCountdown(ev.date);
    const isExpanded   = expandedId === ev.id;
    const isGalleryOpen = galleryExpandedId === ev.id;
    const isPredefOpen  = showPredef === ev.id;
    const isReportOpen  = reportEventId === ev.id;
    const isPdfing      = generatingPdf === ev.id;
    const items         = checklists[ev.id] ?? [];
    const doneCount     = items.filter(i => i.done).length;
    const eventPhotos   = photos[ev.id] ?? [];

    return (
      <div style={{ backgroundColor: T.card, border: `1px solid ${ev.statut === "En cours" ? "#665800" : T.brd}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: 14 }}>

          {/* ── En-tête ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: T.txt, margin: 0 }}>{ev.nom}</p>
              <p style={{ fontSize: 12, color: T.muted, margin: "4px 0 0" }}>📍 {ev.lieu}</p>
              <p style={{ fontSize: 12, color: T.sub, margin: "2px 0 0" }}>📅 {fmtDate(ev.date)}</p>
              {ev.description && <p style={{ fontSize: 11, color: T.muted, margin: "6px 0 0", fontStyle: "italic" }}>{ev.description}</p>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, color: st.color, backgroundColor: st.bg, border: `1px solid ${st.border}`, whiteSpace: "nowrap" }}>
                {ev.statut === "En cours" ? "⚡ En cours" : ev.statut}
              </span>
              {cd.text && (
                <span style={{ fontSize: 12, fontWeight: 900, color: cd.urgent ? "#ff6b6b" : "#FFD700", backgroundColor: cd.urgent ? "#1a0005" : "#1a1400", border: `1px solid ${cd.urgent ? "#8a0015" : "#665800"}`, padding: "3px 9px", borderRadius: 999 }}>
                  ⏳ {cd.text}
                </span>
              )}
            </div>
          </div>

          {/* ── Actions (éditeurs) ── */}
          {canEdit && (
            <div style={{ borderTop: `1px solid ${T.brd}`, paddingTop: 10, marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select value={ev.statut} onChange={e => updateStatut(ev.id, e.target.value as Statut)}
                style={{ flex: 1, minWidth: 120, fontSize: 12, backgroundColor: T.inp, border: `1px solid ${T.brd}`, color: T.txt, borderRadius: 8, padding: "6px 10px", outline: "none" }}>
                {STATUTS.map(s => <option key={s}>{s}</option>)}
              </select>
              <button onClick={() => openEdit(ev)}
                style={{ fontSize: 12, color: "#1E90FF", border: "1px solid #0a4a8a", backgroundColor: "transparent", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>
                ✏️ Éditer
              </button>
              <button onClick={() => handleDelete(ev.id, ev.nom)}
                style={{ fontSize: 13, color: T.sub, border: `1px solid ${T.brd}`, backgroundColor: "transparent", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>
                🗑️
              </button>
            </div>
          )}

          {/* ── Boutons d'action ── */}
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {/* Checklist */}
            <button onClick={() => toggleExpand(ev.id)}
              style={{ flex: 1, minWidth: 100, fontSize: 11, fontWeight: 700, color: isExpanded ? "#fff" : T.muted, backgroundColor: isExpanded ? "#1f3d25" : "transparent", border: `1px solid ${T.brd}`, borderRadius: 8, padding: "6px 8px", cursor: "pointer" }}>
              ✅ Checklist{items.length > 0 ? ` (${doneCount}/${items.length})` : ""}
            </button>
            {/* Galerie */}
            <button onClick={() => toggleGallery(ev.id)}
              style={{ flex: 1, minWidth: 80, fontSize: 11, fontWeight: 700, color: isGalleryOpen ? "#fff" : T.muted, backgroundColor: isGalleryOpen ? "#001428" : "transparent", border: `1px solid ${T.brd}`, borderRadius: 8, padding: "6px 8px", cursor: "pointer" }}>
              📸 Galerie{eventPhotos.length > 0 ? ` (${eventPhotos.length})` : ""}
            </button>
            {/* Rapport stats */}
            {ev.statut === "Terminé" && (
              <button onClick={() => isReportOpen ? setReportEventId(null) : fetchReport(ev)}
                style={{ flex: 1, minWidth: 80, fontSize: 11, fontWeight: 700, color: isReportOpen ? "#fff" : "#FFD700", backgroundColor: isReportOpen ? "#665800" : "transparent", border: "1px solid #665800", borderRadius: 8, padding: "6px 8px", cursor: "pointer" }}>
                📊 Stats
              </button>
            )}
            {/* PDF */}
            <button onClick={() => generateEventPDF(ev)} disabled={isPdfing}
              style={{ flex: 1, minWidth: 80, fontSize: 11, fontWeight: 700, color: isPdfing ? T.sub : "#E4002B", backgroundColor: "transparent", border: "1px solid #8a0015", borderRadius: 8, padding: "6px 8px", cursor: isPdfing ? "default" : "pointer", opacity: isPdfing ? 0.6 : 1 }}>
              {isPdfing ? "…" : "📄 PDF"}
            </button>
          </div>
        </div>

        {/* ── Checklist dépliée ── */}
        {isExpanded && (
          <div style={{ borderTop: `1px solid ${T.brd}`, backgroundColor: T.secBg, padding: "12px 14px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: T.muted, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              ✅ Checklist de préparation
            </p>

            {/* Barre de progression (en haut) */}
            {items.length > 0 && (
              <div style={{ marginBottom: 12, padding: "10px 12px", backgroundColor: T.checkBg, borderRadius: 10, border: `1px solid ${T.brd}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: doneCount === items.length ? "#009A44" : "#1E90FF" }}>
                    {doneCount === items.length ? "✅ Toutes les tâches terminées !" : `${Math.round((doneCount / items.length) * 100)}% complété`}
                  </span>
                  <span style={{ fontSize: 11, color: T.sub }}>{doneCount}/{items.length}</span>
                </div>
                <div style={{ height: 6, backgroundColor: isDark ? "#1a1a1a" : "#e0e8e2", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${(doneCount / items.length) * 100}%`,
                    background: doneCount === items.length ? "#009A44" : "linear-gradient(90deg,#1E90FF,#009A44)",
                    borderRadius: 999, transition: "width 0.4s ease",
                  }} />
                </div>
              </div>
            )}

            {/* Tâches prédéfinies */}
            {canEdit && (
              <div style={{ marginBottom: 10 }}>
                <button onClick={() => setShowPredef(isPredefOpen ? null : ev.id)}
                  style={{ fontSize: 11, color: isPredefOpen ? "#009A44" : T.sub, border: `1px solid ${T.brd}`, background: "transparent", borderRadius: 8, padding: "5px 10px", cursor: "pointer", marginBottom: isPredefOpen ? 8 : 0 }}>
                  ⚡ Tâches types {isPredefOpen ? "▲" : "▼"}
                </button>
                {isPredefOpen && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {PREDEFINED_TASKS.filter(t => !items.some(i => i.texte === t)).map(task => (
                      <button key={task} onClick={() => addPredefinedTask(ev.id, task)}
                        style={{ fontSize: 10, color: "#009A44", border: "1px solid #1f5c30", background: isDark ? "transparent" : "rgba(0,154,68,0.05)", borderRadius: 20, padding: "4px 9px", cursor: "pointer" }}>
                        {task}
                      </button>
                    ))}
                    {PREDEFINED_TASKS.every(t => items.some(i => i.texte === t)) && (
                      <p style={{ fontSize: 11, color: T.sub, margin: 0 }}>Toutes les tâches types sont ajoutées ✓</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Liste des tâches */}
            {items.length === 0 ? (
              <p style={{ fontSize: 12, color: T.sub, margin: "0 0 10px" }}>Aucune tâche — ajoutez-en une ci-dessous</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                {items.map(item => {
                  const status = item.status ?? (item.done ? "done" : "todo");
                  const sc = TASK_STATUS[status] ?? TASK_STATUS.todo;
                  return (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 8px", borderRadius: 8, backgroundColor: T.checkBg, border: `1px solid ${sc.border}` }}>
                      {/* Status cycle */}
                      <button onClick={() => cycleChecklistStatus(ev.id, item)}
                        style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, border: `2px solid ${sc.color}`, backgroundColor: status === "done" ? "#009A44" : status === "in_progress" ? "#001428" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 10, fontWeight: 900, color: sc.color }}>
                        {status === "done" ? "✓" : status === "in_progress" ? "→" : ""}
                      </button>

                      {/* Texte + assigné */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, color: status === "done" ? T.sub : T.txt, margin: 0, textDecoration: status === "done" ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.texte}
                        </p>
                        {item.assignee_name && (
                          <p style={{ fontSize: 10, color: "#009A44", margin: 0 }}>→ {item.assignee_name}</p>
                        )}
                      </div>

                      {/* Assigné select */}
                      {canEdit && (
                        <select value={item.assignee_id ?? ""}
                          onChange={e => {
                            const prof = teamProfiles.find(p => p.id === e.target.value);
                            updateChecklistAssignee(ev.id, item.id, e.target.value, prof?.full_name ?? "");
                          }}
                          style={{ fontSize: 10, backgroundColor: T.inp, border: `1px solid ${T.brd}`, color: T.sub, borderRadius: 6, padding: "2px 4px", maxWidth: 76, outline: "none", flexShrink: 0 }}>
                          <option value="">–</option>
                          {teamProfiles.map(p => (
                            <option key={p.id} value={p.id}>{p.full_name.split(" ")[0]}</option>
                          ))}
                        </select>
                      )}

                      {/* Supprimer */}
                      {canEdit && (
                        <button onClick={() => deleteChecklistItem(ev.id, item.id)}
                          style={{ fontSize: 12, color: "#555", background: "none", border: "none", cursor: "pointer", flexShrink: 0, padding: "0 2px" }}>✕</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Ajouter une tâche personnalisée */}
            {canEdit && (
              <div style={{ display: "flex", gap: 8 }}>
                <input value={newItem[ev.id] ?? ""}
                  onChange={e => setNewItem(prev => ({ ...prev, [ev.id]: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && addChecklistItem(ev.id)}
                  placeholder="Tâche personnalisée…"
                  style={{ flex: 1, padding: "7px 10px", borderRadius: 8, backgroundColor: T.checkBg, border: `1px solid ${T.brd}`, color: T.txt, fontSize: 12, outline: "none" }} />
                <button onClick={() => addChecklistItem(ev.id)}
                  style={{ padding: "7px 14px", borderRadius: 8, backgroundColor: "#009A44", color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>
                  +
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Galerie ── */}
        {isGalleryOpen && (
          <div style={{ borderTop: `1px solid ${T.brd}`, backgroundColor: T.secBg, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: T.muted, margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                📸 Galerie photos
              </p>
              <label style={{ fontSize: 11, color: "#1E90FF", border: "1px solid #0a4a8a", borderRadius: 8, padding: "5px 10px", cursor: uploading ? "default" : "pointer", fontWeight: 700, opacity: uploading ? 0.5 : 1 }}>
                {uploading ? "Envoi…" : "+ Photo"}
                <input type="file" accept="image/*,image/heic,image/heif" multiple style={{ display: "none" }}
                  onChange={e => {
                    const files = Array.from(e.target.files ?? []);
                    files.forEach(f => uploadPhoto(ev.id, f));
                    e.target.value = "";
                  }}
                  disabled={uploading} />
              </label>
            </div>
            {eventPhotos.length === 0 ? (
              <p style={{ fontSize: 12, color: T.sub, textAlign: "center", padding: "20px 0" }}>Aucune photo — appuyez sur &quot;+ Photo&quot;</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 5 }}>
                {eventPhotos.map(photo => (
                  <div key={photo.id} style={{ position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden", cursor: "pointer" }}
                    onClick={() => setLightbox(photo.url)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    {canEdit && (
                      <button onClick={e => { e.stopPropagation(); deletePhoto(ev.id, photo.id, photo.url); }}
                        style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.7)", border: "none", color: "#fff", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 0 }}>
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Rapport chiffres ── */}
        {isReportOpen && (
          <div style={{ borderTop: "1px solid #665800", backgroundColor: isDark ? "#0d1000" : "#fffcee", padding: "12px 14px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#FFD700", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              📊 Chiffres de l&apos;événement
            </p>
            {loadingReport ? (
              <p style={{ fontSize: 12, color: T.sub }}>Chargement…</p>
            ) : report ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                {[
                  { label: "Réservations", value: String(report.tickets), color: "#1E90FF", icon: "🎟️" },
                  { label: "Recettes",  value: fmtMontant(report.recettes),  color: "#009A44", icon: "📈" },
                  { label: "Dépenses",  value: fmtMontant(report.depenses),  color: "#ff6b6b", icon: "📉" },
                ].map(({ label, value, color, icon }) => (
                  <div key={label} style={{ backgroundColor: T.card, border: `1px solid ${color}33`, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
                    <p style={{ fontSize: 16, margin: "0 0 4px" }}>{icon}</p>
                    <p style={{ fontSize: 14, fontWeight: 900, color, margin: 0, lineHeight: 1 }}>{value}</p>
                    <p style={{ fontSize: 9, color: T.sub, marginTop: 4, textTransform: "uppercase" }}>{label}</p>
                  </div>
                ))}
                <div style={{ gridColumn: "1/-1", backgroundColor: T.card, border: `1px solid ${(report.recettes - report.depenses) >= 0 ? "#005c28" : "#8a0015"}`, borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: T.sub }}>Bilan net</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: (report.recettes - report.depenses) >= 0 ? "#009A44" : "#ff6b6b" }}>
                    {(report.recettes - report.depenses) >= 0 ? "+" : ""}{fmtMontant(report.recettes - report.depenses)}
                  </span>
                </div>
              </div>
            ) : null}
            <p style={{ fontSize: 10, color: T.muted, marginTop: 8, fontStyle: "italic" }}>
              Données basées sur la date de l&apos;événement ({ev.date})
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: T.bg, minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.4}}.blink{animation:blink 1.4s ease-in-out infinite}`}</style>

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: T.headerBg, borderBottom: `1px solid ${T.brd}`, padding: "10px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 672, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/dashboard" style={{ color: T.sub, lineHeight: 0 }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </Link>
            <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${T.brd}`, lineHeight: 0 }}>
              <Image src="/logo.jpg" alt="LIL'Z" width={68} height={68} quality={100} style={{ display: "block", objectFit: "cover", width: 34, height: 34 }} />
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 800, color: T.txt, lineHeight: 1.1, margin: 0 }}>🎪 Événements</p>
              <p style={{ fontSize: 10, color: "#009A44", margin: 0, marginTop: 2 }}>LIL&apos;Z EVENT AGENCY</p>
            </div>
          </div>
          <LogoutBtn supabase={supabase} />
        </div>
      </header>

      {/* Bande */}
      <div style={{ display: "flex", height: 2 }}>
        {["#009A44","rgba(255,255,255,0.5)","#E4002B","#1E90FF","#FFD700"].map((c,i)=><div key={i} style={{flex:1,backgroundColor:c}}/>)}
      </div>

      <main style={{ flex: 1, maxWidth: 672, margin: "0 auto", width: "100%", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Compteurs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {[
            { label: "Total",    val: events.length,                                         color: T.txt     },
            { label: "À venir",  val: aVenir.length,                                         color: "#1E90FF"  },
            { label: "En cours", val: events.filter(e => e.statut === "En cours").length,    color: "#FFD700"  },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ backgroundColor: T.card, border: `1px solid ${T.brd}`, borderRadius: 14, padding: "14px 8px", textAlign: "center" }}>
              <p style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1, margin: 0 }}>{loading ? "—" : val}</p>
              <p style={{ fontSize: 9, color: T.sub, marginTop: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Bouton créer */}
        {canEdit && (
          <button onClick={() => { setShowForm(v => !v); if (showForm) resetForm(); else setFormError(""); }}
            style={{ width: "100%", padding: "11px", borderRadius: 12, fontSize: 13, fontWeight: 600, color: isDark ? "#fff" : "#111", background: "transparent", border: "2px dashed #665800", cursor: "pointer" }}>
            {showForm ? "✕ Annuler" : (editId ? "✏️ Modifier l'événement" : "+ Créer un événement")}
          </button>
        )}

        {/* Formulaire */}
        {showForm && canEdit && (
          <form onSubmit={handleSubmit} style={{ backgroundColor: T.formBg, border: "1px solid #665800", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontWeight: 700, color: "#FFD700", fontSize: 14, margin: 0 }}>
              {editId ? "✏️ Modifier l'événement" : "🎪 Nouvel événement"}
            </p>

            <div>
              <label style={lbl}>Nom de l&apos;événement *</label>
              <input style={inp} required placeholder="Ex : Gala de fin d'année" value={fNom} onChange={e => setFNom(e.target.value)} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={lbl}>Date *</label>
                <input type="date" style={inp} required value={fDate} onChange={e => setFDate(e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Statut</label>
                <select style={inp} value={fStatut} onChange={e => setFStatut(e.target.value as Statut)}>
                  {STATUTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={lbl}>Lieu *</label>
              <input style={inp} required placeholder="Salle, adresse…" value={fLieu} onChange={e => setFLieu(e.target.value)} />
            </div>

            <div>
              <label style={lbl}>Description (optionnel)</label>
              <textarea style={{ ...inp, resize: "vertical", minHeight: 72, lineHeight: 1.5 }}
                placeholder="Détails de l'événement…" value={fDesc} onChange={e => setFDesc(e.target.value)} />
            </div>

            {formError && <p style={{ fontSize: 12, color: "#ff6b6b", background: "#1a0005", border: "1px solid #8a0015", borderRadius: 8, padding: "8px 12px", margin: 0 }}>{formError}</p>}

            <button type="submit" disabled={submitting}
              style={{ padding: "12px", borderRadius: 12, backgroundColor: "#FFD700", color: "#0a0a0a", fontSize: 14, fontWeight: 800, border: "none", cursor: "pointer" }}>
              {submitting ? "Enregistrement…" : (editId ? "Enregistrer les modifications" : "Créer l'événement")}
            </button>
          </form>
        )}

        {/* Événements à venir */}
        {!loading && aVenir.length > 0 && (
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ height: 1, flex: 1, backgroundColor: T.brd }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#1E90FF", padding: "3px 12px", border: "1px solid #0a4a8a", borderRadius: 999, backgroundColor: isDark ? "#001428" : "#e8f0ff" }}>
                📅 À venir ({aVenir.length})
              </span>
              <div style={{ height: 1, flex: 1, backgroundColor: T.brd }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {aVenir.map(ev => <div key={ev.id}>{EventCard({ ev })}</div>)}
            </div>
          </section>
        )}

        {/* Événements passés */}
        {!loading && passés.length > 0 && (
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ height: 1, flex: 1, backgroundColor: T.brd }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: T.sub, padding: "3px 12px", border: `1px solid ${T.brd}`, borderRadius: 999, backgroundColor: T.card }}>
                🗓️ Historique ({passés.length})
              </span>
              <div style={{ height: 1, flex: 1, backgroundColor: T.brd }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {passés.map(ev => <div key={ev.id}>{EventCard({ ev })}</div>)}
            </div>
          </section>
        )}

        {/* État vide */}
        {!loading && events.length === 0 && (
          <div style={{ backgroundColor: T.card, border: `1px solid ${T.brd}`, borderRadius: 16, padding: "48px 20px", textAlign: "center" }}>
            <p style={{ fontSize: 48, margin: "0 0 12px" }}>🎪</p>
            <p style={{ color: T.txt, fontWeight: 600, margin: 0 }}>Aucun événement</p>
            {canEdit && <p style={{ color: T.sub, fontSize: 12, marginTop: 4 }}>Crée le premier avec &quot;+ Créer un événement&quot;</p>}
          </div>
        )}

      </main>

      <div style={{ height: "calc(64px + env(safe-area-inset-bottom))" }} />
      <BottomNav />

      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 200, backgroundColor: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setLightbox(null)}>
          {/* Fermer */}
          <button onClick={() => setLightbox(null)}
            style={{ position: "absolute", top: 16, right: 16, width: 44, height: 44, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.12)", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
            ✕
          </button>
          {/* Télécharger */}
          <a href={lightbox} download target="_blank" rel="noreferrer"
            style={{ position: "absolute", top: 16, left: 16, backgroundColor: "rgba(0,154,68,0.25)", border: "1px solid #009A44", color: "#009A44", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 700, textDecoration: "none", zIndex: 1 }}
            onClick={e => e.stopPropagation()}>
            ⬇ Télécharger
          </a>
          {/* Photo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt=""
            style={{ maxWidth: "92vw", maxHeight: "82vh", objectFit: "contain", borderRadius: 10, boxShadow: "0 8px 40px rgba(0,0,0,0.8)" }}
            onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function LogoutBtn({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
      style={{ fontSize: 12, color: isDark ? "#888" : "#666", border: `1px solid ${isDark ? "#1f3d25" : "#e0e8e2"}`, padding: "5px 10px", borderRadius: 8, background: "transparent", cursor: "pointer" }}>
      Déconnexion
    </button>
  );
}
