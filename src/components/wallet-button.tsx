"use client";

import dynamic from "next/dynamic";

// WalletMultiButton ships portal'd UI that breaks SSR. Dynamic-import,
// no-ssr lets the rest of our nav render server-side cleanly.
export const WalletButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false },
);
