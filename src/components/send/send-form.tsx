"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { ArrowRight, Loader2, Lock, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useLoyalClient } from "@/hooks/use-loyal-client";
import { useDeposit } from "@/hooks/use-deposit";
import { DEFAULT_MINT, USDC_DECIMALS, NETWORK } from "@/lib/constants";
import { sealNote } from "@/lib/letterbox";
import {
  ApiError,
  lookupMaintainer,
  postSealedNote,
  type MaintainerProfile,
} from "@/lib/api-client";
import { formatAmount, shortPubkey } from "@/lib/utils";

const MAX_NOTE_LEN = 280;

function explorerLink(sig: string): string {
  const cluster = NETWORK === "mainnet" ? "" : "?cluster=devnet";
  return `https://explorer.solana.com/tx/${sig}${cluster}`;
}

function tryParsePubkey(input: string): PublicKey | null {
  try {
    return new PublicKey(input.trim());
  } catch {
    return null;
  }
}

function parseAmount(input: string): bigint | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > USDC_DECIMALS) return null;
  const padded = (frac + "0".repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS);
  try {
    return BigInt(whole + padded);
  } catch {
    return null;
  }
}

interface ResolveState {
  state: "idle" | "loading" | "ok" | "not_found" | "no_note_key" | "error";
  profile?: MaintainerProfile;
  error?: string;
}

