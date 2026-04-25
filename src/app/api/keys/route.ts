import { NextResponse } from "next/server";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

import { db } from "@/lib/db";
import { noteKeyRegistrationMessage } from "@/lib/letterbox";

// POST /api/keys — register a recipient's X25519 note pubkey
//   body: { walletPubkey, noteKey, signature, ...profile }
//   `signature` is base64 ed25519 over noteKeyRegistrationMessage(walletPubkey,
//   noteKey). Without it, an attacker could publish their own X25519 key
//   under a victim's wallet and intercept every note.

const RegisterSchema = z.object({
  walletPubkey: z.string().min(32).max(44),
  noteKey: z.string().min(40).max(48), // base64-encoded 32 bytes
  signature: z.string().min(80).max(120), // base64 ed25519 sig (64 bytes)
  handle: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9_]+$/i)
    .optional()
    .nullable(),
  displayName: z.string().max(80).optional().nullable(),
  bio: z.string().max(280).optional().nullable(),
  twitter: z.string().max(40).optional().nullable(),
  github: z.string().max(40).optional().nullable(),
});

function asPubkey(s: string): PublicKey | null {
  try {
    return new PublicKey(s);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const {
    walletPubkey,
    noteKey,
    signature,
    handle,
    displayName,
    bio,
    twitter,
    github,
  } = parsed.data;

  const wallet = asPubkey(walletPubkey);
  if (!wallet) {
    return NextResponse.json({ error: "invalid_pubkey" }, { status: 400 });
  }
  // Validate noteKey is exactly 32 bytes when decoded.
  let noteKeyBytes: Uint8Array;
  try {
    noteKeyBytes = Uint8Array.from(Buffer.from(noteKey, "base64"));
  } catch {
    return NextResponse.json({ error: "invalid_note_key" }, { status: 400 });
  }
  if (noteKeyBytes.length !== 32) {
    return NextResponse.json(
      { error: "invalid_note_key_length", got: noteKeyBytes.length },
      { status: 400 },
    );
  }

  // Verify the registration signature: walletPubkey signed
  // noteKeyRegistrationMessage(walletPubkey, noteKey).
  let sigBytes: Uint8Array;
  try {
    sigBytes = Uint8Array.from(Buffer.from(signature, "base64"));
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }
  if (sigBytes.length !== 64) {
    return NextResponse.json(
      { error: "invalid_signature_length", got: sigBytes.length },
      { status: 400 },
    );
  }
  const message = noteKeyRegistrationMessage(walletPubkey, noteKey);
  const ok = nacl.sign.detached.verify(message, sigBytes, wallet.toBytes());
  if (!ok) {
    return NextResponse.json(
      { error: "signature_did_not_verify" },
      { status: 401 },
    );
  }

  // Reject handle collision against a different pubkey.
  if (handle) {
    const existing = await db.maintainer.findUnique({
      where: { handle },
      select: { pubkey: true },
    });
    if (existing && existing.pubkey !== walletPubkey) {
      return NextResponse.json(
        { error: "handle_taken" },
        { status: 409 },
      );
    }
  }

  const maintainer = await db.maintainer.upsert({
    where: { pubkey: walletPubkey },
    create: {
      pubkey: walletPubkey,
      noteKey,
      handle: handle ?? undefined,
      displayName: displayName ?? undefined,
      bio: bio ?? undefined,
      twitter: twitter ?? undefined,
      github: github ?? undefined,
    },
    update: {
      noteKey,
      handle: handle ?? undefined,
      displayName: displayName ?? undefined,
      bio: bio ?? undefined,
      twitter: twitter ?? undefined,
      github: github ?? undefined,
    },
    select: {
      pubkey: true,
      handle: true,
      displayName: true,
      noteKey: true,
    },
  });
  return NextResponse.json({ maintainer });
}

// GET /api/keys?wallet=<base58> — fetch a maintainer's public profile +
// note key. Used by the Send page to encrypt to a recipient.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet");
  const handle = url.searchParams.get("handle");

  if (!wallet && !handle) {
    return NextResponse.json(
      { error: "missing_query" },
      { status: 400 },
    );
  }

  const maintainer = await db.maintainer.findFirst({
    where: wallet ? { pubkey: wallet } : { handle: handle! },
    select: {
      pubkey: true,
      handle: true,
      displayName: true,
      bio: true,
      twitter: true,
      github: true,
      avatarUrl: true,
      noteKey: true,
    },
  });
  if (!maintainer) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ maintainer });
}
