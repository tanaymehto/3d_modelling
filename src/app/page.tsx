export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#0f0f12] text-[#f2f2f2]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(84,68,255,0.22),transparent_40%),radial-gradient(circle_at_80%_100%,rgba(13,126,255,0.2),transparent_45%)]" />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="text-lg font-semibold tracking-wide">Zennah</div>
        <div className="flex items-center gap-3 text-sm">
          <a className="text-white/70 hover:text-white" href="/sign-in">
            Login
          </a>
          <a className="rounded-full bg-[#4a3dff] px-4 py-2 text-white" href="/verify-email">
            Sign up
          </a>
        </div>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-12">
        <p className="mb-4 text-sm text-white/65">Welcome to Zennah AI</p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
          AI Design Partner for Jewellery Professionals
        </h1>
        <p className="mt-6 max-w-2xl text-base text-white/70 sm:text-lg">
          Generate photorealistic jewellery concepts, iterate with references, and convert designs into 3D-ready assets.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a className="rounded-full bg-[#4a3dff] px-6 py-3 font-medium text-white" href="/verify-email">
            Start free
          </a>
          <a className="rounded-full border border-white/20 px-6 py-3 font-medium text-white/90" href="/sign-in">
            Login / Sign up
          </a>
        </div>
        <div className="mt-8 text-sm text-white/60">3 image runs left | 1 3D runs left</div>
      </section>
    </main>
  );
}
