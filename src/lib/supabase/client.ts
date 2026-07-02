import { createBrowserClient } from "@supabase/ssr";
import { createDemoClient } from "@/lib/demo/mockClient";

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

// Client Supabase pour le navigateur (composants React côté client)
// En mode démo (NEXT_PUBLIC_DEMO_MODE=true) : aucune connexion réseau,
// toutes les données viennent d'un faux client en mémoire (src/lib/demo).
function realClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function createClient() {
  if (isDemoMode) {
    return createDemoClient() as unknown as ReturnType<typeof realClient>;
  }
  return realClient();
}
