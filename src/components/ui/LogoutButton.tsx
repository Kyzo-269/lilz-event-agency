"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const supabase = createClient();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="text-xs font-medium text-gray-400 hover:text-[#E4002B] border border-[#1f3d25] hover:border-[#E4002B]/40 px-3 py-1.5 rounded-lg transition-all duration-150 active:scale-95"
    >
      Déconnexion
    </button>
  );
}
