import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="max-w-2xl space-y-10 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          building on Loyal&apos;s private-transactions SDK
        </div>

        <h1 className="font-serif text-6xl font-medium leading-[1.05] tracking-tight">
          Send Solana privately,
          <br />
          with a note only they can read.
        </h1>

        <p className="mx-auto max-w-lg text-lg leading-relaxed text-muted-foreground">
          Quill puts an end-to-end-encrypted letter inside every private payment.
          The amount stays inside the TEE; the words stay between two wallets.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Link
            href="/send"
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Send a private letter
          </Link>
          <Link
            href="/inbox"
            className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-card px-6 text-sm font-medium transition hover:bg-accent"
          >
            Open my inbox
          </Link>
        </div>

        <p className="pt-12 text-xs text-muted-foreground/70">
          devnet · ed25519 → x25519 → AES-GCM · SDK v0.2.8
        </p>
      </div>
    </main>
  );
}
