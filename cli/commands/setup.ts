import { PublicKey } from "@solana/web3.js";

import { buildLoyalClient } from "@/lib/loyal/client";
import { onboardForToken } from "@/lib/loyal/onboard";
import { DEFAULT_MINT } from "@/lib/constants";
import { bytesToBase64 } from "@/lib/encoding";

import { loadKeypair } from "../lib/keypair";
import { deriveNoteKeyForKeypair } from "../lib/derive-note-key";
import { bold, cyan, dim, green, red, symbols, yellow } from "../lib/log";

interface Args {
  keypair: string;
  apiBase: string;
  baseRpc?: string;
  ephemeralRpc?: string;
  ephemeralWs?: string;
  handle?: string;
  displayName?: string;
}

export async function setupCommand(args: Args): Promise<number> {
  const signer = loadKeypair(args.keypair);
  console.log(`${bold("Quill setup")} for ${cyan(signer.publicKey.toBase58())}`);

  console.log(`${dim("•")} Verifying TEE & fetching auth token…`);
  const client = await buildLoyalClient(signer, {
    baseRpcEndpoint: args.baseRpc,
    ephemeralRpcEndpoint: args.ephemeralRpc,
    ephemeralWsEndpoint: args.ephemeralWs,
  });

  const tokenMint = new PublicKey(
    process.env.QUILL_TOKEN_MINT ?? DEFAULT_MINT.toBase58(),
  );

  const result = await onboardForToken({
    client,
    user: signer.publicKey,
    tokenMint,
    onProgress: (p) => {
      const stamp = (label: string, status: { state: string }) => {
        const sym =
          status.state === "running"
            ? symbols.pending
            : status.state === "succeeded"
              ? symbols.ok
              : status.state === "skipped"
                ? green("○")
                : status.state === "failed"
                  ? symbols.err
                  : dim("·");
        return `  ${sym} ${label} ${dim(`(${status.state})`)}`;
      };
      console.log(stamp("initializeDeposit", p.initialize));
      console.log(stamp("createPermission ", p.permission));
      console.log(stamp("delegateDeposit  ", p.delegate));
    },
  });

  if (
    result.initialize.state === "failed" ||
    result.permission.state === "failed" ||
    result.delegate.state === "failed"
  ) {
    console.error(red("Onboarding failed. Re-run to retry — each step is idempotent."));
    return 1;
  }

  console.log(`${dim("•")} Deriving noteKey from wallet signature…`);
  const noteKp = deriveNoteKeyForKeypair(signer);
  const notePubB64 = bytesToBase64(noteKp.publicKey);

  console.log(`${dim("•")} Registering with ${cyan(args.apiBase)}…`);
  const res = await fetch(`${args.apiBase}/api/keys`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      walletPubkey: signer.publicKey.toBase58(),
      noteKey: notePubB64,
      handle: args.handle ?? null,
      displayName: args.displayName ?? null,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(red(`Register failed (${res.status}): ${body}`));
    return 1;
  }

  console.log("");
  console.log(`${green("✓")} ${bold("Inbox claimed.")}`);
  if (args.handle) {
    console.log(`  Public page: ${cyan(`${args.apiBase}/m/${args.handle}`)}`);
  }
  console.log(`  Pubkey:      ${cyan(signer.publicKey.toBase58())}`);
  console.log(`  noteKey:     ${dim(notePubB64)}`);
  console.log("");
  console.log(yellow("→ Tell senders to use the pubkey or handle above."));
  return 0;
}
