import ApiStatus from "@/components/ApiStatus";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6 text-center">
      <span className="rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 text-xs tracking-wide text-indigo-200">
        Phase 1 · Project foundation
      </span>
      <h1 className="bg-gradient-to-r from-indigo-300 via-sky-300 to-emerald-300 bg-clip-text text-5xl font-semibold tracking-tight text-transparent">
        InsightForge AI
      </h1>
      <p className="max-w-xl text-slate-400">
        AI-powered business analytics. Deterministic analytics and ML in the backend, AI-generated insight on top.
      </p>
      <ApiStatus />
    </main>
  );
}
