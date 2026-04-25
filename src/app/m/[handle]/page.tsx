import { notFound } from "next/navigation";
import Link from "next/link";
import { Mail, Globe, Lock } from "lucide-react";
import type { Metadata } from "next";

import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { shortPubkey } from "@/lib/utils";

interface Params {
  handle: string;
}

async function loadMaintainer(handleOrPubkey: string) {
  const isPubkeyish = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(handleOrPubkey);
  return db.maintainer.findFirst({
    where: isPubkeyish
      ? { pubkey: handleOrPubkey }
      : { handle: handleOrPubkey.toLowerCase() },
    include: {
      _count: { select: { notesReceived: true } },
    },
  });
}

export async function generateMetadata(props: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { handle } = await props.params;
  const m = await loadMaintainer(handle);
  if (!m) return { title: "Not found · Quill" };
  const name = m.displayName ?? (m.handle ? `@${m.handle}` : "Quill maintainer");
  return {
    title: `${name} · Quill`,
    description:
      m.bio ??
      `Send ${name} a private letter. Their wallet stays unindexed; the note stays sealed.`,
  };
}

export default async function MaintainerPage(props: {
  params: Promise<Params>;
}) {
  const { handle } = await props.params;
  const m = await loadMaintainer(handle);
  if (!m) notFound();

  const inboxReady = !!m.noteKey;
  const name = m.displayName ?? (m.handle ? `@${m.handle}` : "Quill maintainer");
  const subtitle = m.handle
    ? `${shortPubkey(m.pubkey, 5)} · @${m.handle}`
    : shortPubkey(m.pubkey, 5);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <div className="space-y-10">
        <header className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            <span>Quill private inbox</span>
          </div>
          <h1 className="font-serif text-5xl font-medium leading-[1.05] tracking-tight">
            {name}
          </h1>
          <p className="font-mono text-xs text-muted-foreground">{subtitle}</p>
          {m.bio && (
            <p className="max-w-xl text-base text-muted-foreground">{m.bio}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {m.twitter && (
              <a
                href={`https://x.com/${m.twitter}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs hover:bg-accent"
              >
                <span aria-hidden>𝕏</span>
                {m.twitter}
              </a>
            )}
            {m.github && (
              <a
                href={`https://github.com/${m.github}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs hover:bg-accent"
              >
                <span aria-hidden>⌂</span>
                {m.github}
              </a>
            )}
            {m.website && (
              <a
                href={m.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs hover:bg-accent"
              >
                <Globe className="h-3 w-3" />
                site
              </a>
            )}
            {inboxReady ? (
              <Badge variant="success">private inbox active</Badge>
            ) : (
              <Badge variant="warning">inbox not yet claimed</Badge>
            )}
          </div>
        </header>

        {inboxReady ? (
          <Card>
            <CardContent className="space-y-5 p-6">
              <div className="flex items-start gap-3">
                <Lock className="mt-1 h-5 w-5 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-base">
                    Send {m.displayName ?? "them"} private USDC plus a note
                    only they can read.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    The transfer happens inside MagicBlock&apos;s TEE; the
                    note is end-to-end-encrypted to their wallet before it
                    leaves your browser.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link
                    href={{
                      pathname: "/send",
                      query: { to: m.pubkey },
                    }}
                  >
                    Write a private letter
                  </Link>
                </Button>
                <p className="text-xs text-muted-foreground">
                  {m._count.notesReceived} letter
                  {m._count.notesReceived === 1 ? "" : "s"} received so far.
                  Amounts stay private.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="space-y-3 p-6">
              <p className="font-medium">Inbox not claimed yet.</p>
              <p className="text-sm text-muted-foreground">
                This wallet exists in the registry but hasn&apos;t finished
                /setup. Without a registered note key, senders can&apos;t
                attach E2EE messages.
              </p>
              <Button asChild variant="outline">
                <Link href="/setup">Run setup</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="rounded-xl border border-dashed border-border p-5 text-xs leading-relaxed text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">
            What this page promises
          </p>
          <p>
            On-chain transfers go through Loyal&apos;s private rail
            (MagicBlock TEE). Note contents are encrypted to the recipient
            and only readable in their browser. The fact that{" "}
            <em>some</em> letter arrived is server-visible (count above) —
            that&apos;s the limit of what we can hide off-chain.
          </p>
        </div>
      </div>
    </main>
  );
}
