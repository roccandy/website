export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function PrivacyPage() {
  return (
    <main className="min-h-[60vh] bg-white px-6 py-12 text-zinc-900">
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="normal-case text-4xl font-semibold tracking-tight text-[rgb(114,112,111)]">Privacy</h1>
        <p className="normal-case text-sm leading-relaxed text-zinc-700">
          Roc Candy respects your privacy and only uses your details to process orders, coordinate delivery, and
          provide support.
        </p>
        <p className="normal-case text-sm leading-relaxed text-zinc-700">
          For privacy requests, contact{" "}
          <a href="mailto:enquiries@roccandy.com.au" className="text-[#ff6f95] hover:text-[#ff4f80]">
            enquiries@roccandy.com.au
          </a>
          .
        </p>
      </div>
    </main>
  );
}
