"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { loginUrl } from "@/lib/redirect";

/** Right end of a page header: who is signed in, or a Log In button for guests. */
export default function HeaderAccount() {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading) return null;

  if (!user) {
    return (
      <Link
        href={loginUrl(pathname)}
        className="px-4 py-2 rounded-full text-xs font-semibold text-[#1C1C1E] bg-[#EFEAE0] hover:bg-[#E2DDD2] transition-colors"
      >
        Log In
      </Link>
    );
  }

  const name = user.full_name || user.email;
  return (
    <Link
      href="/profile"
      title={`Signed in as ${user.email}`}
      className="flex items-center gap-2 text-xs font-semibold text-[#1C1C1E] hover:text-[#047857]"
    >
      <span className="w-7 h-7 rounded-full bg-[#1C1C1E] text-white flex items-center justify-center text-[11px]">
        {name.charAt(0).toUpperCase()}
      </span>
      <span className="hidden sm:inline">{name.split(" ")[0]}</span>
    </Link>
  );
}
