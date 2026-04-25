"use client";

import { useCallback, useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";

import { readDepositSnapshot, type DepositSnapshot } from "@/lib/loyal/onboard";
import type { LoyalClient } from "@/lib/loyal/client";

interface UseDepositArgs {
  client: LoyalClient | null;
  user: PublicKey | null;
  tokenMint: PublicKey;
}

export function useDeposit({ client, user, tokenMint }: UseDepositArgs) {
  const [snapshot, setSnapshot] = useState<DepositSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!client || !user) return;
    setLoading(true);
    setError(null);
    try {
      const next = await readDepositSnapshot(client, user, tokenMint);
      setSnapshot(next);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [client, user, tokenMint]);

  useEffect(() => {
    if (!client || !user) {
      setSnapshot(null);
      return;
    }
    void refresh();
  }, [client, user, refresh]);

  return { snapshot, loading, error, refresh };
}
