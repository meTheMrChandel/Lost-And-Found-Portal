"use client";

import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { loginUrl } from "@/lib/redirect";
import { useEffect } from "react";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace(loginUrl(pathname));
      } else if (!user.is_staff && user.role !== "admin") {
        router.replace("/");
      }
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#047857] border-t-transparent animate-spin" />
          <span className="text-xs font-semibold text-[#6B7280]">
            Verifying staff permissions...
          </span>
        </div>
      </div>
    );
  }

  if (!user || (!user.is_staff && user.role !== "admin")) {
    return null;
  }

  return <>{children}</>;
}
