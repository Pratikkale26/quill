import { SendForm } from "@/components/send/send-form";

export const metadata = {
  title: "Send · Quill",
  description: "Send a private letter on Solana.",
};

export default function SendPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <header className="mb-10 space-y-2">
        <p className="text-sm text-muted-foreground">Send</p>
        <h1 className="font-serif text-4xl font-medium tracking-tight">
          A private letter on Solana.
        </h1>
        <p className="max-w-xl text-base text-muted-foreground">
          One transfer inside the TEE plus one note encrypted to the
          recipient&apos;s wallet. They&apos;re the only one who can read it.
        </p>
      </header>
      <SendForm />
    </main>
  );
}
