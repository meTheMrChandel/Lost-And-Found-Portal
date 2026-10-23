"use client";

import { useEffect, useState, use, Suspense } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";

interface ScanData {
  item_name: string;
  category: string;
  owner_name: string;
  qr_uuid: string;
  is_active: boolean;
}

function ScanContent({ params }: { params: Promise<{ uuid: string }> }) {
  const resolvedParams = use(params);
  const qrUuid = resolvedParams.uuid;

  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deactivatedMsg, setDeactivatedMsg] = useState("");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function loadScanData() {
      setLoading(true);
      try {
        const res = await apiClient(`/items/scan/${qrUuid}/`);
        if (res?.data) {
          setScanData(res.data);
        } else if (res?.is_active === false) {
          setDeactivatedMsg(res.message || "This QR sticker is deactivated.");
        }
      } catch (err: any) {
        if (err.status === 404 || err.message?.includes("Invalid QR")) {
          setNotFound(true);
        } else {
          setDeactivatedMsg("Unable to verify QR code at this time.");
        }
      } finally {
        setLoading(false);
      }
    }

    if (qrUuid) {
      loadScanData();
    }
  }, [qrUuid]);

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C1C1E] flex flex-col justify-between">
      {/* Mobile-Friendly Header */}
      <header className="border-b border-[#EFEAE0] bg-white sticky top-0 z-50">
        <div className="max-w-md mx-auto px-6 h-18 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#047857] flex items-center justify-center text-white font-bold text-lg shadow-sm">
              LF
            </div>
            <div>
              <span className="font-serif text-lg font-bold tracking-tight text-[#1C1C1E] block leading-tight">
                IIT Ropar
              </span>
              <span className="text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold">
                Lost & Found Registry
              </span>
            </div>
          </Link>

          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
            Verified Tag
          </span>
        </div>
      </header>

      {/* Main Scan Presentation Card */}
      <main className="max-w-md w-full mx-auto px-6 py-8 flex-1 flex flex-col justify-center">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#6B7280] bg-white rounded-3xl border border-[#EFEAE0]">
            <div className="animate-spin text-2xl mb-3">⚙️</div>
            Verifying campus registration records...
          </div>
        ) : notFound ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-[#EFEAE0] shadow-sm space-y-3">
            <div className="text-4xl mb-1">⚠️</div>
            <h2 className="font-serif text-xl font-bold text-[#1C1C1E]">
              Unregistered QR Code
            </h2>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              This identification tag was not found in the IIT Ropar Lost & Found system or has been completely removed.
            </p>
            <Link
              href="/"
              className="inline-block mt-4 px-5 py-2 bg-[#FAF7F2] border border-[#EFEAE0] text-xs font-semibold rounded-xl text-[#1C1C1E]"
            >
              Return to Campus Portal
            </Link>
          </div>
        ) : deactivatedMsg || (scanData && !scanData.is_active) ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-[#EFEAE0] shadow-sm space-y-3">
            <div className="text-4xl mb-1">🏷️</div>
            <h2 className="font-serif text-xl font-bold text-[#1C1C1E]">
              Sticker Deactivated
            </h2>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              {deactivatedMsg || "This QR sticker is no longer active or has been retired by its owner."}
            </p>
            <p className="text-[11px] text-[#9CA3AF]">
              If you found this item on campus, you can deposit it at the nearest Campus Security Post or Admin Office.
            </p>
          </div>
        ) : scanData ? (
          <div className="bg-white rounded-3xl border border-[#EFEAE0] shadow-md overflow-hidden space-y-6 p-6">
            {/* Belonging Badge */}
            <div className="text-center space-y-1 pb-4 border-b border-[#EFEAE0]">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#047857] px-3 py-1 bg-emerald-50 rounded-full border border-emerald-200 inline-block mb-1">
                Registered Campus Belonging
              </span>
              <h2 className="font-serif text-2xl font-bold text-[#1C1C1E]">
                {scanData.item_name}
              </h2>
              <span className="text-xs font-semibold text-[#6B7280] block">
                Category: {scanData.category}
              </span>
            </div>

            {/* Owner Details */}
            <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#EFEAE0] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#6B7280]">Registered Owner:</span>
                <strong className="text-[#1C1C1E] font-serif text-sm">
                  {scanData.owner_name}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6B7280]">Campus ID:</span>
                <span className="font-mono text-[#047857] font-bold">IIT Ropar Student</span>
              </div>
            </div>

            {/* Zero-Knowledge Privacy Shield Notice */}
            <div className="p-3.5 bg-blue-50/70 border border-blue-200/60 rounded-2xl text-[11px] text-blue-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-blue-800">
                <span>🛡️</span>
                <span>Zero-Knowledge Privacy Shield</span>
              </div>
              <p className="leading-relaxed text-[#4B5563]">
                To safeguard student security, phone numbers, email addresses, and serial numbers are protected and never disclosed on public scans.
              </p>
            </div>

            {/* Found Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <Link
                href={`/report/found?title=${encodeURIComponent("Found: " + scanData.item_name)}&category=${encodeURIComponent(scanData.category.toLowerCase())}`}
                className="w-full py-3 bg-[#047857] hover:bg-[#065F46] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-2"
              >
                <span>📢 I Found This Belonging</span>
              </Link>

              <div className="text-center">
                <span className="text-[11px] text-[#9CA3AF] block">
                  Or hand it over to Campus Security Desk / Admin Office
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-[10px] text-[#9CA3AF] border-t border-[#EFEAE0]">
        IIT Ropar Campus Lost & Found System • CS509 PG Software Lab
      </footer>
    </div>
  );
}

export default function PublicScanPage({ params }: { params: Promise<{ uuid: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center text-xs text-[#6B7280]">
          Verifying QR tag...
        </div>
      }
    >
      <ScanContent params={params} />
    </Suspense>
  );
}
