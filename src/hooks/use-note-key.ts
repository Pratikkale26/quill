"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import nacl from "tweetnacl";

import {
  deriveNoteKeyFromSignature,
  noteKeyChallenge,
  type NoteKeyPair,
} from "@/lib/letterbox";
import { base64ToBytes, bytesToBase64 } from "@/lib/encoding";

const STORAGE_PREFIX = "quill:noteKey:v1:";

type State =
  | { status: "idle" }
  | { status: "deriving" }
  | { status: "ready"; keyPair: NoteKeyPair; pubkeyB64: string }
  | { status: "error"; error: Error };

function rebuildKeyPairFromSecret(secretKey: Uint8Array): NoteKeyPair {
  if (secretKey.length !== 32) {
    throw new Error("note secret must be 32 bytes");
  }
  return {
    publicKey: nacl.scalarMult.base(secretKey),
    secretKey,
  };
}

/**
 * Returns a stable X25519 keypair derived from a wallet signature over a
 * versioned, wallet-bound challenge. The secret is cached in sessionStorage
 * so the user only signs once per browser tab.
 *
 * The hook is intentionally ON-DEMAND — it doesn't auto-prompt for a
 * signature on mount. Call `derive()` from a button click (Setup page,
 * Inbox open, etc.) so the wallet popup is user-initiated.
 */
export function useNoteKey() {
  const { publicKey, signMessage, connected } = useWallet();
  const [state, setState] = useState<State>({ status: "idle" });

  // Hydrate from sessionStorage when wallet is connected.
  useEffect(() => {
    if (!connected || !publicKey) {
      setState({ status: "idle" });
      return;
    }
    if (typeof window === "undefined") return;
    const cached = window.sessionStorage.getItem(
      STORAGE_PREFIX + publicKey.toBase58(),
    );
    if (!cached) return;
    try {
      const { secretKeyB64 } = JSON.parse(cached) as { secretKeyB64: string };
      const kp = rebuildKeyPairFromSecret(base64ToBytes(secretKeyB64));
      setState({
        status: "ready",
        keyPair: kp,
        pubkeyB64: bytesToBase64(kp.publicKey),
      });
    } catch {
      window.sessionStorage.removeItem(
        STORAGE_PREFIX + publicKey.toBase58(),
      );
    }
  }, [connected, publicKey]);

  const derive = useCallback(async (): Promise<NoteKeyPair | null> => {
    if (!publicKey) {
      throw new Error("Connect a wallet before deriving a note key");
    }
    if (!signMessage) {
      throw new Error(
        "Your wallet doesn't support signMessage — try Phantom or Solflare",
      );
    }
    setState({ status: "deriving" });
    try {
      const challenge = noteKeyChallenge(publicKey.toBase58());
      const signature = await signMessage(challenge);
      const kp = deriveNoteKeyFromSignature(signature);
      const pubkeyB64 = bytesToBase64(kp.publicKey);
      const secretKeyB64 = bytesToBase64(kp.secretKey);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          STORAGE_PREFIX + publicKey.toBase58(),
          JSON.stringify({ secretKeyB64, pubkeyB64 }),
        );
      }
      setState({ status: "ready", keyPair: kp, pubkeyB64 });
      return kp;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setState({ status: "error", error });
      return null;
    }
  }, [publicKey, signMessage]);

  const forget = useCallback(() => {
    if (typeof window !== "undefined" && publicKey) {
      window.sessionStorage.removeItem(
        STORAGE_PREFIX + publicKey.toBase58(),
      );
    }
    setState({ status: "idle" });
  }, [publicKey]);

  return { ...state, derive, forget };
}
