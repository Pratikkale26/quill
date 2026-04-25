"use client";

import { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Loader2, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useLoyalClient } from "@/hooks/use-loyal-client";
import { useNoteKey } from "@/hooks/use-note-key";
import { useDeposit } from "@/hooks/use-deposit";
import {
  initialOnboardProgress,
  onboardForToken,
  type OnboardProgress,
  type StepStatus,
} from "@/lib/loyal/onboard";
import { DEFAULT_MINT, USDC_DECIMALS } from "@/lib/constants";
import { formatAmount, shortPubkey } from "@/lib/utils";

type RegisterState =
  | { state: "pending" }
  | { state: "running" }
  | { state: "succeeded" }
  | { state: "failed"; error: string };

const initialRegisterState: RegisterState = { state: "pending" };

function StepRow({
  index,
  title,
  hint,
  status,
}: {
  index: number;
  title: string;
  hint: string;
  status: StepStatus | RegisterState;
}) {
  let icon = (
    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-xs text-muted-foreground">
      {index}
    </span>
  );
  let badge = null;
  if (status.state === "running") {
    icon = (
      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
      </span>
    );
    badge = <Badge variant="warning">in progress</Badge>;
  } else if (status.state === "succeeded") {
    icon = <CheckCircle2 className="h-6 w-6 text-emerald-600" />;
    badge = <Badge variant="success">done</Badge>;
  } else if (status.state === "skipped") {
    icon = <CheckCircle2 className="h-6 w-6 text-muted-foreground" />;
    badge = <Badge variant="muted">skipped</Badge>;
  } else if (status.state === "failed") {
    icon = <AlertCircle className="h-6 w-6 text-wax" />;
    badge = <Badge variant="error">failed</Badge>;
  }
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{title}</span>
          {badge}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {status.state === "skipped"
            ? `already done — ${"reason" in status ? status.reason : ""}`
            : status.state === "failed"
              ? `error — ${"error" in status ? status.error : "unknown"}`
              : hint}
        </p>
      </div>
    </div>
  );
}

