"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/lib/ThemeProvider";
import BottomNav from "@/components/ui/BottomNav";

// ── Couleurs par rôle ──────────────────────────────────────────
const ROLE_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  "CEO":                         { color: "#FFD700", bg: "#1a1400",  border: "#665800" },
  "Responsable Financier":       { color: "#009A44", bg: "#001a0d",  border: "#005c28" },
  "Chef de Projet Événementiel": { color: "#1E90FF", bg: "#001428",  border: "#0a4a8a" },
  "Community Manager":           { color: "#ff69b4", bg: "#1a0012",  border: "#7a0060" },
  "Site Manager":                { color: "#ff9a3c", bg: "#1a0d00",  border: "#7a4000" },
  "Advisor":                     { color: "#b47aff", bg: "#12001a",  border: "#5a007a" },
  "Event Planner":               { color: "#22d3ee", bg: "#00181a",  border: "#006070" },
  "Régisseur de production 1":   { color: "#ff6b6b", bg: "#1a0005",  border: "#8a0015" },
  "Régisseur de production 2":   { color: "#ff6b6b", bg: "#1a0005",  border: "#8a0015" },
  "Régisseur de production 3":   { color: "#ff6b6b", bg: "#1a0005",  border: "#8a0015" },
  "Régisseur de production 4":   { color: "#ff6b6b", bg: "#1a0005",  border: "#8a0015" },
};

const ROLE_STYLE_LIGHT: Record<string, { color: string; bg: string; border: string }> = {
  "CEO":                         { color: "#a07800", bg: "#fffbe6",  border: "#ffe066" },
  "Responsable Financier":       { color: "#007a35", bg: "#e6f7ed",  border: "#8ad4a5" },
  "Chef de Projet Événementiel": { color: "#1565C0", bg: "#e8f1fd",  border: "#90b8f0" },
  "Community Manager":           { color: "#c2185b", bg: "#fce4ec",  border: "#f48fb1" },
  "Site Manager":                { color: "#e65100", bg: "#fff3e0",  border: "#ffb74d" },
  "Advisor":                     { color: "#6a1b9a", bg: "#f3e5f5",  border: "#ce93d8" },
  "Event Planner":               { color: "#00838f", bg: "#e0f7fa",  border: "#80deea" },
  "Régisseur de production 1":   { color: "#c62828", bg: "#ffebee",  border: "#ef9a9a" },
  "Régisseur de production 2":   { color: "#c62828", bg: "#ffebee",  border: "#ef9a9a" },
  "Régisseur de production 3":   { color: "#c62828", bg: "#ffebee",  border: "#ef9a9a" },
  "Régisseur de production 4":   { color: "#c62828", bg: "#ffebee",  border: "#ef9a9a" },
};

// ── Modules ────────────────────────────────────────────────────
const MODULES = [
  {
    href: "/billetterie",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/>
      </svg>
    ),
    label: "Billetterie",
    desc: "Réservations clients",
    accent: "#009A44",
    financeOnly: false,
  },
  {
    href: "/messages",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
      </svg>
    ),
    label: "Messages",
    desc: "Chat privé équipe",
    accent: "#1E90FF",
    financeOnly: false,
  },
  {
    href: "/planning",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9"/>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3"/>
      </svg>
    ),
    label: "Planning",
    desc: "Qui fait quoi",
    accent: "#FFD700",
    financeOnly: false,
  },
  {
    href: "/notes",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M5 5h14a1 1 0 011 1v10a1 1 0 01-1 1l-4 3H5a1 1 0 01-1-1V6a1 1 0 011-1z"/>
      </svg>
    ),
    label: "Notes",
    desc: "Messagerie équipe",
    accent: "#009A44",
    financeOnly: false,
  },
  {
    href: "/equipe",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20H7m10-4a4 4 0 10-8 0m12-4a3 3 0 10-6 0M5 16a3 3 0 116 0"/>
      </svg>
    ),
    label: "Équipe",
    desc: "Les membres",
    accent: "#1E90FF",
    financeOnly: false,
  },
  {
    href: "/evenements",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 012 2v13a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"/>
      </svg>
    ),
    label: "Événements",
    desc: "Gérer les events",
    accent: "#FFD700",
    financeOnly: false,
  },
  {
    href: "/materiel",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    ),
    label: "Matériel",
    desc: "Parc technique",
    accent: "#ff9a3c",
    financeOnly: false,
  },
  {
    href: "/finances",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    ),
    label: "Finances",
    desc: "Recettes & dépenses",
    accent: "#E4002B",
    financeOnly: true,
  },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

