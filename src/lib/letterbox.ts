// Letterbox — Quill's E2EE note channel.
//
// Goal: attach a private message to every Loyal transfer. Server stores
// only opaque ciphertext. Only the recipient — using their Solana wallet
// to sign a deterministic challenge — can read it.
//
// Construction:
//   1. Recipient signs CHALLENGE_TEMPLATE(walletPubkey) with their wallet.
//      The signature is deterministic for a given (wallet, message) pair
//      on Ed25519, so the derived key is stable.
//   2. seed = SHA-512(signature)[..32]
//   3. recipientNoteKey = nacl.box.keyPair.fromSecretKey(seed)
//      The PUBLIC half is registered in our DB; the SECRET half stays in
//      the browser (sessionStorage), re-derivable any time the user re-signs.
//   4. Sender does:
//        ephemeral = nacl.box.keyPair()
//        nonce     = randomBytes(24)
//        ciphertext = nacl.box(utf8(note), nonce, recipientNoteKey.pub, ephemeral.secret)
//      and POSTs (ephemeral.pub, nonce, ciphertext) keyed by tx signature.
//   5. Recipient decrypts:
//        nacl.box.open(ciphertext, nonce, ephemeralPub, recipientNoteKey.secret)
//
// Trust note: the *fact* that a note exists for a recipient is server-visible.
// Only the contents are private. We surface this honestly in the README.

import nacl from "tweetnacl";

import { base64ToBytes, bytesToBase64, utf8ToBytes, bytesToUtf8 } from "./encoding";

export const NOTE_KEY_VERSION = "v1";

/**
 * Domain-separated, wallet-bound challenge string. The wallet pubkey is
 * embedded so a signature for one wallet can't be reused for another.
 * Versioned so we can rotate later without breaking old keys.
 */
export function noteKeyChallenge(walletPubkeyBase58: string): Uint8Array {
  const text =
    `Quill ${NOTE_KEY_VERSION} note key derivation\n\n` +
    `Wallet: ${walletPubkeyBase58}\n` +
    `Purpose: derive Curve25519 secret for end-to-end-encrypted note inbox\n\n` +
    `By signing this you grant nothing on-chain — this is purely a key derivation.`;
  return utf8ToBytes(text);
}

export interface NoteKeyPair {
  publicKey: Uint8Array; // 32 bytes
  secretKey: Uint8Array; // 32 bytes
}

/**
 * Derive an X25519 keypair from an Ed25519 signature over the challenge.
 * Caller (a React hook) is responsible for caching the result so the user
 * isn't prompted on every action.
 */
export function deriveNoteKeyFromSignature(signature: Uint8Array): NoteKeyPair {
  if (signature.length < 32) {
    throw new Error("signature too short to derive a note key");
  }
  // SHA-512(sig) — first 32 bytes feed nacl.box (X25519) clamping.
  const hash = nacl.hash(signature);
  const seed = hash.slice(0, 32);
  const kp = nacl.box.keyPair.fromSecretKey(seed);
  return { publicKey: kp.publicKey, secretKey: kp.secretKey };
}

export interface SealedNote {
  ephemeralPubkey: string; // base64
  nonce: string; // base64
  ciphertext: string; // base64
}

/**
 * Encrypt `plaintext` to the recipient's noteKey. Ephemeral keypair is
 * generated per call — there's no link between successive notes from the
 * same sender.
 */
export function sealNote(
  plaintext: string,
  recipientNotePubB64: string,
): SealedNote {
  const recipientPub = base64ToBytes(recipientNotePubB64);
  if (recipientPub.length !== 32) {
    throw new Error("recipient note key must be 32 bytes");
  }
  const ephemeral = nacl.box.keyPair();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const ciphertext = nacl.box(
    utf8ToBytes(plaintext),
    nonce,
    recipientPub,
    ephemeral.secretKey,
  );
  return {
    ephemeralPubkey: bytesToBase64(ephemeral.publicKey),
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(ciphertext),
  };
}

/**
 * Decrypt a sealed note with the recipient's note secret. Returns the
 * plaintext string, or null if the ciphertext / nonce / key combination
 * doesn't authenticate (which means tampering OR the wrong key).
 */
export function openNote(
  sealed: SealedNote,
  recipientNoteSecret: Uint8Array,
): string | null {
  if (recipientNoteSecret.length !== 32) {
    throw new Error("recipient note secret must be 32 bytes");
  }
  const ephemeralPub = base64ToBytes(sealed.ephemeralPubkey);
  const nonce = base64ToBytes(sealed.nonce);
  const ciphertext = base64ToBytes(sealed.ciphertext);
  const plaintext = nacl.box.open(
    ciphertext,
    nonce,
    ephemeralPub,
    recipientNoteSecret,
  );
  if (!plaintext) return null;
  return bytesToUtf8(plaintext);
}

/** Constant-time compare two Uint8Arrays. */
export function ctEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}
