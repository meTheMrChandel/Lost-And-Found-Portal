"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense } from "react";
import { apiClient, getErrorMessage } from "@/lib/api";
import Link from "next/link";

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [regNo, setRegNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await apiClient("/adminpanel/invites/accept/", {
        method: "POST",
        data: {
          token,
          full_name: fullName,
          password,
          registration_number: regNo,
        },
      });

      setSuccess(res.message || "Invitation accepted! Redirecting to login...");
      setTimeout(() => {
        router.push("/login?admin_activated=true");
      }, 2000);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to accept admin invite."));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="p-8 rounded-3xl bg-[#EFEAE0]/80 border border-[#EFEAE0] text-center max-w-md w-full">
        <h1 className="font-serif text-2xl font-bold text-[#D94F3B] mb-2">
          Missing Invitation Token
        </h1>
        <p className="text-xs text-[#6B7280] mb-6">
          This URL appears invalid or missing its authentication token.
        </p>
        <Link
          href="/"
          className="px-6 py-2.5 rounded-full bg-[#047857] text-white text-xs font-semibold"
        >
          Return to Portal
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md p-8 rounded-3xl bg-[#EFEAE0]/80 border border-[#EFEAE0] shadow-lg">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-[#047857] flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-sm">
          LF
        </div>
        <h1 className="font-serif text-3xl font-bold text-[#1C1C1E]">
          Join Administration
        </h1>
        <p className="text-sm text-[#6B7280] mt-1 font-sans">
          Complete your profile to activate staff authority
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-[#D94F3B]/10 border border-[#D94F3B]/20 text-[#D94F3B] text-xs font-semibold mb-6">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 rounded-2xl bg-[#047857]/10 border border-[#047857]/20 text-[#047857] text-xs font-semibold mb-6">
          {success}
        </div>
      )}

      <form onSubmit={handleAccept} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-1">
            Full Name
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Dr. Ramesh Sharma"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-sm shadow-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-1">
            Staff / Employee ID (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. EMP2024"
            value={regNo}
            onChange={(e) => setRegNo(e.target.value)}
            className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-sm shadow-sm uppercase"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-1">
            Set Secure Password
          </label>
          <input
            type="password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-sm shadow-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-full bg-[#047857] hover:bg-[#10B981] text-white text-sm font-semibold shadow-md transition-all disabled:opacity-50 mt-2 cursor-pointer"
        >
          {loading ? "Activating Account..." : "Accept & Activate Admin"}
        </button>
      </form>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAF7F2]">
      <Suspense fallback={<div className="text-sm font-semibold text-[#6B7280]">Loading invite...</div>}>
        <AcceptInviteContent />
      </Suspense>
    </div>
  );
}
