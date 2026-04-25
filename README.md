# Quill

**Send Solana privately, with a note only the recipient can read.**

Private payments are not enough. Every Venmo memo needs to also be private.
Quill attaches an end-to-end-encrypted letter to every Loyal private
transfer — the amount stays inside MagicBlock's TEE, the words stay between
two wallets.

<!-- TODO(deploy): live URL -->

- Repo: https://github.com/Pratikkale26/quill
- Live: TODO — not yet deployed
- Built for: Loyal HQ Mini Build Challenge
- Network: Solana **devnet** only (mainnet endpoints wired, untested)

---

## What it does

Three pages and one public landing page, all backed by a tiny Next.js API
that holds opaque ciphertext.

**`/setup`** — connect a wallet, run `initializeDeposit → createPermission
→ delegateDeposit` against Loyal's SDK on devnet, then derive a
deterministic X25519 `noteKey` from a wallet-signed challenge
(`signMessage`). The X25519 *public* half is published to `POST /api/keys`;
the secret half lives in `sessionStorage` and never leaves the browser.

**`/send`** — look up a recipient's published `noteKey`, seal a plaintext
note with `nacl.box` (X25519 ECDH + XSalsa20-Poly1305) **before it leaves
the browser**, then call `client.transferDeposit()` inside MagicBlock's TEE.
Ciphertext is posted to `/api/notes` keyed by the on-chain tx signature.

**`/inbox`** — list ciphertext records for the connected wallet. Once the
user signs the noteKey challenge, the secret rebuilds in memory and every
letter decrypts client-side. Nothing plaintext ever touches the server,
disk, or `localStorage`. Wipe-on-tab-close.

**`/m/[handle]`** — public maintainer page with one CTA → `/send?to=<pubkey>`.
Surfaces a letter count but **never amounts** — public revenue would defeat
the privacy story.

---

## The novel primitive

E2EE notes attached to private payments.

The two prior contest entries — Ghost-Tip (handle-tipping with X-OAuth
claim) and Shroud (recurring private streams via Vercel cron + burner
key) — didn't touch encrypted memos. Quill is the entry that says: a
private payment without a private memo is half the product. So we built
the other half.

---

## Privacy boundary (be skeptical, judges will look)

- **On-chain:** transfer accounting lives inside MagicBlock's TEE — neither
  amount nor recipient balance leaks on-chain. ✓
- **In-browser:** note plaintext. Sealed via `nacl.box` against the
  recipient's X25519 key, derived deterministically from their wallet
  signature. ✓
- **Server-visible:** that *some* note exists for a recipient. We
  store recipient pubkey, optional sender pubkey (only if they signed
  it on Send), tx signature, timestamp, and ciphertext. Contents stay
  encrypted; metadata does not. ✗

We surface this boundary on every page, not just here. Don't sell what
you didn't build.

---

## Architecture

```
                                                  +---------------------+
   browser                                        |  Quill DB (Prisma)  |
   +---------------------+   POST ciphertext      |---------------------|
   |  nacl.box seal      |----------------------->| Maintainer (pubkey, |
   |  (X25519 + XSalsa20 |   GET ciphertext       |  noteKey pub, ...)  |
   |   -Poly1305)        |<-----------------------| Note (ciphertext,   |
   +---------+-----------+                        |  nonce, ephPub,     |
             |                                    |  txSig, amount)     |
             | client.transferDeposit()           +---------------------+
             v
   +---------------------+    delegated PDAs      +---------------------+
   |  MagicBlock TEE     |<---------------------->|  Solana base layer  |
   |  (Ephemeral Rollup) |    init/permission/    |  (devnet)           |
   |  amounts hidden     |    delegate, undelegate|  Loyal program      |
   +---------------------+                        +---------------------+
```

Three layers, each doing one job. The chain holds delegation state. The
TEE holds amounts. Our DB holds opaque ciphertext keyed by tx signature.
Nothing is loadbearing on us — drop our DB and the on-chain transfers
still settle, you just lose the memos.

---

## Tech stack

- Next.js 16 (App Router, Turbopack, Tailwind 4) on Bun
- `@loyal-labs/private-transactions` 0.2.8
- `@magicblock-labs/ephemeral-rollups-sdk` 0.11.2
- Solana wallet-adapter (Phantom, Solflare); Anchor 0.32
- Prisma 6 + SQLite locally / Postgres-ready for prod
- `tweetnacl` + `ed2curve` for the Letterbox crypto
- 8 round-trip + tamper tests pass under `bun test src/lib/letterbox.test.ts`

---

## File map

