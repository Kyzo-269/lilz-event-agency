"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/ui/BottomNav";
import { useTheme } from "@/lib/ThemeProvider";
import { sendPushTo } from "@/hooks/usePushNotifications";

// ── Types ─────────────────────────────────────────────────────
interface NoteReaction {
  id: string;
  user_id: string;
  emoji: string;
}

interface Note {
  id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  content: string;
  is_urgent: boolean;
  is_pinned: boolean;
  reply_to: string | null;
  reply_preview: string | null;
  audio_url: string | null;
  image_url: string | null;
  created_at: string;
  note_reactions: NoteReaction[];
}

interface ReplyTarget {
  id: string;
  author_name: string;
  content: string;
}

// ── Mentions ──────────────────────────────────────────────────
const ROLES_MENTIONABLES = [
  "@CEO", "@Chef de Projet", "@Community Manager", "@Site Manager",
  "@Advisor", "@Responsable Financier", "@Event Planner",
  "@Régisseur 1", "@Régisseur 2", "@Régisseur 3", "@Régisseur 4",
];

const EMOJIS_REACTION = ["👍", "❤️", "😂", "🔥", "👏", "😮"];

function renderContent(text: string) {
  return text.split(/(@\S+)/g).map((part, i) => {
    if (part.startsWith("@")) return <span key={i} style={{ color: "#1E90FF", fontWeight: 600 }}>{part}</span>;
    if (part.toUpperCase().includes("URGENT")) return <span key={i} style={{ color: "#ff6b6b", fontWeight: 700 }}>{part}</span>;
    return <span key={i}>{part}</span>;
  });
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) + " " +
         d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function roleColor(role: string): string {
  if (role === "CEO" || role === "Admin") return "#FFD700";
  if (role.includes("Régisseur")) return "#E4002B";
  if (role === "Responsable Financier") return "#009A44";
  if (role === "Chef de Projet Événementiel") return "#1E90FF";
  if (role === "Community Manager") return "#ff69b4";
  if (role === "Site Manager") return "#ff9a3c";
  if (role === "Event Planner") return "#22d3ee";
  return "#888";
}

