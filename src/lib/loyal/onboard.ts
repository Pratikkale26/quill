// Onboarding orchestrator — moves a fresh user through the
// init → permission → delegate sequence so they can receive private
// transfers. Each step is idempotent; the function returns a per-step
// status so the UI can show what already existed vs. what was newly
// created.

import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  getErValidatorForRpcEndpoint,
  type LoyalPrivateTransactionsClient,
} from "@loyal-labs/private-transactions";

import { BASE_RPC } from "@/lib/constants";

export type StepStatus =
  | { state: "pending" }
  | { state: "running" }
  | { state: "skipped"; reason: string }
  | { state: "succeeded"; signature: string | null }
  | { state: "failed"; error: string };

export interface OnboardProgress {
  initialize: StepStatus;
  fund: StepStatus;
  permission: StepStatus;
  delegate: StepStatus;
}

export const initialOnboardProgress: OnboardProgress = {
  initialize: { state: "pending" },
  fund: { state: "pending" },
  permission: { state: "pending" },
  delegate: { state: "pending" },
};

export interface OnboardParams {
  client: LoyalPrivateTransactionsClient;
  user: PublicKey;
  payer?: PublicKey; // defaults to user
  tokenMint: PublicKey;
  validator?: PublicKey; // defaults to per-network ER validator
  /**
   * Amount in token base units to shield during onboarding (between init
   * and permission, per Shroud's verified order). Pass 0n or omit to skip
   * funding — the deposit will still be created and delegated, just empty.
   */
  fundAmount?: bigint;
  /**
   * Override the user's token ATA. Defaults to the canonical SPL Token
   * (not Token-2022) ATA for (user, tokenMint).
   */
  userTokenAccount?: PublicKey;
  onProgress?: (progress: OnboardProgress) => void;
}

const errMsg = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

const isAlreadyExistsLike = (msg: string): boolean =>
  /already in use|already initialized|already exists|account already/i.test(
    msg,
  );

const isAlreadyDelegatedLike = (msg: string): boolean =>
  /already delegated|delegated to ER/i.test(msg);

export async function onboardForToken(
  params: OnboardParams,
): Promise<OnboardProgress> {
  const { client, user, tokenMint, onProgress } = params;
  const payer = params.payer ?? user;
  const validator =
    params.validator ?? getErValidatorForRpcEndpoint(BASE_RPC);
  const fundAmount = params.fundAmount ?? 0n;
  const userTokenAccount =
    params.userTokenAccount ?? getAssociatedTokenAddressSync(tokenMint, user);

  const progress: OnboardProgress = { ...initialOnboardProgress };
  const tick = () => onProgress?.({ ...progress });

  // 1. initializeDeposit — idempotent. SDK returns the tx sig or no-ops.
  progress.initialize = { state: "running" };
  tick();
  try {
    const sig = await client.initializeDeposit({
      tokenMint,
      user,
      payer,
    });
    progress.initialize = { state: "succeeded", signature: sig ?? null };
  } catch (e) {
    const msg = errMsg(e);
    if (isAlreadyExistsLike(msg)) {
      progress.initialize = {
        state: "skipped",
        reason: "deposit account already exists",
      };
    } else {
      progress.initialize = { state: "failed", error: msg };
      tick();
      return progress;
    }
  }
  tick();

  // 2. (Optional) fund — modifyBalance(increase). Order matters:
  // funding has to happen BEFORE delegate, because the base PDA can't
  // be modifyBalance'd once it's owned by the delegation program.
  if (fundAmount > 0n) {
    progress.fund = { state: "running" };
    tick();
    try {
      const result = await client.modifyBalance({
        tokenMint,
        user,
        payer,
        amount: fundAmount,
        increase: true,
        userTokenAccount,
      });
      progress.fund = { state: "succeeded", signature: result.signature };
    } catch (e) {
      progress.fund = { state: "failed", error: errMsg(e) };
      tick();
      return progress;
    }
    tick();
  } else {
    progress.fund = {
      state: "skipped",
      reason: "no fund amount provided",
    };
    tick();
  }

  // 3. createPermission — returns null if already present.
  progress.permission = { state: "running" };
  tick();
  try {
    const sig = await client.createPermission({
      tokenMint,
      user,
      payer,
    });
    if (sig === null) {
      progress.permission = {
        state: "skipped",
        reason: "permission already exists",
      };
    } else {
      progress.permission = { state: "succeeded", signature: sig };
    }
  } catch (e) {
    progress.permission = { state: "failed", error: errMsg(e) };
    tick();
    return progress;
  }
  tick();

  // 4. delegateDeposit — flips owner to delegation program.
  progress.delegate = { state: "running" };
  tick();
  try {
    const sig = await client.delegateDeposit({
      tokenMint,
      user,
      payer,
      validator,
    });
    progress.delegate = { state: "succeeded", signature: sig };
  } catch (e) {
    const msg = errMsg(e);
    if (isAlreadyDelegatedLike(msg)) {
      progress.delegate = {
        state: "skipped",
        reason: "already delegated to TEE",
      };
    } else {
      progress.delegate = { state: "failed", error: msg };
    }
  }
  tick();
  return progress;
}

