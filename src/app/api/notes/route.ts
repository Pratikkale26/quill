import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";

// POST /api/notes — record a new sealed note for a transfer.
// GET /api/notes?recipient=<base58>&since=<iso> — list sealed notes for inbox.

const PostSchema = z.object({
  txSignature: z.string().min(40).max(120),
  recipientPubkey: z.string().min(32).max(44),
  senderPubkey: z.string().min(32).max(44).optional().nullable(),
  ephemeralPubkey: z.string().min(40).max(48), // base64 32 bytes
  nonce: z.string().min(28).max(40), // base64 24 bytes
  ciphertext: z.string().min(1),
  amount: z.string().regex(/^\d+$/),
  tokenMint: z.string().min(32).max(44),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Recipient must be a known Maintainer (FK + ensures noteKey is registered).
  const recipient = await db.maintainer.findUnique({
    where: { pubkey: data.recipientPubkey },
    select: { pubkey: true, noteKey: true },
  });
  if (!recipient || !recipient.noteKey) {
    return NextResponse.json(
      { error: "recipient_not_onboarded" },
      { status: 404 },
    );
  }

  // Auto-create sender as a stub Maintainer if they aren't one. This keeps
  // the FK happy without making senders go through full onboarding.
  if (data.senderPubkey) {
    await db.maintainer.upsert({
      where: { pubkey: data.senderPubkey },
      create: { pubkey: data.senderPubkey },
      update: {},
    });
  }

  try {
    const note = await db.note.create({
      data: {
        txSignature: data.txSignature,
        recipientPubkey: data.recipientPubkey,
        senderPubkey: data.senderPubkey ?? null,
        ephemeralPubkey: data.ephemeralPubkey,
        nonce: data.nonce,
        ciphertext: data.ciphertext,
        amount: data.amount,
        tokenMint: data.tokenMint,
      },
      select: { id: true, createdAt: true },
    });
    await db.event.create({
      data: {
        type: "tip",
        txSignature: data.txSignature,
        senderPubkey: data.senderPubkey ?? null,
        recipientPubkey: data.recipientPubkey,
        tokenMint: data.tokenMint,
        amount: data.amount,
        hasNote: true,
      },
    });
    return NextResponse.json({ note });
  } catch (err) {
    if (
      typeof err === "object" &&
      err &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "duplicate_tx" },
        { status: 409 },
      );
    }
    throw err;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const recipient = url.searchParams.get("recipient");
  if (!recipient) {
    return NextResponse.json(
      { error: "missing_recipient" },
      { status: 400 },
    );
  }

  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? 50), 1),
    200,
  );

  const notes = await db.note.findMany({
    where: { recipientPubkey: recipient },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      txSignature: true,
      senderPubkey: true,
      ephemeralPubkey: true,
      nonce: true,
      ciphertext: true,
      amount: true,
      tokenMint: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ notes });
}
