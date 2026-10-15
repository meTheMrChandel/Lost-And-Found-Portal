"use client";

import CampusHeroSlider from "@/components/CampusHeroSlider";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

export default function Home() {
  const { user, logout } = useAuth();

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

          <div className="flex items-center gap-3 sm:gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                {(user.is_staff || user.role === "admin") && (
                  <Link
                    href="/admin"
                    className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-white bg-[#047857] hover:bg-[#10B981] shadow-sm transition-all"
                  >
                    Admin Portal
                  </Link>
                )}
                <Link
                  href="/profile"
                  className="px-4 py-2 rounded-full text-xs font-semibold text-[#1C1C1E] bg-[#EFEAE0] hover:bg-[#E2DDD2] transition-colors"
                >
                  {user.full_name || user.email}
                </Link>
                <button
                  onClick={logout}
                  className="px-4 py-2 rounded-full text-xs font-semibold text-[#D94F3B] hover:bg-[#D94F3B]/10 transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-5 py-2.5 rounded-full text-sm font-medium text-[#1C1C1E] hover:bg-[#EFEAE0] transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="px-5 py-2.5 rounded-full text-sm font-medium text-white bg-[#047857] hover:bg-[#10B981] shadow-sm transition-all"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>


      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 flex flex-col gap-12">
        {/* Modern IIT Ropar Campus Image Slider */}
        <CampusHeroSlider />

        {/* Live Preview Cards Grid using Design System */}
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
            <a
              href="/feed"
              className="hidden sm:inline-flex text-sm font-medium text-[#047857] hover:underline"
            >
              View all posts →
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Sample LOST card */}
            <div className="p-6 rounded-2xl bg-[#EFEAE0]/80 border border-[#EFEAE0] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white bg-[#D94F3B]">
                    LOST
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold text-[#1C1C1E] bg-[#F5B73B]">
                    ₹500 Reward
                  </span>
                </div>
                <h4 className="font-serif text-xl font-bold text-[#1C1C1E] mb-2">
                  Blue Campus ID & Hostel Keys
                </h4>
                <p className="text-sm text-[#6B7280] mb-4">
                  Lost near Satluj Hostel common room or path to cafeteria.
                </p>
              </div>
              <div className="text-xs text-[#6B7280] pt-4 border-t border-[#E2DDD2] flex justify-between">
                <span>Satluj Hostel</span>
                <span>2 hours ago</span>
              </div>
            </div>

            {/* Card 2: Sample FOUND card */}
            <div className="p-6 rounded-2xl bg-[#EFEAE0]/80 border border-[#EFEAE0] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white bg-[#047857]">
                    FOUND
                  </span>
                  <span className="text-xs text-[#6B7280]">
                    Admin Office Custody
                  </span>
                </div>
                <h4 className="font-serif text-xl font-bold text-[#1C1C1E] mb-2">
                  Wireless Earbuds Case
                </h4>
                <p className="text-sm text-[#6B7280] mb-4">
                  Found on bench outside Central Library entrance.
                </p>
              </div>
              <div className="text-xs text-[#6B7280] pt-4 border-t border-[#E2DDD2] flex justify-between">
                <span>Central Library</span>
                <span>Today, 11:30 AM</span>
              </div>
            </div>

            {/* Card 3: QR Valuable Tag Feature */}
            <div className="p-6 rounded-2xl bg-[#EFEAE0]/80 border border-[#EFEAE0] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-[#1C1C1E] bg-[#FAF7F2]">
                    SECURITY FEATURE
                  </span>
                </div>
                <h4 className="font-serif text-xl font-bold text-[#1C1C1E] mb-2">
                  Zero-Knowledge QR Stickers
                </h4>
                <p className="text-sm text-[#6B7280] mb-4">
                  Generate stickers for your cycle, laptop, or bottle. Scanners only see item name, keeping personal data private.
                </p>
              </div>
              <div className="text-xs text-[#047857] font-semibold pt-4 border-t border-[#E2DDD2]">
                Admin-supervised handovers
              </div>
            </div>
          </div>
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