export function SendForm() {
  const { publicKey } = useWallet();
  const searchParams = useSearchParams();
  const loyal = useLoyalClient();
  const deposit = useDeposit({
    client: loyal.status === "ready" ? loyal.client : null,
    user: publicKey,
    tokenMint: DEFAULT_MINT,
  });

  const [recipientInput, setRecipientInput] = useState(
    () => searchParams.get("to") ?? "",
  );
  const [amountInput, setAmountInput] = useState("");
  const [note, setNote] = useState("");
  const [resolve, setResolve] = useState<ResolveState>({ state: "idle" });
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<{
    sig: string;
    recipient: string;
    amount: string;
  } | null>(null);

  const resolveRecipient = useCallback(async (raw: string) => {
    const trimmed = raw.trim().replace(/^@/, "");
    if (trimmed.length === 0) {
      setResolve({ state: "idle" });
      return;
    }
    setResolve({ state: "loading" });
    const pub = tryParsePubkey(trimmed);
    try {
      const profile = pub
        ? await lookupMaintainer({ wallet: pub.toBase58() })
        : await lookupMaintainer({ handle: trimmed });
      if (!profile.noteKey) {
        setResolve({ state: "no_note_key", profile });
      } else {
        setResolve({ state: "ok", profile });
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setResolve({ state: "not_found" });
      } else {
        setResolve({
          state: "error",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }, []);

  // Debounced resolution as the user types.
  useEffect(() => {
    const t = setTimeout(() => {
      void resolveRecipient(recipientInput);
    }, 350);
    return () => clearTimeout(t);
  }, [recipientInput, resolveRecipient]);

  const amountBig = useMemo(() => parseAmount(amountInput), [amountInput]);

  const canSend =
    !busy &&
    loyal.status === "ready" &&
    !!publicKey &&
    resolve.state === "ok" &&
    !!amountBig &&
    amountBig > 0n &&
    deposit.snapshot?.isDelegated &&
    (deposit.snapshot.ephemeralAmount ?? 0n) >= amountBig;

  const send = useCallback(async () => {
    if (!canSend || resolve.state !== "ok" || !resolve.profile?.noteKey) return;
    if (loyal.status !== "ready" || !publicKey || !amountBig) return;
    setBusy(true);
    try {
      const recipientPub = new PublicKey(resolve.profile.pubkey);
      const sealed = note.trim()
        ? sealNote(note, resolve.profile.noteKey)
        : null;

      const sig = await loyal.client.transferDeposit({
        user: publicKey,
        payer: publicKey,
        tokenMint: DEFAULT_MINT,
        destinationUser: recipientPub,
        amount: amountBig,
        sessionToken: null,
      });

      if (sealed) {
        try {
          await postSealedNote({
            txSignature: sig,
            recipientPubkey: resolve.profile.pubkey,
            senderPubkey: publicKey.toBase58(),
            sealed,
            amount: amountBig.toString(),
            tokenMint: DEFAULT_MINT.toBase58(),
            baseUrl: "",
          });
        } catch (e) {
          // Note storage failed — surface but the on-chain transfer
          // already succeeded.
          console.error("post note failed", e);
          toast.warning(
            "Sent privately, but the encrypted note couldn't be saved. Try resending the note later.",
          );
        }
      }

      setSuccess({
        sig,
        recipient: resolve.profile.handle ?? resolve.profile.pubkey,
        amount: amountInput,
      });
      setNote("");
      setAmountInput("");
      void deposit.refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "transfer failed for an unknown reason",
      );
    } finally {
      setBusy(false);
    }
  }, [
    canSend,
    resolve,
    loyal,
    publicKey,
    amountBig,
    note,
    amountInput,
    deposit,
  ]);

  if (!publicKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connect a wallet</CardTitle>
          <CardDescription>
            Connect Phantom or Solflare on devnet to send a private letter.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loyal.status === "building") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verifying TEE&hellip;</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (deposit.snapshot && !deposit.snapshot.isDelegated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Shield your balance first</CardTitle>
          <CardDescription>
            Quill needs your USDC inside the MagicBlock TEE before it can
            send privately.{" "}
            <a className="underline" href="/setup">
              Run setup
            </a>{" "}
            to claim your private inbox and shield a balance.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle>Write a private letter</CardTitle>
          <CardDescription>
            One private transfer + one E2EE note. The transfer happens inside
            the TEE; the note is encrypted to the recipient&apos;s wallet
            before it leaves your browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="recipient">Recipient</Label>
            <Input
              id="recipient"
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              placeholder="@handle  or  base58 pubkey"
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
            />
            <RecipientStatus state={resolve} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount</Label>
            <div className="relative">
              <Input
                id="amount"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="5.00"
                disabled={busy}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                USDC
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Shielded balance:{" "}
              <span className="font-mono">
                {deposit.snapshot
                  ? formatAmount(
                      deposit.snapshot.ephemeralAmount ?? 0n,
                      USDC_DECIMALS,
                    )
                  : "—"}
              </span>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">Note (optional, end-to-end encrypted)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE_LEN))}
              placeholder="thanks for axios — saved my afternoon"
              disabled={busy}
              rows={4}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Encrypted to recipient&apos;s noteKey before leaving this
                browser
              </span>
              <span>
                {note.length}/{MAX_NOTE_LEN}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={send} disabled={!canSend} size="lg">
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending privately
                </>
              ) : (
                <>
                  Send private letter
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            {amountBig &&
              deposit.snapshot &&
              (deposit.snapshot.ephemeralAmount ?? 0n) < amountBig && (
                <span className="text-xs text-wax">
                  not enough shielded USDC
                </span>
              )}
          </div>

          {success && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">
                    Sent {success.amount} USDC privately to{" "}
                    <span className="font-mono">
                      {success.recipient.startsWith("@")
                        ? success.recipient
                        : shortPubkey(success.recipient, 5)}
                    </span>
                  </div>
                  <a
                    href={explorerLink(success.sig)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
                  >
                    {shortPubkey(success.sig, 6)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSuccess(null);
                  }}
                >
                  Send another
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What stays private</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Inside TEE:</strong> the
            transfer accounting itself — neither amount nor recipient
            balance is visible on-chain.
          </p>
          <p>
            <strong className="text-foreground">In your browser:</strong> the
            note plaintext. It&apos;s sealed with{" "}
            <code className="text-xs">nacl.box</code> against the
            recipient&apos;s X25519 key before it leaves.
          </p>
          <p>
            <strong className="text-foreground">Server-visible:</strong> the
            tx signature, recipient pubkey, sender pubkey (you signed it),
            and that <em>some</em> note exists. Never its contents.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function RecipientStatus({ state }: { state: ResolveState }) {
  if (state.state === "idle") {
    return (
      <p className="text-xs text-muted-foreground">
        We&apos;ll resolve handles or pubkeys against the registry.
      </p>
    );
  }
  if (state.state === "loading") {
    return (
      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        looking up&hellip;
      </p>
    );
  }
  if (state.state === "not_found") {
    return (
      <p className="text-xs text-wax">
        No private inbox found. Ask them to claim one at{" "}
        <a className="underline" href="/setup">
          /setup
        </a>
        .
      </p>
    );
  }
  if (state.state === "no_note_key") {
    return (
      <p className="text-xs text-amber-700 dark:text-amber-300">
        That wallet exists but hasn&apos;t registered a note key yet. They
        need to finish /setup before you can attach a note.
      </p>
    );
  }
  if (state.state === "error") {
    return <p className="text-xs text-wax">lookup failed: {state.error}</p>;
  }
  // ok
  const p = state.profile!;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Badge variant="success">private inbox active</Badge>
      <span className="text-muted-foreground">
        {p.displayName ?? (p.handle ? `@${p.handle}` : shortPubkey(p.pubkey, 5))}
      </span>
      <span className="font-mono text-muted-foreground/70">
        {shortPubkey(p.pubkey, 5)}
      </span>
    </div>
  );
}
