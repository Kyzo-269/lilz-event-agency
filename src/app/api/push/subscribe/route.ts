import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Crée un client Supabase avec un JWT utilisateur (bypass cookies)
function makeClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

// ── POST : enregistre un abonnement push ──────────────────────
export async function POST(req: NextRequest) {
  try {
    // 1. Lire le JWT depuis le header Authorization
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      console.error("[push/subscribe] Header Authorization manquant");
      return NextResponse.json({ error: "Authorization manquant" }, { status: 401 });
    }

    // 2. Valider le token et obtenir l'utilisateur
    const supabase = makeClient(token);
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      console.error("[push/subscribe] Token invalide :", authErr?.message ?? "user null");
      return NextResponse.json({ error: "Token invalide", detail: authErr?.message }, { status: 401 });
    }

    console.log("[push/subscribe] ✓ Utilisateur authentifié :", user.id, user.email);

    // 3. Lire le corps
    const body = await req.json() as {
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
      userAgent?: string;
    };
    const { subscription, userAgent } = body;

    console.log("[push/subscribe] Subscription reçue :", {
      endpoint: subscription?.endpoint?.slice(0, 60) + "…",
      hasP256dh: !!subscription?.keys?.p256dh,
      hasAuth: !!subscription?.keys?.auth,
    });

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      console.error("[push/subscribe] Subscription invalide");
      return NextResponse.json({ error: "Subscription invalide" }, { status: 400 });
    }

    // 4. Upsert dans push_subscriptions
    const { error: dbErr } = await supabase.from("push_subscriptions").upsert({
      user_id:    user.id,
      endpoint:   subscription.endpoint,
      p256dh:     subscription.keys.p256dh,
      auth:       subscription.keys.auth,
      user_agent: userAgent ?? null,
    }, { onConflict: "user_id,endpoint" });

    if (dbErr) {
      console.error("[push/subscribe] Erreur Supabase upsert :", dbErr.message, dbErr.code, dbErr.details);
      return NextResponse.json({ error: dbErr.message, code: dbErr.code }, { status: 500 });
    }

    console.log("[push/subscribe] ✓ Abonnement enregistré pour", user.id);
    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("[push/subscribe] Erreur inattendue :", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── DELETE : supprime un abonnement push ─────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Authorization manquant" }, { status: 401 });

    const supabase = makeClient(token);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Token invalide" }, { status: 401 });

    const { endpoint } = await req.json() as { endpoint: string };
    await supabase.from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);

    console.log("[push/subscribe] Abonnement supprimé pour", user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
