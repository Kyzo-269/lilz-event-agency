"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/lib/ThemeProvider";
import BottomNav from "@/components/ui/BottomNav";

type TicketStatus = "En attente" | "Confirmée" | "Présent" | "No-show" | "Annulée";

interface Ticket {
  id: string;
  client_name: string;
  nb_personnes: number;
  statut: TicketStatus;
  created_at: string;
  created_by: string;
}

const ALL_STATUSES: TicketStatus[] = [
  "En attente",
  "Confirmée",
  "Présent",
  "No-show",
  "Annulée",
];

const STATUS_STYLE: Record<TicketStatus, { color: string; bg: string; border: string }> = {
  "En attente": { color: "#FFD700", bg: "#1a1600",  border: "#665800" },
  "Confirmée":  { color: "#1E90FF", bg: "#001428",  border: "#0a4a8a" },
  "Présent":    { color: "#009A44", bg: "#001a0d",  border: "#005c28" },
  "No-show":    { color: "#ff6b6b", bg: "#1a0005",  border: "#8a0015" },
  "Annulée":    { color: "#888888", bg: "#111111",  border: "#333333" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function BilletteriePage() {
  const supabase = createClient();

  const [tickets, setTickets]       = useState<Ticket[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState("");

  // Champs formulaire
  const [clientName, setClientName]   = useState("");
  const [nbPersonnes, setNbPersonnes] = useState(1);
  const [newStatut, setNewStatut]     = useState<TicketStatus>("En attente");

  // ── Chargement ──────────────────────────────────────────
  const fetchTickets = useCallback(async () => {
    const { data } = await supabase
      .from("tickets")
      .select("id, client_name, nb_personnes, statut, created_at, created_by")
      .order("created_at", { ascending: false });
    if (data) setTickets(data as Ticket[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const { theme } = useTheme();
  const isDark = theme === "dark";
  const T = {
    bg:   isDark ? "#0a0a0a" : "#ffffff",
    card: isDark ? "#111111" : "#ffffff",
    brd:  isDark ? "#1f3d25" : "#e8eee9",
    txt:  isDark ? "#ffffff" : "#111111",
    sub:  isDark ? "#666666" : "#888888",
    muted:isDark ? "#444444" : "#aaaaaa",
    inp:  isDark ? "#0a0a0a" : "#f8fafb",
    sel:  isDark ? "#0a0a0a" : "#f8fafb",
    sec:  isDark ? "#0d0d0d" : "#f5f7f5",
  };

  // ── Compteurs ───────────────────────────────────────────
  const total     = tickets.length;
  const attendus  = tickets
    .filter(t => t.statut !== "Annulée" && t.statut !== "No-show")
    .reduce((s, t) => s + t.nb_personnes, 0);
  const presents  = tickets
    .filter(t => t.statut === "Présent")
    .reduce((s, t) => s + t.nb_personnes, 0);

  // ── Ajout ───────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return; }

    const { error } = await supabase.from("tickets").insert({
      client_name:  clientName.trim(),
      nb_personnes: nbPersonnes,
      statut:       newStatut,
      created_by:   user.id,
    });

    if (error) {
      setFormError("Erreur : " + error.message);
      setSubmitting(false);
      return;
    }
    setClientName(""); setNbPersonnes(1); setNewStatut("En attente");
    setShowForm(false);
    await fetchTickets();
    setSubmitting(false);
  }

  // ── Changement statut ───────────────────────────────────
  async function handleStatus(id: string, s: TicketStatus) {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, statut: s } : t));
    await supabase.from("tickets").update({ statut: s }).eq("id", id);
  }

  // ── Suppression ─────────────────────────────────────────
  async function handleDelete(id: string, name: string) {
    if (!confirm(`Supprimer la réservation de "${name}" ?`)) return;
    setTickets(prev => prev.filter(t => t.id !== id));
    await supabase.from("tickets").delete().eq("id", id);
  }

  // ── Styles partagés (theme-aware) ─────────────────────────
  const S = {
    page:    { backgroundColor: T.bg,  minHeight: "100dvh", display: "flex", flexDirection: "column" as const, transition: "background-color 0.3s" },
    header:  { position: "sticky" as const, top: 0, zIndex: 10, backgroundColor: isDark ? "rgba(8,8,8,0.96)" : "rgba(255,255,255,0.97)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: `1px solid ${T.brd}`, padding: "10px 16px", transition: "background-color 0.3s, border-color 0.3s" },
    hInner:  { display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 672, margin: "0 auto" },
    hLeft:   { display: "flex", alignItems: "center", gap: 10 },
    logoBox: { borderRadius: 10, overflow: "hidden", border: `1px solid ${T.brd}`, lineHeight: 0 },
    hTitle:  { fontSize: 12, fontWeight: 800, color: T.txt, lineHeight: 1.1, margin: 0 },
    hSub:    { fontSize: 10, color: "#009A44", marginTop: 2, lineHeight: 1, margin: 0, fontWeight: 600 },
    backBtn: { color: T.sub, padding: "4px 2px", lineHeight: 0, cursor: "pointer" },
    logoutBtn: { fontSize: 11, fontWeight: 600, color: T.muted, border: `1px solid ${T.brd}`, padding: "5px 10px", borderRadius: 8, background: "transparent", cursor: "pointer" },
    stripe:  { display: "flex", height: 2, flexShrink: 0 },
    main:    { flex: 1, maxWidth: 672, margin: "0 auto", width: "100%", padding: "20px 16px", display: "flex", flexDirection: "column" as const, gap: 20, transition: "background-color 0.3s" },
    // Compteurs
    counters:    { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 },
    counter:     { backgroundColor: T.card, border: `1px solid ${T.brd}`, borderRadius: 16, padding: "16px 8px", textAlign: "center" as const, boxShadow: isDark ? "none" : "0 1px 4px rgba(0,0,0,0.06)" },
    counterNum:  { fontSize: 30, fontWeight: 900, lineHeight: 1 },
    counterLbl:  { fontSize: 10, color: T.sub, marginTop: 6, textTransform: "uppercase" as const, letterSpacing: "0.08em" },
    // Bouton ajouter
    addBtn: { width: "100%", padding: "12px", borderRadius: 12, fontSize: 14, fontWeight: 600, color: "#009A44", background: "transparent", border: `2px dashed ${isDark ? "#1f5c30" : "#8ad4a5"}`, cursor: "pointer" },
    // Formulaire
    form:      { backgroundColor: isDark ? "#0d1a10" : "#f0faf5", border: `1px solid ${isDark ? "#1f5c30" : "#a8d8b8"}`, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column" as const, gap: 14 },
    formTitle: { fontSize: 15, fontWeight: 700, color: T.txt, margin: 0 },
    fieldWrap: { display: "flex", flexDirection: "column" as const, gap: 6 },
    lbl:       { fontSize: 13, fontWeight: 500, color: T.sub },
    inp:       { width: "100%", padding: "11px 14px", borderRadius: 10, backgroundColor: T.inp, border: `1px solid ${T.brd}`, color: T.txt, fontSize: 14, outline: "none" },
    submitBtn: { padding: "13px", borderRadius: 12, backgroundColor: "#009A44", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", width: "100%" },
    errBox:    { backgroundColor: isDark ? "#1a0005" : "#fff0f0", border: "1px solid #ff6b6b44", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#ff6b6b" },
    // Section liste
    sectionHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    sectionLbl:  { fontSize: 11, fontWeight: 600, color: T.muted, textTransform: "uppercase" as const, letterSpacing: "0.1em" },
    sectionCount:{ fontSize: 11, color: T.muted },
    // Carte réservation
    ticketCard:  { backgroundColor: T.card, border: `1px solid ${T.brd}`, borderRadius: 16, padding: 14, display: "flex", flexDirection: "column" as const, gap: 10, boxShadow: isDark ? "none" : "0 1px 4px rgba(0,0,0,0.05)" },
    ticketTop:   { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
    ticketName:  { fontSize: 15, fontWeight: 700, color: T.txt, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
    ticketMeta:  { fontSize: 12, color: T.sub, marginTop: 3, display: "flex", gap: 8 },
    ticketDivider: { borderTop: `1px solid ${T.brd}`, paddingTop: 10, display: "flex", gap: 8, alignItems: "center" },
    select: { flex: 1, fontSize: 12, backgroundColor: T.sel, border: `1px solid ${T.brd}`, color: T.sub, borderRadius: 8, padding: "6px 10px", outline: "none" },
    deleteBtn: { fontSize: 13, color: T.muted, border: `1px solid ${T.brd}`, backgroundColor: "transparent", borderRadius: 8, padding: "6px 10px", cursor: "pointer", flexShrink: 0 },
    // Vide
    empty: { backgroundColor: T.card, border: `1px solid ${T.brd}`, borderRadius: 16, padding: "48px 20px", textAlign: "center" as const },
    // Footer
    footer: { borderTop: `1px solid ${T.brd}`, padding: "20px 16px", textAlign: "center" as const, marginTop: "auto" },
  };

  return (
    <div style={S.page}>

      {/* ── Header ─────────────────────────────────────── */}
      <header style={S.header}>
        <div style={S.hInner}>
          <div style={S.hLeft}>
            <Link href="/dashboard" style={S.backBtn}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div style={S.logoBox}>
              <Image src="/logo.jpg" alt="LIL'Z" width={68} height={68} quality={100} style={{ display: "block", objectFit: "cover", width: 34, height: 34 }} />
            </div>
            <div>
              <p style={S.hTitle}>🎟️ Billetterie</p>
              <p style={S.hSub}>LIL&apos;Z EVENT AGENCY</p>
            </div>
          </div>
          <LogoutBtn supabase={supabase} />
        </div>
      </header>

      {/* ── Bande comoriennes ───────────────────────────── */}
      <div style={S.stripe}>
        <div style={{ flex: 1, backgroundColor: "#009A44" }} />
        <div style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.5)" }} />
        <div style={{ flex: 1, backgroundColor: "#E4002B" }} />
        <div style={{ flex: 1, backgroundColor: "#1E90FF" }} />
        <div style={{ flex: 1, backgroundColor: "#FFD700" }} />
      </div>

      {/* ── Contenu ─────────────────────────────────────── */}
      <main style={S.main}>

        {/* Compteurs */}
        <div style={S.counters}>
          <div style={S.counter}>
            <p style={{ ...S.counterNum, color: T.txt }}>{total}</p>
            <p style={S.counterLbl}>Réservations</p>
          </div>
          <div style={S.counter}>
            <p style={{ ...S.counterNum, color: "#1E90FF" }}>{attendus}</p>
            <p style={S.counterLbl}>Attendues</p>
          </div>
          <div style={S.counter}>
            <p style={{ ...S.counterNum, color: "#009A44" }}>{presents}</p>
            <p style={S.counterLbl}>Présents</p>
          </div>
        </div>

        {/* Bouton Ajouter */}
        <button
          style={S.addBtn}
          onClick={() => { setShowForm(v => !v); setFormError(""); }}
        >
          {showForm ? "✕  Annuler" : "+ Ajouter une réservation"}
        </button>

        {/* Formulaire */}
        {showForm && (
          <form style={S.form} onSubmit={handleSubmit}>
            <p style={S.formTitle}>Nouvelle réservation</p>

            <div style={S.fieldWrap}>
              <label style={S.lbl}>Nom du client</label>
              <input
                style={S.inp}
                type="text"
                required
                placeholder="Prénom NOM"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
              />
            </div>

            <div style={S.fieldWrap}>
              <label style={S.lbl}>Nombre de personnes</label>
              <input
                style={S.inp}
                type="number"
                required
                min={1}
                max={9999}
                value={nbPersonnes}
                onChange={e => setNbPersonnes(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>

            <div style={S.fieldWrap}>
              <label style={S.lbl}>Statut</label>
              <select
                style={S.inp}
                value={newStatut}
                onChange={e => setNewStatut(e.target.value as TicketStatus)}
              >
                {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {formError && <p style={S.errBox}>{formError}</p>}

            <button type="submit" style={S.submitBtn} disabled={submitting}>
              {submitting ? "Enregistrement…" : "Enregistrer la réservation"}
            </button>
          </form>
        )}

        {/* Liste */}
        <section>
          <div style={S.sectionHead}>
            <span style={S.sectionLbl}>Réservations</span>
            <span style={S.sectionCount}>{total} au total</span>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#555", fontSize: 14 }}>
              Chargement…
            </div>
          ) : tickets.length === 0 ? (
            <div style={S.empty}>
              <p style={{ fontSize: 48, marginBottom: 12 }}>🎟️</p>
              <p style={{ color: T.txt, fontWeight: 600 }}>Aucune réservation</p>
              <p style={{ color: T.sub, fontSize: 13, marginTop: 4 }}>
                Clique sur &quot;+ Ajouter&quot; pour commencer
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {tickets.map(ticket => {
                const st = STATUS_STYLE[ticket.statut];
                return (
                  <div key={ticket.id} style={S.ticketCard}>

                    {/* Nom + badge */}
                    <div style={S.ticketTop}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={S.ticketName}>{ticket.client_name}</p>
                        <div style={S.ticketMeta}>
                          <span>👥 {ticket.nb_personnes} pers.</span>
                          <span>·</span>
                          <span>{fmtDate(ticket.created_at)}</span>
                        </div>
                      </div>
                      <span style={{
                        flexShrink: 0,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "4px 10px",
                        borderRadius: 999,
                        border: `1px solid ${st.border}`,
                        color: st.color,
                        backgroundColor: st.bg,
                        whiteSpace: "nowrap",
                      }}>
                        {ticket.statut}
                      </span>
                    </div>

                    {/* Actions */}
                    <div style={S.ticketDivider}>
                      <select
                        style={S.select}
                        value={ticket.statut}
                        onChange={e => handleStatus(ticket.id, e.target.value as TicketStatus)}
                      >
                        {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button
                        style={S.deleteBtn}
                        onClick={() => handleDelete(ticket.id, ticket.client_name)}
                        title="Supprimer"
                      >
                        🗑️
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Espace pour BottomNav */}
      <div style={{ height: "calc(64px + env(safe-area-inset-bottom))" }} />
      <BottomNav />

    </div>
  );
}

// Bouton déconnexion inline
function LogoutBtn({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }
  return (
    <button
      onClick={logout}
      style={{ fontSize: 12, color: "#888", border: "1px solid #1f3d25", padding: "5px 10px", borderRadius: 8, background: "transparent", cursor: "pointer" }}
    >
      Déconnexion
    </button>
  );
}
