export default function Header() {
  return (
    <header className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/3 px-3 py-1 text-xs font-medium text-white/90">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-sm" />
          AI Voice
        </span>
      </div>

      <h1 className="text-3xl font-extrabold leading-tight text-white md:text-4xl">
        Talk to your
        <span className="block bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 to-indigo-400">
          Personal AI Assistant
        </span>
      </h1>

      <p className="max-w-xl text-sm leading-relaxed text-slate-300">
        Speak naturally — the assistant listens and replies back aloud.
      </p>
    </header>
  );
}