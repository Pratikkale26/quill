import { SetupFlow } from "@/components/onboarding/setup-flow";

export const metadata = {
  title: "Setup · Quill",
  description: "Claim your private inbox on Solana.",
};

export default function SetupPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <header className="mb-10 space-y-2">
        <p className="text-sm text-muted-foreground">Setup</p>
        <h1 className="font-serif text-4xl font-medium tracking-tight">
          Claim your private inbox.
        </h1>
        <p className="max-w-xl text-base text-muted-foreground">
          Three transactions on Solana devnet, plus one signature for your
          encrypted-note key. After this, anyone can send you private USDC
          and a note only you can read.
        </p>
      </header>
      <SetupFlow />
    </main>
  );
}
