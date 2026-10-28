import Link from "next/link";
import { loginUrl } from "@/lib/redirect";

interface LoginRequiredProps {
  /** Path to come back to after signing in. */
  returnTo: string;
  message: string;
}

export default function LoginRequired({ returnTo, message }: LoginRequiredProps) {
  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-3xl border border-[#E2DDD2] max-w-md w-full text-center">
        <h2 className="font-serif text-2xl font-bold text-[#1C1C1E] mb-2">Please Log In</h2>
        <p className="text-xs text-[#6B7280] mb-6">{message}</p>
        <Link
          href={loginUrl(returnTo)}
          className="block w-full py-3 rounded-full bg-[#047857] text-white text-xs font-bold"
        >
          Log In
        </Link>
        <Link href="/" className="block mt-3 text-xs font-semibold text-[#6B7280] hover:text-[#1C1C1E]">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