export function SetupFlow() {
  const { publicKey } = useWallet();
  const loyal = useLoyalClient();
  const noteKey = useNoteKey();
  const deposit = useDeposit({
    client: loyal.status === "ready" ? loyal.client : null,
    user: publicKey,
    tokenMint: DEFAULT_MINT,
  });

  const [chainProgress, setChainProgress] =
    useState<OnboardProgress>(initialOnboardProgress);
  const [registerState, setRegisterState] = useState<RegisterState>(
    initialRegisterState,
  );
  const [running, setRunning] = useState(false);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [twitter, setTwitter] = useState("");

  const run = useCallback(async () => {
    if (loyal.status !== "ready" || !publicKey) {
      toast.error("Connect a wallet first");
      return;
    }
    setRunning(true);
    setChainProgress(initialOnboardProgress);
    setRegisterState({ state: "pending" });

    // Step 1-3: chain onboarding (init → permission → delegate)
    const chain = await onboardForToken({
      client: loyal.client,
      user: publicKey,
      tokenMint: DEFAULT_MINT,
      onProgress: setChainProgress,
    });
    setChainProgress(chain);

    if (chain.delegate.state === "failed" || chain.permission.state === "failed" || chain.initialize.state === "failed") {
      setRunning(false);
      toast.error("Couldn't shield your inbox — see status panel");
      return;
    }

    // Step 4: derive note key + register w/ profile fields
    setRegisterState({ state: "running" });
    let noteKeyPair = noteKey.status === "ready" ? noteKey.keyPair : null;
    if (!noteKeyPair) {
      noteKeyPair = await noteKey.derive();
    }
    if (!noteKeyPair) {
      setRegisterState({
        state: "failed",
        error: "user did not sign the note-key challenge",
      });
      setRunning(false);
      return;
    }

    const { bytesToBase64 } = await import("@/lib/encoding");
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          walletPubkey: publicKey.toBase58(),
          noteKey: bytesToBase64(noteKeyPair.publicKey),
          handle: handle.trim() || null,
          displayName: displayName.trim() || null,
          twitter: twitter.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `register failed (${res.status})`);
      }
      setRegisterState({ state: "succeeded" });
      toast.success("Your private inbox is live");
      void deposit.refresh();
    } catch (e) {
      setRegisterState({
        state: "failed",
        error: e instanceof Error ? e.message : String(e),
      });
      toast.error("Couldn't register your note key");
    } finally {
      setRunning(false);
    }
  }, [loyal, publicKey, noteKey, handle, displayName, twitter, deposit]);

  if (!publicKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connect a wallet</CardTitle>
          <CardDescription>
            Connect Phantom or Solflare on Solana devnet to claim your private
            inbox.
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
          <CardDescription>
            Validating MagicBlock TDX attestation and fetching a session
            auth token.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loyal.status === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Couldn&apos;t reach the TEE</CardTitle>
          <CardDescription>
            {loyal.error.message}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={loyal.rebuild}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Claim your private inbox</CardTitle>
          <CardDescription>
            Three on-chain transactions and one wallet signature. After this
            anyone can send you private USDC + an end-to-end-encrypted note.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3 rounded-xl border border-border bg-background/40 p-4">
            <StepRow
              index={1}
              title="Initialize deposit account"
              hint="Creates the on-chain PDA that holds your shielded balance."
              status={chainProgress.initialize}
            />
            <StepRow
              index={2}
              title="Create PER permission"
              hint="Adds the access-control account that lets the TEE manage your deposit."
              status={chainProgress.permission}
            />
            <StepRow
              index={3}
              title="Delegate to MagicBlock TEE"
              hint="Flips ownership to the delegation program. From now on transfers happen privately inside the TEE."
              status={chainProgress.delegate}
            />
            <StepRow
              index={4}
              title="Register your encrypted-note key"
              hint="One wallet signature derives an X25519 keypair. The public half is published; the secret stays in this browser."
              status={registerState}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="handle">Handle (optional)</Label>
              <Input
                id="handle"
                value={handle}
                onChange={(e) =>
                  setHandle(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_]/g, "")
                      .slice(0, 32),
                  )
                }
                placeholder="pratik"
                disabled={running}
              />
              <p className="text-xs text-muted-foreground">
                Becomes your public page at{" "}
                <code className="text-xs">/m/{handle || "you"}</code>.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Display name (optional)</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value.slice(0, 80))}
                placeholder="Pratik"
                disabled={running}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="twitter">X / Twitter (optional)</Label>
              <Input
                id="twitter"
                value={twitter}
                onChange={(e) =>
                  setTwitter(e.target.value.replace(/^@/, "").slice(0, 40))
                }
                placeholder="pratikkale26"
                disabled={running}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={run} disabled={running} size="lg">
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running setup
                </>
              ) : (
                <>
                  Claim my inbox
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Each step is idempotent — safe to re-run if anything fails.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wallet</CardTitle>
          <CardDescription className="font-mono text-xs">
            {shortPubkey(publicKey.toBase58(), 6)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Shielded balance
            </div>
            <div className="font-mono text-2xl">
              {deposit.snapshot
                ? formatAmount(
                    deposit.snapshot.ephemeralAmount ??
                      deposit.snapshot.baseAmount ??
                      0n,
                    USDC_DECIMALS,
                  )
                : "—"}{" "}
              <span className="text-sm text-muted-foreground">USDC</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {deposit.snapshot?.isDelegated
                ? "live in TEE"
                : deposit.snapshot?.baseAmount
                  ? "on base layer (not delegated yet)"
                  : "no deposit yet"}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Note key
            </div>
            <div className="font-mono text-xs break-all text-muted-foreground">
              {noteKey.status === "ready"
                ? noteKey.pubkeyB64
                : "not derived yet"}
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Privacy boundary.</strong>{" "}
            Quill servers see <em>that</em> a note exists for your wallet
            (recipient, sender if signed, tx sig, timestamp) — never the
            contents. The decrypting key is in your browser only.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
