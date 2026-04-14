import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ── POST : enregistre un abonnement push ──────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
      userAgent?: string;
    };
    const { subscription, userAgent } = body;

    console.log("[push/subscribe] Tentative d'enregistrement :", {
      endpoint: subscription?.endpoint?.slice(0, 60) + "…",
      hasP256dh: !!subscription?.keys?.p256dh,
      hasAuth: !!subscription?.keys?.auth,
    });

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      console.error("[push/subscribe] Subscription invalide :", JSON.stringify(subscription).slice(0, 200));
      return NextResponse.json({ error: "Subscription invalide" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      console.error("[push/subscribe] Non authentifié :", authErr?.message);
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    console.log("[push/subscribe] Utilisateur authentifié :", user.id);

    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id:    user.id,
      endpoint:   subscription.endpoint,
      p256dh:     subscription.keys.p256dh,
      auth:       subscription.keys.auth,
      user_agent: userAgent ?? null,
    }, { onConflict: "user_id,endpoint" });

    if (error) {
      console.error("[push/subscribe] Erreur Supabase :", error.message, error.code);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
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
    const { endpoint } = await req.json() as { endpoint: string };
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

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
