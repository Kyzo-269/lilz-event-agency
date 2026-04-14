import webpush from "web-push";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
}

interface SendRequest {
  userId?: string;
  toAll?: boolean;
  excludeUserId?: string;
  payload: PushPayload;
}

export async function POST(req: NextRequest) {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  // ── Vérification VAPID ────────────────────────────────────────
  if (!subject || !publicKey || !privateKey) {
    console.error("[push/send] VAPID manquant :", {
      subject: !!subject,
      publicKey: !!publicKey,
      privateKey: !!privateKey,
    });
    return NextResponse.json({ error: "VAPID non configuré" }, { status: 503 });
  }

  // setVapidDetails ici (pas au niveau module) pour éviter un crash au démarrage
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch (err) {
    console.error("[push/send] setVapidDetails failed:", err);
    return NextResponse.json({ error: "VAPID invalide", detail: String(err) }, { status: 503 });
  }

  try {
    const body = await req.json() as SendRequest;
    const { userId, toAll, excludeUserId, payload } = body;

    console.log("[push/send] Requête reçue :", { userId, toAll, excludeUserId, title: payload?.title });

    // ── Auth ──────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      console.error("[push/send] Non authentifié :", authErr?.message);
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // ── Récupérer les abonnements ─────────────────────────────────
    let query = supabase.from("push_subscriptions").select("endpoint, p256dh, auth, user_id");

    if (userId) {
      query = query.eq("user_id", userId);
    } else if (toAll) {
      const excluded = excludeUserId ?? user.id;
      query = query.neq("user_id", excluded);
    } else {
      return NextResponse.json({ error: "userId ou toAll requis" }, { status: 400 });
    }

    const { data: subs, error: fetchErr } = await query;

    if (fetchErr) {
      console.error("[push/send] Erreur lecture push_subscriptions :", fetchErr.message);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    console.log(`[push/send] ${subs?.length ?? 0} abonnement(s) trouvé(s)`);

    if (!subs || subs.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, reason: "Aucun abonné" });
    }

    // ── Payload ───────────────────────────────────────────────────
    const pushPayload = JSON.stringify({
      title: payload.title,
      body:  payload.body,
      icon:  payload.icon  ?? "/icons/icon-192.png",
      badge: payload.badge ?? "/icons/icon-72.png",
      url:   payload.url   ?? "/dashboard",
      tag:   payload.tag   ?? "lilz-notif",
    });

    // ── Envoi en parallèle ────────────────────────────────────────
    const results = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          pushPayload,
          { TTL: 3600 }
        )
      )
    );

    // ── Log des résultats ─────────────────────────────────────────
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        console.log(`[push/send] ✓ Envoyé à ${subs[i].endpoint.slice(0, 60)}…`);
      } else {
        const code = (r.reason as { statusCode?: number })?.statusCode;
        console.warn(`[push/send] ✗ Échec (${code}) : ${String(r.reason).slice(0, 120)}`);
      }
    });

    // ── Nettoyer les abonnements expirés (410 / 404) ──────────────
    const expiredEndpoints = results.flatMap((r, i) => {
      if (r.status === "rejected") {
        const code = (r.reason as { statusCode?: number })?.statusCode;
        if (code === 410 || code === 404) return [subs[i].endpoint];
      }
      return [];
    });

    if (expiredEndpoints.length > 0) {
      console.log(`[push/send] Suppression de ${expiredEndpoints.length} abonnement(s) expiré(s)`);
      await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
    }

    const sent = results.filter(r => r.status === "fulfilled").length;
    console.log(`[push/send] Résultat final : ${sent}/${subs.length} envoyé(s)`);
    return NextResponse.json({ ok: true, sent, total: subs.length });

  } catch (err) {
    console.error("[push/send] Erreur inattendue :", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
