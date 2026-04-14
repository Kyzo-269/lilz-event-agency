import webpush from "web-push";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ── GET /api/push/test ────────────────────────────────────────
// Ouvrir cette URL dans un navigateur pour diagnostiquer
// et envoyer une notification de test à tous les abonnés.
export async function GET() {
  const subject    = process.env.VAPID_SUBJECT;
  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  const vapidOk = !!(subject && publicKey && privateKey);
  const diag: Record<string, unknown> = {
    vapid: {
      VAPID_SUBJECT:                  subject         ? "✓ défini" : "✗ MANQUANT",
      NEXT_PUBLIC_VAPID_PUBLIC_KEY:   publicKey       ? "✓ défini" : "✗ MANQUANT",
      VAPID_PRIVATE_KEY:              privateKey      ? "✓ défini" : "✗ MANQUANT",
      publicKeyPrefix:                publicKey?.slice(0, 20) ?? "—",
    },
  };

  if (!vapidOk) {
    return NextResponse.json({ ok: false, error: "VAPID non configuré", diag }, { status: 503 });
  }

  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  diag.auth = user ? `✓ connecté (${user.email})` : "✗ non authentifié — ouvre cette URL après connexion";

  if (!user) {
    return NextResponse.json({ ok: false, error: "Non authentifié", diag }, { status: 401 });
  }

  // Lire les abonnements
  const { data: subs, error: fetchErr } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, user_id, user_agent");

  if (fetchErr) {
    diag.supabase = `✗ Erreur lecture push_subscriptions : ${fetchErr.message}`;
    return NextResponse.json({ ok: false, diag }, { status: 500 });
  }

  diag.subscriptions = {
    total: subs?.length ?? 0,
    list: subs?.map(s => ({
      user_id: s.user_id,
      endpoint: s.endpoint.slice(0, 60) + "…",
      ua: s.user_agent?.slice(0, 40) ?? "—",
    })) ?? [],
  };

  if (!subs || subs.length === 0) {
    return NextResponse.json({
      ok: false,
      error: "Aucun abonnement — l'utilisateur n'a pas encore accepté les notifications ou la table push_subscriptions est vide",
      diag,
    });
  }

  // Configurer VAPID
  webpush.setVapidDetails(subject!, publicKey!, privateKey!);

  const payload = JSON.stringify({
    title: "🔔 Test LIL'Z EVENT AGENCY",
    body:  "Les notifications push fonctionnent !",
    icon:  "/icons/icon-192.png",
    badge: "/icons/icon-72.png",
    url:   "/dashboard",
    tag:   "push-test",
  });

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 300 }
      )
    )
  );

  const details = results.map((r, i) => ({
    user_id: subs[i].user_id,
    endpoint: subs[i].endpoint.slice(0, 60) + "…",
    status: r.status === "fulfilled" ? "✓ envoyé" : `✗ échec (${(r.reason as { statusCode?: number })?.statusCode ?? "?"}) : ${String((r as PromiseRejectedResult).reason).slice(0, 100)}`,
  }));

  // Supprimer les abonnements expirés
  const expired = results.flatMap((r, i) => {
    if (r.status === "rejected") {
      const code = (r.reason as { statusCode?: number })?.statusCode;
      if (code === 410 || code === 404) return [subs[i].endpoint];
    }
    return [];
  });
  if (expired.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", expired);
  }

  const sent = results.filter(r => r.status === "fulfilled").length;
  return NextResponse.json({
    ok: sent > 0,
    sent,
    total: subs.length,
    expired: expired.length,
    details,
    diag,
  });
}
