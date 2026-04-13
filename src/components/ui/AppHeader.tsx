import Image from "next/image";
import Link from "next/link";
import LogoutButton from "./LogoutButton";

interface AppHeaderProps {
  title: string;
  emoji?: string;
  backHref?: string;
}

// Header réutilisable sur toutes les pages de modules
export default function AppHeader({ title, emoji, backHref = "/dashboard" }: AppHeaderProps) {
  return (
    <>
      <header className="sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-[#1f3d25] px-4 py-2.5 safe-top">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <Link
              href={backHref}
              className="text-gray-400 hover:text-white p-1 -ml-1 transition-colors"
              aria-label="Retour"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="rounded-xl overflow-hidden border border-[#1f3d25]">
              <Image src="/logo.jpg" alt="LIL'Z" width={34} height={34} className="object-cover" />
            </div>
            <div>
              <p className="text-xs font-black text-white leading-none tracking-tight">
                {emoji && <span className="mr-1">{emoji}</span>}
                {title}
              </p>
              <p className="text-[10px] text-[#009A44] leading-none mt-0.5">LIL&apos;Z EVENT AGENCY</p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      {/* Bande décorative couleurs comoriennes */}
      <div className="flex h-0.5 flex-shrink-0">
        <div className="flex-1 bg-[#009A44]" />
        <div className="flex-1 bg-white/60" />
        <div className="flex-1 bg-[#E4002B]" />
        <div className="flex-1 bg-[#1E90FF]" />
        <div className="flex-1 bg-[#FFD700]" />
      </div>
    </>
  );
}