export interface DepositSnapshot {
  baseAmount: bigint | null;
  ephemeralAmount: bigint | null;
  isDelegated: boolean;
}

/**
 * Read the user's deposit on both layers. Delegated deposits only show
 * up on the ephemeral side (base PDA owner is the delegation program and
 * Anchor can't deserialize it as a Deposit there).
 */
export async function readDepositSnapshot(
  client: LoyalPrivateTransactionsClient,
  user: PublicKey,
  tokenMint: PublicKey,
): Promise<DepositSnapshot> {
  const [base, ephemeral] = await Promise.all([
    client.getBaseDeposit(user, tokenMint).catch(() => null),
    client.getEphemeralDeposit(user, tokenMint).catch(() => null),
  ]);
  return {
    baseAmount: base?.amount ?? null,
    ephemeralAmount: ephemeral?.amount ?? null,
    isDelegated: !!ephemeral && !base,
  };
}

import { MAGIC_CONTEXT_ID, MAGIC_PROGRAM_ID } from "@loyal-labs/private-transactions";

export interface TopUpProgress {
  undelegate: StepStatus;
  fund: StepStatus;
  redelegate: StepStatus;
}

export const initialTopUpProgress: TopUpProgress = {
  undelegate: { state: "pending" },
  fund: { state: "pending" },
  redelegate: { state: "pending" },
};

export interface TopUpParams {
  client: LoyalPrivateTransactionsClient;
  user: PublicKey;
  payer?: PublicKey;
  tokenMint: PublicKey;
  validator?: PublicKey;
  amount: bigint;
  userTokenAccount?: PublicKey;
  onProgress?: (progress: TopUpProgress) => void;
}

/**
 * Add balance to an already-delegated deposit. Pattern lifted from
 * Shroud's signed-cancel: undelegate (committing PER state back to base) →
 * modifyBalance(increase) → re-delegate. Each tx is a wallet popup; the
 * undelegate blocks until the SDK confirms ownership flipped back to
 * PROGRAM_ID on both layers.
 */
export async function topUpDelegatedDeposit(
  params: TopUpParams,
): Promise<TopUpProgress> {
  const { client, user, tokenMint, amount, onProgress } = params;
  const payer = params.payer ?? user;
  const validator =
    params.validator ?? getErValidatorForRpcEndpoint(BASE_RPC);
  const userTokenAccount =
    params.userTokenAccount ?? getAssociatedTokenAddressSync(tokenMint, user);

  const progress: TopUpProgress = { ...initialTopUpProgress };
  const tick = () => onProgress?.({ ...progress });

  progress.undelegate = { state: "running" };
  tick();
  try {
    const sig = await client.undelegateDeposit({
      tokenMint,
      user,
      payer,
      sessionToken: null,
      magicProgram: MAGIC_PROGRAM_ID,
      magicContext: MAGIC_CONTEXT_ID,
    });
    progress.undelegate = { state: "succeeded", signature: sig };
  } catch (e) {
    progress.undelegate = { state: "failed", error: errMsg(e) };
    tick();
    return progress;
  }
  tick();

  progress.fund = { state: "running" };
  tick();
  try {
    const result = await client.modifyBalance({
      tokenMint,
      user,
      payer,
      amount,
      increase: true,
      userTokenAccount,
    });
    progress.fund = { state: "succeeded", signature: result.signature };
  } catch (e) {
    progress.fund = { state: "failed", error: errMsg(e) };
    tick();
    return progress;
  }
  tick();

  progress.redelegate = { state: "running" };
  tick();
  try {
    const sig = await client.delegateDeposit({
      tokenMint,
      user,
      payer,
      validator,
    });
    progress.redelegate = { state: "succeeded", signature: sig };
  } catch (e) {
    progress.redelegate = { state: "failed", error: errMsg(e) };
  }
  tick();
  return progress;
}
