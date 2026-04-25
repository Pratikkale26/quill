import {
  LoyalPrivateTransactionsClient,
  type WalletLike,
} from "@loyal-labs/private-transactions";
import { Keypair } from "@solana/web3.js";

import { BASE_RPC, EPHEMERAL_RPC, EPHEMERAL_WS } from "@/lib/constants";

export type LoyalClient = LoyalPrivateTransactionsClient;

export type LoyalSigner = WalletLike | Keypair;

/**
 * Build a Loyal client with our centralized devnet/mainnet endpoints.
 * `fromConfig` is async — it does TEE attestation + auth-token handshake.
 * Memoize callers; do NOT rebuild on every render.
 */
export async function buildLoyalClient(
  signer: LoyalSigner,
  overrides?: {
    baseRpcEndpoint?: string;
    ephemeralRpcEndpoint?: string;
    ephemeralWsEndpoint?: string;
  },
): Promise<LoyalClient> {
  return LoyalPrivateTransactionsClient.fromConfig({
    signer,
    baseRpcEndpoint: overrides?.baseRpcEndpoint ?? BASE_RPC,
    ephemeralRpcEndpoint: overrides?.ephemeralRpcEndpoint ?? EPHEMERAL_RPC,
    ephemeralWsEndpoint: overrides?.ephemeralWsEndpoint ?? EPHEMERAL_WS,
    commitment: "confirmed",
  });
}
