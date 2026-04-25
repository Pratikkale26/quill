// Round-trip + tamper tests for the Letterbox crypto. Run with `bun test`.

import { describe, expect, test } from "bun:test";
import nacl from "tweetnacl";

import {
  deriveNoteKeyFromSignature,
  noteKeyChallenge,
  noteKeyRegistrationMessage,
  openNote,
  sealNote,
} from "./letterbox";
import { base64ToBytes, bytesToBase64 } from "./encoding";

describe("letterbox", () => {
  test("seal → open round-trips utf-8 plaintext", () => {
    const recipient = nacl.box.keyPair();
    const recipientPubB64 = bytesToBase64(recipient.publicKey);

    const plaintext = "thanks for axios — saved my afternoon 🙏";
    const sealed = sealNote(plaintext, recipientPubB64);

    const decrypted = openNote(sealed, recipient.secretKey);
    expect(decrypted).toBe(plaintext);
  });

  test("ephemeral pubkey changes between calls (no link between notes)", () => {
    const recipient = nacl.box.keyPair();
    const recipientPubB64 = bytesToBase64(recipient.publicKey);

    const a = sealNote("note a", recipientPubB64);
    const b = sealNote("note b", recipientPubB64);
    expect(a.ephemeralPubkey).not.toBe(b.ephemeralPubkey);
    expect(a.nonce).not.toBe(b.nonce);
  });

  test("wrong recipient key returns null (no panic)", () => {
    const recipient = nacl.box.keyPair();
    const attacker = nacl.box.keyPair();
    const sealed = sealNote("for someone else", bytesToBase64(recipient.publicKey));
    expect(openNote(sealed, attacker.secretKey)).toBeNull();
  });

  test("tampered ciphertext returns null", () => {
    const recipient = nacl.box.keyPair();
    const sealed = sealNote("hello", bytesToBase64(recipient.publicKey));
    const corrupted = base64ToBytes(sealed.ciphertext);
    corrupted[0] ^= 1;
    const result = openNote(
      { ...sealed, ciphertext: bytesToBase64(corrupted) },
      recipient.secretKey,
    );
    expect(result).toBeNull();
  });

  test("deriveNoteKeyFromSignature is deterministic for the same signature", () => {
    // Simulate a fixed Ed25519 signature (64 bytes of 0x42).
    const sig = new Uint8Array(64).fill(0x42);
    const a = deriveNoteKeyFromSignature(sig);
    const b = deriveNoteKeyFromSignature(sig);
    expect(bytesToBase64(a.secretKey)).toBe(bytesToBase64(b.secretKey));
    expect(bytesToBase64(a.publicKey)).toBe(bytesToBase64(b.publicKey));
    expect(a.publicKey.length).toBe(32);
    expect(a.secretKey.length).toBe(32);
  });

  test("different signatures derive different keypairs", () => {
    const a = deriveNoteKeyFromSignature(new Uint8Array(64).fill(0x01));
    const b = deriveNoteKeyFromSignature(new Uint8Array(64).fill(0x02));
    expect(bytesToBase64(a.secretKey)).not.toBe(bytesToBase64(b.secretKey));
  });

  test("end-to-end with a derived note key", () => {
    // Senders look up the recipient's published public key only.
    const recipientSig = new Uint8Array(64);
    crypto.getRandomValues(recipientSig);
    const recipientNoteKp = deriveNoteKeyFromSignature(recipientSig);
    const recipientPubB64 = bytesToBase64(recipientNoteKp.publicKey);

    const sealed = sealNote("rent for april — leaving the wifi password in the closet", recipientPubB64);

    const decrypted = openNote(sealed, recipientNoteKp.secretKey);
    expect(decrypted).toBe(
      "rent for april — leaving the wifi password in the closet",
    );
  });

  test("noteKeyChallenge is wallet-bound", () => {
    const a = noteKeyChallenge("9XK4abc...");
    const b = noteKeyChallenge("8YK5xyz...");
    expect(new TextDecoder().decode(a)).not.toBe(
      new TextDecoder().decode(b),
    );
  });

  test("registration signature round-trips (CLI-style nacl.sign.detached)", () => {
    // Simulates exactly what the CLI does in setup.ts and what the
    // server does in /api/keys. If this passes, browser signMessage —
    // which is plain Ed25519 over the same bytes — verifies the same
    // way. (Solana wallet adapter spec mandates raw Ed25519 with no
    // wrapper.)
    const wallet = nacl.sign.keyPair();
    const noteKey = nacl.box.keyPair();
    const noteKeyB64 = bytesToBase64(noteKey.publicKey);
    const walletB58 =
      // base58-ish stub; the message is content-addressed to whatever
      // string we hand it, so any pubkey-shaped representation works
      // for the round-trip test.
      "TestWallet" + bytesToBase64(wallet.publicKey).slice(0, 32);

    const message = noteKeyRegistrationMessage(walletB58, noteKeyB64);
    const sig = nacl.sign.detached(message, wallet.secretKey);
    expect(sig.length).toBe(64);

    const ok = nacl.sign.detached.verify(message, sig, wallet.publicKey);
    expect(ok).toBe(true);

    // Wrong noteKey under same wallet must fail.
    const evilNoteKey = nacl.box.keyPair();
    const evilMessage = noteKeyRegistrationMessage(
      walletB58,
      bytesToBase64(evilNoteKey.publicKey),
    );
    expect(
      nacl.sign.detached.verify(evilMessage, sig, wallet.publicKey),
    ).toBe(false);

    // Different wallet pubkey must fail to verify.
    const otherWallet = nacl.sign.keyPair();
    expect(
      nacl.sign.detached.verify(message, sig, otherWallet.publicKey),
    ).toBe(false);
  });
});
