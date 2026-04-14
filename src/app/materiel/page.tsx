"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/lib/ThemeProvider";
import BottomNav from "@/components/ui/BottomNav";

// ── Types ────────────────────────────────────────────────────
type Categorie   = "Son" | "Lumière" | "Décor" | "Mobilier" | "Scène" | "Autre";
type StatutPrevu = "OK" | "Manquant" | "Fragile" | "Usé" | "À réparer";
type Priorite    = "Urgent" | "Normal" | "Optionnel";
type TypeMateriel = "prevu" | "a_prevoir";
type SortKey     = "recent" | "etat" | "nom";
type TabKey      = "prevu" | "a_prevoir";

interface Materiel {
  id: string;
  type: TypeMateriel;
  nom: string;
  categorie: Categorie;
  quantite: number;
  etat: StatutPrevu | null;
  priorite: Priorite | null;
  note: string | null;
  created_by: string;
  created_at: string;
}

// ── Constantes ───────────────────────────────────────────────
const CATEGORIES: Categorie[] = ["Son", "Lumière", "Décor", "Mobilier", "Scène", "Autre"];
const STATUTS: StatutPrevu[]   = ["OK", "Manquant", "Fragile", "Usé", "À réparer"];
const PRIORITES: Priorite[]    = ["Urgent", "Normal", "Optionnel"];

// Ordre de gravité pour le tri par état
const ETAT_ORDER: Record<StatutPrevu, number> = {
  "Manquant": 0, "À réparer": 1, "Fragile": 2, "Usé": 3, "OK": 4,
};
const PRIORITE_ORDER: Record<Priorite, number> = {
  "Urgent": 0, "Normal": 1, "Optionnel": 2,
};

const STATUT_CONFIG: Record<StatutPrevu, { color: string; bgDark: string; bgLight: string; borderDark: string; borderLight: string; dot: string }> = {
  "OK":        { color: "#009A44", bgDark: "#001a0d", bgLight: "#e6f7ee", borderDark: "#005c28", borderLight: "#80d4a4", dot: "#009A44"  },
  "Manquant":  { color: "#E4002B", bgDark: "#1a0005", bgLight: "#ffeaec", borderDark: "#8a0015", borderLight: "#f0859a", dot: "#E4002B"  },
  "Fragile":   { color: "#ff9a3c", bgDark: "#1a0d00", bgLight: "#fff4e5", borderDark: "#7a4000", borderLight: "#ffc17a", dot: "#ff9a3c"  },
  "Usé":       { color: "#FFD700", bgDark: "#1a1600", bgLight: "#fffbdf", borderDark: "#665800", borderLight: "#ffe066", dot: "#e6c200"  },
  "À réparer": { color: "#b47aff", bgDark: "#12001a", bgLight: "#f3eeff", borderDark: "#5a007a", borderLight: "#c4a0f5", dot: "#b47aff"  },
};

const PRIORITE_CONFIG: Record<Priorite, { color: string; bgDark: string; bgLight: string; borderDark: string; borderLight: string }> = {
  "Urgent":    { color: "#E4002B", bgDark: "#1a0005", bgLight: "#ffeaec", borderDark: "#8a0015", borderLight: "#f0859a" },
  "Normal":    { color: "#1E90FF", bgDark: "#001428", bgLight: "#e8f2ff", borderDark: "#0a4a8a", borderLight: "#80b8f5" },
  "Optionnel": { color: "#888888", bgDark: "#111111", bgLight: "#f5f5f5", borderDark: "#333333", borderLight: "#cccccc" },
};

const CAT_ICON: Record<Categorie, string> = {
  "Son": "🔊", "Lumière": "💡", "Décor": "🌸", "Mobilier": "🪑", "Scène": "🎭", "Autre": "📦",
};

const CAT_COLOR: Record<Categorie, string> = {
  "Son": "#1E90FF", "Lumière": "#FFD700", "Décor": "#ff69b4",
  "Mobilier": "#ff9a3c", "Scène": "#b47aff", "Autre": "#888",
};

