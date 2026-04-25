import { PublicKey } from "@solana/web3.js";

import { buildLoyalClient } from "@/lib/loyal/client";
import { sealNote } from "@/lib/letterbox";
import { DEFAULT_MINT, USDC_DECIMALS } from "@/lib/constants";

import { loadKeypair } from "../lib/keypair";
import { bold, cyan, dim, green, red, yellow } from "../lib/log";

interface Args {
  keypair: string;
  apiBase: string;
  to: string; // handle or pubkey
  amount: string; // human "5" or "0.50"
  note?: string;
  baseRpc?: string;
  ephemeralRpc?: string;
  ephemeralWs?: string;
}

function parseAmount(input: string, decimals: number): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`invalid amount: "${input}" (expected like "5" or "0.50")`);
  }
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) {
    throw new Error(`amount has ${frac.length} fractional digits; max ${decimals}`);
  }
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole + padded);
}

function isPubkeyish(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s.trim());
}

export async function sendCommand(args: Args): Promise<number> {
  const signer = loadKeypair(args.keypair);
  const target = args.to.replace(/^@/, "");

  console.log(`${bold("Quill send")} from ${cyan(signer.publicKey.toBase58())}`);

  // Resolve recipient.
  console.log(`${dim("•")} Looking up ${cyan(target)} via ${args.apiBase}…`);
  const lookupQuery = isPubkeyish(target)
    ? `wallet=${target}`
    : `handle=${target}`;
  const lookup = await fetch(`${args.apiBase}/api/keys?${lookupQuery}`);
  if (!lookup.ok) {
    if (lookup.status === 404) {
      console.error(
        red(`No private inbox found for "${target}". Ask them to claim one at /setup.`),
      );
    } else {
      console.error(red(`Lookup failed (${lookup.status})`));
    }
    return 1;
  }
  const { maintainer } = (await lookup.json()) as {
    maintainer: { pubkey: string; handle: string | null; noteKey: string | null };
  };
  if (!maintainer.noteKey) {
    console.error(
      red(`Recipient is registered but hasn't published a noteKey yet — they need to finish /setup.`),
    );
    return 1;
  }

  // Build client.
  console.log(`${dim("•")} Verifying TEE…`);
  const client = await buildLoyalClient(signer, {
    baseRpcEndpoint: args.baseRpc,
    ephemeralRpcEndpoint: args.ephemeralRpc,
    ephemeralWsEndpoint: args.ephemeralWs,
  });

  const amount = parseAmount(args.amount, USDC_DECIMALS);
  const tokenMint = new PublicKey(
    process.env.QUILL_TOKEN_MINT ?? DEFAULT_MINT.toBase58(),
  );

  // Encrypt note (if provided) before any on-chain action.
  const sealed = args.note ? sealNote(args.note, maintainer.noteKey) : null;

  console.log(
    `${dim("•")} Sending ${green(args.amount)} USDC privately to ${cyan(maintainer.handle ?? maintainer.pubkey)}…`,
  );
  let signature: string;
  try {
    signature = await client.transferDeposit({
      user: signer.publicKey,
      payer: signer.publicKey,
      tokenMint,
      destinationUser: new PublicKey(maintainer.pubkey),
      amount,
      sessionToken: null,
    });
  } catch (e) {
    console.error(red(`Transfer failed: ${e instanceof Error ? e.message : e}`));
    return 1;
  }
  console.log(`  ${green("✓")} tx ${dim(signature)}`);

  // Post the sealed note.
  if (sealed) {
    console.log(`${dim("•")} Saving encrypted note…`);
    const post = await fetch(`${args.apiBase}/api/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        txSignature: signature,
        recipientPubkey: maintainer.pubkey,
        senderPubkey: signer.publicKey.toBase58(),
        ephemeralPubkey: sealed.ephemeralPubkey,
        nonce: sealed.nonce,
        ciphertext: sealed.ciphertext,
        amount: amount.toString(),
        tokenMint: tokenMint.toBase58(),
      }),
    });
    if (!post.ok) {
      const body = await post.text().catch(() => "");
      console.warn(
        yellow(
          `  Transfer succeeded but note storage failed (${post.status}): ${body}`,
        ),
      );
      return 0;
    }
  }

  console.log("");
  console.log(`${green("✓")} ${bold("Sent privately.")}`);
  console.log(`  Recipient sees the letter when they unlock their /inbox.`);
  return 0;
}
