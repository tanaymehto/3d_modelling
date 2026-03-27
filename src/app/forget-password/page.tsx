export default function ForgetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f0f12] p-6 text-[#f2f2f2]">
      <section className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#17171c] p-6">
        <h1 className="mb-1 text-2xl font-semibold">Forgot password?</h1>
        <p className="text-sm text-white/60">
          Password reset email flow is not wired yet in this local MVP.
        </p>
        <a href="/sign-in" className="mt-5 inline-block text-sm text-white underline">
          Back to sign in
        </a>
      </section>
    </main>
  );
}
