#!/usr/bin/env bun
// Quill CLI — private payments + E2EE notes from your terminal.
//
// Usage:
//   quill setup --keypair ~/.config/solana/id.json [--handle pratik]
//   quill send  --keypair ./id.json --to @alice --amount 5 --note "thanks"
//   quill tip   --keypair ./id.json --csv ./recipients.csv \
//               --default-amount 1 --note-template "thanks for {handle}"
//
// Env (also accepts CLI flags --base-rpc / --api-base / etc):
//   QUILL_API_BASE       default http://localhost:3000
//   QUILL_BASE_RPC       default https://api.devnet.solana.com
//   QUILL_EPHEMERAL_RPC  default https://tee.magicblock.app
//   QUILL_EPHEMERAL_WS   default wss://tee.magicblock.app
//   QUILL_TOKEN_MINT     default devnet USDC

import { setupCommand } from "./commands/setup";
import { sendCommand } from "./commands/send";
import { tipCommand } from "./commands/tip";
import { bold, dim, red } from "./lib/log";

interface Flags {
  [key: string]: string | true;
}

function parseFlags(argv: string[]): { positional: string[]; flags: Flags } {
  const flags: Flags = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq > -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else if (i + 1 < argv.length && !argv[i + 1]!.startsWith("--")) {
        flags[arg.slice(2)] = argv[++i]!;
      } else {
        flags[arg.slice(2)] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function pickString(flags: Flags, key: string): string | undefined {
  const v = flags[key];
  return typeof v === "string" ? v : undefined;
}

function commonArgs(flags: Flags) {
  return {
    apiBase:
      pickString(flags, "api-base") ??
      process.env.QUILL_API_BASE ??
      "http://localhost:3000",
    baseRpc:
      pickString(flags, "base-rpc") ?? process.env.QUILL_BASE_RPC,
    ephemeralRpc:
      pickString(flags, "ephemeral-rpc") ?? process.env.QUILL_EPHEMERAL_RPC,
    ephemeralWs:
      pickString(flags, "ephemeral-ws") ?? process.env.QUILL_EPHEMERAL_WS,
  };
}

function help(): string {
  return [
    bold("quill — private payments + E2EE notes"),
    "",
    `${dim("Usage:")} quill <setup|send|tip> [flags]`,
    "",
    bold("setup") + "  claim a private inbox for a keypair",
    "  --keypair <path>      JSON keypair file (Solana CLI format)",
    "  --handle <slug>       optional public handle",
    "  --display-name <s>    optional display name",
    "",
    bold("send") + "   send one private USDC + an E2EE note",
    "  --keypair <path>",
    "  --to <handle|pubkey>",
    "  --amount <usdc>       e.g. 5 or 0.50",
    "  --note <text>         optional, max 280 chars",
    "",
    bold("tip") + "    fan out from a CSV (recipient,amount,note)",
    "  --keypair <path>",
    "  --csv <path>          rows: recipient[,amount][,note]",
    "  --default-amount <n>  used when a row omits its amount",
    "  --note-template <s>   {handle} is substituted per row",
    "",
    bold("Common"),
    "  --api-base <url>      default $QUILL_API_BASE or http://localhost:3000",
    "  --base-rpc <url>      default $QUILL_BASE_RPC or devnet",
    "  --ephemeral-rpc <url> default $QUILL_EPHEMERAL_RPC",
    "  --help                show this",
  ].join("\n");
}

async function main(argv: string[]): Promise<number> {
  const { positional, flags } = parseFlags(argv);
  const cmd = positional[0];

  if (!cmd || flags["help"]) {
    console.log(help());
    return cmd ? 0 : 1;
  }

  const keypair = pickString(flags, "keypair");
  if (!keypair && cmd !== "help") {
    console.error(red("Missing --keypair <path>"));
    return 1;
  }

  const common = commonArgs(flags);

  switch (cmd) {
    case "setup":
      return setupCommand({
        keypair: keypair!,
        ...common,
        handle: pickString(flags, "handle"),
        displayName: pickString(flags, "display-name"),
      });
    case "send": {
      const to = pickString(flags, "to");
      const amount = pickString(flags, "amount");
      if (!to || !amount) {
        console.error(red("send requires --to and --amount"));
        return 1;
      }
      return sendCommand({
        keypair: keypair!,
        ...common,
        to,
        amount,
        note: pickString(flags, "note"),
      });
    }
    case "tip": {
      const csv = pickString(flags, "csv");
      if (!csv) {
        console.error(red("tip requires --csv <path>"));
        return 1;
      }
      return tipCommand({
        keypair: keypair!,
        ...common,
        csv,
        defaultAmount: pickString(flags, "default-amount"),
        noteTemplate: pickString(flags, "note-template"),
      });
    }
    default:
      console.error(red(`Unknown command: ${cmd}`));
      console.log(help());
      return 1;
  }
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(red(e instanceof Error ? e.stack ?? e.message : String(e)));
    process.exit(1);
  });
