"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { WalletLike } from "@loyal-labs/private-transactions";

import { buildLoyalClient, type LoyalClient } from "@/lib/loyal/client";

type State =
  | { status: "idle" }
  | { status: "building"; pubkey: string }
  | { status: "ready"; pubkey: string; client: LoyalClient }
  | { status: "error"; pubkey: string; error: Error };

/**
 * React hook that lazily builds a LoyalPrivateTransactionsClient when the
 * connected wallet is capable of signing transactions. Rebuilds when the
 * connected pubkey changes; never rebuilds on every render.
 */
export function useLoyalClient() {
  const { publicKey, signTransaction, signAllTransactions, connected } =
    useWallet();
  const [state, setState] = useState<State>({ status: "idle" });
  const buildRef = useRef(0);

  const wallet: WalletLike | null = useMemo(() => {
    if (!publicKey || !signTransaction || !signAllTransactions) return null;
    return { publicKey, signTransaction, signAllTransactions };
  }, [publicKey, signTransaction, signAllTransactions]);

  const build = useCallback(async () => {
    if (!wallet) return;
    const ticket = ++buildRef.current;
    const pubkey = wallet.publicKey.toBase58();
    setState({ status: "building", pubkey });
    try {
      const client = await buildLoyalClient(wallet);
      if (ticket !== buildRef.current) return; // superseded
      setState({ status: "ready", pubkey, client });
    } catch (err) {
      if (ticket !== buildRef.current) return;
      setState({
        status: "error",
        pubkey,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }, [wallet]);

  useEffect(() => {
    if (!connected || !wallet) {
      setState({ status: "idle" });
      buildRef.current++;
      return;
    }
    void build();
  }, [connected, wallet, build]);

  return {
    ...state,
    rebuild: build,
  };
}
