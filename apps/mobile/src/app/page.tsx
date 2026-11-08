import { appDescription, appName } from "@/lib/brand";

// Placeholder until the tab screens arrive (M-04/M-05); shows the shell, safe areas and tokens.
// shortcut: copy is inline until @payproof/api-client/i18n exists (S-05).
export default function HomePage() {
  return (
    <main className="pt-safe pb-safe px-safe mx-auto flex min-h-dvh max-w-app flex-col">
      <header className="pt-12 pb-2">
        <h1 className="text-4xl leading-tight font-bold tracking-tight">{appName}</h1>
        <p className="text-text-3 mt-1 text-md">{appDescription}</p>
      </header>
      <section className="bg-surface border-border mt-6 rounded-xl border p-5 shadow-1">
        <h2 className="text-lg font-semibold">Mobil tətbiq hazırlanır</h2>
        <p className="text-text-2 mt-2 text-sm leading-relaxed">
          Paketlərin statusunu izləyin, sübuta baxın və hazır paketi təsdiqləyin. Təsdiq ödəniş
          deyil — yalnız sənəd paketinin hazırlığıdır.
        </p>
      </section>
    </main>
  );
}
