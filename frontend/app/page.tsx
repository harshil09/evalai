import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-16">
      <main className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          EvalAI
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-zinc-900">
          Evaluate transcripts with confidence
        </h1>
        <p className="mt-4 text-base leading-7 text-zinc-600">
          Upload text or markdown transcripts and receive structured evaluation
          reports. Create an account to get started.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            Sign up
          </Link>
          <Link
            href="/auth"
            className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
          >
            Sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
