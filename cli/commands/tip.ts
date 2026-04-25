import { readFileSync } from "node:fs";

import { sendCommand } from "./send";
import { bold, cyan, dim, green, red, yellow } from "../lib/log";

interface Args {
  keypair: string;
  apiBase: string;
  csv: string; // path to CSV with `recipient,amount,note` columns
  defaultAmount?: string;
  noteTemplate?: string;
  baseRpc?: string;
  ephemeralRpc?: string;
  ephemeralWs?: string;
}

interface Row {
  recipient: string;
  amount?: string;
  note?: string;
}

function parseCsv(content: string): Row[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  const out: Row[] = [];
  // Skip header if first line is non-recipient-looking (contains "recipient" or "handle").
  let start = 0;
  const head = lines[0]?.toLowerCase() ?? "";
  if (head.includes("recipient") || head.includes("handle") || head.includes("pubkey")) {
    start = 1;
  }
  for (let i = start; i < lines.length; i++) {
    const fields = lines[i]!.split(",").map((s) => s.trim());
    if (fields.length === 0 || !fields[0]) continue;
    out.push({
      recipient: fields[0],
      amount: fields[1] || undefined,
      note: fields[2] || undefined,
    });
  }
  return out;
}

export async function tipCommand(args: Args): Promise<number> {
  const csv = readFileSync(args.csv, "utf8");
  const rows = parseCsv(csv);
  if (rows.length === 0) {
    console.error(red(`No rows in ${args.csv}.`));
    return 1;
  }

  console.log(
    `${bold("Quill tip")} fanning out ${cyan(String(rows.length))} private letter${rows.length > 1 ? "s" : ""}.`,
  );

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const amount = row.amount ?? args.defaultAmount;
    if (!amount) {
      console.warn(
        yellow(`  ${dim(`[${i + 1}/${rows.length}]`)} skip ${row.recipient} — no amount`),
      );
      fail++;
      continue;
    }
    let note = row.note;
    if (!note && args.noteTemplate) {
      note = args.noteTemplate.replace(/\{handle\}/g, row.recipient);
    }
    console.log("");
    console.log(
      `${dim(`[${i + 1}/${rows.length}]`)} ${bold("→")} ${cyan(row.recipient)} ${dim(`(${amount} USDC)`)}`,
    );
    const code = await sendCommand({
      keypair: args.keypair,
      apiBase: args.apiBase,
      to: row.recipient,
      amount,
      note,
      baseRpc: args.baseRpc,
      ephemeralRpc: args.ephemeralRpc,
      ephemeralWs: args.ephemeralWs,
    });
    if (code === 0) ok++;
    else fail++;
  }

  console.log("");
  console.log(
    `${green("✓")} ${bold(`${ok}`)} sent ${dim("·")} ${red(String(fail))} failed`,
  );
  return fail === 0 ? 0 : 1;
}
