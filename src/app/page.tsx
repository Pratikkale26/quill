import Link from "next/link";
import {
  ArrowRight,
  Lock,
  Mail,
  Sparkles,
  ShieldCheck,
  KeyRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-5xl flex-col items-center px-6 pb-16 pt-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          built on Loyal&apos;s private-transactions SDK · Solana devnet
        </div>

        <h1 className="mt-6 max-w-3xl font-serif text-6xl font-medium leading-[1.04] tracking-tight">
          Send Solana privately,
          <br />
          <span className="text-muted-foreground">
            with a note only they can read.
          </span>
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Quill puts an end-to-end-encrypted letter inside every private
          payment. The amount stays inside the TEE; the words stay
          between two wallets.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/setup">
              Claim your inbox
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/send">Write a letter</Link>
          </Button>
        </div>

        <p className="mt-8 font-mono text-xs text-muted-foreground/70">
          ed25519 → x25519 · nacl.box · MagicBlock TEE · 0.2.8
        </p>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 pb-20">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard
            icon={<Lock className="h-5 w-5" />}
            kicker="Private payment"
            title="The amount never leaks."
            body="Transfers settle inside MagicBlock's TEE. On-chain observers see one delegated PDA — never sender balance, never recipient, never amount."
          />
          <FeatureCard
            icon={<Mail className="h-5 w-5" />}
            kicker="Encrypted memo"
            title="Words stay between wallets."
            body="Each letter is sealed with nacl.box (X25519 + XSalsa20-Poly1305) against the recipient's wallet-derived key. Servers store only ciphertext."
          />
          <FeatureCard
            icon={<KeyRound className="h-5 w-5" />}
            kicker="No new key to lose"
            title="Wallet-derived keys."
            body="The decryption secret is regenerated on demand from a single signMessage challenge. No backups, no extension, no lock-in."
          />
        </div>
      </section>

      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto w-full max-w-5xl px-6 py-20">
          <div className="grid gap-12 md:grid-cols-2">
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground">
                Honest privacy
              </p>
              <h2 className="mt-2 font-serif text-3xl font-medium leading-tight tracking-tight">
                What stays hidden — and what doesn&apos;t.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Privacy products lose trust the moment they overpromise.
                Quill draws the line clearly so you can decide whether the
                guarantee fits your use case.
              </p>
            </div>
            <div className="grid gap-3">
              <Disclosure
                kind="hidden"
                title="Transfer accounting"
                body="Inside the MagicBlock TEE — neither amount nor recipient balance touches base layer."
              />
              <Disclosure
                kind="hidden"
                title="Note plaintext"
                body="Sealed in your browser before it leaves. The recipient's wallet is the only thing that can open it."
              />
              <Disclosure
                kind="visible"
                title="That a note exists"
                body="Server stores ciphertext, recipient pubkey, sender pubkey (you signed it), tx signature, timestamp."
              />
              <Disclosure
                kind="visible"
                title="On-chain delegation"
                body="The delegate transaction itself, like all Solana txs, is public. We don't try to hide it."
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-20">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Three ways people use it
        </p>
        <h2 className="mt-2 font-serif text-3xl font-medium leading-tight tracking-tight">
          One primitive, every payment that needed a memo.
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <UseCase
            title="Creator tipping"
            body="Drop /m/yourhandle in a README or thread. Supporters tip privately and leave a note only you can read."
          />
          <UseCase
            title="Private invoicing"
            body="Send a freelance invoice as a note + amount. Receipt history stays in your browser, not on a public ledger."
          />
          <UseCase
            title="OSS sustainability"
            body="Coming soon — bulk-tip your dependency tree from the CLI with a per-package thank-you note. Distribution flywheel for maintainers."
          />
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6 text-xs text-muted-foreground">
          <span>quill · Loyal mini build challenge submission</span>
          <span className="font-mono">{`devnet · 2026-04`}</span>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  kicker,
  title,
  body,
}: {
  icon: React.ReactNode;
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground">
        {icon}
      </div>
      <p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">
        {kicker}
      </p>
      <h3 className="mt-1 font-serif text-xl font-medium leading-snug tracking-tight">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}

function Disclosure({
  kind,
  title,
  body,
}: {
  kind: "hidden" | "visible";
  title: string;
  body: string;
}) {
  const isHidden = kind === "hidden";
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-4">
      <div
        className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
          isHidden
            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        }`}
      >
        {isHidden ? <ShieldCheck className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
              isHidden
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
            }`}
          >
            {isHidden ? "hidden" : "visible"}
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {body}
        </p>
      </div>
    </div>
  );
}

function UseCase({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="font-serif text-lg font-medium tracking-tight">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}
