"use client";

import { useCallback, useEffect, useState } from "react";

import { listSealedNotes, type SealedNoteRecord } from "@/lib/api-client";
import { openNote } from "@/lib/letterbox";

export interface InboxLetter {
  id: string;
  txSignature: string;
  senderPubkey: string | null;
  amount: string;
  tokenMint: string;
  createdAt: string;
  /** plaintext after decryption, or null if we don't have the key yet */
  body: string | null;
  /** true when ciphertext failed to decrypt with the supplied secret */
  failed: boolean;
}

interface UseInboxArgs {
  recipient: string | null;
  /** 32-byte X25519 secret for the recipient. Null until derived. */
  noteSecret: Uint8Array | null;
}

/**
 * Fetches notes for a recipient and decrypts them client-side once the
 * note secret is available. Decryption is in-memory only — we never
 * write plaintext anywhere.
 */
export function useInbox({ recipient, noteSecret }: UseInboxArgs) {
  const [raw, setRaw] = useState<SealedNoteRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!recipient) {
      setRaw([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const notes = await listSealedNotes({ recipient });
      setRaw(notes);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [recipient]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const letters: InboxLetter[] = raw.map((n) => {
    let body: string | null = null;
    let failed = false;
    if (noteSecret) {
      try {
        const plain = openNote(
          {
            ephemeralPubkey: n.ephemeralPubkey,
            nonce: n.nonce,
            ciphertext: n.ciphertext,
          },
          noteSecret,
        );
        if (plain === null) failed = true;
        else body = plain;
      } catch {
        failed = true;
      }
    }
    return {
      id: n.id,
      txSignature: n.txSignature,
      senderPubkey: n.senderPubkey,
      amount: n.amount,
      tokenMint: n.tokenMint,
      createdAt: n.createdAt,
      body,
      failed,
    };
  });

  return { letters, loading, error, refresh };
}
