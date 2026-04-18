"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/ui/BottomNav";
import { useTheme } from "@/lib/ThemeProvider";

// ── Types ─────────────────────────────────────────────────────
type StatutPresence = "Disponible" | "Sur scène" | "En pause" | "En déplacement" | "Hors ligne";

interface Member {
  id: string;
  full_name: string;
  role: string;
  email: string;
  last_seen: string | null;
  statut_presence: StatutPresence | null;
}

// ── Config couleurs rôle ──────────────────────────────────────
const ROLE_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  "CEO":                         { color: "#FFD700", bg: "#1a1400",  border: "#665800"  },
  "Admin":                       { color: "#FFD700", bg: "#1a1400",  border: "#665800"  },
  "Responsable Financier":       { color: "#009A44", bg: "#001a0d",  border: "#005c28"  },
  "Chef de Projet Événementiel": { color: "#1E90FF", bg: "#001428",  border: "#0a4a8a"  },
  "Community Manager":           { color: "#ff69b4", bg: "#1a0012",  border: "#7a0060"  },
  "Site Manager":                { color: "#ff9a3c", bg: "#1a0d00",  border: "#7a4000"  },
  "Advisor":                     { color: "#b47aff", bg: "#12001a",  border: "#5a007a"  },
  "Event Planner":               { color: "#22d3ee", bg: "#00181a",  border: "#006070"  },
  "Régisseur de production 1":   { color: "#ff6b6b", bg: "#1a0005",  border: "#8a0015"  },
  "Régisseur de production 2":   { color: "#ff6b6b", bg: "#1a0005",  border: "#8a0015"  },
  "Régisseur de production 3":   { color: "#ff6b6b", bg: "#1a0005",  border: "#8a0015"  },
  "Régisseur de production 4":   { color: "#ff6b6b", bg: "#1a0005",  border: "#8a0015"  },
};

// ── Config statut de présence ─────────────────────────────────
const STATUT_CONFIG: Record<StatutPresence, { color: string; bg: string; border: string; icon: string }> = {
  "Disponible":     { color: "#009A44", bg: "#001a0d", border: "#005c28", icon: "🟢" },
  "Sur scène":      { color: "#FFD700", bg: "#1a1400", border: "#665800", icon: "🎤" },
  "En pause":       { color: "#1E90FF", bg: "#001428", border: "#0a4a8a", icon: "☕" },
  "En déplacement": { color: "#ff9a3c", bg: "#1a0d00", border: "#7a4000", icon: "🚗" },
  "Hors ligne":     { color: "#555",    bg: "#111",    border: "#333",    icon: "⚫" },
};

const STATUTS: StatutPresence[] = ["Disponible", "Sur scène", "En pause", "En déplacement", "Hors ligne"];

function initials(name: string): string {
  return name.split(" ").map(w => w[0] ?? "").slice(0, 2).join("").toUpperCase();
}

function fmtLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return "jamais";
  const diff = Date.now() - new Date(lastSeen).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return new Date(lastSeen).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// ── Composant ─────────────────────────────────────────────────
