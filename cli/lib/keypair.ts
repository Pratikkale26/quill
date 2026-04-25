// Load a Solana Keypair from a JSON file (Solana CLI format).
import { readFileSync } from "node:fs";
import { Keypair } from "@solana/web3.js";

export function loadKeypair(path: string): Keypair {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(
      `Couldn't read keypair at ${path}: ${e instanceof Error ? e.message : e}`,
    );
  }
  if (!Array.isArray(raw)) {
    throw new Error(
      `Keypair at ${path} must be a JSON array of bytes (Solana CLI format).`,
    );
  }
  if (raw.length !== 64) {
    throw new Error(
      `Keypair at ${path} has ${raw.length} bytes; expected 64.`,
    );
  }
  return Keypair.fromSecretKey(Uint8Array.from(raw as number[]));
}
