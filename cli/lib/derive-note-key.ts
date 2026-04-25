// Mirror of the browser-side note-key derivation, but driven by a
// Solana CLI keypair. The signMessage path uses tweetnacl.sign.detached
// over the same domain-separated challenge so the resulting noteKey is
// identical to what a Phantom signMessage would produce.

import nacl from "tweetnacl";
import type { Keypair } from "@solana/web3.js";

import {
  deriveNoteKeyFromSignature,
  noteKeyChallenge,
  type NoteKeyPair,
} from "@/lib/letterbox";

export function deriveNoteKeyForKeypair(kp: Keypair): NoteKeyPair {
  const challenge = noteKeyChallenge(kp.publicKey.toBase58());
  const sig = nacl.sign.detached(challenge, kp.secretKey);
  return deriveNoteKeyFromSignature(sig);
}
