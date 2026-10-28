"use client";

import AdminGuard from "@/components/AdminGuard";
import NotificationBell from "@/components/NotificationBell";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navLinks = [
    { href: "/admin", label: "Overview", exact: true },
    { href: "/admin/cases", label: "Case Queue" },
    { href: "/admin/matches", label: "Match Queue" },
    { href: "/admin/abuse-reports", label: "Abuse Reports" },
    { href: "/admin/users", label: "User Moderation" },
    { href: "/admin/invites", label: "Admin Invites" },
    { href: "/admin/audit-logs", label: "Audit Logs" },
    { href: "/admin/settings", label: "Site Configuration" },
  ];

  return (
    <AdminGuard>
      <div className="min-h-screen bg-[#FAF7F2] text-[#1C1C1E] flex flex-col">
        {/* Admin Navigation Bar */}
        <header className="border-b border-[#EFEAE0] bg-[#FAF7F2]/95 backdrop-blur sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 h-18 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2">
                <Logo size={36} />
                <div>
                  <span className="font-serif text-xl font-bold tracking-tight text-[#1C1C1E]">
                    Admin Portal
                  </span>
                  <span className="text-[10px] text-[#047857] font-semibold block uppercase tracking-wider">
                    Staff Authority
                  </span>
                </div>
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/chat"
                className="text-xs font-semibold text-[#047857] hover:underline"
              >
                💬 Chat
              </Link>
              <NotificationBell />
              <Link
                href="/"
                className="text-xs font-semibold text-[#6B7280] hover:text-[#1C1C1E] transition-colors"
              >
                ← Back to Portal
              </Link>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="max-w-6xl mx-auto px-6 flex gap-6 overflow-x-auto text-xs font-semibold border-t border-[#EFEAE0]/60">
            {navLinks.map((tab) => {
              const active = tab.exact
                ? pathname === tab.href
                : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`py-3 border-b-2 transition-all whitespace-nowrap ${
                    active
                      ? "border-[#047857] text-[#047857] font-bold"
                      : "border-transparent text-[#6B7280] hover:text-[#1C1C1E]"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </header>

        {/* Content Container */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
          {children}
        </main>
      </div>
    </AdminGuard>
  );
}
