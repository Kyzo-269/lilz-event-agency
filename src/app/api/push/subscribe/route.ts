import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ── POST : enregistre un abonnement push ──────────────────────
export async function POST(req: NextRequest) {
  try {
    const { subscription, userAgent } = await req.json() as {
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
      userAgent?: string;
    };

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: "Subscription invalide" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id:   user.id,
      endpoint:  subscription.endpoint,
      p256dh:    subscription.keys.p256dh,
      auth:      subscription.keys.auth,
      user_agent: userAgent ?? null,
    }, { onConflict: "user_id,endpoint" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
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

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
