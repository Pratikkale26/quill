// Typed wrappers around our /api routes. Used by both the Next.js UI
// and (later) the CLI, so the shapes stay aligned.

import type { SealedNote } from "./letterbox";

export interface MaintainerProfile {
  pubkey: string;
  handle: string | null;
  displayName: string | null;
  bio?: string | null;
  twitter?: string | null;
  github?: string | null;
  avatarUrl?: string | null;
  noteKey: string | null;
}

export interface SealedNoteRecord {
  id: string;
  txSignature: string;
  senderPubkey: string | null;
  ephemeralPubkey: string;
  nonce: string;
  ciphertext: string;
  amount: string;
  tokenMint: string;
  createdAt: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new ApiError(
      res.status,
      body?.error ?? `http_${res.status}`,
      body?.message,
    );
  }
  return (await res.json()) as T;
}

export async function lookupMaintainer(args: {
  wallet?: string;
  handle?: string;
  baseUrl?: string;
}): Promise<MaintainerProfile> {
  const base = args.baseUrl ?? "";
  const params = new URLSearchParams();
  if (args.wallet) params.set("wallet", args.wallet);
  else if (args.handle) params.set("handle", args.handle);
  else throw new Error("lookupMaintainer requires wallet or handle");
  const res = await fetch(`${base}/api/keys?${params.toString()}`);
  const { maintainer } = await jsonOrThrow<{ maintainer: MaintainerProfile }>(
    res,
  );
  return maintainer;
}

export async function postSealedNote(args: {
  txSignature: string;
  recipientPubkey: string;
  senderPubkey: string | null;
  sealed: SealedNote;
  amount: string;
  tokenMint: string;
  baseUrl?: string;
}): Promise<{ id: string }> {
  const base = args.baseUrl ?? "";
  const res = await fetch(`${base}/api/notes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      txSignature: args.txSignature,
      recipientPubkey: args.recipientPubkey,
      senderPubkey: args.senderPubkey,
      ephemeralPubkey: args.sealed.ephemeralPubkey,
      nonce: args.sealed.nonce,
      ciphertext: args.sealed.ciphertext,
      amount: args.amount,
      tokenMint: args.tokenMint,
    }),
  });
  const { note } = await jsonOrThrow<{ note: { id: string } }>(res);
  return note;
}

export async function listSealedNotes(args: {
  recipient: string;
  limit?: number;
  baseUrl?: string;
}): Promise<SealedNoteRecord[]> {
  const base = args.baseUrl ?? "";
  const params = new URLSearchParams({ recipient: args.recipient });
  if (args.limit) params.set("limit", String(args.limit));
  const res = await fetch(`${base}/api/notes?${params.toString()}`);
  const { notes } = await jsonOrThrow<{ notes: SealedNoteRecord[] }>(res);
  return notes;
}