// ── Page ───────────────────────────────────────────────────────
export default function DashboardPage() {
  const supabase = createClient();
  const userId = useRef<string | null>(null);
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  const [profile, setProfile]           = useState<Record<string, string> | null>(null);
  const [eventEnCours, setEventEnCours] = useState<{ nom: string } | null>(null);
  const [notifCount, setNotifCount]     = useState(0);
  const [hasUrgent, setHasUrgent]       = useState(false);
  const [loading, setLoading]           = useState(true);

  // ── Palette selon le thème ─────────────────────────────────
  const T = {
    pageBg:        isDark ? "#080808"  : "#ffffff",
    headerBg:      isDark ? "rgba(8,8,8,0.96)"           : "rgba(255,255,255,0.97)",
    borderMain:    isDark ? "#1f3d25"  : "#e0e8e2",
    cardBg:        isDark ? "linear-gradient(135deg,#0d2016,#0a1a0e)" : "#ffffff",
    cardBorder:    isDark ? "#1f3d25"  : "#e0e8e2",
    textMain:      isDark ? "#ffffff"  : "#111111",
    textSub:       isDark ? "#666666"  : "#777777",
    textLabel:     isDark ? "#4ac672"  : "#009A44",
    textMuted:     isDark ? "#444444"  : "#aaaaaa",
    eventBg:       isDark ? "linear-gradient(135deg,#001a0d,#002818)" : "rgba(0,154,68,0.04)",
    eventBorder:   isDark ? "#009A44"  : "#009A44",
    footerText:    isDark ? "#aaaaaa"  : "#999999",
    footerCredit:  isDark ? "#444444"  : "#bbbbbb",
    logoutColor:   isDark ? "#555555"  : "#999999",
    logoutBorder:  isDark ? "#1f3d25"  : "#d8e4dc",
  };

  // ── Chargement des données ─────────────────────────────────
  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    userId.current = user.id;

    const [profRes, eventsRes] = await Promise.all([
      supabase.from("profiles").select("full_name, role").eq("id", user.id).single(),
      supabase.from("evenements").select("nom").eq("statut", "En cours").limit(1),
    ]);

    if (profRes.data) setProfile(profRes.data as Record<string, string>);
    setEventEnCours(eventsRes.data?.[0] ?? null);

    await supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", user.id);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Notifications Realtime ─────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("dash-notifs")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notes_internes" },
        (payload) => {
          const row = payload.new as { author_id: string; is_urgent: boolean };
          if (row.author_id !== userId.current) {
            setNotifCount(n => n + 1);
            if (row.is_urgent) setHasUrgent(true);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const isFinance = profile?.role === "CEO" || profile?.role === "Responsable Financier";
  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  const lastName  = profile?.full_name?.split(" ").slice(1).join(" ") ?? "";
  const roleStyleMap = isDark ? ROLE_STYLE : ROLE_STYLE_LIGHT;
  const rs = profile?.role
    ? (roleStyleMap[profile.role] ?? { color: "#888", bg: isDark ? "#111" : "#f0f0f0", border: isDark ? "#333" : "#ccc" })
    : { color: "#888", bg: isDark ? "#111" : "#f0f0f0", border: isDark ? "#333" : "#ccc" };

  return (
    <div style={{ backgroundColor: T.pageBg, minHeight: "100dvh", display: "flex", flexDirection: "column", transition: "background-color 0.3s" }}>

      {/* ── Header ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 20,
        backgroundColor: T.headerBg,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${T.borderMain}`,
        padding: "10px 16px",
        transition: "background-color 0.3s, border-color 0.3s",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 672, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${T.borderMain}`, lineHeight: 0 }}>
              <Image src="/logo.jpg" alt="LIL'Z" width={72} height={72} quality={100}
                style={{ display: "block", objectFit: "cover", width: 36, height: 36 }} />
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 800, color: T.textMain, lineHeight: 1.1, margin: 0, letterSpacing: "-0.01em", transition: "color 0.3s" }}>
                LIL&apos;Z EVENT AGENCY
              </p>
              <p style={{ fontSize: 10, color: "#009A44", margin: 0, marginTop: 2, fontWeight: 600 }}>
                Espace équipe
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Cloche */}
            <a href="/notes" style={{ position: "relative", lineHeight: 0, textDecoration: "none", padding: 4 }}>
              <svg width="20" height="20" fill="none" stroke={notifCount > 0 ? "#009A44" : T.logoutColor} strokeWidth="2" viewBox="0 0 24 24" style={{ transition: "stroke 0.3s" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17H9a6 6 0 01-6-6V9a9 9 0 0118 0v2a6 6 0 01-6 6zm0 0v1a3 3 0 11-6 0v-1"/>
              </svg>
              {notifCount > 0 && (
                <span
                  className={hasUrgent ? "notif-pulse" : ""}
                  style={{
                    position: "absolute", top: 0, right: 0,
                    minWidth: 15, height: 15, borderRadius: 999,
                    backgroundColor: "#E4002B", color: "#fff",
                    fontSize: 8, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 3px", lineHeight: 1,
                    border: `1.5px solid ${T.pageBg}`,
                  }}>
                  {notifCount > 9 ? "9+" : notifCount}
                </span>
              )}
            </a>

            {/* Toggle thème */}
            <button
              onClick={toggle}
              title={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
              style={{
                width: 34, height: 34,
                borderRadius: 10,
                border: `1px solid ${T.borderMain}`,
                backgroundColor: "transparent",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: T.logoutColor,
                transition: "border-color 0.3s, color 0.3s",
                flexShrink: 0,
              }}
            >
              {isDark ? (
                /* Icône soleil */
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="5"/>
                  <path strokeLinecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
              ) : (
                /* Icône lune */
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                </svg>
              )}
            </button>

            <LogoutBtn supabase={supabase} isDark={isDark} borderColor={T.logoutBorder} />
          </div>
        </div>
      </header>

      {/* Bande comoriennes */}
      <div style={{ display: "flex", height: 2, flexShrink: 0 }}>
        {["#009A44", isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.2)", "#E4002B", "#1E90FF", "#FFD700"].map((c, i) =>
          <div key={i} style={{ flex: 1, backgroundColor: c }} />
        )}
      </div>

      <main style={{
        flex: 1,
        maxWidth: 672,
        margin: "0 auto",
        width: "100%",
        padding: "20px 16px 0",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        transition: "background-color 0.3s",
      }}>

        {/* ── Carte bienvenue ── */}
        <div
          className="animate-fade-in-up"
          style={{
            position: "relative",
            overflow: "hidden",
            background: isDark
              ? "linear-gradient(135deg, #0d2016 0%, #0a1a0e 100%)"
              : "linear-gradient(135deg, rgba(0,154,68,0.05) 0%, #ffffff 100%)",
            border: `1px solid ${isDark ? "#1f3d25" : "rgba(0,154,68,0.2)"}`,
            borderRadius: 20,
            padding: "20px 18px",
            boxShadow: isDark ? "none" : "0 2px 16px rgba(0,154,68,0.08)",
            transition: "background 0.3s, border-color 0.3s",
          }}
        >
          {isDark && (
            <>
              <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", backgroundColor: "#009A44", opacity: 0.06, filter: "blur(30px)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", bottom: -20, left: "30%", width: 80, height: 80, borderRadius: "50%", backgroundColor: "#1E90FF", opacity: 0.04, filter: "blur(25px)", pointerEvents: "none" }} />
            </>
          )}

          <p style={{ fontSize: 12, color: T.textLabel, margin: "0 0 2px", fontWeight: 600, transition: "color 0.3s" }}>
            {getGreeting()},
          </p>
          <p style={{ fontSize: 26, fontWeight: 900, color: T.textMain, margin: 0, lineHeight: 1.1, letterSpacing: "-0.02em", transition: "color 0.3s" }}>
            {loading
              ? <span className="skeleton" style={{ display: "inline-block", width: 100, height: 28 }} />
              : firstName
            }
          </p>
          {lastName && (
            <p style={{ fontSize: 13, color: T.textSub, margin: "2px 0 0", transition: "color 0.3s" }}>{lastName}</p>
          )}
          {loading ? (
            <span className="skeleton" style={{ display: "inline-block", width: 120, height: 22, marginTop: 10, borderRadius: 999 }} />
          ) : profile?.role && (
            <span style={{
              display: "inline-flex", marginTop: 10,
              padding: "4px 12px", borderRadius: 999,
              fontSize: 11, fontWeight: 700,
              color: rs.color, backgroundColor: rs.bg,
              border: `1px solid ${rs.border}`,
              letterSpacing: "0.02em",
              transition: "all 0.3s",
            }}>
              {profile.role}
            </span>
          )}
        </div>

        {/* ── Bannière événement en cours ── */}
        {eventEnCours && (
          <a
            href="/evenements"
            className="animate-fade-in-up"
            style={{
              display: "flex", alignItems: "center", gap: 12,
              background: T.eventBg,
              border: `1.5px solid ${T.eventBorder}`,
              borderRadius: 16, padding: "12px 16px",
              textDecoration: "none", animationDelay: "0.06s",
              boxShadow: isDark ? "none" : "0 1px 8px rgba(0,154,68,0.08)",
              transition: "background 0.3s",
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              backgroundColor: "rgba(0,154,68,0.12)",
              border: "1px solid rgba(0,154,68,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg width="18" height="18" fill="none" stroke="#009A44" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 012 2v13a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: "#009A44", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0, fontWeight: 700 }}>
                Événement en cours
              </p>
              <p style={{ fontSize: 15, fontWeight: 700, color: T.textMain, margin: 0, transition: "color 0.3s" }}>
                {eventEnCours.nom}
              </p>
            </div>
            <span style={{
              flexShrink: 0, fontSize: 10, fontWeight: 800,
              backgroundColor: "#009A44", color: "#fff",
              padding: "4px 9px", borderRadius: 8,
              letterSpacing: "0.05em",
            }}>
              EN COURS
            </span>
          </a>
        )}

        {/* ── Grille modules ── */}
        <section className="animate-fade-in-up" style={{ animationDelay: "0.12s" }}>
          <p style={{
            fontSize: 10, fontWeight: 700, color: T.textMuted,
            textTransform: "uppercase", letterSpacing: "0.12em",
            margin: "0 0 10px",
            transition: "color 0.3s",
          }}>
            Modules
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
            {MODULES.map((mod, i) => {
              if (mod.financeOnly && !isFinance) return null;
              return (
                <a
                  key={mod.href}
                  href={mod.href}
                  className="animate-fade-in-up"
                  style={{
                    animationDelay: `${0.14 + i * 0.04}s`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    padding: "14px",
                    borderRadius: 18,
                    background: isDark
                      ? "linear-gradient(135deg, #0e1a11, #0b1410)"
                      : `linear-gradient(135deg, ${mod.accent}0e, ${mod.accent}06)`,
                    border: `1.5px solid ${isDark ? "#1f3d25" : mod.accent + "55"}`,
                    textDecoration: "none",
                    transition: "border-color 0.15s, transform 0.12s, background 0.3s, box-shadow 0.15s",
                    position: "relative",
                    overflow: "hidden",
                    boxShadow: isDark ? "none" : `0 1px 8px ${mod.accent}18`,
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = mod.accent + "cc";
                    (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 20px ${mod.accent}30`;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = isDark ? "#1f3d25" : mod.accent + "55";
                    (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                    (e.currentTarget as HTMLElement).style.boxShadow = isDark ? "none" : `0 1px 8px ${mod.accent}18`;
                  }}
                  onPointerDown={e => { (e.currentTarget as HTMLElement).style.transform = "scale(0.96)"; }}
                  onPointerUp={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                >
                  {/* Lueur accent (dark only) */}
                  {isDark && (
                    <div style={{
                      position: "absolute", top: -20, right: -20,
                      width: 60, height: 60, borderRadius: "50%",
                      backgroundColor: mod.accent, opacity: 0.05,
                      filter: "blur(15px)", pointerEvents: "none",
                    }} />
                  )}

                  {/* Icône */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 12,
                    backgroundColor: mod.accent + (isDark ? "18" : "15"),
                    border: `1px solid ${mod.accent}${isDark ? "35" : "40"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: mod.accent,
                    flexShrink: 0,
                  }}>
                    {mod.icon}
                  </div>

                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: T.textMain, margin: 0, letterSpacing: "-0.01em", transition: "color 0.3s" }}>
                      {mod.label}
                    </p>
                    <p style={{ fontSize: 11, color: T.textSub, margin: "3px 0 0", transition: "color 0.3s" }}>
                      {mod.desc}
                    </p>
                  </div>

                  {/* Barre accent en bas */}
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    height: 2, backgroundColor: mod.accent, opacity: isDark ? 0.3 : 0.35,
                    borderRadius: "0 0 18px 18px",
                  }} />
                </a>
              );
            })}
          </div>
        </section>

      </main>

      {/* ── Footer (gardé uniquement sur le dashboard) ── */}
      <footer style={{
        borderTop: `1px solid ${T.borderMain}`,
        padding: "20px 16px",
        paddingBottom: "calc(80px + 16px + env(safe-area-inset-bottom))",
        textAlign: "center",
        marginTop: 24,
        transition: "border-color 0.3s",
      }}>
        <p style={{ fontSize: 13, fontStyle: "italic", color: T.footerText, margin: 0, transition: "color 0.3s" }}>
          Chaque instant marque l&apos;histoire
        </p>
        <p style={{ fontSize: 11, color: T.footerCredit, marginTop: 4, transition: "color 0.3s" }}>
          Application développée par{" "}
          <span style={{ color: "#009A44", fontWeight: 600 }}>Kylian Cheikh Ahmed</span>
        </p>
      </footer>

      <BottomNav />
    </div>
  );
}

function LogoutBtn({
  supabase,
  isDark,
  borderColor,
}: {
  supabase: ReturnType<typeof createClient>;
  isDark: boolean;
  borderColor: string;
}) {
  return (
    <button
      onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
      style={{
        fontSize: 11, color: isDark ? "#555" : "#888",
        border: `1px solid ${borderColor}`,
        padding: "5px 10px", borderRadius: 8,
        background: "transparent", cursor: "pointer",
        transition: "color 0.15s, border-color 0.15s",
        fontWeight: 600,
      }}
    >
      Déconnexion
    </button>
  );
}
