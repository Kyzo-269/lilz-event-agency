import { createBrowserClient } from "@supabase/ssr";
import { createDemoClient } from "@/lib/demo/mockClient";

export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

// Client Supabase pour le navigateur (composants React côté client)
// En mode démo (NEXT_PUBLIC_DEMO_MODE=true) : aucune connexion réseau,
// toutes les données viennent d'un faux client en mémoire (src/lib/demo).
function realClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Le vrai createBrowserClient() est un singleton interne (isSingleton) — il
// renvoie toujours la même référence. Le faux client doit avoir le même
// comportement, sinon chaque `const supabase = createClient()` dans un
// composant produit une nouvelle référence à chaque rendu, ce qui casse
// tous les useCallback/useEffect([supabase]) de l'app (boucle de rendu
// infinie → page qui se fige et navigation qui ne répond plus).
let demoClientSingleton: ReturnType<typeof createDemoClient> | null = null;

export function createClient() {
  if (isDemoMode) {
    if (!demoClientSingleton) demoClientSingleton = createDemoClient();
    return demoClientSingleton as unknown as ReturnType<typeof realClient>;
  }
  return realClient();
}
