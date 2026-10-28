import Link from "next/link";
import Logo from "@/components/Logo";

/** Top bar for the login, sign up and password reset pages (same look as the home header). */
export default function AuthHeader({ current }: { current: "login" | "register" | "reset" }) {
  return (
    <header className="border-b border-[#EFEAE0] bg-[#FAF7F2]/90 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Logo size={40} />
          <div>
            <span className="font-serif text-2xl font-bold tracking-tight text-[#1C1C1E]">
              Lost & Found
            </span>
            <span className="text-xs text-[#6B7280] block font-sans tracking-wide">
              IIT ROPAR CAMPUS
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/feed"
            className="hidden sm:inline text-xs font-semibold text-[#1C1C1E] hover:text-[#047857] transition-colors"
          >
            Public Feed
          </Link>
          {current !== "login" && (
            <Link
              href="/login"
              className="px-4 py-2 rounded-full text-xs font-medium text-[#1C1C1E] hover:bg-[#EFEAE0] transition-colors"
            >
              Log in
            </Link>
          )}
          {current !== "register" && (
            <Link
              href="/register"
              className="px-4 py-2 rounded-full text-xs font-medium text-white bg-[#047857] hover:bg-[#10B981] shadow-sm transition-all"
            >
              Sign up
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
