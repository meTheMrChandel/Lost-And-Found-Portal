import Link from "next/link";
import Logo from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-[#FAF7F2] text-[#1C1C1E]">
      <div className="max-w-md w-full text-center">
        <Logo size={56} variant="tile" className="mx-auto mb-6" />
        <p className="text-xs font-bold uppercase tracking-wider text-[#D94F3B] mb-2">
          Error 404
        </p>
        <h1 className="font-serif text-3xl font-bold mb-3">
          This page seems to be lost too
        </h1>
        <p className="text-sm text-[#6B7280] mb-8">
          The link may be broken, or the page may have been moved. Try the campus feed, or report
          what you&apos;re looking for.
        </p>
        <div className="flex flex-wrap justify-center gap-2.5">
          <Link
            href="/"
            className="px-4 py-2 rounded-full bg-[#047857] hover:bg-[#10B981] text-white text-xs font-bold shadow-sm transition-all"
          >
            Back to Home
          </Link>
          <Link
            href="/feed"
            className="px-4 py-2 rounded-full bg-white border border-[#E2DDD2] hover:bg-[#EFEAE0] text-[#1C1C1E] text-xs font-bold shadow-sm transition-all"
          >
            Browse Campus Feed
          </Link>
        </div>
      </div>
    </div>
  );
}
