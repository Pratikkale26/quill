"use client";

import { useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Loader2, Mail, KeyRound, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useNoteKey } from "@/hooks/use-note-key";
import { useInbox } from "@/hooks/use-inbox";
import { Letter } from "@/components/inbox/letter";
import { formatAmount, shortPubkey } from "@/lib/utils";
import { USDC_DECIMALS } from "@/lib/constants";

export function InboxView() {
  const { publicKey } = useWallet();
  const noteKey = useNoteKey();

  const recipient = publicKey?.toBase58() ?? null;
  const secret =
    noteKey.status === "ready" ? noteKey.keyPair.secretKey : null;

  const inbox = useInbox({ recipient, noteSecret: secret });

  const totals = useMemo(() => {
    let count = 0;
    let amt = 0n;
    for (const l of inbox.letters) {
      count++;
      try {
        amt += BigInt(l.amount);
      } catch {}
    }
    return { count, amt };
  }, [inbox.letters]);

  if (!publicKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connect a wallet</CardTitle>
          <CardDescription>
            Connect Phantom or Solflare to read your private inbox.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              {totals.count > 0
                ? `${totals.count} private letter${totals.count > 1 ? "s" : ""} · ${formatAmount(totals.amt, USDC_DECIMALS)} USDC total`
                : "No letters yet"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void inbox.refresh()}
            disabled={inbox.loading}
          >
            {inbox.loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>

        {inbox.letters.length === 0 && !inbox.loading && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Empty inbox</CardTitle>
              <CardDescription>
                Once you&apos;ve onboarded, share your wallet pubkey or{" "}
                <code className="font-mono">/m/&lt;handle&gt;</code> page so
                people can send you private letters.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs font-mono text-muted-foreground">
              {shortPubkey(publicKey.toBase58(), 8)}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {inbox.letters.map((l) => (
            <Letter
              key={l.id}
              letter={l}
              unlocked={noteKey.status === "ready"}
            />
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Decryption key</CardTitle>
          <CardDescription>
            One signature unlocks every letter for this browser session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {noteKey.status === "ready" ? (
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-700 dark:text-emerald-300">
                <KeyRound className="h-3 w-3" />
                key in memory
              </div>
              <p className="text-xs text-muted-foreground">
                Letters above will decrypt automatically. The secret is in
                this tab&apos;s sessionStorage and is wiped when you close
                it.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => noteKey.forget()}
              >
                Forget key (re-prompt)
              </Button>
            </div>
          ) : noteKey.status === "deriving" ? (
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              waiting for wallet signature&hellip;
            </div>
          ) : (
            <Button onClick={() => void noteKey.derive()}>
              <KeyRound className="h-4 w-4" />
              Unlock inbox
            </Button>
          )}

          {noteKey.status === "error" && (
            <p className="text-xs text-wax">
              {noteKey.error.message}
            </p>
          )}

          <hr className="border-border" />

          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Mail className="h-3 w-3" />
              <span>Letters never leave the page in plaintext.</span>
            </div>
            <p>
              Servers store ciphertext + tx metadata only. Decryption is
              client-side, gated by your wallet.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