// ── Composant ─────────────────────────────────────────────────
export default function NotesPage() {
  const supabase = createClient();

  const [notes, setNotes]             = useState<Note[]>([]);
  const [userId, setUserId]           = useState<string | null>(null);
  const [userRole, setUserRole]       = useState<string | null>(null);
  const [userName, setUserName]       = useState<string>("");
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [content, setContent]         = useState("");
  const [isUrgent, setIsUrgent]       = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [filterUrgent, setFilterUrgent] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);

  // Voice recording
  const [recording, setRecording]       = useState(false);
  const [audioBlob, setAudioBlob]       = useState<Blob | null>(null);
  const [recordSeconds, setRecordSecs]  = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const recordTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // Photo
  const [photoFile, setPhotoFile]       = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef  = useRef<HTMLInputElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const bottomRef      = useRef<HTMLDivElement>(null);

  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data: p } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();
      if (p) { setUserName(p.full_name); setUserRole(p.role); }
    }
    const { data } = await supabase
      .from("notes_internes")
      .select("*, note_reactions(id, user_id, emoji)")
      .order("created_at", { ascending: true });
    if (data) setNotes(data as Note[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [notes, loading]);

  // ── Tri : épinglés en haut ────────────────────────────────────
  const pinnedNotes   = notes.filter(n => n.is_pinned).sort((a,b) => a.created_at.localeCompare(b.created_at));
  const regularNotes  = notes.filter(n => !n.is_pinned).sort((a,b) => a.created_at.localeCompare(b.created_at));
  const filteredRegular = filterUrgent ? regularNotes.filter(n => n.is_urgent) : regularNotes;
  const displayed = [...pinnedNotes, ...filteredRegular];

  // ── Soumission texte ──────────────────────────────────────────
  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!content.trim() && !audioBlob && !photoFile) return;
    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return; }

    let finalAudioUrl: string | null = null;
    let finalImageUrl: string | null = null;

    // Upload audio si présent
    if (audioBlob) {
      // Détecter le vrai MIME type (audio/mp4 sur iOS, audio/webm ailleurs)
      const mime = audioBlob.type || "audio/mp4";
      const ext  = mime.includes("mp4") || mime.includes("m4a") ? "mp4"
                 : mime.includes("ogg") ? "ogg"
                 : "webm";
      const fileName = `${user.id}/audio_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("chat-media")
        .upload(fileName, audioBlob, { contentType: mime });
      if (upErr) {
        console.error("[notes] Erreur upload audio :", upErr.message);
        alert(`Erreur envoi vocal : ${upErr.message}`);
        setSubmitting(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(fileName);
      finalAudioUrl = publicUrl;
    }

    // Upload photo si présente
    if (photoFile) {
      const ext = photoFile.name.split(".").pop() ?? "jpg";
      const fileName = `${user.id}/img_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("chat-media").upload(fileName, photoFile, { contentType: photoFile.type });
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(fileName);
        finalImageUrl = publicUrl;
      }
    }

    const { error } = await supabase.from("notes_internes").insert({
      author_id: user.id,
      author_name: userName,
      author_role: userRole,
      content: content.trim() || (audioBlob ? "🎙️ Message vocal" : "📷 Photo"),
      is_urgent: isUrgent,
      is_pinned: false,
      reply_to: replyTarget?.id ?? null,
      reply_preview: replyTarget ? `${replyTarget.author_name}: ${replyTarget.content.slice(0, 80)}` : null,
      audio_url: finalAudioUrl,
      image_url: finalImageUrl,
    });

    if (!error) {
      setContent(""); setIsUrgent(false); setShowMentions(false);
      setReplyTarget(null); setAudioBlob(null); setPhotoFile(null); setPhotoPreview(null);
      await fetchAll();

      // Notification push → tous les membres sauf l'expéditeur
      {
        const preview = content.trim().slice(0, 80) || (audioBlob ? "Message vocal" : "Photo");
        const body = preview.length < content.trim().length ? preview + "…" : preview;
        sendPushTo({
          toAll: true,
          excludeUserId: user.id,
          title: isUrgent ? `🚨 URGENT — ${userName}` : `💬 ${userName}`,
          body,
          url: "/notes",
          tag: isUrgent ? "urgent-note" : "note",
        });
      }
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce message ?")) return;
    setNotes(prev => prev.filter(n => n.id !== id));
    await supabase.from("notes_internes").delete().eq("id", id);
  }

  async function togglePin(note: Note) {
    const newVal = !note.is_pinned;
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, is_pinned: newVal } : n));
    await supabase.from("notes_internes").update({ is_pinned: newVal }).eq("id", note.id);
  }

  async function toggleReaction(note: Note, emoji: string) {
    if (!userId) return;
    const existing = note.note_reactions.find(r => r.user_id === userId && r.emoji === emoji);
    if (existing) {
      setNotes(prev => prev.map(n =>
        n.id === note.id
          ? { ...n, note_reactions: n.note_reactions.filter(r => !(r.user_id === userId && r.emoji === emoji)) }
          : n
      ));
      await supabase.from("note_reactions").delete().eq("id", existing.id);
    } else {
      const tempId = crypto.randomUUID();
      setNotes(prev => prev.map(n =>
        n.id === note.id
          ? { ...n, note_reactions: [...n.note_reactions, { id: tempId, user_id: userId, emoji }] }
          : n
      ));
      await supabase.from("note_reactions").insert({ note_id: note.id, user_id: userId, emoji });
    }
  }

  function insertMention(mention: string) {
    const t = textareaRef.current;
    if (!t) return;
    const start = t.selectionStart;
    const newContent = content.slice(0, start) + mention + " " + content.slice(start);
    setContent(newContent);
    setShowMentions(false);
    setTimeout(() => { t.focus(); t.setSelectionRange(start + mention.length + 1, start + mention.length + 1); }, 0);
  }

  // ── Enregistrement vocal ──────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // iOS ne supporte pas audio/webm — détection automatique du format
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        // Utilise le vrai MIME type du recorder, pas un type hardcodé
        const actualType = mr.mimeType || mimeType || "audio/mp4";
        const blob = new Blob(audioChunksRef.current, { type: actualType });
        setAudioBlob(blob);
        stream.getTracks().forEach(t => t.stop());
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        setRecordSecs(0);
      };
      mr.start(100);
      setRecording(true);
      setRecordSecs(0);
      recordTimerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000);
    } catch {
      alert("Accès au microphone refusé ou non disponible.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  function cancelRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    setAudioBlob(null);
    setRecordSecs(0);
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
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
    msgSelf:   isDark ? "#0d1a10"             : "rgba(0,154,68,0.06)",
    msgOther:  isDark ? "#111111"             : "#f8f8f8",
  };

  const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, backgroundColor: T.inp, border: `1px solid ${T.brd}`, color: T.txt, fontSize: 13, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ backgroundColor: T.bg, minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes pulse-red{0%,100%{opacity:1}50%{opacity:0.4}}
        .pulse{animation:pulse-red 1.4s ease-in-out infinite}
        @keyframes rec-pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        .rec-dot{animation:rec-pulse 1s ease-in-out infinite}
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
              <p style={{ fontSize: 12, fontWeight: 800, color: T.txt, lineHeight: 1.1, margin: 0 }}>💬 Notes Internes</p>
              <p style={{ fontSize: 10, color: "#009A44", margin: 0, marginTop: 2 }}>LIL&apos;Z EVENT AGENCY</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setFilterUrgent(v => !v)}
              style={{ fontSize: 11, fontWeight: 700, color: filterUrgent ? "#fff" : "#ff6b6b", border: `1px solid ${filterUrgent ? "#E4002B" : "#8a0015"}`, backgroundColor: filterUrgent ? "#E4002B" : "transparent", padding: "4px 10px", borderRadius: 8, cursor: "pointer" }}>
              🔴 URGENT
            </button>
            <LogoutBtn supabase={supabase} />
          </div>
        </div>
      </header>

      {/* Bande */}
      <div style={{ display: "flex", height: 2 }}>
        {["#009A44","rgba(255,255,255,0.5)","#E4002B","#1E90FF","#FFD700"].map((c,i)=><div key={i} style={{flex:1,backgroundColor:c}}/>)}
      </div>

      {/* Compteurs */}
      <div style={{ maxWidth: 672, margin: "16px auto 0", width: "100%", padding: "0 16px", display: "flex", gap: 10 }}>
        {[
          { label: "Messages", value: notes.length,                               color: T.txt    },
          { label: "Urgents",  value: notes.filter(n => n.is_urgent).length,      color: "#ff6b6b" },
          { label: "Épinglés", value: notes.filter(n => n.is_pinned).length,      color: "#FFD700" },
          { label: "Membres",  value: new Set(notes.map(n => n.author_id)).size,  color: "#1E90FF" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ flex: 1, backgroundColor: T.card, border: `1px solid ${T.brd}`, borderRadius: 12, padding: "10px 6px", textAlign: "center" }}>
            <p style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1, margin: 0 }}>{value}</p>
            <p style={{ fontSize: 8, color: T.sub, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Liste de messages */}
      <main style={{ flex: 1, maxWidth: 672, margin: "0 auto", width: "100%", padding: "16px 16px 0" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: T.sub, fontSize: 13, padding: "40px 0" }}>Chargement…</p>
        ) : displayed.length === 0 ? (
          <div style={{ backgroundColor: T.card, border: `1px solid ${T.brd}`, borderRadius: 16, padding: "48px 20px", textAlign: "center" }}>
            <p style={{ fontSize: 40, margin: "0 0 10px" }}>💬</p>
            <p style={{ color: T.sub, fontSize: 13, margin: 0 }}>{filterUrgent ? "Aucun message urgent" : "Aucun message — soyez le premier !"}</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Séparateur épinglés */}
            {pinnedNotes.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ height: 1, flex: 1, backgroundColor: "#665800" }} />
                <span style={{ fontSize: 10, color: "#FFD700", fontWeight: 700 }}>📌 Épinglés</span>
                <div style={{ height: 1, flex: 1, backgroundColor: "#665800" }} />
              </div>
            )}

            {displayed.map((note, noteIdx) => {
              // Séparateur entre épinglés et non-épinglés
              const showSep = note.id === filteredRegular[0]?.id && pinnedNotes.length > 0;
              const isMine = note.author_id === userId;
              const color = roleColor(note.author_role);

              // Grouper les réactions par emoji
              const reactionMap: Record<string, { count: number; hasMe: boolean }> = {};
              note.note_reactions.forEach(r => {
                if (!reactionMap[r.emoji]) reactionMap[r.emoji] = { count: 0, hasMe: false };
                reactionMap[r.emoji].count++;
                if (r.user_id === userId) reactionMap[r.emoji].hasMe = true;
              });

              return (
                <div key={note.id}>
                  {showSep && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div style={{ height: 1, flex: 1, backgroundColor: T.brd }} />
                      <span style={{ fontSize: 10, color: T.sub, fontWeight: 700 }}>Messages</span>
                      <div style={{ height: 1, flex: 1, backgroundColor: T.brd }} />
                    </div>
                  )}
                  <div
                    className={note.is_urgent && !note.is_pinned ? "pulse" : ""}
                    style={{
                      backgroundColor: note.is_pinned ? (isDark ? "#1a1400" : "#fffcee") : note.is_urgent ? (isDark ? "#120005" : "#fff0f0") : isMine ? T.msgSelf : T.msgOther,
                      border: `1px solid ${note.is_pinned ? "#665800" : note.is_urgent ? "#8a0015" : isMine ? (isDark ? "#1f5c30" : "#b0d8be") : T.brd}`,
                      borderRadius: 14, padding: 12,
                      alignSelf: isMine ? "flex-end" : "flex-start",
                      maxWidth: "92%",
                      animation: `fadeInUp 0.3s ${noteIdx * 0.02}s ease-out both`,
                    }}>

                    {/* Auteur */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: color + "22", border: `1px solid ${color}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color }}>{initials(note.author_name)}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.txt }}>{note.author_name}</span>
                        <span style={{ fontSize: 10, color: T.sub, marginLeft: 6 }}>{note.author_role}</span>
                      </div>
                      {note.is_urgent && <span style={{ fontSize: 9, fontWeight: 700, backgroundColor: "#E4002B", color: "#fff", padding: "2px 6px", borderRadius: 999 }}>URGENT</span>}
                      {note.is_pinned && <span style={{ fontSize: 10 }}>📌</span>}
                    </div>

                    {/* Citation de réponse */}
                    {note.reply_preview && (
                      <div style={{ backgroundColor: T.inp, border: `1px solid ${T.brd}`, borderLeft: "3px solid #1E90FF", borderRadius: 8, padding: "6px 10px", marginBottom: 8 }}>
                        <p style={{ fontSize: 11, color: "#1E90FF", margin: 0, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          ↩ {note.reply_preview}
                        </p>
                      </div>
                    )}

                    {/* Contenu texte */}
                    {note.content && note.content !== "🎙️ Message vocal" && note.content !== "📷 Photo" && (
                      <p style={{ fontSize: 13, color: T.txt, lineHeight: 1.5, margin: 0, wordBreak: "break-word" }}>
                        {renderContent(note.content)}
                      </p>
                    )}

                    {/* Audio */}
                    {note.audio_url && (
                      <div style={{ marginTop: 6 }}>
                        <p style={{ fontSize: 11, color: T.sub, margin: "0 0 4px" }}>🎙️ Message vocal</p>
                        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                        <audio controls src={note.audio_url} style={{ width: "100%", height: 36, borderRadius: 8 }} />
                      </div>
                    )}

                    {/* Image */}
                    {note.image_url && (
                      <div style={{ marginTop: 6 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={note.image_url} alt="Photo" style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 10, objectFit: "cover", display: "block" }} />
                      </div>
                    )}

                    {/* Réactions */}
                    {Object.keys(reactionMap).length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                        {Object.entries(reactionMap).map(([emoji, { count, hasMe }]) => (
                          <button key={emoji} onClick={() => toggleReaction(note, emoji)}
                            style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, border: `1px solid ${hasMe ? "#009A44" : T.brd}`, backgroundColor: hasMe ? (isDark ? "#001a0d" : "rgba(0,154,68,0.08)") : T.card, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                            <span>{emoji}</span>
                            <span style={{ fontSize: 11, color: hasMe ? "#009A44" : T.sub, fontWeight: 700 }}>{count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Bas */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, color: T.muted }}>{fmtDateTime(note.created_at)}</span>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {/* Ajouter une réaction */}
                        <div style={{ position: "relative", display: "inline-block" }}>
                          <ReactionPicker onPick={emoji => toggleReaction(note, emoji)} />
                        </div>
                        {/* Répondre */}
                        <button onClick={() => setReplyTarget({ id: note.id, author_name: note.author_name, content: note.content })}
                          style={{ fontSize: 11, color: "#1E90FF", background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}>↩</button>
                        {/* Épingler */}
                        <button onClick={() => togglePin(note)}
                          style={{ fontSize: 11, color: note.is_pinned ? "#FFD700" : T.muted, background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}>📌</button>
                        {/* Supprimer (auteur) */}
                        {isMine && (
                          <button onClick={() => handleDelete(note.id)}
                            style={{ fontSize: 11, color: "#555", background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}>🗑️</button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      {/* Zone de saisie */}
      <div style={{ position: "sticky", bottom: 0, backgroundColor: T.headerBg, borderTop: `1px solid ${T.brd}`, padding: "12px 16px", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        <div style={{ maxWidth: 672, margin: "0 auto" }}>

          {/* Répondre à */}
          {replyTarget && (
            <div style={{ backgroundColor: "#001428", border: "1px solid #0a4a8a", borderLeft: "3px solid #1E90FF", borderRadius: 8, padding: "6px 10px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontSize: 11, color: "#1E90FF", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                ↩ Répondre à <strong>{replyTarget.author_name}</strong> : {replyTarget.content.slice(0, 60)}
              </p>
              <button onClick={() => setReplyTarget(null)} style={{ fontSize: 14, color: "#555", background: "none", border: "none", cursor: "pointer", flexShrink: 0, marginLeft: 8 }}>✕</button>
            </div>
          )}

          {/* Prévisualisation audio */}
          {audioBlob && !recording && (
            <div style={{ backgroundColor: "#001428", border: "1px solid #0a4a8a", borderRadius: 8, padding: "8px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: "#1E90FF" }}>🎙️ Message vocal prêt</span>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio controls src={URL.createObjectURL(audioBlob)} style={{ height: 28, flex: 1 }} />
              <button onClick={() => setAudioBlob(null)} style={{ fontSize: 14, color: "#555", background: "none", border: "none", cursor: "pointer" }}>✕</button>
            </div>
          )}

          {/* Prévisualisation photo */}
          {photoPreview && (
            <div style={{ backgroundColor: "#001428", border: "1px solid #0a4a8a", borderRadius: 8, padding: "8px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoPreview} alt="Preview" style={{ height: 50, width: 50, objectFit: "cover", borderRadius: 6 }} />
              <span style={{ fontSize: 12, color: "#1E90FF", flex: 1 }}>Photo sélectionnée</span>
              <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); if (photoInputRef.current) photoInputRef.current.value = ""; }}
                style={{ fontSize: 14, color: "#555", background: "none", border: "none", cursor: "pointer" }}>✕</button>
            </div>
          )}

          {/* En cours d'enregistrement */}
          {recording && (
            <div style={{ backgroundColor: "#1a0005", border: "1px solid #E4002B", borderRadius: 8, padding: "8px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
              <span className="rec-dot" style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#E4002B", display: "inline-block" }} />
              <span style={{ fontSize: 12, color: "#ff6b6b", fontWeight: 700 }}>Enregistrement {recordSeconds}s</span>
              <button onClick={stopRecording} style={{ marginLeft: "auto", fontSize: 11, color: "#fff", backgroundColor: "#E4002B", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
                ⏹ Arrêter
              </button>
              <button onClick={cancelRecording} style={{ fontSize: 11, color: "#888", background: "none", border: "none", cursor: "pointer" }}>Annuler</button>
            </div>
          )}

          {/* Barre outils */}
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setShowMentions(v => !v)}
              style={{ fontSize: 11, color: "#1E90FF", border: "1px solid #0a4a8a", backgroundColor: showMentions ? "#001428" : "transparent", padding: "4px 10px", borderRadius: 8, cursor: "pointer" }}>
              @ Mentionner
            </button>
            <button type="button" onClick={() => setIsUrgent(v => !v)}
              style={{ fontSize: 11, fontWeight: 700, color: isUrgent ? "#fff" : "#ff6b6b", border: `1px solid ${isUrgent ? "#E4002B" : "#8a0015"}`, backgroundColor: isUrgent ? "#E4002B" : "transparent", padding: "4px 10px", borderRadius: 8, cursor: "pointer" }}>
              🔴 {isUrgent ? "URGENT ✓" : "Urgent ?"}
            </button>
            {/* Bouton micro */}
            {!recording && !audioBlob && (
              <button type="button" onClick={startRecording}
                style={{ fontSize: 11, color: "#888", border: "1px solid #333", padding: "4px 10px", borderRadius: 8, cursor: "pointer", backgroundColor: "transparent" }}>
                🎙️ Vocal
              </button>
            )}
            {/* Bouton photo */}
            <button type="button" onClick={() => photoInputRef.current?.click()}
              style={{ fontSize: 11, color: "#888", border: "1px solid #333", padding: "4px 10px", borderRadius: 8, cursor: "pointer", backgroundColor: "transparent" }}>
              📷 Photo
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoSelect} />
          </div>

          {/* Dropdown mentions */}
          {showMentions && (
            <div style={{ backgroundColor: T.card, border: `1px solid ${T.brd}`, borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
              {ROLES_MENTIONABLES.map(m => (
                <button key={m} type="button" onClick={() => insertMention(m)}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 12, color: "#1E90FF", background: "none", border: "none", cursor: "pointer", borderBottom: `1px solid ${T.brd}` }}>
                  {m}
                </button>
              ))}
            </div>
          )}

          {/* Zone de texte + envoyer */}
          <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              ref={textareaRef}
              rows={2}
              value={content}
              onChange={e => setContent(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e as unknown as React.FormEvent); } }}
              placeholder={audioBlob || photoFile ? "Ajouter un texte (optionnel)…" : "Écris un message…"}
              style={{ flex: 1, padding: "10px 12px", borderRadius: 10, backgroundColor: T.card, border: `1px solid ${isUrgent ? "#E4002B" : T.brd}`, color: T.txt, fontSize: 13, outline: "none", resize: "none", lineHeight: 1.4 }}
            />
            <button type="submit" disabled={submitting || (!content.trim() && !audioBlob && !photoFile)}
              style={{ flexShrink: 0, padding: "10px 14px", borderRadius: 10, backgroundColor: "#009A44", color: "#fff", fontSize: 18, border: "none", cursor: "pointer", opacity: (submitting || (!content.trim() && !audioBlob && !photoFile)) ? 0.4 : 1 }}>
              {submitting ? "…" : "➤"}
            </button>
          </form>
        </div>
      </div>

      <div style={{ height: "calc(64px + env(safe-area-inset-bottom))" }} />
      <BottomNav />
    </div>
  );
}

// ── Composant picker de réactions ────────────────────────────
function ReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ fontSize: 11, color: "#555", background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}>
        😊
      </button>
      {open && (
        <div style={{ position: "absolute", bottom: "100%", left: 0, backgroundColor: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: "6px 8px", display: "flex", gap: 4, zIndex: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          {EMOJIS_REACTION.map(emoji => (
            <button key={emoji} onClick={() => { onPick(emoji); setOpen(false); }}
              style={{ fontSize: 18, background: "none", border: "none", cursor: "pointer", borderRadius: 6, padding: 2 }}>
              {emoji}
            </button>
          ))}
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
