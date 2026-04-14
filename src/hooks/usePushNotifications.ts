"use client";

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
  if (!isPushSupported()) return false;

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    console.warn("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY manquante");
    return false;
  }

  try {
    // 1. Demander la permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    // 2. Attendre le service worker
    const reg = await navigator.serviceWorker.ready;

    // 3. Vérifier si déjà abonné
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      // Déjà abonné — re-synchroniser avec le serveur au cas où
      await saveSubscription(existing);
      return true;
    }

    // 4. Créer un nouvel abonnement
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    // 5. Sauvegarder dans Supabase via l'API route
    await saveSubscription(sub);
    return true;

  } catch (err) {
    // iOS < 16.4, navigateur non compatible, ou permission refusée
    console.warn("[push] Abonnement impossible :", err);
    return false;
  }
}

// ── Sauvegarde l'abonnement côté serveur ─────────────────────
async function saveSubscription(sub: PushSubscription): Promise<void> {
  try {
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        userAgent: navigator.userAgent,
      }),
    });
  } catch (err) {
    console.warn("[push] Impossible de sauvegarder l'abonnement :", err);
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
    await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  } catch (err) {
    // Silencieux côté client — la notification n'est pas critique
    console.warn("[push] Envoi impossible :", err);
  }
}
