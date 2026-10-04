export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 font-sans text-zinc-900">
      <main className="flex w-full max-w-xl flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          What do you want to learn?
        </h1>
        <p className="text-sm text-zinc-500">
          Scaffold build (T0) — the live learning app lands in T2.
        </p>
      </main>
    </div>
  );
}
