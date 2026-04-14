"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/ui/BottomNav";
import { useTheme } from "@/lib/ThemeProvider";
import { sendPushTo } from "@/hooks/usePushNotifications";

// ── Types ─────────────────────────────────────────────────────
interface PlanningEntry {
  id: string;
  assigne_nom: string;
  assigne_role: string;
  poste: string;
  date: string;
  heure_debut: string;
  heure_fin: string;
  notes: string | null;
  created_by: string;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

type View = "liste" | "calendrier";

// ── Constantes ────────────────────────────────────────────────
const POSTES = ["Entrée", "Bar", "Scène", "Vestiaire", "Parking", "Coulisses", "Sécurité", "Accueil VIP", "Technique Son", "Technique Lumière", "Coordination", "Autre"];
const CAN_EDIT = ["CEO", "Admin", "Chef de Projet Événementiel", "Site Manager"];
const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// Couleurs par rôle
const ROLE_COLOR: Record<string, string> = {
  "CEO":                         "#FFD700",
  "Admin":                       "#FFD700",
  "Responsable Financier":       "#009A44",
  "Chef de Projet Événementiel": "#1E90FF",
  "Community Manager":           "#ff69b4",
  "Site Manager":                "#ff9a3c",
  "Advisor":                     "#b47aff",
  "Event Planner":               "#22d3ee",
};

function getRoleColor(role: string): string {
  if (role.includes("Régisseur")) return "#ff6b6b";
  return ROLE_COLOR[role] ?? "#888";
}

// ── Utilitaires ───────────────────────────────────────────────
function toMin(h: string) {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + mm;
}

function fmtTime(h: string) { return h.slice(0, 5); }

function fmtDateLabel(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });
}

function isAlerte(entry: PlanningEntry): boolean {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (entry.date !== today) return false;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const debutMin = toMin(entry.heure_debut);
  const finMin = toMin(entry.heure_fin);
  return (debutMin - nowMin >= 0 && debutMin - nowMin <= 30) ||
         (finMin - nowMin >= 0 && finMin - nowMin <= 30 && nowMin >= debutMin);
}

function isActif(entry: PlanningEntry): boolean {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (entry.date !== today) return false;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= toMin(entry.heure_debut) && nowMin < toMin(entry.heure_fin);
}

function groupByDate(entries: PlanningEntry[]): Record<string, PlanningEntry[]> {
  return entries.reduce((acc, e) => {
    if (!acc[e.date]) acc[e.date] = [];
    acc[e.date].push(e);
    return acc;
  }, {} as Record<string, PlanningEntry[]>);
}

// Retourne les 7 dates ISO locales de la semaine (lun→dim)
function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWeekDates(weekOffset: number): string[] {
  const now = new Date();
  const day = now.getDay(); // 0=Dim, 1=Lun, ...
  const mondayDiff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayDiff + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toLocalISO(d);
  });
}

