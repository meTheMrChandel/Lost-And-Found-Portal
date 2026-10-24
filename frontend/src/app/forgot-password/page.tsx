"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient, getErrorMessage } from "@/lib/api";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiClient("/auth/request-otp/", {
        method: "POST",
        data: { email, purpose: "password_reset" },
      });
      setMessage(res.message);
      setStep(2);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to send reset OTP."));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiClient("/auth/password-reset-confirm/", {
        method: "POST",
        data: { email, code, new_password: newPassword },
      });
      router.push("/login?reset=success");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to reset password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAF7F2]">
      <div className="w-full max-w-md p-8 rounded-3xl bg-[#EFEAE0]/80 border border-[#EFEAE0] shadow-lg">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#047857] flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-sm">
            LF
          </div>
          <h1 className="font-serif text-3xl font-bold text-[#1C1C1E]">
            Reset Password
          </h1>
          <p className="text-sm text-[#6B7280] mt-1 font-sans">
            {step === 1 ? "Enter your registered email to receive an OTP" : "Enter OTP and your new password"}
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-[#D94F3B]/10 border border-[#D94F3B]/20 text-[#D94F3B] text-sm mb-6 font-medium">
            {error}
          </div>
        )}

        {message && !error && (
          <div className="p-4 rounded-2xl bg-[#047857]/10 border border-[#047857]/20 text-[#047857] text-sm mb-6 font-medium">
            {message}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleRequestOtp} className="flex flex-col gap-5">
            <div>
              <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-2">
                Campus Email Address
              </label>
              <input
                type="email"
                required
                placeholder="e.g. 2024csm1001@iitrpr.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-[#1C1C1E] text-sm shadow-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full bg-[#047857] hover:bg-[#10B981] text-white text-sm font-semibold shadow-md transition-all disabled:opacity-50 mt-2 cursor-pointer"
            >
              {loading ? "Sending..." : "Send Reset Code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="flex flex-col gap-5">
            <div>
              <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-2">
                6-Digit Reset Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="Enter 6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-4 py-3 text-center tracking-widest text-lg font-mono rounded-2xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-[#1C1C1E] shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-2">
                New Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-[#1C1C1E] text-sm shadow-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full bg-[#047857] hover:bg-[#10B981] text-white text-sm font-semibold shadow-md transition-all disabled:opacity-50 mt-2 cursor-pointer"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-[#6B7280] mt-8">
          Remember your password?{" "}
          <Link href="/login" className="text-[#047857] font-semibold hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
