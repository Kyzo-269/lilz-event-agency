"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/ThemeProvider";
import { setupPushNotifications } from "@/hooks/usePushNotifications";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPwd, setShowPwd]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Email ou mot de passe incorrect.");
      setLoading(false);
      return;
    }

    // Demander la permission de notifications push après connexion
    // (iOS 16.4+ PWA seulement — silencieux si non supporté)
    setupPushNotifications().catch(() => {});

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div
      className="min-h-dvh flex flex-col safe-top safe-bottom"
      style={{ backgroundColor: isDark ? "#080808" : "#ffffff" }}
    >
      {/* Fond décoratif : lueur verte subtile en haut */}
      <div
        style={{
          position: "fixed",
          top: -120,
          left: "50%",
          transform: "translateX(-50%)",
          width: 400,
          height: 300,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(0,154,68,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div
        className="relative z-10 flex flex-col items-center justify-between min-h-dvh px-6"
        style={{ gap: 0 }}
      >
        {/* ── Zone centrale ── */}
        <div
          className="flex-1 flex flex-col items-center justify-center w-full"
          style={{ maxWidth: 360, paddingTop: 48, paddingBottom: 32 }}
        >
          {/* Logo */}
          <div
            className="animate-fade-in"
            style={{
              marginBottom: 20,
              borderRadius: 20,
              overflow: "hidden",
              boxShadow: isDark ? "0 0 40px rgba(0,154,68,0.25), 0 8px 32px rgba(0,0,0,0.6)" : "0 4px 24px rgba(0,0,0,0.12)",
              border: "1.5px solid rgba(0,154,68,0.35)",
            }}
          >
            <Image
              src="/logo.jpg"
              alt="LIL'Z EVENT AGENCY"
              width={100}
              height={100}
              className="object-cover block"
              priority
            />
          </div>

          {/* Titre */}
          <h1
            className="animate-fade-in"
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: isDark ? "#ffffff" : "#1a1a1a",
              letterSpacing: "-0.02em",
              textAlign: "center",
              lineHeight: 1.1,
              margin: 0,
              animationDelay: "0.05s",
            }}
          >
            LIL&apos;Z EVENT AGENCY
          </h1>
          <p
            className="animate-fade-in"
            style={{
              fontSize: 11,
              color: "#009A44",
              marginTop: 6,
              marginBottom: 28,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 600,
              animationDelay: "0.1s",
            }}
          >
            Espace équipe
          </p>

          {/* Bande décorative */}
          <div
            className="animate-fade-in"
            style={{
              display: "flex",
              width: "100%",
              height: 3,
              borderRadius: 999,
              overflow: "hidden",
              marginBottom: 28,
              animationDelay: "0.15s",
            }}
          >
            {["#009A44", "rgba(255,255,255,0.6)", "#E4002B", "#1E90FF", "#FFD700"].map((c, i) => (
              <div key={i} style={{ flex: 1, backgroundColor: c }} />
            ))}
          </div>

          {/* Formulaire */}
          <form
            onSubmit={handleLogin}
            className="animate-fade-in w-full"
            style={{ display: "flex", flexDirection: "column", gap: 16, animationDelay: "0.2s" }}
          >
            {/* Email */}
            <div>
              <label htmlFor="email" className="label">Adresse email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="prenom@lilzagency.fr"
                className="input"
              />
            </div>

            {/* Mot de passe + œil */}
            <div>
              <label htmlFor="password" className="label">Mot de passe</label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input"
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 4,
                    color: showPwd ? "#009A44" : isDark ? "#555" : "#999",
                    transition: "color 0.15s",
                    lineHeight: 0,
                  }}
                  aria-label={showPwd ? "Masquer" : "Afficher"}
                >
                  {showPwd ? (
                    /* Œil barré */
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                    </svg>
                  ) : (
                    /* Œil ouvert */
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Erreur */}
            {error && (
              <div
                style={{
                  borderRadius: 12,
                  backgroundColor: "rgba(228,0,43,0.08)",
                  border: "1px solid rgba(228,0,43,0.3)",
                  padding: "10px 14px",
                  fontSize: 13,
                  color: "#ff6b6b",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10A8 8 0 11.001 10 8 8 0 0118 10zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
                {error}
              </div>
            )}

            {/* Bouton */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ marginTop: 4, borderRadius: 14, fontSize: 15, fontWeight: 700, paddingTop: 14, paddingBottom: 14 }}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Connexion…
                </>
              ) : (
                "Se connecter"
              )}
            </button>
          </form>
        </div>

        {/* ── Pied de page ── */}
        <div style={{ width: "100%", textAlign: "center", paddingBottom: 20 }}>
          <p style={{ fontSize: 14, fontStyle: "italic", color: isDark ? "rgba(255,255,255,0.6)" : "#888888", fontWeight: 300, letterSpacing: "0.02em" }}>
            Chaque instant marque l&apos;histoire
          </p>
          <p style={{ fontSize: 11, color: isDark ? "#666" : "#aaaaaa", marginTop: 4 }}>
            Développée par{" "}
            <span style={{ color: "#009A44", fontWeight: 600 }}>Kylian Cheikh Ahmed</span>
          </p>
        </div>
      </div>
    </div>
  );
}
