import { redirect } from "next/navigation";

// La racine redirige vers /dashboard (le middleware gère l'auth)
export default function Home() {
  redirect("/dashboard");
}
