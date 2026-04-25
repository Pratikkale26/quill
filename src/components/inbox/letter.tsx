"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Lock, Mail } from "lucide-react";

import type { InboxLetter } from "@/hooks/use-inbox";
import { Badge } from "@/components/ui/badge";
import { formatAmount, shortPubkey } from "@/lib/utils";
import { USDC_DECIMALS, NETWORK } from "@/lib/constants";

function explorerLink(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}${NETWORK === "mainnet" ? "" : "?cluster=devnet"}`;
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function Letter({
  letter,
  unlocked,
}: {
  letter: InboxLetter;
  unlocked: boolean;
}) {
  const [open, setOpen] = useState(true);

  return (
    <motion.article
      layout
      className="group relative overflow-hidden rounded-2xl border border-border bg-paper text-ink shadow-[0_1px_0_0_rgba(0,0,0,0.04)] dark:bg-paper"
    >
      <header className="flex items-center justify-between gap-3 border-b border-ink/10 px-5 py-3 text-xs">
        <div className="flex items-center gap-2 text-ink/60">
          <Mail className="h-3.5 w-3.5" />
          <span className="font-medium">
            {letter.senderPubkey
              ? shortPubkey(letter.senderPubkey, 4)
              : "anonymous"}
          </span>
          <span className="opacity-50">·</span>
          <span>{relativeTime(letter.createdAt)}</span>
        </div>
        <Badge variant="outline" className="border-ink/20 bg-paper text-ink">
          {formatAmount(letter.amount, USDC_DECIMALS)} USDC
        </Badge>
      </header>

      <div className="px-5 py-5">
        <AnimatePresence mode="wait">
          {!unlocked ? (
            <motion.div
              key="locked"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-sm text-ink/50"
            >
              <Lock className="h-4 w-4" />
              Sealed. Derive your note key to read.
            </motion.div>
          ) : letter.failed ? (
            <motion.div
              key="failed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm text-wax"
            >
              This letter wasn&apos;t addressed to your current note key, or
              the ciphertext is malformed.
            </motion.div>
          ) : letter.body === null ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm italic text-ink/60"
            >
              (sent privately with no note attached)
            </motion.div>
          ) : (
            <motion.div
              key="body"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="whitespace-pre-wrap font-serif text-base leading-relaxed text-ink"
            >
              {letter.body}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-ink/10 px-5 py-2 text-xs text-ink/50">
        <a
          href={explorerLink(letter.txSignature)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 hover:underline"
        >
          {shortPubkey(letter.txSignature, 6)}
          <ExternalLink className="h-3 w-3" />
        </a>
        {letter.body && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-ink/40 hover:text-ink"
          >
            {open ? "" : ""}
          </button>
        )}
      </footer>
    </motion.article>
  );
}
