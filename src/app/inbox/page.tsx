import { InboxView } from "@/components/inbox/inbox-view";

export const metadata = {
  title: "Inbox · Quill",
  description: "Read private letters sealed to your wallet.",
};

export default function InboxPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <header className="mb-10 space-y-2">
        <p className="text-sm text-muted-foreground">Inbox</p>
        <h1 className="font-serif text-4xl font-medium tracking-tight">
          Letters sealed to you.
        </h1>
        <p className="max-w-xl text-base text-muted-foreground">
          Each card is private USDC plus a note encrypted to your wallet.
          One signature decrypts everything for this browser session.
        </p>
      </header>
      <InboxView />
    </main>
  );
}