export default function EquipePage() {
  const supabase = createClient();
  const router = useRouter();
  const [members, setMembers]           = useState<Member[]>([]);
  const [loading, setLoading]           = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [tick, setTick]                 = useState(0);

  // Rafraîchit toutes les 30s pour les indicateurs last_seen
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      await supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", user.id);
    }
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role, email, last_seen, statut_presence")
      .neq("role", "Admin")
      .order("role", { ascending: true });
    if (data) {
      const sorted = [...(data as Member[])].sort((a, b) => {
        if (a.role < b.role) return -1;
        if (a.role > b.role) return 1;
        return (a.full_name ?? "").localeCompare(b.full_name ?? "");
      });
      setMembers(sorted);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Realtime : écoute les changements de statut ─────────────
  useEffect(() => {
    const channel = supabase
      .channel("equipe-presence-rt")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        payload => {
          const updated = payload.new as Member;
          setMembers(prev =>
            prev.map(m =>
              m.id === updated.id
                ? { ...m, statut_presence: updated.statut_presence, last_seen: updated.last_seen }
                : m
            )
          );
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  // ── Changer son propre statut ─────────────────────────────
  async function changeStatut(statut: StatutPresence) {
    if (!currentUserId) return;
    setUpdatingStatus(true);
    const prevStatut = members.find(m => m.id === currentUserId)?.statut_presence ?? "Hors ligne";
    setMembers(prev => prev.map(m => m.id === currentUserId ? { ...m, statut_presence: statut } : m));
    const { error } = await supabase.from("profiles")
      .update({ statut_presence: statut, last_seen: new Date().toISOString() })
      .eq("id", currentUserId);
    if (error) setMembers(prev => prev.map(m => m.id === currentUserId ? { ...m, statut_presence: prevStatut } : m));
    setUpdatingStatus(false);
  }

  const { theme } = useTheme();
  const isDark = theme === "dark";
  const T = {
    bg:         isDark ? "#0a0a0a"               : "#ffffff",
    card:       isDark ? "#111111"               : "#ffffff",
    cardGreen:  isDark ? "#0d1a10"               : "rgba(0,154,68,0.04)",
    brd:        isDark ? "#1f3d25"               : "#e0e8e2",
    brdGreen:   isDark ? "#1f5c30"               : "#b0d8be",
    txt:        isDark ? "#ffffff"               : "#111111",
    sub:        isDark ? "#666666"               : "#888888",
    headerBg:   isDark ? "rgba(10,10,10,0.97)"  : "rgba(255,255,255,0.97)",
  };

  const me = members.find(m => m.id === currentUserId);
  const myStatut = me?.statut_presence ?? "Hors ligne";

  // Compteurs
  const disponibles = members.filter(m => m.statut_presence === "Disponible").length;
  const surScene    = members.filter(m => m.statut_presence === "Sur scène").length;

  return (
    <div style={{ backgroundColor: T.bg, minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .statut-btn { transition: all 0.15s; cursor: pointer; }
        .statut-btn:active { transform: scale(0.95); }
      `}</style>

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: T.headerBg, borderBottom: `1px solid ${T.brd}`, padding: "10px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 672, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/dashboard" style={{ color: "#888", lineHeight: 0 }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </Link>
            <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #1f3d25", lineHeight: 0 }}>
              <Image src="/logo.jpg" alt="LIL'Z" width={68} height={68} quality={100} style={{ display: "block", objectFit: "cover", width: 34, height: 34 }} />
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 800, color: T.txt, lineHeight: 1.1, margin: 0 }}>👥 Équipe</p>
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

        {/* Mon statut */}
        {currentUserId && !loading && (
          <div style={{ backgroundColor: T.cardGreen, border: `1px solid ${T.brdGreen}`, borderRadius: 16, padding: "16px 14px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#4ac672", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>
              Mon statut
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {STATUTS.map(s => {
                const cfg = STATUT_CONFIG[s];
                const isActive = myStatut === s;
                return (
                  <button
                    key={s}
                    className="statut-btn"
                    onClick={() => changeStatut(s)}
                    disabled={updatingStatus}
                    style={{
                      fontSize: 12, fontWeight: 700, padding: "7px 12px", borderRadius: 20,
                      border: `2px solid ${isActive ? cfg.color : T.brd}`,
                      backgroundColor: isActive ? cfg.bg : "transparent",
                      color: isActive ? cfg.color : T.sub,
                      opacity: updatingStatus ? 0.6 : 1,
                    }}>
                    {cfg.icon} {s}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Compteurs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {[
            { label: "Membres",     val: members.length, color: T.txt     },
            { label: "Disponibles", val: disponibles,     color: "#009A44"  },
            { label: "Sur scène",   val: surScene,        color: "#FFD700"  },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ backgroundColor: T.card, border: `1px solid ${T.brd}`, borderRadius: 14, padding: "14px 8px", textAlign: "center" }}>
              <p style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1, margin: 0 }}>{loading ? "—" : val}</p>
              <p style={{ fontSize: 9, color: T.sub, marginTop: 5, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Liste */}
        {loading ? (
          <p style={{ textAlign: "center", color: T.sub, fontSize: 13, padding: "40px 0" }}>Chargement…</p>
        ) : members.length === 0 ? (
          <div style={{ backgroundColor: T.card, border: `1px solid ${T.brd}`, borderRadius: 16, padding: "48px 20px", textAlign: "center" }}>
            <p style={{ fontSize: 40, margin: "0 0 10px" }}>👥</p>
            <p style={{ color: T.sub, fontSize: 13, margin: 0 }}>Aucun membre trouvé</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {members.map((m, i) => {
              const rs = ROLE_STYLE[m.role] ?? { color: "#888", bg: "#111", border: "#333" };
              const statut = (m.statut_presence ?? "Hors ligne") as StatutPresence;
              const statutCfg = STATUT_CONFIG[statut];
              const isMe = m.id === currentUserId;
              return (
                <div
                  key={m.id}
                  style={{
                    animation: `fadeInUp 0.35s ${i * 0.04}s ease-out both`,
                    display: "flex", alignItems: "center", gap: 12,
                    backgroundColor: isMe ? T.cardGreen : T.card,
                    border: `1px solid ${isMe ? T.brdGreen : T.brd}`,
                    borderRadius: 14, padding: "12px 14px",
                  }}>

                  {/* Avatar */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: rs.bg, border: `2px solid ${rs.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: rs.color }}>{initials(m.full_name)}</span>
                    </div>
                    {/* Indicateur statut */}
                    <div style={{
                      position: "absolute", bottom: 0, right: 0, width: 14, height: 14, borderRadius: "50%",
                      backgroundColor: statutCfg.color,
                      border: `2px solid ${T.bg}`,
                      fontSize: 7, display: "flex", alignItems: "center", justifyContent: "center",
                    }} />
                  </div>

                  {/* Infos */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: T.txt, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.full_name}
                      {isMe && <span style={{ fontSize: 10, color: "#4ac672", marginLeft: 6 }}>(vous)</span>}
                    </p>
                    <p style={{ fontSize: 10, color: T.sub, margin: "2px 0 0" }}>
                      {fmtLastSeen(m.last_seen)}
                    </p>
                  </div>

                  {/* Badge statut + rôle + message */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
                    {/* Badge statut de présence */}
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
                      color: statutCfg.color, backgroundColor: statutCfg.bg, border: `1px solid ${statutCfg.border}`,
                      whiteSpace: "nowrap",
                    }}>
                      {statutCfg.icon} {statut}
                    </span>
                    {/* Badge rôle */}
                    <span style={{
                      fontSize: 9, padding: "2px 7px", borderRadius: 999,
                      color: rs.color, backgroundColor: rs.bg, border: `1px solid ${rs.border}`,
                      maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {m.role}
                    </span>
                    {/* Bouton message (pas pour soi-même) */}
                    {!isMe && (
                      <button
                        onClick={() => router.push(`/messages/${m.id}`)}
                        style={{
                          fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
                          color: "#1E90FF", backgroundColor: isDark ? "#001428" : "#e8f0ff",
                          border: "1px solid #0a4a8a", cursor: "pointer", whiteSpace: "nowrap",
                        }}>
                        💬 Message
                      </button>
                    )}
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
