import { PublicKey } from "@solana/web3.js";

export const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet") as
  | "devnet"
  | "mainnet";

export const BASE_RPC =
  process.env.NEXT_PUBLIC_BASE_RPC ??
  (NETWORK === "mainnet"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com");

export const EPHEMERAL_RPC =
  process.env.NEXT_PUBLIC_EPHEMERAL_RPC ??
  (NETWORK === "mainnet"
    ? "https://mainnet-tee.magicblock.app"
    : "https://tee.magicblock.app");

export const EPHEMERAL_WS =
  process.env.NEXT_PUBLIC_EPHEMERAL_WS ??
  (NETWORK === "mainnet"
    ? "wss://mainnet-tee.magicblock.app"
    : "wss://tee.magicblock.app");

// USDC-Dev on Solana devnet (4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU)
// USDC on mainnet (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)
export const DEFAULT_MINT_STR =
  process.env.NEXT_PUBLIC_DEFAULT_MINT ??
  (NETWORK === "mainnet"
    ? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    : "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

export const DEFAULT_MINT = new PublicKey(DEFAULT_MINT_STR);

export const USDC_DECIMALS = 6;

// Per-network ER validator pubkey is derived inside the Loyal SDK by
// passing the *base* RPC endpoint string to getErValidatorForRpcEndpoint.
// Centralized here so we don't accidentally hard-code ER_VALIDATOR
// (which silently defaults to devnet).
export { getErValidatorForRpcEndpoint } from "@loyal-labs/private-transactions";