```
src/
  app/
    page.tsx                  landing
    setup/page.tsx            three-tx onboarding + key derivation
    send/page.tsx             encrypt + transfer
    inbox/page.tsx            decrypt-on-sign
    m/[handle]/page.tsx       public maintainer page
    api/
      keys/route.ts           POST/GET — register & fetch noteKeys
      notes/route.ts          POST/GET — store & list ciphertext
  hooks/
    use-loyal-client.ts       lazy-built SDK client tied to wallet
    use-note-key.ts           derive + cache X25519 secret per tab
    use-deposit.ts            base + ephemeral deposit snapshot
    use-inbox.ts              fetch + client-side decrypt
  lib/
    letterbox.ts              sealNote / openNote / deriveNoteKey
    letterbox.test.ts         8 tests — round-trip, tamper, determinism
    loyal/
      onboard.ts              init → permission → delegate orchestrator
      client.ts               buildLoyalClient(wallet) factory
cli/
  quill.ts                    entry — setup / send / tip subcommands
  commands/
    setup.ts                  onboard a keypair + register noteKey
    send.ts                   one private transfer + encrypted note
    tip.ts                    CSV fanout, calls send for each row
prisma/
  schema.prisma               Maintainer, Note, Event
```

---

## Honest limits

Judges will look. So:

- **Recipients must complete `/setup` before anyone can send to them.**
  The SDK's `ensureDelegated` check fires *before* the on-chain transfer
  on **both** the source and destination Deposit PDAs (`dist/index.js`
  lines 2758–2759). There is no `init_if_needed` escape hatch — the
  destination has to be delegated already. Confirmed by reading the
  compiled SDK.
- **No funding step yet** (`modifyBalance` increase). Use a pre-funded
  devnet wallet for the demo.
- **No unshield UI yet** (undelegate + `modifyBalance` decrease).
- **CLI signs every transfer with the user's keypair** — there's no
  burner-key delegation yet, so `quill tip` against 50 recipients means
  50 sequential signatures from the loaded keypair (still fast on devnet,
  ~2s each). Burner-key fanout (Shroud's pattern) is a follow-up.
- **Devnet only.** Mainnet endpoints exist in `.env.example` but nothing
  has been tested against mainnet-beta. Do not assume it works.

---

## Quick start

You'll need Bun, a Phantom or Solflare wallet on devnet, and a pre-funded
USDC-Dev balance on the wallet you plan to receive with.

```bash
bun install
cp .env.example .env.local        # sqlite default works as-is
bun run prisma db push            # creates the SQLite file
bun run dev
```

Then:

1. Open http://localhost:3000/setup with Phantom on devnet.
2. Run the three-step onboarding (init / permission / delegate).
3. Sign once more to derive your noteKey, optionally claim a `@handle`.
4. Share `/m/<handle>` and watch the inbox.

Run the crypto tests:

```bash
bun test src/lib/letterbox.test.ts
```

---

## CLI

There's a tiny CLI for terminal-native flows. It reuses the same
Letterbox crypto and onboarding orchestrator as the web app, so the
ciphertext you produce here decrypts in `/inbox` exactly the same way.

```bash
# claim a private inbox for a keypair file
bun run cli/quill.ts setup \
  --keypair ~/.config/solana/id.json \
  --handle pratik

# send one private USDC + an encrypted note
bun run cli/quill.ts send \
  --keypair ~/.config/solana/id.json \
  --to @pratik \
  --amount 5 \
  --note "thanks for axios — saved my afternoon"

# fan out from a CSV (recipient,amount,note)
bun run cli/quill.ts tip \
  --keypair ~/.config/solana/id.json \
  --csv ./recipients.csv \
  --default-amount 1 \
  --note-template "thanks for {handle}"
```

The CSV format is `recipient,amount,note` per row, with optional header.
Each row inherits `--default-amount` and `--note-template` if its column
is empty. `{handle}` is substituted in the template.

Common flags: `--api-base` (default `$QUILL_API_BASE` or
`http://localhost:3000`), `--base-rpc`, `--ephemeral-rpc`. The CLI uses
the same constants module as the web app, so devnet defaults are wired.

---

## How the noteKey works (one paragraph)

The recipient signs a versioned, wallet-bound challenge string with their
Solana wallet (Ed25519). The signature is deterministic for a given
(wallet, message) pair, so the derived key is stable across sessions.
We hash the signature with SHA-512, take the first 32 bytes as a seed,
and feed it into `nacl.box.keyPair.fromSecretKey` to get a Curve25519
keypair. The public half is published; the secret half is rebuilt
on-demand whenever the user re-signs the same challenge. No new wallet,
no extra account, no custody.

See `src/lib/letterbox.ts` for the full construction and `letterbox.test.ts`
for the round-trip and tamper tests.

---

## License

MIT. Build whatever you want with this. If you ship private memos on
top of Loyal in production, link back so people can find the primitive.
