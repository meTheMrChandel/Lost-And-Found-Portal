export default function Home() {
  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Navigation Bar */}
      <header className="border-b border-[#EFEAE0] bg-[#FAF7F2]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
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
          </div>

          <div className="flex items-center gap-4">
            <a
              href="/login"
              className="px-5 py-2.5 rounded-full text-sm font-medium text-[#1C1C1E] hover:bg-[#EFEAE0] transition-colors"
            >
              Log in
            </a>
            <a
              href="/register"
              className="px-5 py-2.5 rounded-full text-sm font-medium text-white bg-[#047857] hover:bg-[#10B981] shadow-sm transition-all"
            >
              Sign up
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-16 flex flex-col justify-center">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EFEAE0] text-[#1C1C1E] text-xs font-semibold mb-6">
            <span className="w-2 h-2 rounded-full bg-[#047857]"></span>
            Official IIT Ropar Portal
          </div>
          <h1 className="font-serif text-5xl sm:text-6xl font-bold text-[#1C1C1E] leading-tight mb-6">
            Reconnecting lost belongings with their owners.
          </h1>
          <p className="font-sans text-lg sm:text-xl text-[#6B7280] leading-relaxed mb-10 max-w-2xl">
            A verified, secure campus platform for reporting lost valuables, publishing found items, and facilitating admin-supervised handovers.
          </p>

          <div className="flex flex-wrap gap-4 mb-16">
            <a
              href="/report-lost"
              className="px-7 py-3.5 rounded-full text-base font-medium text-white bg-[#D94F3B] hover:opacity-95 shadow-sm transition-all"
            >
              Report Lost Item
            </a>
            <a
              href="/report-found"
              className="px-7 py-3.5 rounded-full text-base font-medium text-white bg-[#047857] hover:bg-[#10B981] shadow-sm transition-all"
            >
              Report Found Item
            </a>
            <a
              href="/feed"
              className="px-7 py-3.5 rounded-full text-base font-medium text-[#1C1C1E] bg-[#EFEAE0] hover:bg-[#E2DDD2] transition-colors"
            >
              Browse Campus Feed
            </a>
          </div>
        </div>

        {/* Live Preview Cards Grid using Design System */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-[#EFEAE0]">
          {/* Card 1: Sample LOST card */}
          <div className="p-6 rounded-2xl bg-[#EFEAE0]/70 border border-[#EFEAE0] shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white bg-[#D94F3B]">
                  LOST
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold text-[#1C1C1E] bg-[#F5B73B]">
                  ₹500 Reward
                </span>
              </div>
              <h3 className="font-serif text-xl font-bold text-[#1C1C1E] mb-2">
                Blue Campus ID & Hostel Keys
              </h3>
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
          <div className="p-6 rounded-2xl bg-[#EFEAE0]/70 border border-[#EFEAE0] shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white bg-[#047857]">
                  FOUND
                </span>
                <span className="text-xs text-[#6B7280]">
                  Admin Office Custody
                </span>
              </div>
              <h3 className="font-serif text-xl font-bold text-[#1C1C1E] mb-2">
                Wireless Earbuds Case
              </h3>
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
          <div className="p-6 rounded-2xl bg-[#EFEAE0]/70 border border-[#EFEAE0] shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-[#1C1C1E] bg-[#FAF7F2]">
                  FEATURE
                </span>
              </div>
              <h3 className="font-serif text-xl font-bold text-[#1C1C1E] mb-2">
                Privacy-First QR Stickers
              </h3>
              <p className="text-sm text-[#6B7280] mb-4">
                Generate stickers for your cycle, laptop or bottle. Scanners only see item name, keeping personal data private.
              </p>
            </div>
            <div className="text-xs text-[#047857] font-semibold pt-4 border-t border-[#E2DDD2]">
              Admin-verified handovers
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#EFEAE0] bg-[#FAF7F2]">
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
