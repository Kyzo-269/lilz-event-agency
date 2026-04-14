"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/lib/ThemeProvider";
import BottomNav from "@/components/ui/BottomNav";
import Link from "next/link";
import Image from "next/image";

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  media_type: string | null;
  read_at: string | null;
  created_at: string;
}

interface Conversation {
  profile: Profile;
  lastMsg: DirectMessage;
  unread: number;
}

function initials(name: string) {
  return name.split(" ").map(w => w[0] ?? "").slice(0, 2).join("").toUpperCase();
}

function fmtRelTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export default function MessagesListPage() {
  const router   = useRouter();
  const supabase = createClient();
  const { theme } = useTheme();
  const isDark   = theme === "dark";

  const T = {
    bg:       isDark ? "#0a0a0a"              : "#f5f7f5",
    card:     isDark ? "#111111"              : "#ffffff",
    brd:      isDark ? "#1f3d25"              : "#e0e8e2",
    txt:      isDark ? "#ffffff"              : "#111111",
    sub:      isDark ? "#666666"              : "#888888",
    muted:    isDark ? "#444444"              : "#aaaaaa",
    header:   isDark ? "rgba(10,10,10,0.97)" : "rgba(255,255,255,0.97)",
    active:   isDark ? "#0d1a10"             : "rgba(0,154,68,0.04)",
    activeBrd:isDark ? "#1f5c30"             : "#b0d8be",
  };

  const [myId, setMyId]               = useState<string | null>(null);
  const [convs, setConvs]             = useState<Conversation[]>([]);
  const [allMembers, setAllMembers]   = useState<Profile[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");

  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setMyId(user.id);

    // Membres
    const { data: members } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .neq("id", user.id)
      .order("full_name");

    const profiles = (members ?? []) as Profile[];
    setAllMembers(profiles);

    // Messages
    const { data: msgs } = await supabase
      .from("direct_messages")
      .select("*")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    // Grouper par interlocuteur
    const map = new Map<string, { lastMsg: DirectMessage; unread: number }>();
    (msgs ?? []).forEach((msg: DirectMessage) => {
      const othId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      if (!map.has(othId)) {
        map.set(othId, {
          lastMsg: msg,
          unread: msg.receiver_id === user.id && !msg.read_at ? 1 : 0,
        });
      } else {
        const e = map.get(othId)!;
        if (msg.receiver_id === user.id && !msg.read_at) e.unread++;
      }
    });

    const conversations: Conversation[] = [];
    map.forEach((val, othId) => {
      const prof = profiles.find(p => p.id === othId);
      if (prof) conversations.push({ profile: prof, lastMsg: val.lastMsg, unread: val.unread });
    });

    conversations.sort((a, b) =>
      new Date(b.lastMsg.created_at).getTime() - new Date(a.lastMsg.created_at).getTime()
    );

    setConvs(conversations);
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime
  useEffect(() => {
    if (!myId) return;
    const ch = supabase
      .channel("convlist-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, () => {
        fetchAll();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, myId, fetchAll]);

  // Membres sans conversation (pour "Nouveau message")
  const convIds = new Set(convs.map(c => c.profile.id));
  const newable = allMembers.filter(m =>
    !convIds.has(m.id) &&
    (search === "" || m.full_name.toLowerCase().includes(search.toLowerCase()))
  );
  const filteredConvs = convs.filter(c =>
    search === "" || c.profile.full_name.toLowerCase().includes(search.toLowerCase())
  );

  function previewMsg(msg: DirectMessage) {
    if (msg.media_type === "image") return "📷 Photo";
    if (msg.media_type === "audio") return "🎤 Message vocal";
    if (!msg.content) return "";
    return msg.content.length > 40 ? msg.content.slice(0, 40) + "…" : msg.content;
  }

  return (
    <div style={{ backgroundColor: T.bg, minHeight: "100dvh", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 10,
        backgroundColor: T.header,
        borderBottom: `1px solid ${T.brd}`,
        padding: "10px 16px",
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 672, margin: "0 auto" }}>
          <Link href="/dashboard" style={{ color: T.sub, lineHeight: 0 }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
          </Link>
          <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${T.brd}`, lineHeight: 0 }}>
            <Image src="/logo.jpg" alt="LIL'Z" width={68} height={68} quality={100}
              style={{ display: "block", objectFit: "cover", width: 34, height: 34 }} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 800, color: T.txt, margin: 0, lineHeight: 1.1 }}>💬 Messages</p>
            <p style={{ fontSize: 10, color: "#009A44", margin: 0, marginTop: 2 }}>LIL&apos;Z EVENT AGENCY</p>
          </div>
        </div>
      </header>

      {/* Bande */}
      <div style={{ display: "flex", height: 2 }}>
        {["#009A44","rgba(255,255,255,0.5)","#E4002B","#1E90FF","#FFD700"].map((c,i) =>
          <div key={i} style={{ flex: 1, backgroundColor: c }} />
        )}
      </div>

      <main style={{ flex: 1, maxWidth: 672, margin: "0 auto", width: "100%", padding: "16px 16px", paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}>

        {/* Recherche */}
        <div style={{ marginBottom: 16 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Rechercher un membre…"
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 12,
              backgroundColor: T.card, border: `1px solid ${T.brd}`,
              color: T.txt, fontSize: 13, outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {loading ? (
          <p style={{ textAlign: "center", color: T.sub, padding: "40px 0" }}>Chargement…</p>
        ) : (
          <>
            {/* Conversations récentes */}
            {filteredConvs.length > 0 && (
              <section style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>
                  Conversations récentes
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {filteredConvs.map(({ profile: p, lastMsg, unread: uc }) => (
                    <button key={p.id}
                      onClick={() => router.push(`/messages/${p.id}`)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        backgroundColor: uc > 0 ? T.active : T.card,
                        border: `1px solid ${uc > 0 ? T.activeBrd : T.brd}`,
                        borderRadius: 14, padding: "12px 14px",
                        cursor: "pointer", textAlign: "left", width: "100%",
                      }}>
                      {/* Avatar */}
                      <div style={{
                        width: 46, height: 46, borderRadius: "50%",
                        backgroundColor: isDark ? "#1a1a1a" : "#e0ede4",
                        border: `2px solid ${uc > 0 ? "#009A44" : T.brd}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 15, fontWeight: 800, color: "#009A44",
                        flexShrink: 0, position: "relative",
                      }}>
                        {initials(p.full_name)}
                        {uc > 0 && (
                          <span style={{
                            position: "absolute", top: -2, right: -2,
                            minWidth: 18, height: 18, borderRadius: 999,
                            backgroundColor: "#E4002B", color: "#fff",
                            fontSize: 9, fontWeight: 900,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            padding: "0 3px", border: `2px solid ${uc > 0 ? T.active : T.card}`,
                          }}>
                            {uc > 9 ? "9+" : uc}
                          </span>
                        )}
                      </div>

                      {/* Infos */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <p style={{ fontSize: 14, fontWeight: uc > 0 ? 800 : 600, color: T.txt, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.full_name}
                          </p>
                          <span style={{ fontSize: 10, color: T.muted, flexShrink: 0, marginLeft: 8 }}>
                            {fmtRelTime(lastMsg.created_at)}
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: uc > 0 ? T.txt : T.sub, margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: uc > 0 ? 600 : 400 }}>
                          {lastMsg.sender_id === myId ? "Vous : " : ""}{previewMsg(lastMsg)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Nouveau message — membres sans conversation */}
            {newable.length > 0 && (
              <section>
                <p style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>
                  {filteredConvs.length > 0 ? "Nouveau message" : "Membres de l'équipe"}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {newable.map(p => (
                    <button key={p.id}
                      onClick={() => router.push(`/messages/${p.id}`)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        backgroundColor: T.card, border: `1px solid ${T.brd}`,
                        borderRadius: 14, padding: "12px 14px",
                        cursor: "pointer", textAlign: "left", width: "100%",
                      }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: "50%",
                        backgroundColor: isDark ? "#1a1a1a" : "#e0ede4",
                        border: `2px solid ${T.brd}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 800, color: T.sub, flexShrink: 0,
                      }}>
                        {initials(p.full_name)}
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: T.txt, margin: 0 }}>{p.full_name}</p>
                        <p style={{ fontSize: 11, color: "#009A44", margin: 0 }}>{p.role}</p>
                      </div>
                      <div style={{ marginLeft: "auto", flexShrink: 0 }}>
                        <svg width="16" height="16" fill="none" stroke={T.muted} strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {filteredConvs.length === 0 && newable.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <p style={{ fontSize: 40, marginBottom: 12 }}>💬</p>
                <p style={{ color: T.txt, fontWeight: 600, margin: 0 }}>Aucun résultat</p>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
