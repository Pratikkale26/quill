"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { Toaster } from "sonner";

import { BASE_RPC } from "@/lib/constants";

import "@solana/wallet-adapter-react-ui/styles.css";

// Phantom self-registers via the Wallet Standard now — explicit adapter
// triggers a "can be removed from your app" warning. We keep Solflare's
// legacy adapter because not every Solflare build advertises Standard.
export function Providers({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(() => [new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={BASE_RPC} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
          <Toaster
            position="bottom-right"
            theme="system"
            richColors
            closeButton
          />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