// ── Composant ─────────────────────────────────────────────────
export default function PlanningPage() {
  const supabase = createClient();

  const [entries, setEntries]       = useState<PlanningEntry[]>([]);
  const [profiles, setProfiles]     = useState<Profile[]>([]);
  const [userRole, setUserRole]     = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState("");
  const [view, setView]             = useState<View>("liste");
  const [weekOffset, setWeekOffset] = useState(0);
  const [filterDate, setFilterDate] = useState("");
  const [movingId, setMovingId] = useState<string | null>(null);
  const notifTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Formulaire
  const [fAssigneId, setFAssigneId] = useState("");
  const [fPoste, setFPoste]         = useState(POSTES[0]);
  const [fDate, setFDate]           = useState(new Date().toISOString().slice(0, 10));
  const [fDebut, setFDebut]         = useState("08:00");
  const [fFin, setFFin]             = useState("16:00");
  const [fNotes, setFNotes]         = useState("");

  // Tick chaque minute pour alertes
  useEffect(() => {
    const id = setInterval(() => {}, 60_000);
    return () => clearInterval(id);
  }, []);

  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (p) setUserRole(p.role);
    }
    const [{ data: pls }, { data: profs }] = await Promise.all([
      supabase.from("planning").select("*").order("date").order("heure_debut"),
      supabase.from("profiles").select("id, full_name, role").order("full_name"),
    ]);
    if (pls) setEntries(pls as PlanningEntry[]);
    if (profs) setProfiles(profs as Profile[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Notifications push 30 min avant chaque poste ─────────────
  useEffect(() => {
    notifTimers.current.forEach(clearTimeout);
    notifTimers.current = [];

    if (!("Notification" in window)) return;
    if (Notification.permission === "default") Notification.requestPermission();
    if (Notification.permission !== "granted") return;

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const nowMs = now.getTime();

    entries
      .filter(e => e.date === today)
      .forEach(e => {
        const [hh, mm] = e.heure_debut.split(":").map(Number);
        const shiftMs = new Date(today + "T00:00:00").getTime() + (hh * 60 + mm) * 60_000;
        const notifMs = shiftMs - 30 * 60_000;
        const delay = notifMs - nowMs;
        if (delay > 0 && delay < 12 * 3600_000) {
          const t = setTimeout(() => {
            new Notification("⏰ Poste dans 30 min", {
              body: `${e.assigne_nom} → ${e.poste} à ${fmtTime(e.heure_debut)}`,
              icon: "/logo.jpg",
            });
          }, delay);
          notifTimers.current.push(t);
        }
      });

    return () => { notifTimers.current.forEach(clearTimeout); };
  }, [entries]);

  const canEdit = userRole ? CAN_EDIT.includes(userRole) : false;
  const today = toLocalISO(new Date());
  const alertes = entries.filter(e => isAlerte(e));
  const weekDates = getWeekDates(weekOffset);

  // ── Déplacer un poste d'un jour à l'autre (boutons ← →) ─────
  async function moveEntry(id: string, direction: -1 | 1) {
    if (movingId) return;
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    setMovingId(id);
    const idx = weekDates.indexOf(entry.date);
    let newDate: string;
    if (idx !== -1) {
      const ni = idx + direction;
      if (ni < 0 || ni >= weekDates.length) { setMovingId(null); return; }
      newDate = weekDates[ni];
    } else {
      const d = new Date(entry.date + "T00:00:00");
      d.setDate(d.getDate() + direction);
      newDate = d.toISOString().slice(0, 10);
    }
    setEntries(prev => prev.map(e => e.id === id ? { ...e, date: newDate } : e));
    await supabase.from("planning").update({ date: newDate }).eq("id", id);
    setMovingId(null);
  }

  // ── Soumission formulaire ─────────────────────────────────────
  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setSubmitting(true); setFormError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const assigneProfile = profiles.find(p => p.id === fAssigneId);
    if (!assigneProfile) { setFormError("Sélectionne un membre."); setSubmitting(false); return; }
    const { error } = await supabase.from("planning").insert({
      user_id:     fAssigneId,
      assigne_id:  fAssigneId,
      assigne_nom: assigneProfile.full_name,
      assigne_role: assigneProfile.role,
      poste: fPoste, date: fDate,
      heure_debut: fDebut, heure_fin: fFin,
      notes: fNotes.trim() || null, created_by: user.id,
    });
    if (error) { setFormError(error.message); setSubmitting(false); return; }
    sendPushTo({
      userId: fAssigneId,
      title: "Nouveau poste assigné",
      body: `${fPoste} · ${fDate} · ${fDebut}–${fFin}`,
      url: "/planning",
      tag: `planning-${fAssigneId}`,
    });
    setFAssigneId(""); setFPoste(POSTES[0]); setFNotes("");
    setShowForm(false);
    await fetchAll();
    setSubmitting(false);
  }

  async function handleDelete(id: string, nom: string) {
    if (!confirm(`Supprimer le poste de "${nom}" ?`)) return;
    setEntries(prev => prev.filter(e => e.id !== id));
    await supabase.from("planning").delete().eq("id", id);
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
    alertBg:   isDark ? "#120005"             : "#fff0f0",
    activeBg:  isDark ? "#001a0d"             : "rgba(0,154,68,0.05)",
  };

  // ── Styles communs ────────────────────────────────────────────
  const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, backgroundColor: T.inp, border: `1px solid ${T.brd}`, color: T.txt, fontSize: 13, outline: "none", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 3, display: "block" };

  // ── Carte d'entrée (réutilisée liste + calendrier) ────────────
  function EntryCard({ entry, compact = false }: { entry: PlanningEntry; compact?: boolean }) {
    const actif = isActif(entry);
    const alerte = isAlerte(entry);
    const roleClr = getRoleColor(entry.assigne_role);
    const borderColor = alerte ? "#E4002B" : actif ? "#009A44" : "#1f3d25";
    return (
      <div style={{
        backgroundColor: alerte ? T.alertBg : actif ? T.activeBg : T.card,
        border: `1px solid ${borderColor}`,
        borderLeft: `3px solid ${roleClr}`,
        borderRadius: 10,
        padding: compact ? "5px 6px" : 12,
        overflow: "hidden",
        width: "100%",
        boxSizing: "border-box",
        minWidth: 0,
      }}>
        {/* Heure + badge statut */}
        <p style={{ fontSize: compact ? 10 : 13, fontWeight: 900, color: actif ? "#009A44" : alerte ? "#ff6b6b" : "#FFD700", margin: 0, fontVariantNumeric: "tabular-nums", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {fmtTime(entry.heure_debut)}–{fmtTime(entry.heure_fin)}
        </p>
        {(actif || alerte) && (
          <span style={{ fontSize: compact ? 7 : 8, backgroundColor: actif ? "#009A44" : "#E4002B", color: "#fff", padding: "1px 5px", borderRadius: 999, display: "inline-block", marginBottom: compact ? 2 : 0, marginTop: compact ? 0 : 1 }}>
            {actif ? "EN COURS" : "BIENTÔT"}
          </span>
        )}
        {/* Nom */}
        <p style={{ fontSize: compact ? 10 : 13, fontWeight: 700, color: T.txt, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entry.assigne_nom}
        </p>
        {/* Badges */}
        {!compact && (
          <div style={{ display: "flex", gap: 4, marginTop: 3, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 9, color: roleClr, backgroundColor: roleClr + "18", padding: "1px 6px", borderRadius: 5, border: `1px solid ${roleClr}44`, fontWeight: 700 }}>
              {entry.assigne_role.replace("Régisseur de production", "Rég.")}
            </span>
            <span style={{ fontSize: 9, color: "#009A44", backgroundColor: isDark ? "#1a2a1a" : "rgba(0,154,68,0.08)", padding: "1px 6px", borderRadius: 5, border: `1px solid ${T.brd}` }}>
              {entry.poste}
            </span>
          </div>
        )}
        {compact && (
          <p style={{ fontSize: 9, color: "#009A44", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {entry.poste}
          </p>
        )}
        {/* Actions */}
        {!compact && canEdit && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
            <button onClick={() => handleDelete(entry.id, entry.assigne_nom)}
              style={{ fontSize: 12, color: T.sub, border: `1px solid ${T.brd}`, backgroundColor: "transparent", borderRadius: 7, padding: "4px 8px", cursor: "pointer" }}>
              🗑️
            </button>
          </div>
        )}
        {/* Boutons déplacement (calendrier uniquement) */}
        {compact && canEdit && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, gap: 2 }}>
            <button
              onClick={e => { e.stopPropagation(); moveEntry(entry.id, -1); }}
              disabled={movingId === entry.id}
              style={{ flex: 1, fontSize: 12, background: "none", border: `1px solid ${T.brd}`, color: T.sub, borderRadius: 4, padding: "2px 0", cursor: "pointer", lineHeight: 1 }}>
              ←
            </button>
            <button
              onClick={e => { e.stopPropagation(); moveEntry(entry.id, 1); }}
              disabled={movingId === entry.id}
              style={{ flex: 1, fontSize: 12, background: "none", border: `1px solid ${T.brd}`, color: T.sub, borderRadius: 4, padding: "2px 0", cursor: "pointer", lineHeight: 1 }}>
              →
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: T.bg, minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes pulse-red { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .alerte-pulse { animation: pulse-red 1.2s ease-in-out infinite; }
        .drop-zone-active { background-color: #001a0d !important; border-color: #009A44 !important; }
      `}</style>

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
              <p style={{ fontSize: 12, fontWeight: 800, color: T.txt, lineHeight: 1.1, margin: 0 }}>📅 Planning</p>
              <p style={{ fontSize: 10, color: "#009A44", margin: 0, marginTop: 2 }}>LIL&apos;Z EVENT AGENCY</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Sélecteur de vue */}
            <div style={{ display: "flex", border: `1px solid ${T.brd}`, borderRadius: 8, overflow: "hidden" }}>
              {(["liste", "calendrier"] as View[]).map(v => (
                <button key={v} onClick={() => setView(v)}
                  style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", border: "none", cursor: "pointer",
                    backgroundColor: view === v ? "#009A44" : "transparent",
                    color: view === v ? "#fff" : T.sub,
                  }}>
                  {v === "liste" ? "≡" : "⊞"}
                </button>
              ))}
            </div>
            <LogoutBtn supabase={supabase} />
          </div>
        </div>
      </header>

      {/* Bande */}
      <div style={{ display: "flex", height: 2 }}>
        {["#009A44","rgba(255,255,255,0.5)","#E4002B","#1E90FF","#FFD700"].map((c,i)=><div key={i} style={{flex:1,backgroundColor:c}}/>)}
      </div>

      <main style={{ flex: 1, maxWidth: 672, margin: "0 auto", width: "100%", padding: "16px 16px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Alertes actives */}
        {alertes.length > 0 && (
          <div className="alerte-pulse" style={{ backgroundColor: "#1a0005", border: "2px solid #E4002B", borderRadius: 14, padding: "12px 14px" }}>
            <p style={{ color: "#ff6b6b", fontWeight: 700, fontSize: 13, margin: 0 }}>
              🔴 {alertes.length} changement{alertes.length > 1 ? "s" : ""} de poste imminent{alertes.length > 1 ? "s" : ""}
            </p>
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
              {alertes.map(a => (
                <p key={a.id} style={{ color: "#ffaaaa", fontSize: 12, margin: 0 }}>
                  {a.assigne_nom} — {a.poste} à {fmtTime(a.heure_debut)}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Stats du jour */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {[
            { label: "Total",        value: entries.length,                                color: T.txt    },
            { label: "Aujourd'hui",  value: entries.filter(e => e.date === today).length,  color: "#1E90FF" },
            { label: "En cours",     value: entries.filter(e => isActif(e)).length,        color: "#009A44" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ backgroundColor: T.card, border: `1px solid ${T.brd}`, borderRadius: 14, padding: "14px 8px", textAlign: "center" }}>
              <p style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1, margin: 0 }}>{value}</p>
              <p style={{ fontSize: 9, color: T.sub, marginTop: 5, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Légende couleurs rôles */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(ROLE_COLOR).slice(0, 6).map(([role, color]) => (
            <span key={role} style={{ fontSize: 9, color, backgroundColor: color + "18", border: `1px solid ${color}44`, padding: "2px 7px", borderRadius: 5, fontWeight: 700 }}>
              {role.replace("Chef de Projet Événementiel", "Chef Projet").replace("Community Manager", "CM").replace("Responsable Financier", "RF")}
            </span>
          ))}
          <span style={{ fontSize: 9, color: "#ff6b6b", backgroundColor: "#ff6b6b18", border: "1px solid #ff6b6b44", padding: "2px 7px", borderRadius: 5, fontWeight: 700 }}>
            Régisseurs
          </span>
        </div>

        {/* Bouton ajouter */}
        {canEdit && (
          <button onClick={() => { setShowForm(v => !v); setFormError(""); }}
            style={{ width: "100%", padding: "11px", borderRadius: 12, fontSize: 13, fontWeight: 600, color: isDark ? "#fff" : "#111", background: "transparent", border: "2px dashed #1f5c30", cursor: "pointer" }}>
            {showForm ? "✕ Annuler" : "+ Ajouter un poste"}
          </button>
        )}

        {/* Formulaire */}
        {showForm && canEdit && (
          <form onSubmit={handleSubmit} style={{ backgroundColor: isDark ? "#0d1a10" : "rgba(0,154,68,0.04)", border: "1px solid #1f5c30", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontWeight: 700, color: T.txt, fontSize: 14, margin: 0 }}>Nouveau poste</p>

            <div>
              <label style={lbl}>Membre assigné *</label>
              <select required style={inp} value={fAssigneId} onChange={e => setFAssigneId(e.target.value)}>
                <option value="">— Choisir un membre —</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={lbl}>Poste *</label>
                <select style={inp} value={fPoste} onChange={e => setFPoste(e.target.value)}>
                  {POSTES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Date *</label>
                <input type="date" style={inp} required value={fDate} onChange={e => setFDate(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={lbl}>Heure début *</label>
                <input type="time" style={inp} required value={fDebut} onChange={e => setFDebut(e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Heure fin *</label>
                <input type="time" style={inp} required value={fFin} onChange={e => setFFin(e.target.value)} />
              </div>
            </div>

            <div>
              <label style={lbl}>Notes (optionnel)</label>
              <input style={inp} placeholder="Instruction particulière…" value={fNotes} onChange={e => setFNotes(e.target.value)} />
            </div>

            {formError && <p style={{ fontSize: 12, color: "#ff6b6b", background: "#1a0005", border: "1px solid #8a0015", borderRadius: 8, padding: "8px 12px", margin: 0 }}>{formError}</p>}

            <button type="submit" disabled={submitting} style={{ padding: "12px", borderRadius: 12, backgroundColor: "#009A44", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer" }}>
              {submitting ? "Enregistrement…" : "Enregistrer le poste"}
            </button>
          </form>
        )}

        {/* ── VUE LISTE ── */}
        {view === "liste" && (
          <>
            {/* Filtre par date */}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Filtrer par date</label>
                <input type="date" style={inp} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
              </div>
              {filterDate && (
                <button onClick={() => setFilterDate("")} style={{ marginTop: 18, fontSize: 12, color: T.sub, background: "none", border: `1px solid ${T.brd}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>
                  Tout voir
                </button>
              )}
            </div>

            {loading ? (
              <p style={{ textAlign: "center", color: T.sub, fontSize: 13, padding: "40px 0" }}>Chargement…</p>
            ) : (() => {
              const filtered = filterDate ? entries.filter(e => e.date === filterDate) : entries;
              const grouped = groupByDate(filtered);
              const dates = Object.keys(grouped).sort();
              if (dates.length === 0) return (
                <div style={{ backgroundColor: T.card, border: `1px solid ${T.brd}`, borderRadius: 16, padding: "48px 20px", textAlign: "center" }}>
                  <p style={{ fontSize: 40, margin: "0 0 10px" }}>📅</p>
                  <p style={{ color: T.txt, fontWeight: 600, margin: 0 }}>Aucun poste planifié</p>
                </div>
              );
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {dates.map(date => (
                    <div key={date}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <div style={{ height: 1, flex: 1, backgroundColor: T.brd }} />
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 999,
                          backgroundColor: date === today ? "#009A44" : T.card,
                          color: date === today ? "#fff" : T.sub,
                          border: `1px solid ${date === today ? "#009A44" : T.brd}`,
                        }}>
                          {date === today ? "📍 AUJOURD'HUI" : fmtDateLabel(date)}
                        </span>
                        <div style={{ height: 1, flex: 1, backgroundColor: T.brd }} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {grouped[date].sort((a,b) => a.heure_debut.localeCompare(b.heure_debut)).map(entry => (
                          <EntryCard key={entry.id} entry={entry} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </>
        )}

        {/* ── VUE CALENDRIER ── */}
        {view === "calendrier" && (
          <div>
            {/* Navigation semaine */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, backgroundColor: T.card, border: `1px solid ${T.brd}`, borderRadius: 12, padding: "10px 14px" }}>
              <button onClick={() => setWeekOffset(w => w - 1)}
                style={{ fontSize: 16, color: T.sub, background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>←</button>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: T.txt, margin: 0 }}>
                  Semaine {weekOffset === 0 ? "en cours" : weekOffset > 0 ? `+${weekOffset}` : weekOffset}
                </p>
                <p style={{ fontSize: 10, color: T.sub, margin: 0 }}>
                  {new Date(weekDates[0] + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                  {" – "}
                  {new Date(weekDates[6] + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                </p>
              </div>
              <button onClick={() => setWeekOffset(w => w + 1)}
                style={{ fontSize: 16, color: T.sub, background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>→</button>
            </div>

            {/* Grille 7 jours avec scroll horizontal */}
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <div style={{ display: "flex", gap: 6, minWidth: weekDates.length * 118 }}>
                {weekDates.map((date, dayIdx) => {
                  const dayEntries = entries
                    .filter(e => e.date === date)
                    .sort((a, b) => a.heure_debut.localeCompare(b.heure_debut));
                  const isToday = date === today;

                  return (
                    <div
                      key={date}
                      style={{
                        flex: "0 0 112px",
                        minWidth: 0,
                        backgroundColor: isToday ? (isDark ? "#0d1a10" : "rgba(0,154,68,0.04)") : T.card,
                        border: `1px solid ${isToday ? "#1f5c30" : T.brd}`,
                        borderRadius: 12,
                        minHeight: 180,
                        padding: 6,
                        overflow: "hidden",
                      }}>
                      {/* En-tête jour */}
                      <div style={{ textAlign: "center", marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${isToday ? "#1f5c30" : T.brd}` }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: isToday ? "#009A44" : T.muted, margin: 0 }}>
                          {DAYS_FR[dayIdx]}
                        </p>
                        <p style={{ fontSize: 18, fontWeight: 900, color: isToday ? T.txt : T.sub, margin: 0, lineHeight: 1 }}>
                          {new Date(date + "T00:00:00").getDate()}
                        </p>
                        {dayEntries.length > 0 && (
                          <p style={{ fontSize: 9, color: T.sub, margin: 0 }}>{dayEntries.length} poste{dayEntries.length > 1 ? "s" : ""}</p>
                        )}
                      </div>

                      {/* Cartes du jour */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {dayEntries.map(entry => (
                          <EntryCard key={entry.id} entry={entry} compact />
                        ))}
                        {dayEntries.length === 0 && (
                          <p style={{ fontSize: 10, color: T.muted, textAlign: "center", padding: "12px 0" }}>—</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {canEdit && (
              <p style={{ fontSize: 10, color: T.sub, textAlign: "center", marginTop: 10 }}>
                💡 Utilisez ← → sur chaque carte pour déplacer un poste
              </p>
            )}
          </div>
        )}

      </main>

      <div style={{ height: "calc(64px + env(safe-area-inset-bottom))" }} />
      <BottomNav />
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
