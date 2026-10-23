"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled page error", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-[#FAF7F2] text-[#1C1C1E]">
      <div className="max-w-md w-full text-center">
        <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-[#D94F3B] flex items-center justify-center text-white font-bold text-2xl shadow-sm">
          !
        </div>
        <h1 className="font-serif text-3xl font-bold mb-3">Something went wrong</h1>
        <p className="text-sm text-[#6B7280] mb-2">
          An unexpected error occurred while loading this page. Your reports and data are safe.
        </p>
        {error.digest && (
          <p className="text-[11px] text-[#6B7280] mb-6 font-mono">Reference: {error.digest}</p>
        )}
        <div className="flex flex-wrap justify-center gap-2.5 mt-6">
          <button
            type="button"
            onClick={() => retry()}
            className="px-4 py-2 rounded-full bg-[#047857] hover:bg-[#10B981] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-full bg-white border border-[#E2DDD2] hover:bg-[#EFEAE0] text-[#1C1C1E] text-xs font-bold shadow-sm transition-all"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