const ROLES_AUTORISES = [
  "CEO",
  "Admin",
  "Régisseur de production 1",
  "Régisseur de production 2",
  "Régisseur de production 3",
  "Régisseur de production 4",
];

// ── Composant principal ──────────────────────────────────────
export default function MaterielPage() {
  const supabase = createClient();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // ── Palette thème ─────────────────────────────────────────
  const T = {
    pageBg:     isDark ? "#080808" : "#ffffff",
    headerBg:   isDark ? "rgba(8,8,8,0.96)" : "rgba(255,255,255,0.97)",
    border:     isDark ? "#1f3d25" : "#e0e8e2",
    cardBg:     isDark ? "#111111" : "#ffffff",
    cardBorder: isDark ? "#1f3d25" : "#e8eee9",
    sectionBg:  isDark ? "#0d0d0d" : "#f9fbfa",
    sectionBorder: isDark ? "#1f3d25" : "#e4ede6",
    inputBg:    isDark ? "#0a0a0a" : "#f7faf8",
    inputBorder:isDark ? "#1f3d25" : "#d0ddd4",
    textMain:   isDark ? "#ffffff" : "#111111",
    textSub:    isDark ? "#666666" : "#777777",
    textMuted:  isDark ? "#444444" : "#aaaaaa",
    chipBg:     isDark ? "#1a1a1a" : "#f0f4f1",
    chipBorder: isDark ? "#2a2a2a" : "#d8e4dc",
    chipText:   isDark ? "#888888" : "#666666",
    selectBg:   isDark ? "#0a0a0a" : "#f7faf8",
  };

  // ── État ──────────────────────────────────────────────────
  const [items, setItems]           = useState<Materiel[]>([]);
  const [userRole, setUserRole]     = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState("");

  // Recherche & filtres
  const [search, setSearch]         = useState("");
  const [catFilter, setCatFilter]   = useState<Categorie | "Tous">("Tous");
  const [sortBy, setSortBy]         = useState<SortKey>("recent");
  const [activeTab, setActiveTab]   = useState<TabKey>("prevu");

  // Formulaire
  const [showForm, setShowForm]     = useState(false);
  const [addType, setAddType]       = useState<TypeMateriel>("prevu");

  // Champs prévu
  const [fNom, setFNom]       = useState("");
  const [fCat, setFCat]       = useState<Categorie>("Son");
  const [fQte, setFQte]       = useState(1);
  const [fStatut, setFStatut] = useState<StatutPrevu>("OK");
  const [fNote, setFNote]     = useState("");
  const [fPrio, setFPrio]     = useState<Priorite>("Normal");

  // ── Chargement ────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (p) setUserRole(p.role);
    }
    const { data } = await supabase
      .from("materiel_technique").select("*").order("created_at", { ascending: false });
    if (data) setItems(data as Materiel[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const canEdit = userRole ? ROLES_AUTORISES.includes(userRole) : false;

  // ── Données filtrées & triées ─────────────────────────────
  const filteredPrevu = useMemo(() => {
    let list = items.filter(i => i.type === "prevu");
    if (catFilter !== "Tous") list = list.filter(i => i.categorie === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i => i.nom.toLowerCase().includes(q) || i.categorie.toLowerCase().includes(q));
    }
    if (sortBy === "etat") list = [...list].sort((a, b) => ETAT_ORDER[a.etat ?? "OK"] - ETAT_ORDER[b.etat ?? "OK"]);
    if (sortBy === "nom")  list = [...list].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    return list;
  }, [items, catFilter, search, sortBy]);

  const filteredAPrevoir = useMemo(() => {
    let list = items.filter(i => i.type === "a_prevoir");
    if (catFilter !== "Tous") list = list.filter(i => i.categorie === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i => i.nom.toLowerCase().includes(q) || i.categorie.toLowerCase().includes(q));
    }
    if (sortBy === "etat") list = [...list].sort((a, b) => PRIORITE_ORDER[a.priorite ?? "Normal"] - PRIORITE_ORDER[b.priorite ?? "Normal"]);
    if (sortBy === "nom")  list = [...list].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    return list;
  }, [items, catFilter, search, sortBy]);

  const totalPrevu    = items.filter(i => i.type === "prevu").length;
  const totalAPrevoir = items.filter(i => i.type === "a_prevoir").length;
  const problemes     = items.filter(i => i.type === "prevu" && i.etat !== "OK").length;

  // ── Formulaire ─────────────────────────────────────────────
  function resetForm() {
    setFNom(""); setFCat("Son"); setFQte(1);
    setFStatut("OK"); setFNote(""); setFPrio("Normal");
    setFormError("");
  }

  function openAdd(type: TypeMateriel) {
    setAddType(type);
    resetForm();
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setFormError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return; }

    const payload = addType === "prevu"
      ? { type: "prevu" as TypeMateriel, nom: fNom.trim(), categorie: fCat, quantite: fQte, etat: fStatut as StatutPrevu, priorite: null as Priorite | null, note: fNote.trim() || null, created_by: user.id }
      : { type: "a_prevoir" as TypeMateriel, nom: fNom.trim(), categorie: fCat, quantite: fQte, etat: null as StatutPrevu | null, priorite: fPrio as Priorite, note: fNote.trim() || null, created_by: user.id };

    const { data, error } = await supabase.from("materiel_technique").insert(payload).select().single();
    if (error) { setFormError(error.message); setSubmitting(false); return; }

    // Mise à jour optimiste — l'item apparaît immédiatement
    if (data) {
      const row = data as Omit<Materiel, "created_at"> & { created_at?: string };
      const newItem: Materiel = { ...row as Materiel, created_at: row.created_at ?? new Date().toISOString() };
      setItems(prev => [newItem, ...prev]);
    }

    resetForm();
    setShowForm(false);
    setActiveTab(addType);
    setSubmitting(false);
  }

  // ── Mise à jour ───────────────────────────────────────────
  async function updateStatut(id: string, statut: StatutPrevu) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, etat: statut } : i));
    await supabase.from("materiel_technique").update({ etat: statut }).eq("id", id);
  }

  async function updatePriorite(id: string, priorite: Priorite) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, priorite } : i));
    await supabase.from("materiel_technique").update({ priorite }).eq("id", id);
  }

  async function handleDelete(id: string, nom: string) {
    if (!confirm(`Supprimer "${nom}" ?`)) return;
    setItems(prev => prev.filter(i => i.id !== id));
    await supabase.from("materiel_technique").delete().eq("id", id);
  }

  // ── Styles ────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width: "100%", padding: "10px 13px", borderRadius: 10,
    backgroundColor: T.inputBg, border: `1px solid ${T.inputBorder}`,
    color: T.textMain, fontSize: 14, outline: "none", boxSizing: "border-box",
    transition: "border-color 0.2s",
  };
  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: T.textSub,
    marginBottom: 5, display: "block", textTransform: "uppercase", letterSpacing: "0.06em",
  };

  // ── Carte matériel prévu ──────────────────────────────────
  function ItemCard({ item }: { item: Materiel }) {
    const isPrevu = item.type === "prevu";
    const st = isPrevu ? STATUT_CONFIG[item.etat ?? "OK"] : null;
    const pr = !isPrevu ? PRIORITE_CONFIG[item.priorite ?? "Normal"] : null;

    return (
      <div style={{
        backgroundColor: T.cardBg,
        border: `1px solid ${T.cardBorder}`,
        borderRadius: 16,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}>
        {/* Ligne principale */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          {/* Icône catégorie */}
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            backgroundColor: CAT_COLOR[item.categorie] + (isDark ? "18" : "14"),
            border: `1px solid ${CAT_COLOR[item.categorie]}${isDark ? "35" : "40"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>
            {CAT_ICON[item.categorie]}
          </div>

          {/* Info principale */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: T.textMain, margin: 0, lineHeight: 1.2 }}>
              {item.nom}
            </p>
            <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" as const, alignItems: "center" }}>
              {/* Catégorie pill */}
              <span style={{
                fontSize: 10, fontWeight: 600,
                color: CAT_COLOR[item.categorie],
                backgroundColor: CAT_COLOR[item.categorie] + (isDark ? "18" : "14"),
                border: `1px solid ${CAT_COLOR[item.categorie]}${isDark ? "30" : "40"}`,
                padding: "2px 8px", borderRadius: 6,
                letterSpacing: "0.04em",
              }}>
                {item.categorie}
              </span>
              {/* Quantité */}
              <span style={{
                fontSize: 11, fontWeight: 700, color: T.textSub,
                backgroundColor: T.chipBg, border: `1px solid ${T.chipBorder}`,
                padding: "2px 8px", borderRadius: 6,
              }}>
                ×{item.quantite}
              </span>
              {/* Note */}
              {item.note && (
                <span style={{ fontSize: 11, color: T.textMuted, fontStyle: "italic" }}>
                  {item.note}
                </span>
              )}
            </div>
          </div>

          {/* Badge état / priorité */}
          {st && (
            <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              {/* Point coloré + label */}
              <span style={{
                display: "flex", alignItems: "center", gap: 5,
                fontSize: 11, fontWeight: 700,
                color: st.color,
                backgroundColor: isDark ? st.bgDark : st.bgLight,
                border: `1px solid ${isDark ? st.borderDark : st.borderLight}`,
                padding: "4px 10px", borderRadius: 999,
                whiteSpace: "nowrap" as const,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: st.dot, flexShrink: 0 }} />
                {item.etat}
              </span>
            </div>
          )}
          {pr && (
            <span style={{
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 11, fontWeight: 700,
              color: pr.color,
              backgroundColor: isDark ? pr.bgDark : pr.bgLight,
              border: `1px solid ${isDark ? pr.borderDark : pr.borderLight}`,
              padding: "4px 10px", borderRadius: 999,
              flexShrink: 0, whiteSpace: "nowrap" as const,
              ...(item.priorite === "Urgent" ? { animation: "pulse-red 1.4s ease-in-out infinite" } : {}),
            }}>
              {item.priorite === "Urgent" && <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#E4002B", flexShrink: 0 }} />}
              {item.priorite}
            </span>
          )}
        </div>

        {/* Actions si autorisé */}
        {canEdit && (
          <div style={{
            borderTop: `1px solid ${T.border}`,
            paddingTop: 10,
            display: "flex", gap: 8, alignItems: "center",
          }}>
            {isPrevu ? (
              <select
                value={item.etat ?? "OK"}
                onChange={e => updateStatut(item.id, e.target.value as StatutPrevu)}
                style={{ flex: 1, fontSize: 12, backgroundColor: T.selectBg, border: `1px solid ${T.inputBorder}`, color: T.textMain, borderRadius: 8, padding: "6px 10px", outline: "none" }}
              >
                {STATUTS.map(s => <option key={s}>{s}</option>)}
              </select>
            ) : (
              <select
                value={item.priorite ?? "Normal"}
                onChange={e => updatePriorite(item.id, e.target.value as Priorite)}
                style={{ flex: 1, fontSize: 12, backgroundColor: T.selectBg, border: `1px solid ${T.inputBorder}`, color: T.textMain, borderRadius: 8, padding: "6px 10px", outline: "none" }}
              >
                {PRIORITES.map(p => <option key={p}>{p}</option>)}
              </select>
            )}
            <button
              onClick={() => handleDelete(item.id, item.nom)}
              style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.border}`, backgroundColor: "transparent", cursor: "pointer", fontSize: 14, color: T.textMuted, transition: "color 0.15s, border-color 0.15s" }}
              title="Supprimer"
            >
              🗑️
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Liste active ──────────────────────────────────────────
  const activeList = activeTab === "prevu" ? filteredPrevu : filteredAPrevoir;

  return (
    <div style={{ backgroundColor: T.pageBg, minHeight: "100dvh", display: "flex", flexDirection: "column", transition: "background-color 0.3s" }}>
      <style>{`
        @keyframes pulse-red { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .cat-chip:active { transform: scale(0.94); }
      `}</style>

      {/* ── Header ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 20,
        backgroundColor: T.headerBg,
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${T.border}`,
        padding: "10px 16px",
        transition: "background-color 0.3s, border-color 0.3s",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 672, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/dashboard" style={{ color: T.textSub, lineHeight: 0, padding: 2 }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${T.border}`, lineHeight: 0 }}>
              <Image src="/logo.jpg" alt="LIL'Z" width={68} height={68} quality={100} style={{ display: "block", objectFit: "cover", width: 34, height: 34 }} />
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 800, color: T.textMain, lineHeight: 1.1, margin: 0 }}>Matériel Technique</p>
              <p style={{ fontSize: 10, color: "#009A44", marginTop: 2, fontWeight: 600 }}>LIL&apos;Z EVENT AGENCY</p>
            </div>
          </div>
          <LogoutBtn supabase={supabase} T={T} />
        </div>
      </header>

      {/* Bande */}
      <div style={{ display: "flex", height: 2, flexShrink: 0 }}>
        {["#009A44", isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.15)", "#E4002B", "#1E90FF", "#FFD700"].map((c, i) =>
          <div key={i} style={{ flex: 1, backgroundColor: c }} />
        )}
      </div>

      <main style={{ flex: 1, maxWidth: 672, margin: "0 auto", width: "100%", padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 14, transition: "background-color 0.3s" }}>

        {/* ── Barre recherche + bouton ajouter ── */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Recherche */}
          <div style={{ flex: 1, position: "relative" }}>
            <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: T.textMuted }} width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Rechercher un matériel…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...inp, paddingLeft: 36, fontSize: 13 }}
            />
          </div>

          {/* Bouton + Ajouter */}
          {canEdit && (
            <button
              onClick={() => {
                openAdd(activeTab);
                setShowForm(prev => !prev || addType !== activeTab ? true : !prev);
              }}
              style={{
                flexShrink: 0,
                display: "flex", alignItems: "center", gap: 6,
                padding: "10px 14px", borderRadius: 12,
                backgroundColor: "#009A44", color: "#fff",
                border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 700,
                boxShadow: isDark ? "0 2px 12px rgba(0,154,68,0.3)" : "0 2px 12px rgba(0,154,68,0.25)",
                transition: "transform 0.1s, box-shadow 0.1s",
                whiteSpace: "nowrap" as const,
              }}
              onPointerDown={e => (e.currentTarget.style.transform = "scale(0.95)")}
              onPointerUp={e => (e.currentTarget.style.transform = "scale(1)")}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14"/>
              </svg>
              Ajouter
            </button>
          )}
        </div>

        {/* ── Filtres catégorie (horizontal scroll) ── */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
          {(["Tous", ...CATEGORIES] as const).map(cat => {
            const active = catFilter === cat;
            const color = cat === "Tous" ? "#009A44" : CAT_COLOR[cat as Categorie];
            return (
              <button
                key={cat}
                className="cat-chip"
                onClick={() => setCatFilter(cat as Categorie | "Tous")}
                style={{
                  flexShrink: 0,
                  padding: "6px 12px", borderRadius: 999,
                  fontSize: 12, fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  border: `1.5px solid ${active ? color : T.chipBorder}`,
                  backgroundColor: active
                    ? (isDark ? color + "25" : color + "15")
                    : T.chipBg,
                  color: active ? color : T.chipText,
                }}
              >
                {cat === "Tous" ? "Tous" : `${CAT_ICON[cat as Categorie]} ${cat}`}
              </button>
            );
          })}
        </div>

        {/* ── Tri + stats ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Compteurs */}
          <div style={{ display: "flex", gap: 12 }}>
            <span style={{ fontSize: 11, color: T.textSub }}>
              <strong style={{ color: T.textMain }}>{totalPrevu}</strong> matériels
            </span>
            {problemes > 0 && (
              <span style={{ fontSize: 11, color: "#E4002B", fontWeight: 600 }}>
                ⚠️ {problemes} problème{problemes > 1 ? "s" : ""}
              </span>
            )}
            <span style={{ fontSize: 11, color: T.textSub }}>
              <strong style={{ color: "#1E90FF" }}>{totalAPrevoir}</strong> à prévoir
            </span>
          </div>

          {/* Tri */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            style={{ fontSize: 11, fontWeight: 600, backgroundColor: T.chipBg, border: `1px solid ${T.chipBorder}`, color: T.textSub, borderRadius: 8, padding: "5px 8px", outline: "none", cursor: "pointer" }}
          >
            <option value="recent">Plus récent</option>
            <option value="etat">Par état</option>
            <option value="nom">A → Z</option>
          </select>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 0, borderRadius: 14, overflow: "hidden", border: `1px solid ${T.border}`, backgroundColor: T.chipBg }}>
          {[
            { key: "prevu" as TabKey, label: "Inventaire", count: totalPrevu, color: "#009A44" },
            { key: "a_prevoir" as TabKey, label: "À prévoir", count: totalAPrevoir, color: "#1E90FF" },
          ].map(({ key, label, count, color }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  flex: 1, padding: "10px 12px", border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  backgroundColor: active ? (isDark ? "#111" : "#ffffff") : "transparent",
                  color: active ? color : T.textMuted,
                  transition: "all 0.15s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                {label}
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  backgroundColor: active ? color + (isDark ? "25" : "18") : "transparent",
                  color: active ? color : T.textMuted,
                  border: active ? `1px solid ${color}${isDark ? "40" : "35"}` : "1px solid transparent",
                  padding: "1px 7px", borderRadius: 999,
                  transition: "all 0.15s",
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Formulaire ajout ── */}
        {showForm && canEdit && (
          <div style={{
            backgroundColor: isDark ? "#0a0f0c" : "#f5fbf7",
            border: `1.5px solid ${addType === "prevu" ? "#009A44" : "#1E90FF"}${isDark ? "60" : "50"}`,
            borderRadius: 18, padding: 16,
            display: "flex", flexDirection: "column", gap: 12,
            transition: "background-color 0.3s",
          }}>
            {/* En-tête formulaire */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: T.textMain, margin: 0 }}>
                {addType === "prevu" ? "📦 Nouveau matériel" : "🛒 Nouveau besoin"}
              </p>
              {/* Toggle type */}
              <div style={{ display: "flex", gap: 6 }}>
                {(["prevu", "a_prevoir"] as TypeMateriel[]).map(t => (
                  <button key={t} onClick={() => setAddType(t)} style={{
                    fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 8,
                    border: `1px solid ${t === "prevu" ? "#009A44" : "#1E90FF"}${addType === t ? "" : "60"}`,
                    backgroundColor: addType === t ? (t === "prevu" ? (isDark ? "rgba(0,154,68,0.2)" : "rgba(0,154,68,0.1)") : (isDark ? "rgba(30,144,255,0.2)" : "rgba(30,144,255,0.1)")) : "transparent",
                    color: t === "prevu" ? "#009A44" : "#1E90FF",
                    cursor: "pointer",
                  }}>
                    {t === "prevu" ? "Prévu" : "À prévoir"}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Nom + Catégorie */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={lbl}>Nom *</label>
                  <input style={inp} required placeholder="Ex : Sono principale" value={fNom} onChange={e => setFNom(e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Catégorie</label>
                  <select style={inp} value={fCat} onChange={e => setFCat(e.target.value as Categorie)}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Quantité + État/Priorité */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={lbl}>Quantité</label>
                  <input style={inp} type="number" min={1} value={fQte} onChange={e => setFQte(Math.max(1, parseInt(e.target.value) || 1))} />
                </div>
                <div>
                  <label style={lbl}>{addType === "prevu" ? "État" : "Priorité"}</label>
                  {addType === "prevu" ? (
                    <select style={inp} value={fStatut} onChange={e => setFStatut(e.target.value as StatutPrevu)}>
                      {STATUTS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  ) : (
                    <select style={inp} value={fPrio} onChange={e => setFPrio(e.target.value as Priorite)}>
                      {PRIORITES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  )}
                </div>
              </div>

              {/* Note */}
              <div>
                <label style={lbl}>Note (optionnel)</label>
                <input style={inp} placeholder="Remarque, fournisseur…" value={fNote} onChange={e => setFNote(e.target.value)} />
              </div>

              {formError && (
                <p style={{ fontSize: 12, color: "#ff6b6b", backgroundColor: isDark ? "#1a0005" : "#fff0f0", border: "1px solid #ff6b6b44", borderRadius: 8, padding: "8px 12px", margin: 0 }}>
                  {formError}
                </p>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }} style={{ flex: 1, padding: "11px", borderRadius: 12, fontSize: 13, fontWeight: 600, color: T.textSub, backgroundColor: "transparent", border: `1px solid ${T.border}`, cursor: "pointer" }}>
                  Annuler
                </button>
                <button type="submit" disabled={submitting} style={{ flex: 2, padding: "11px", borderRadius: 12, fontSize: 14, fontWeight: 700, color: "#fff", backgroundColor: addType === "prevu" ? "#009A44" : "#1E90FF", border: "none", cursor: "pointer", opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Avertissement lecture seule ── */}
        {!loading && !canEdit && (
          <div style={{ backgroundColor: isDark ? "#110d00" : "#fffbef", border: `1px solid ${isDark ? "#665800" : "#FFD700"}`, borderRadius: 12, padding: "10px 14px", fontSize: 12, color: isDark ? "#FFD700" : "#a07800", display: "flex", gap: 8, alignItems: "center" }}>
            <span>👁️</span>
            <span>Mode lecture — seuls les Régisseurs, le CEO et l&apos;Admin peuvent modifier.</span>
          </div>
        )}

        {/* ── Liste ── */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1,2,3].map(n => (
              <div key={n} className="skeleton" style={{ height: 80, borderRadius: 16 }} />
            ))}
          </div>
        ) : activeList.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px", backgroundColor: T.sectionBg, borderRadius: 20, border: `1px solid ${T.sectionBorder}` }}>
            <p style={{ fontSize: 40, marginBottom: 10 }}>
              {activeTab === "prevu" ? "📦" : "🛒"}
            </p>
            <p style={{ fontSize: 15, fontWeight: 600, color: T.textMain, margin: 0 }}>
              {search || catFilter !== "Tous" ? "Aucun résultat" : (activeTab === "prevu" ? "Aucun matériel enregistré" : "Aucun besoin enregistré")}
            </p>
            {canEdit && !search && catFilter === "Tous" && (
              <p style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>
                Utilisez le bouton <strong style={{ color: "#009A44" }}>+ Ajouter</strong> pour commencer
              </p>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {activeList.map(item => <ItemCard key={item.id} item={item} />)}
          </div>
        )}

      </main>

      <div style={{ height: "calc(64px + env(safe-area-inset-bottom))" }} />
      <BottomNav />
    </div>
  );
}

function LogoutBtn({ supabase, T }: { supabase: ReturnType<typeof createClient>; T: Record<string, string> }) {
  return (
    <button
      onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
      style={{ fontSize: 11, color: T.textMuted, border: `1px solid ${T.border}`, padding: "5px 10px", borderRadius: 8, background: "transparent", cursor: "pointer", fontWeight: 600, transition: "color 0.15s" }}
    >
      Déconnexion
    </button>
  );
}
