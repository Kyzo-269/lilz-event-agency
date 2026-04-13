import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Client Supabase pour le serveur (Server Components, Server Actions, Middleware)
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll peut être appelé depuis un Server Component (lecture seule)
            // C'est normal, le middleware gère le rafraîchissement de session
          }
        },
      },
    }
  );
}
