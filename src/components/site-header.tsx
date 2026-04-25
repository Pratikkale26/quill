import Link from "next/link";

import { WalletButton } from "@/components/wallet-button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-serif text-xl tracking-tight"
        >
          <span aria-hidden className="text-gold">
            ✒
          </span>
          <span>quill</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/send"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
          >
            Send
          </Link>
          <Link
            href="/inbox"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
          >
            Inbox
          </Link>
          <Link
            href="/setup"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
          >
            Setup
          </Link>
          <div className="ml-2">
            <WalletButton />
          </div>
        </nav>
      </div>
    </header>
  );
}
