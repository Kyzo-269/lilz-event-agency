import Image from "next/image";
import Footer from "@/components/ui/Footer";

export default function OfflinePage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center text-center px-6 safe-top safe-bottom">
      <div className="mb-6 rounded-2xl overflow-hidden border border-[#1f3d25] opacity-60">
        <Image src="/logo.jpg" alt="LIL'Z" width={80} height={80} className="object-cover" />
      </div>
      <div className="text-4xl mb-4">📡</div>
      <h1 className="text-2xl font-bold text-white mb-2">Pas de connexion</h1>
      <p className="text-gray-500 max-w-xs text-sm">
        Tu es hors ligne. Reconnecte-toi à Internet pour accéder à LIL&apos;Z EVENT AGENCY.
      </p>
      <div className="flex gap-1 mt-8">
        <div className="w-8 h-0.5 rounded bg-[#009A44]" />
        <div className="w-8 h-0.5 rounded bg-white/30" />
        <div className="w-8 h-0.5 rounded bg-[#E4002B]" />
        <div className="w-8 h-0.5 rounded bg-[#1E90FF]" />
        <div className="w-8 h-0.5 rounded bg-[#FFD700]" />
      </div>
      <div className="mt-auto w-full">
        <Footer />
      </div>
    </div>
  );
}
