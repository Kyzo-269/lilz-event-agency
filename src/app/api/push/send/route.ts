import webpush from "web-push";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Configure VAPID une seule fois au démarrage du module
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
}

interface SendRequest {
  // Envoyer à un utilisateur spécifique
  userId?: string;
  // Envoyer à tous les membres (sauf l'expéditeur)
  toAll?: boolean;
  excludeUserId?: string;
  // Contenu de la notification
  payload: PushPayload;
}

export async function POST(req: NextRequest) {
  // Vérifier que les variables VAPID sont bien configurées
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return NextResponse.json({ error: "VAPID non configuré" }, { status: 503 });
  }

  try {
    const body = await req.json() as SendRequest;
    const { userId, toAll, excludeUserId, payload } = body;

    // Vérification auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    // Récupérer les abonnements cibles
    let query = supabase.from("push_subscriptions").select("endpoint, p256dh, auth, user_id");

    if (userId) {
      // Un seul destinataire
      query = query.eq("user_id", userId);
    } else if (toAll) {
      // Tous les membres sauf l'expéditeur
      const excluded = excludeUserId ?? user.id;
      query = query.neq("user_id", excluded);
    } else {
      return NextResponse.json({ error: "userId ou toAll requis" }, { status: 400 });
    }

    const { data: subs, error: fetchErr } = await query;
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0 });

    // Payload serialisé
    const pushPayload = JSON.stringify({
      title: payload.title,
      body:  payload.body,
      icon:  payload.icon  ?? "/icons/icon-192.png",
      badge: payload.badge ?? "/icons/icon-72.png",
      url:   payload.url   ?? "/dashboard",
      tag:   payload.tag   ?? "lilz-notif",
    });

    // Envoyer à tous les abonnements en parallèle
    const results = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          pushPayload,
          { TTL: 3600 }   // notification valable 1h si l'appareil est hors-ligne
        )
      )
    );

    // Supprimer les abonnements expirés (code 410 = subscription expirée)
    const expiredEndpoints = results.flatMap((r, i) => {
      if (r.status === "rejected") {
        const code = (r.reason as { statusCode?: number })?.statusCode;
        if (code === 410 || code === 404) return [subs[i].endpoint];
      }
      return [];
    });

    if (expiredEndpoints.length > 0) {
      await supabase.from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);
    }

    const sent = results.filter(r => r.status === "fulfilled").length;
    return NextResponse.json({ ok: true, sent });

  } catch (err) {
    console.error("[push/send] Erreur :", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
