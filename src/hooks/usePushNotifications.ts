"use client";

import { createClient } from "@/lib/supabase/client";

// ── Helper : convertit la clé VAPID base64 en Uint8Array ─────
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

// ── Vérifie si les notifications push sont supportées ────────
export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// ── Demande la permission + abonne l'appareil ────────────────
export async function setupPushNotifications(): Promise<boolean> {
  if (!isPushSupported()) {
    console.log("[push] Non supporté sur ce navigateur/appareil");
    return false;
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    console.error("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY manquante — vérifier .env.local et Vercel");
    return false;
  }

  try {
    // 1. Demander la permission (doit être dans un contexte user-gesture)
    const permission = await Notification.requestPermission();
    console.log("[push] Permission :", permission);
    if (permission !== "granted") return false;

    // 2. Attendre le service worker
    const reg = await navigator.serviceWorker.ready;
    console.log("[push] Service worker prêt :", reg.scope);

    // 3. Vérifier si déjà abonné
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      console.log("[push] Abonnement existant — re-synchronisation");
      await saveSubscription(existing);
      return true;
    }

    // 4. Créer un nouvel abonnement
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
    console.log("[push] Nouvel abonnement créé :", sub.endpoint.slice(0, 60) + "…");

    // 5. Sauvegarder dans Supabase
    await saveSubscription(sub);
    return true;

  } catch (err) {
    console.error("[push] Erreur lors de l'abonnement :", err);
    return false;
  }
}

// ── Sauvegarde l'abonnement côté serveur ─────────────────────
async function saveSubscription(sub: PushSubscription): Promise<void> {
  try {
    // Récupérer le JWT depuis la session active (ne dépend pas des cookies serveur)
    const supabase = createClient();
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();

    if (sessionErr || !session?.access_token) {
      console.error("[push] Pas de session active — impossible de sauvegarder l'abonnement", sessionErr?.message);
      return;
    }

    console.log("[push] JWT récupéré, envoi vers /api/push/subscribe…");

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        userAgent: navigator.userAgent,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      console.error("[push] Erreur sauvegarde abonnement :", res.status, json);
    } else {
      console.log("[push] ✓ Abonnement sauvegardé en base");
    }
  } catch (err) {
    console.error("[push] Impossible de sauvegarder l'abonnement :", err);
  }
}

// ── Désabonne l'appareil ─────────────────────────────────────
export async function unsubscribePush(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
    console.log("[push] Désabonnement effectué");
  } catch (err) {
    console.warn("[push] Désabonnement impossible :", err);
  }
}

// ── Envoie une notification push via l'API ───────────────────
export async function sendPushTo(params: {
  userId?: string;
  toAll?: boolean;
  excludeUserId?: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<void> {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      console.warn("[push] sendPushTo : pas de session active");
      return;
    }
    const res = await fetch("/api/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId:        params.userId,
        toAll:         params.toAll,
        excludeUserId: params.excludeUserId,
        payload: {
          title: params.title,
          body:  params.body,
          url:   params.url  ?? "/dashboard",
          tag:   params.tag  ?? "lilz-notif",
        },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      console.warn("[push] Erreur envoi :", json);
    } else {
      console.log(`[push] ✓ ${json.sent ?? "?"} notification(s) envoyée(s)`);
    }
  } catch (err) {
    console.warn("[push] Envoi impossible :", err);
  }
}
