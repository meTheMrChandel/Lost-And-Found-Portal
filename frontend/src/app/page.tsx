"use client";

import CampusHeroSlider from "@/components/CampusHeroSlider";
import NotificationBell from "@/components/NotificationBell";
import RecentActivity from "@/components/RecentActivity";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useState } from "react";

export default function Home() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#FAF7F2] text-[#1C1C1E]">
      {/* Navigation Bar */}
      <header className="border-b border-[#EFEAE0] bg-[#FAF7F2]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#047857] flex items-center justify-center text-white font-bold text-xl shadow-sm">
              LF
            </div>
            <div>
              <span className="font-serif text-2xl font-bold tracking-tight text-[#1C1C1E]">
                Lost & Found
              </span>
              <span className="text-xs text-[#6B7280] block font-sans tracking-wide">
                IIT ROPAR CAMPUS
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="home-nav"
            className="lg:hidden w-10 h-10 rounded-xl flex items-center justify-center text-xl text-[#1C1C1E] hover:bg-[#EFEAE0] transition-colors"
          >
            {menuOpen ? "✕" : "☰"}
          </button>

          <nav
            id="home-nav"
            className={`${
              menuOpen ? "flex" : "hidden"
            } lg:flex absolute lg:static top-full inset-x-0 flex-col lg:flex-row items-stretch lg:items-center gap-3 lg:gap-4 p-6 lg:p-0 bg-[#FAF7F2] lg:bg-transparent border-b lg:border-0 border-[#EFEAE0] text-center`}
          >
            <Link
              href="/feed"
              className="text-xs font-semibold text-[#1C1C1E] hover:text-[#047857] transition-colors"
            >
              Public Feed
            </Link>

            {user ? (
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 lg:gap-3">
                <Link
                  href="/report/lost"
                  className="px-3 py-1.5 rounded-full text-xs font-bold text-white bg-[#D94F3B] hover:opacity-95 shadow-sm transition-all"
                >
                  + Lost
                </Link>
                <Link
                  href="/report/found"
                  className="px-3 py-1.5 rounded-full text-xs font-bold text-white bg-[#047857] hover:bg-[#10B981] shadow-sm transition-all"
                >
                  + Found
                </Link>
                <Link
                  href="/my-reports"
                  className="px-3 py-1.5 rounded-full text-xs font-semibold text-[#1C1C1E] bg-[#EFEAE0] hover:bg-[#E2DDD2] transition-colors"
                >
                  My Reports
                </Link>
                <Link
                  href="/items"
                  className="px-3 py-1.5 rounded-full text-xs font-semibold text-[#047857] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                >
                  🏷️ Valuables
                </Link>
                <Link
                  href="/chat"
                  className="px-3 py-1.5 rounded-full text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 transition-colors"
                >
                  💬 Chat
                </Link>
                <NotificationBell />
                {(user.is_staff || user.role === "admin") && (
                  <Link
                    href="/admin"
                    className="px-3 py-1.5 rounded-full text-xs font-semibold text-white bg-[#1C1C1E] hover:bg-black shadow-sm transition-all"
                  >
                    Admin Portal
                  </Link>
                )}
                <Link
                  href="/profile"
                  className="px-3 py-1.5 rounded-full text-xs font-semibold text-[#1C1C1E] bg-[#FAF7F2] border border-[#E2DDD2] hover:bg-[#EFEAE0] transition-colors"
                >
                  {user.full_name || user.email}
                </Link>
                <button
                  onClick={logout}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold text-[#D94F3B] hover:bg-[#D94F3B]/10 transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <Link
                  href="/report/lost"
                  className="px-3 py-1.5 rounded-full text-xs font-bold text-white bg-[#D94F3B] hover:opacity-95 shadow-sm transition-all"
                >
                  + Lost
                </Link>
                <Link
                  href="/report/found"
                  className="px-3 py-1.5 rounded-full text-xs font-bold text-white bg-[#047857] hover:bg-[#10B981] shadow-sm transition-all"
                >
                  + Found
                </Link>
                <Link
                  href="/login"
                  className="px-4 py-2 rounded-full text-xs font-medium text-[#1C1C1E] hover:bg-[#EFEAE0] transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 rounded-full text-xs font-medium text-white bg-[#047857] hover:bg-[#10B981] shadow-sm transition-all"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>


      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 flex flex-col gap-12">
        {/* Modern IIT Ropar Campus Image Slider */}
        <CampusHeroSlider />

        {/* Quick Action Banner */}
        <div className="p-6 rounded-3xl bg-gradient-to-r from-[#047857]/10 via-[#FAF7F2] to-[#FAF7F2] border border-[#047857]/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-xl font-bold text-[#1C1C1E]">
              Lost something on campus?
            </h3>
            <p className="text-xs text-[#6B7280]">
              Submit a report with confidential proof of ownership to initiate admin review and automated matching.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/report/lost"
              className="px-4 py-2 rounded-full bg-[#D94F3B] hover:opacity-95 text-white text-xs font-bold shadow-sm transition-all"
            >
              Report Lost Item
            </Link>
            <Link
              href="/report/found"
              className="px-4 py-2 rounded-full bg-[#047857] hover:bg-[#10B981] text-white text-xs font-bold shadow-sm transition-all"
            >
              Report Found Item
            </Link>
            <Link
              href="/feed"
              className="px-4 py-2 rounded-full bg-white border border-[#E2DDD2] hover:bg-[#FAF7F2] text-[#1C1C1E] text-xs font-bold transition-all shadow-sm"
            >
              View Feed →
            </Link>
          </div>
        </div>

        {/* Latest approved posts from the public feed */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-serif text-2xl font-bold text-[#1C1C1E]">
                Recent Campus Activity
              </h3>
              <p className="text-sm text-[#6B7280]">
                Live updates of reported lost and found belongings across hostels and departments.
              </p>
            </div>
            <Link
              href="/feed"
              className="hidden sm:inline-flex text-sm font-medium text-[#047857] hover:underline"
            >
              View all posts →
            </Link>
          </div>

          <RecentActivity />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#EFEAE0] bg-[#FAF7F2] mt-12">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#6B7280] gap-4">
          <p>© 2026 IIT Ropar Lost & Found Portal. CS509 PG Software Lab.</p>
          <div className="flex gap-6">
            <span>Admin Supervision</span>
            <span>Zero-Knowledge Scans</span>
            <span>Secured Verification</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
