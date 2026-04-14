"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/ui/BottomNav";
import { useTheme } from "@/lib/ThemeProvider";

// ── Types ─────────────────────────────────────────────────────
type TypeFinance = "Recette" | "Dépense";

interface FinanceEntry {
  id: string;
  libelle: string;
  montant: number;
  type: TypeFinance;
  categorie: string;
  date: string;
  created_by: string;
  created_at: string;
}

// ── Constantes ────────────────────────────────────────────────
const ROLES_AUTORISES = ["CEO", "Admin", "Responsable Financier"];
const CATEGORIES_RECETTE = ["Billetterie", "Sponsoring", "Subvention", "Vente bar", "Vente merch", "Autre"];
const CATEGORIES_DEPENSE = ["Logistique", "Personnel", "Matériel", "Communication", "Autre"];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMontant(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n)) + " FC";
}

// Formate un montant court pour les axes du graphique
function fmtK(n: number): string {
  if (n >= 1000000) return Math.round(n / 1000000) + "MFC";
  if (n >= 10000) return Math.round(n / 1000) + "kFC";
  if (n >= 1000) return (n / 1000).toFixed(1) + "kFC";
  return Math.round(n) + " FC";
}

// ── Graphique mensuel ─────────────────────────────────────────
function MonthlyChart({ entries }: { entries: FinanceEntry[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Grouper par mois YYYY-MM
  const grouped: Record<string, { rec: number; dep: number }> = {};
  entries.forEach(e => {
    const m = e.date.slice(0, 7);
    if (!grouped[m]) grouped[m] = { rec: 0, dep: 0 };
    if (e.type === "Recette") grouped[m].rec += e.montant;
    else grouped[m].dep += e.montant;
  });

  const months = Object.keys(grouped).sort().slice(-6);
  if (months.length === 0) return null;

  const maxVal = Math.max(...months.flatMap(m => [grouped[m].rec, grouped[m].dep]), 1);

  // Dimensions SVG
  const W = 560, H = 140;
  const PAD_LEFT = 42, PAD_BOT = 22, PAD_TOP = 10, PAD_RIGHT = 8;
  const chartH = H - PAD_TOP - PAD_BOT;
  const chartW = W - PAD_LEFT - PAD_RIGHT;
  const colW = chartW / months.length;
  const barW = Math.min(colW * 0.33, 26);

  function fmtMonth(ym: string) {
    const [y, mo] = ym.split("-");
    return new Date(+y, +mo - 1).toLocaleDateString("fr-FR", { month: "short" });
  }

  return (
    <div style={{ backgroundColor: isDark ? "#111111" : "#ffffff", border: `1px solid ${isDark ? "#1f3d25" : "#e0e8e2"}`, borderRadius: 16, padding: "16px 14px" }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#aaa" : "#555", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        📊 Recettes vs Dépenses par mois
      </p>
      <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: "#009A44", display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 8, height: 8, backgroundColor: "#009A44", borderRadius: 2, display: "inline-block" }} /> Recettes
        </span>
        <span style={{ fontSize: 10, color: "#E4002B", display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 8, height: 8, backgroundColor: "#E4002B", borderRadius: 2, display: "inline-block" }} /> Dépenses
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {/* Lignes de grille horizontales */}
        {[0.25, 0.5, 0.75, 1].map(pct => {
          const y = PAD_TOP + (1 - pct) * chartH;
          return (
            <g key={pct}>
              <line x1={PAD_LEFT} y1={y} x2={W - PAD_RIGHT} y2={y} stroke={isDark ? "#1f3d25" : "#e0e8e2"} strokeWidth="0.5" />
              <text x={PAD_LEFT - 4} y={y + 3} fill={isDark ? "#555" : "#888"} fontSize="8" textAnchor="end">
                {fmtK(maxVal * pct)}
              </text>
            </g>
          );
        })}

        {/* Ligne de base */}
        <line x1={PAD_LEFT} y1={PAD_TOP + chartH} x2={W - PAD_RIGHT} y2={PAD_TOP + chartH} stroke={isDark ? "#2a2a2a" : "#d0d0d0"} strokeWidth="1" />

        {/* Barres par mois */}
        {months.map((m, i) => {
          const cx = PAD_LEFT + i * colW + colW / 2;
          const baseY = PAD_TOP + chartH;
          const recH = maxVal > 0 ? (grouped[m].rec / maxVal) * chartH : 0;
          const depH = maxVal > 0 ? (grouped[m].dep / maxVal) * chartH : 0;
          return (
            <g key={m}>
              {recH > 0 && (
                <rect x={cx - barW - 1} y={baseY - recH} width={barW} height={recH} fill="#009A44" rx="2" opacity="0.85" />
              )}
              {depH > 0 && (
                <rect x={cx + 1} y={baseY - depH} width={barW} height={depH} fill="#E4002B" rx="2" opacity="0.85" />
              )}
              <text x={cx} y={H - 5} fill={isDark ? "#666" : "#888"} fontSize="9" textAnchor="middle">
                {fmtMonth(m)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────
export default function FinancesPage() {
  const supabase = createClient();

  const [userRole, setUserRole]         = useState<string | null>(null);
  const [checkingRole, setChecking]     = useState(true);
  const [entries, setEntries]           = useState<FinanceEntry[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [formError, setFormError]       = useState("");
  const [filterType, setFilterType]     = useState<"all" | TypeFinance>("all");

  // Budget prévisionnel (stocké en localStorage)
  const [budget, setBudget]             = useState<number>(0);
  const [editBudget, setEditBudget]     = useState(false);
  const [budgetInput, setBudgetInput]   = useState("");

  // Formulaire
  const [fLibelle, setFLibelle] = useState("");
  const [fMontant, setFMontant] = useState("");
  const [fType, setFType]       = useState<TypeFinance>("Recette");
  const [fCat, setFCat]         = useState("Billetterie");
  const [fDate, setFDate]       = useState(new Date().toISOString().slice(0, 10));

  // Charger le budget depuis localStorage
  useEffect(() => {
    const saved = localStorage.getItem("lilz_budget_previsionnel");
    if (saved) setBudget(parseFloat(saved));
  }, []);

  // Mettre à jour la catégorie par défaut selon le type
  useEffect(() => {
    setFCat(fType === "Recette" ? CATEGORIES_RECETTE[0] : CATEGORIES_DEPENSE[0]);
  }, [fType]);

  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setUserRole(p?.role ?? null);
    }
    setChecking(false);
    const { data } = await supabase.from("finances").select("*").order("date", { ascending: false });
    if (data) setEntries(data as FinanceEntry[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function saveBudget() {
    const val = parseFloat(budgetInput.replace(",", "."));
    if (!isNaN(val) && val > 0) {
      setBudget(val);
      localStorage.setItem("lilz_budget_previsionnel", String(val));
      setEditBudget(false);
      setBudgetInput("");
    }
  }

  // ── Accès refusé ─────────────────────────────────────────────
  if (!checkingRole && userRole !== null && !ROLES_AUTORISES.includes(userRole)) {
    return (
      <div style={{ backgroundColor: "#0a0a0a", minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ backgroundColor: "#1a0005", border: "2px solid #E4002B", borderRadius: 20, padding: "40px 32px", textAlign: "center", maxWidth: 360 }}>
          <p style={{ fontSize: 60, margin: "0 0 16px" }}>🔒</p>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: "0 0 8px" }}>Accès refusé</h1>
          <p style={{ fontSize: 13, color: "#aaa", margin: "0 0 24px", lineHeight: 1.6 }}>
            Le module Finances est réservé au <span style={{ color: "#FFD700", fontWeight: 700 }}>CEO / Admin</span> et au <span style={{ color: "#009A44", fontWeight: 700 }}>Responsable Financier</span> uniquement.
          </p>
          <Link href="/dashboard" style={{ display: "inline-block", padding: "10px 24px", backgroundColor: "#E4002B", color: "#fff", borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
            ← Retour au dashboard
          </Link>
        </div>
        <p style={{ fontSize: 11, color: "#333", marginTop: 32, fontStyle: "italic" }}>Chaque instant marque l&apos;histoire</p>
      </div>
    );
  }

  // ── Totaux ────────────────────────────────────────────────────
  const totalRecettes = entries.filter(e => e.type === "Recette").reduce((s, e) => s + e.montant, 0);
  const totalDepenses = entries.filter(e => e.type === "Dépense").reduce((s, e) => s + e.montant, 0);
  const solde         = totalRecettes - totalDepenses;
  const budgetPct     = budget > 0 ? Math.min((totalDepenses / budget) * 100, 100) : 0;
  const budgetOver    = budget > 0 && totalDepenses > budget;

  const displayed = filterType === "all" ? entries : entries.filter(e => e.type === filterType);

  // ── Ajout ─────────────────────────────────────────────────────
  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setSubmitting(true); setFormError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const montantNum = parseFloat(fMontant.replace(",", "."));
    if (isNaN(montantNum) || montantNum <= 0) { setFormError("Montant invalide."); setSubmitting(false); return; }
    const { error } = await supabase.from("finances").insert({
      libelle: fLibelle.trim(), montant: montantNum, type: fType,
      categorie: fCat, date: fDate, created_by: user.id,
    });
    if (error) { setFormError(error.message); setSubmitting(false); return; }
    setFLibelle(""); setFMontant(""); setFType("Recette"); setFDate(new Date().toISOString().slice(0, 10));
    setShowForm(false);
    await fetchAll();
    setSubmitting(false);
  }

  async function handleDelete(id: string, libelle: string) {
    if (!confirm(`Supprimer "${libelle}" ?`)) return;
    const prev = entries;
    setEntries(p => p.filter(e => e.id !== id));
    const { error } = await supabase.from("finances").delete().eq("id", id);
    if (error) setEntries(prev);
  }

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
    catBg:     isDark ? "#181818"             : "#f0f0f0",
    progressBg:isDark ? "#1a1a1a"             : "#e8e8e8",
  };

  const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, backgroundColor: T.inp, border: `1px solid ${T.brd}`, color: T.txt, fontSize: 13, outline: "none", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 3, display: "block" };

  return (
    <div style={{ backgroundColor: T.bg, minHeight: "100dvh", display: "flex", flexDirection: "column" }}>

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
              <p style={{ fontSize: 12, fontWeight: 800, color: T.txt, lineHeight: 1.1, margin: 0 }}>💰 Finances</p>
              <p style={{ fontSize: 10, color: "#FFD700", margin: 0, marginTop: 2 }}>Accès restreint</p>
            </div>
          </div>
          <LogoutBtn supabase={supabase} />
        </div>
      </header>

      {/* Bande comoriennes */}
      <div style={{ display: "flex", height: 2 }}>
        {["#009A44","rgba(255,255,255,0.5)","#E4002B","#1E90FF","#FFD700"].map((c,i)=><div key={i} style={{flex:1,backgroundColor:c}}/>)}
      </div>

      <main style={{ flex: 1, maxWidth: 672, margin: "0 auto", width: "100%", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── Bilan ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div style={{ backgroundColor: isDark ? "#001a0d" : "rgba(0,154,68,0.05)", border: "1px solid #005c28", borderRadius: 14, padding: "14px 8px", textAlign: "center" }}>
            <p style={{ fontSize: 11, color: "#4ac672", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Recettes</p>
            <p style={{ fontSize: 16, fontWeight: 900, color: "#009A44", margin: 0, lineHeight: 1 }}>{fmtMontant(totalRecettes)}</p>
          </div>
          <div style={{ backgroundColor: isDark ? "#1a0005" : "rgba(228,0,43,0.05)", border: "1px solid #8a0015", borderRadius: 14, padding: "14px 8px", textAlign: "center" }}>
            <p style={{ fontSize: 11, color: "#ff6b6b", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Dépenses</p>
            <p style={{ fontSize: 16, fontWeight: 900, color: "#ff6b6b", margin: 0, lineHeight: 1 }}>{fmtMontant(totalDepenses)}</p>
          </div>
          <div style={{ backgroundColor: solde >= 0 ? (isDark ? "#001a0d" : "rgba(0,154,68,0.05)") : (isDark ? "#1a0005" : "rgba(228,0,43,0.05)"), border: `1px solid ${solde >= 0 ? "#005c28" : "#8a0015"}`, borderRadius: 14, padding: "14px 8px", textAlign: "center" }}>
            <p style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Solde</p>
            <p style={{ fontSize: 16, fontWeight: 900, color: solde >= 0 ? "#009A44" : "#ff6b6b", margin: 0, lineHeight: 1 }}>{fmtMontant(solde)}</p>
          </div>
        </div>

        {/* ── Graphique mensuel ── */}
        {!loading && entries.length > 0 && <MonthlyChart entries={entries} />}

        {/* ── Budget prévisionnel ── */}
        <div style={{
          backgroundColor: T.card,
          border: `2px solid ${budgetOver ? "#E4002B" : T.brd}`,
          borderRadius: 16,
          padding: "16px 14px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: budget > 0 || editBudget ? 12 : 0 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: T.muted, margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              🎯 Budget prévisionnel
            </p>
            <button
              onClick={() => { setEditBudget(v => !v); setBudgetInput(budget > 0 ? String(budget) : ""); }}
              style={{ fontSize: 11, color: T.sub, border: `1px solid ${T.brd}`, borderRadius: 6, padding: "3px 8px", background: "none", cursor: "pointer" }}>
              {editBudget ? "Annuler" : budget > 0 ? "✏️ Modifier" : "+ Définir"}
            </button>
          </div>

          {editBudget ? (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Ex : 5000"
                value={budgetInput}
                onChange={e => setBudgetInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveBudget()}
                style={{ flex: 1, padding: "9px 12px", borderRadius: 8, backgroundColor: T.inp, border: `1px solid ${T.brd}`, color: T.txt, fontSize: 13, outline: "none" }}
              />
              <button onClick={saveBudget}
                style={{ padding: "9px 18px", borderRadius: 8, backgroundColor: "#009A44", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>
                OK
              </button>
            </div>
          ) : budget > 0 ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: T.sub }}>Dépensé : {fmtMontant(totalDepenses)}</span>
                <span style={{ fontSize: 12, color: T.sub }}>Objectif : {fmtMontant(budget)}</span>
              </div>
              {/* Barre de progression */}
              <div style={{ height: 10, backgroundColor: T.progressBg, borderRadius: 999, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${budgetPct}%`,
                  backgroundColor: budgetOver ? "#E4002B" : budgetPct > 80 ? "#FFD700" : "#009A44",
                  borderRadius: 999,
                  transition: "width 0.4s ease",
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: budgetOver ? "#ff6b6b" : budgetPct > 80 ? "#FFD700" : "#4ac672" }}>
                  {budgetOver
                    ? `⚠️ Dépassement de ${fmtMontant(totalDepenses - budget)}`
                    : `${Math.round(budgetPct)}% utilisé`}
                </span>
                <span style={{ fontSize: 11, color: T.sub }}>
                  Restant : {budgetOver ? "0 €" : fmtMontant(budget - totalDepenses)}
                </span>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: T.sub, margin: 0 }}>
              Clique sur &quot;+ Définir&quot; pour fixer un budget cible
            </p>
          )}
        </div>

        {/* ── Répartition dépenses par catégorie ── */}
        {!loading && totalDepenses > 0 && (
          <div style={{ backgroundColor: T.card, border: `1px solid ${T.brd}`, borderRadius: 16, padding: "16px 14px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: T.muted, margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              📂 Dépenses par catégorie
            </p>
            {CATEGORIES_DEPENSE.map(cat => {
              const total = entries.filter(e => e.type === "Dépense" && e.categorie === cat).reduce((s, e) => s + e.montant, 0);
              if (total === 0) return null;
              const pct = (total / totalDepenses) * 100;
              return (
                <div key={cat} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: T.txt }}>{cat}</span>
                    <span style={{ fontSize: 11, color: T.sub }}>{fmtMontant(total)} · {Math.round(pct)}%</span>
                  </div>
                  <div style={{ height: 6, backgroundColor: T.progressBg, borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, backgroundColor: "#E4002B", borderRadius: 999, opacity: 0.75 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Bouton ajouter ── */}
        <button onClick={() => { setShowForm(v => !v); setFormError(""); }}
          style={{ width: "100%", padding: "11px", borderRadius: 12, fontSize: 13, fontWeight: 600, color: isDark ? "#fff" : "#111", background: "transparent", border: "2px dashed #665800", cursor: "pointer" }}>
          {showForm ? "✕ Annuler" : "+ Ajouter une entrée"}
        </button>

        {/* ── Formulaire ── */}
        {showForm && (
          <form onSubmit={handleSubmit} style={{ backgroundColor: isDark ? "#0d1000" : "#fffdf0", border: "1px solid #665800", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontWeight: 700, color: "#FFD700", fontSize: 14, margin: 0 }}>Nouvelle entrée financière</p>

            {/* Type */}
            <div style={{ display: "flex", gap: 8 }}>
              {(["Recette", "Dépense"] as TypeFinance[]).map(t => (
                <button key={t} type="button" onClick={() => setFType(t)}
                  style={{ flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "2px solid",
                    backgroundColor: fType === t ? (t === "Recette" ? "#009A44" : "#E4002B") : "transparent",
                    color: fType === t ? "#fff" : t === "Recette" ? "#009A44" : "#ff6b6b",
                    borderColor: t === "Recette" ? "#009A44" : "#E4002B",
                  }}>
                  {t === "Recette" ? "📈 Recette" : "📉 Dépense"}
                </button>
              ))}
            </div>

            <div>
              <label style={lbl}>Libellé *</label>
              <input style={inp} required placeholder="Ex : Vente billets soirée X" value={fLibelle} onChange={e => setFLibelle(e.target.value)} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={lbl}>Montant (€) *</label>
                <input style={inp} required placeholder="0.00" value={fMontant} onChange={e => setFMontant(e.target.value)} inputMode="decimal" />
              </div>
              <div>
                <label style={lbl}>Date *</label>
                <input type="date" style={inp} required value={fDate} onChange={e => setFDate(e.target.value)} />
              </div>
            </div>

            <div>
              <label style={lbl}>Catégorie</label>
              <select style={inp} value={fCat} onChange={e => setFCat(e.target.value)}>
                {(fType === "Recette" ? CATEGORIES_RECETTE : CATEGORIES_DEPENSE).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            {formError && (
              <p style={{ fontSize: 12, color: "#ff6b6b", background: "#1a0005", border: "1px solid #8a0015", borderRadius: 8, padding: "8px 12px", margin: 0 }}>
                {formError}
              </p>
            )}

            <button type="submit" disabled={submitting}
              style={{ padding: "12px", borderRadius: 12, backgroundColor: fType === "Recette" ? "#009A44" : "#E4002B", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer" }}>
              {submitting ? "Enregistrement…" : `Enregistrer la ${fType.toLowerCase()}`}
            </button>
          </form>
        )}

        {/* ── Filtre ── */}
        <div style={{ display: "flex", gap: 8 }}>
          {(["all", "Recette", "Dépense"] as const).map(f => (
            <button key={f} onClick={() => setFilterType(f)}
              style={{ flex: 1, padding: "8px 4px", borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: "pointer", border: "1px solid",
                backgroundColor: filterType === f ? (f === "Recette" ? "#009A44" : f === "Dépense" ? "#E4002B" : isDark ? "#333" : "#e8e8e8") : "transparent",
                color: filterType === f ? "#fff" : T.sub,
                borderColor: filterType === f ? (f === "Recette" ? "#009A44" : f === "Dépense" ? "#E4002B" : T.brd) : T.brd,
              }}>
              {f === "all" ? "Tout" : f === "Recette" ? "📈 Recettes" : "📉 Dépenses"}
            </button>
          ))}
        </div>

        {/* ── Liste ── */}
        {loading ? (
          <p style={{ textAlign: "center", color: T.sub, fontSize: 13, padding: "40px 0" }}>Chargement…</p>
        ) : displayed.length === 0 ? (
          <div style={{ backgroundColor: T.card, border: `1px solid ${T.brd}`, borderRadius: 16, padding: "48px 20px", textAlign: "center" }}>
            <p style={{ fontSize: 40, margin: "0 0 10px" }}>💰</p>
            <p style={{ color: T.sub, fontSize: 13, margin: 0 }}>Aucune entrée{filterType !== "all" ? ` (${filterType})` : ""}</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {displayed.map(entry => {
              const isRec = entry.type === "Recette";
              return (
                <div key={entry.id} style={{ backgroundColor: T.card, border: `1px solid ${isRec ? T.brd : isDark ? "#2a1015" : "#ffdde2"}`, borderRadius: 14, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, color: T.txt, fontSize: 14, margin: 0 }}>{entry.libelle}</p>
                      <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: T.sub, backgroundColor: T.catBg, padding: "2px 8px", borderRadius: 6 }}>{entry.categorie}</span>
                        <span style={{ fontSize: 11, color: T.sub }}>{fmtDate(entry.date)}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 900, color: isRec ? "#009A44" : "#ff6b6b", whiteSpace: "nowrap" }}>
                        {isRec ? "+" : "−"}{fmtMontant(entry.montant)}
                      </span>
                      <button onClick={() => handleDelete(entry.id, entry.libelle)}
                        style={{ fontSize: 13, color: T.sub, border: `1px solid ${T.brd}`, backgroundColor: "transparent", borderRadius: 8, padding: "5px 8px", cursor: "pointer" }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
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
