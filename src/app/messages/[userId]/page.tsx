"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/lib/ThemeProvider";
import { sendPushTo } from "@/hooks/usePushNotifications";

// ── Types ─────────────────────────────────────────────────────
interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  media_url: string | null;
  media_type: "image" | "audio" | null;
  read_at: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

// ── Helpers ───────────────────────────────────────────────────
function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDay(ts: string) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function initials(name: string) {
  return name.split(" ").map(w => w[0] ?? "").slice(0, 2).join("").toUpperCase();
}

// Son de notification (Web Audio API)
function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // ignore — pas de son si le navigateur bloque
  }
}

// Notification navigateur
function showNotif(title: string, body: string) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/logo.jpg", badge: "/logo.jpg" });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(perm => {
      if (perm === "granted") new Notification(title, { body, icon: "/logo.jpg" });
    });
  }
}

// ── Composant principal ───────────────────────────────────────
export default function ConversationPage() {
  const params   = useParams();
  const router   = useRouter();
  const supabase = createClient();
  const { theme } = useTheme();
  const isDark   = theme === "dark";

  const T = {
    bg:          isDark ? "#0a0a0a"              : "#f5f5f5",
    header:      isDark ? "rgba(10,10,10,0.97)"  : "rgba(255,255,255,0.97)",
    brd:         isDark ? "#1f3d25"              : "#e0e8e2",
    txt:         isDark ? "#ffffff"              : "#111111",
    sub:         isDark ? "#666666"              : "#888888",
    inputBg:     isDark ? "#111111"              : "#ffffff",
    myBubble:    isDark ? "#0d2b15"              : "rgba(0,154,68,0.09)",
    myBubbleBrd: isDark ? "#1f5c30"              : "#b0d8be",
    othBubble:   isDark ? "#1a1a1a"              : "#ffffff",
    othBrd:      isDark ? "#2a2a2a"              : "#e0e0e0",
    dayBg:       isDark ? "#111111"              : "#e8e8e8",
    toolbarBg:   isDark ? "#111111"              : "#f0f0f0",
    muted:       isDark ? "#555555"              : "#aaaaaa",
  };

  const otherId     = params.userId as string;
  const [me, setMe]           = useState<Profile | null>(null);
  const [other, setOther]     = useState<Profile | null>(null);
  const [messages, setMsgs]   = useState<DirectMessage[]>([]);
  const [input, setInput]     = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Enregistrement vocal
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const mediaRecRef  = useRef<MediaRecorder | null>(null);
  const audioChunks  = useRef<Blob[]>([]);
  const recTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRecording  = useRef(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // ── Fetch initial ─────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const [{ data: meData }, { data: otherData }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, role").eq("id", user.id).single(),
      supabase.from("profiles").select("id, full_name, role").eq("id", otherId).single(),
    ]);
    if (meData) setMe(meData as Profile);
    if (otherData) setOther(otherData as Profile);

    const { data: msgs } = await supabase
      .from("direct_messages")
      .select("*")
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),` +
        `and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true });

    if (msgs) setMsgs(msgs as DirectMessage[]);

    // Marquer comme lus
    await supabase
      .from("direct_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("sender_id", otherId)
      .eq("receiver_id", user.id)
      .is("read_at", null);

    setLoading(false);
  }, [supabase, otherId, router]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Scroll bas
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Demander permission notif au montage
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // ── Realtime ──────────────────────────────────────────────
  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel(`dm-${[me.id, otherId].sort().join("-")}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, payload => {
        const msg = payload.new as DirectMessage;
        const mine   = msg.sender_id === me.id && msg.receiver_id === otherId;
        const theirs = msg.sender_id === otherId && msg.receiver_id === me.id;
        if (mine || theirs) {
          setMsgs(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
          if (theirs) {
            supabase.from("direct_messages").update({ read_at: new Date().toISOString() }).eq("id", msg.id);
            playNotifSound();
            showNotif(other?.full_name ?? "Message", msg.content || (msg.media_type === "image" ? "📷 Photo" : "🎤 Vocal"));
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, me, other, otherId]);

  // ── Envoi texte ───────────────────────────────────────────
  async function sendText() {
    const text = input.trim();
    if (!text || !me || sending) return;
    setSending(true);
    const optimistic: DirectMessage = {
      id: `tmp-${Date.now()}`, sender_id: me.id, receiver_id: otherId,
      content: text, media_url: null, media_type: null,
      read_at: null, created_at: new Date().toISOString(),
    };
    setMsgs(prev => [...prev, optimistic]);
    setInput("");
    const { data } = await supabase.from("direct_messages").insert({
      sender_id: me.id, receiver_id: otherId, content: text,
    }).select().single();
    if (data) setMsgs(prev => prev.map(m => m.id === optimistic.id ? (data as DirectMessage) : m));
    setSending(false);
    inputRef.current?.focus();

    // Notification push au destinataire
    sendPushTo({
      userId: otherId,
      title: `💬 ${me.full_name}`,
      body: text.length > 80 ? text.slice(0, 80) + "…" : text,
      url: `/messages/${me.id}`,
      tag: `msg-${me.id}`,
    });
  }

  // ── Envoi média (photo ou audio) ─────────────────────────
  async function sendMedia(file: File) {
    if (!me || uploadingMedia) return;
    setUploadingMedia(true);
    const isImg = file.type.startsWith("image/");
    // Determine extension — iOS records audio/mp4, Android uses audio/webm
    let ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || ext === "blob") {
      if (file.type.includes("mp4") || file.type.includes("m4a")) ext = "mp4";
      else if (file.type.includes("webm")) ext = "webm";
      else if (file.type.includes("ogg")) ext = "ogg";
      else ext = isImg ? "jpg" : "mp4";
    }
    const path = `${me.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("chat-private-media")
      .upload(path, file, { contentType: file.type || (isImg ? "image/jpeg" : "audio/mp4"), upsert: false });
    if (upErr) {
      console.error("Erreur upload média :", upErr.message);
      alert(`Erreur envoi : ${upErr.message}`);
      setUploadingMedia(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("chat-private-media").getPublicUrl(path);
    const { error: dbErr } = await supabase.from("direct_messages").insert({
      sender_id: me.id, receiver_id: otherId,
      content: "", media_url: publicUrl,
      media_type: isImg ? "image" : "audio",
    });
    if (dbErr) console.error("Erreur insert message :", dbErr.message);
    setUploadingMedia(false);

    // Notification push au destinataire
    sendPushTo({
      userId: otherId,
      title: `${isImg ? "📷" : "🎙️"} ${me?.full_name ?? ""}`,
      body:  isImg ? "vous a envoyé une photo" : "vous a envoyé un message vocal",
      url:   `/messages/${me?.id}`,
      tag:   `msg-${me?.id}`,
    });
  }

  // ── Enregistrement vocal ──────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = MediaRecorder.isTypeSupported("audio/webm") ? { mimeType: "audio/webm" } : {};
      const mr = new MediaRecorder(stream, options);
      mediaRecRef.current = mr;
      audioChunks.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunks.current.push(e.data); };
      mr.start(100);
      isRecording.current = true;
      setRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch {
      alert("Microphone non disponible");
    }
  }

  async function stopRecording() {
    if (!mediaRecRef.current || !isRecording.current) return;
    isRecording.current = false;
    setRecording(false);
    if (recTimerRef.current) clearInterval(recTimerRef.current);

    await new Promise<void>(resolve => {
      mediaRecRef.current!.onstop = () => resolve();
      mediaRecRef.current!.stop();
      mediaRecRef.current!.stream.getTracks().forEach(t => t.stop());
    });

    if (recSeconds >= 1 && audioChunks.current.length > 0) {
      const mimeType = audioChunks.current[0].type || "audio/webm";
      const blob = new Blob(audioChunks.current, { type: mimeType });
      const ext  = mimeType.includes("webm") ? "webm" : "mp4";
      const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: mimeType });
      await sendMedia(file);
    }
    setRecSeconds(0);
  }

  // Touch/mouse long press sur le bouton micro
  function onMicPressStart(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
    longPressRef.current = setTimeout(() => {
      startRecording();
    }, 300);
  }

  function onMicPressEnd(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
    if (isRecording.current) stopRecording();
  }

  // ── Grouper par jour ─────────────────────────────────────
  const grouped: { day: string; msgs: DirectMessage[] }[] = [];
  messages.forEach(msg => {
    const day  = fmtDay(msg.created_at);
    const last = grouped[grouped.length - 1];
    if (!last || last.day !== day) grouped.push({ day, msgs: [msg] });
    else last.msgs.push(msg);
  });

  // ── Rendu ─────────────────────────────────────────────────
  return (
    <div style={{ backgroundColor: T.bg, height: "100dvh", display: "flex", flexDirection: "column" }}>

      {/* ── Header ── */}
      <header style={{
        flexShrink: 0,
        backgroundColor: T.header, borderBottom: `1px solid ${T.brd}`,
        padding: "10px 16px",
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 672, margin: "0 auto" }}>
          <button onClick={() => router.back()}
            style={{ color: T.sub, background: "none", border: "none", cursor: "pointer", padding: 4, lineHeight: 0, flexShrink: 0 }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          {other && (
            <>
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                backgroundColor: isDark ? "#1a1a1a" : "#e0ede4",
                border: "2px solid #009A44",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 800, color: "#009A44", flexShrink: 0,
              }}>
                {initials(other.full_name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: T.txt, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {other.full_name}
                </p>
                <p style={{ fontSize: 10, color: "#009A44", margin: 0 }}>{other.role}</p>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Bande */}
      <div style={{ display: "flex", height: 2, flexShrink: 0 }}>
        {["#009A44","rgba(255,255,255,0.5)","#E4002B","#1E90FF","#FFD700"].map((c,i) =>
          <div key={i} style={{ flex: 1, backgroundColor: c }} />
        )}
      </div>

      {/* ── Messages ── */}
      <div style={{
        flex: 1, overflowY: "auto",
        padding: "12px 16px 8px",
        display: "flex", flexDirection: "column",
      }}>
        {loading ? (
          <p style={{ textAlign: "center", color: T.sub, fontSize: 13, padding: "60px 0" }}>Chargement…</p>
        ) : messages.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
            <p style={{ fontSize: 48, marginBottom: 12 }}>💬</p>
            <p style={{ color: T.txt, fontWeight: 600, margin: 0, textAlign: "center" }}>
              Démarrez la conversation
            </p>
            <p style={{ color: T.sub, fontSize: 12, marginTop: 4, textAlign: "center" }}>
              avec {other?.full_name}
            </p>
          </div>
        ) : grouped.map(({ day, msgs }) => (
          <div key={day}>
            {/* Séparateur jour */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 8px" }}>
              <div style={{ flex: 1, height: 1, backgroundColor: T.brd }} />
              <span style={{ fontSize: 10, color: T.sub, fontWeight: 600, padding: "2px 10px", borderRadius: 999, backgroundColor: T.dayBg }}>
                {day}
              </span>
              <div style={{ flex: 1, height: 1, backgroundColor: T.brd }} />
            </div>

            {msgs.map(msg => {
              const isMine = msg.sender_id === me?.id;
              return (
                <div key={msg.id} style={{
                  display: "flex", justifyContent: isMine ? "flex-end" : "flex-start",
                  marginBottom: 5,
                }}>
                  <div style={{
                    maxWidth: "78%",
                    backgroundColor: isMine ? T.myBubble : T.othBubble,
                    border: `1px solid ${isMine ? T.myBubbleBrd : T.othBrd}`,
                    borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    padding: msg.media_type === "audio" ? "8px 10px" : (msg.media_type === "image" ? "4px 4px 8px 4px" : "8px 12px"),
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                    overflow: "hidden",
                  }}>
                    {/* Image */}
                    {msg.media_type === "image" && msg.media_url && (
                      <div style={{ marginBottom: 4 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={msg.media_url} alt="photo"
                          style={{ display: "block", maxWidth: "100%", maxHeight: 240, borderRadius: 12, cursor: "pointer", objectFit: "cover" }}
                          onClick={() => setLightbox(msg.media_url!)} />
                      </div>
                    )}

                    {/* Audio */}
                    {msg.media_type === "audio" && msg.media_url && (
                      <div style={{ marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 18 }}>🎤</span>
                        <audio src={msg.media_url} controls
                          style={{ height: 32, flex: 1, minWidth: 120, maxWidth: 200 }} />
                      </div>
                    )}

                    {/* Texte */}
                    {msg.content && (
                      <p style={{
                        fontSize: 13, color: T.txt, margin: 0,
                        lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word",
                        paddingTop: msg.media_type ? 2 : 0,
                        paddingLeft: msg.media_type === "image" ? 6 : 0,
                        paddingRight: msg.media_type === "image" ? 6 : 0,
                      }}>
                        {msg.content}
                      </p>
                    )}

                    {/* Heure + lu */}
                    <div style={{
                      display: "flex", alignItems: "center",
                      justifyContent: "flex-end", gap: 4,
                      marginTop: 3,
                      paddingLeft: msg.media_type === "image" ? 6 : 0,
                      paddingRight: msg.media_type === "image" ? 6 : 0,
                    }}>
                      <span style={{ fontSize: 10, color: T.sub }}>{fmtTime(msg.created_at)}</span>
                      {isMine && (
                        <span style={{ fontSize: 11, color: msg.read_at ? "#009A44" : T.sub, fontWeight: 700 }}>
                          {msg.read_at ? "✓✓" : "✓"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Barre de saisie ── */}
      <div style={{
        flexShrink: 0,
        backgroundColor: T.header, borderTop: `1px solid ${T.brd}`,
        padding: "8px 12px",
        paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
      }}>
        {/* Indicateur enregistrement vocal */}
        {recording && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            backgroundColor: isDark ? "#1a0005" : "#fff0f0",
            border: "1px solid #8a0015",
            borderRadius: 12, padding: "8px 14px", marginBottom: 8,
          }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#E4002B", display: "inline-block", animation: "blink 1s infinite" }} />
            <span style={{ fontSize: 13, color: "#E4002B", fontWeight: 700 }}>Enregistrement… {recSeconds}s</span>
            <span style={{ fontSize: 11, color: T.sub, marginLeft: "auto" }}>Relâchez pour envoyer</span>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", maxWidth: 672, margin: "0 auto" }}>

          {/* Bouton photo */}
          <label style={{
            width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
            backgroundColor: T.toolbarBg, border: `1px solid ${T.brd}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: uploadingMedia ? "default" : "pointer",
            opacity: uploadingMedia ? 0.5 : 1,
            color: T.sub,
          }}>
            {uploadingMedia ? (
              <span style={{ fontSize: 14 }}>⏳</span>
            ) : (
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <circle cx="12" cy="13" r="3"/>
              </svg>
            )}
            <input type="file" accept="image/*,image/heic" multiple style={{ display: "none" }}
              onChange={e => {
                const files = Array.from(e.target.files ?? []);
                files.forEach(f => sendMedia(f));
                e.target.value = "";
              }}
              disabled={uploadingMedia} />
          </label>

          {/* Input texte */}
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); }
            }}
            placeholder="Message…"
            disabled={recording}
            style={{
              flex: 1, padding: "10px 14px", borderRadius: 24,
              backgroundColor: T.inputBg, border: `1px solid ${T.brd}`,
              color: T.txt, fontSize: 14, outline: "none",
              opacity: recording ? 0.4 : 1,
            }}
          />

          {/* Bouton micro (long press) ou envoi */}
          {input.trim() ? (
            <button onClick={sendText} disabled={sending}
              style={{
                width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                backgroundColor: "#009A44", border: "none", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", opacity: sending ? 0.6 : 1, transition: "all 0.15s",
              }}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
              </svg>
            </button>
          ) : (
            <button
              onTouchStart={onMicPressStart}
              onTouchEnd={onMicPressEnd}
              onMouseDown={onMicPressStart}
              onMouseUp={onMicPressEnd}
              onMouseLeave={onMicPressEnd}
              style={{
                width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                backgroundColor: recording ? "#E4002B" : T.toolbarBg,
                border: `1px solid ${recording ? "#E4002B" : T.brd}`,
                color: recording ? "#fff" : T.sub,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "all 0.15s",
                userSelect: "none", WebkitUserSelect: "none",
              }}>
              <svg width="18" height="18" fill={recording ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
              </svg>
            </button>
          )}
        </div>

        <p style={{ fontSize: 9, color: T.muted, textAlign: "center", marginTop: 4 }}>
          Appui long sur 🎤 pour enregistrer un message vocal
        </p>
      </div>

      {/* ── Lightbox photo ── */}
      {lightbox && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 200, backgroundColor: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)}
            style={{ position: "absolute", top: 16, right: 16, width: 44, height: 44, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.12)", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            ✕
          </button>
          <a href={lightbox} download target="_blank" rel="noreferrer"
            style={{ position: "absolute", top: 16, left: 16, backgroundColor: "rgba(0,154,68,0.25)", border: "1px solid #009A44", color: "#009A44", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
            onClick={e => e.stopPropagation()}>
            ⬇ Télécharger
          </a>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt=""
            style={{ maxWidth: "92vw", maxHeight: "82vh", objectFit: "contain", borderRadius: 10 }}
            onClick={e => e.stopPropagation()} />
        </div>
      )}

      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  );
}
