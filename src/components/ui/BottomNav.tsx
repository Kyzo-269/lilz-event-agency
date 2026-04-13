"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/lib/ThemeProvider";

const NAV = [
  {
    href: "/dashboard",
    label: "Accueil",
    icon: (
      <svg width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.75L12 3l9 6.75V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.75z"/>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 21V12h6v9"/>
      </svg>
    ),
  },
  {
    href: "/evenements",
    label: "Événements",
    icon: (
      <svg width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 012 2v13a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"/>
      </svg>
    ),
  },
  {
    href: "/planning",
    label: "Planning",
    icon: (
      <svg width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9"/>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3"/>
      </svg>
    ),
  },
  {
    href: "/notes",
    label: "Notes",
    icon: (
      <svg width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M5 5h14a1 1 0 011 1v10a1 1 0 01-1 1l-4 3H5a1 1 0 01-1-1V6a1 1 0 011-1z"/>
      </svg>
    ),
  },
  {
    href: "/messages",
    label: "Messages",
    icon: (
      <svg width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
      </svg>
    ),
  },
  {
    href: "/equipe",
    label: "Équipe",
    icon: (
      <svg width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20H7m10-4a4 4 0 10-8 0m12-4a3 3 0 10-6 0M5 16a3 3 0 116 0"/>
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname  = usePathname();
  const { theme } = useTheme();
  const isDark    = theme === "dark";
  const supabase  = createClient();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    async function fetchUnread() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .is("read_at", null);
      setUnread(count ?? 0);
    }

    fetchUnread();

    const channel = supabase
      .channel("unread-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, fetchUnread)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navBg  = isDark ? "rgba(8,8,8,0.97)"        : "rgba(240,245,242,0.97)";
  const navBrd = isDark ? "#1f3d25"                  : "#b8d8c0";

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40,
      backgroundColor: navBg,
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      borderTop: `1px solid ${navBrd}`,
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      <div style={{ display: "flex", maxWidth: 672, margin: "0 auto" }}>
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));

          return (
            <Link key={href} href={href} style={{
              flex: 1,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              paddingTop: 9, paddingBottom: 9, gap: 2,
              color: active ? "#009A44" : isDark ? "#444" : "#999",
              textDecoration: "none",
              transition: "color 0.15s",
              position: "relative",
            }}>
              {/* Indicateur actif */}
              {active && (
                <span style={{
                  position: "absolute", top: 0, left: "20%", right: "20%",
                  height: 2, borderRadius: "0 0 4px 4px",
                  backgroundColor: "#009A44",
                }} />
              )}

              {/* Icône + badge */}
              <span style={{
                transition: "transform 0.15s",
                transform: active ? "scale(1.1)" : "scale(1)",
                position: "relative",
              }}>
                {icon}
                {href === "/messages" && unread > 0 && (
                  <span style={{
                    position: "absolute", top: -4, right: -6,
                    minWidth: 16, height: 16, borderRadius: 999,
                    backgroundColor: "#E4002B", color: "#fff",
                    fontSize: 9, fontWeight: 900, lineHeight: 1,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 3px",
                    border: `2px solid ${navBg}`,
                  }}>
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </span>

              <span style={{
                fontSize: 8,
                fontWeight: active ? 700 : 500,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
                lineHeight: 1,
              }}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
