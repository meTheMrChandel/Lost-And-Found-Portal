"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { getErrorMessage } from "@/lib/api";
import { safeRedirect, useRedirectIfSignedIn } from "@/lib/redirect";
import Logo from "@/components/Logo";
import SessionCheck from "@/components/SessionCheck";

// Notices other pages hand over via the query string after a redirect here
const NOTICES: Record<string, string> = {
  registered: "Account created. Log in to get started.",
  reset: "Password updated. Log in with your new password.",
  admin_activated: "Admin access activated. Log in to open the Admin Portal.",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const { user, login } = useAuth();
  const redirectTo = safeRedirect(searchParams.get("redirect"));
  // Already signed in, or just signed in: move on, replacing this page in history
  const redirecting = useRedirectIfSignedIn(redirectTo);
  const notice = Object.keys(NOTICES).find((key) => searchParams.has(key));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to log in. Please check your credentials."));
    } finally {
      setSubmitting(false);
    }
  };

  if (redirecting) {
    return <SessionCheck message={user ? "You're signed in. Taking you there..." : "Checking your session..."} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAF7F2]">
      <div className="w-full max-w-md p-8 rounded-3xl bg-[#EFEAE0]/80 border border-[#EFEAE0] shadow-lg">
        <div className="text-center mb-8">
          <Logo size={48} variant="tile" className="mx-auto mb-4" />
          <h1 className="font-serif text-3xl font-bold text-[#1C1C1E]">
            Welcome Back
          </h1>
          <p className="text-sm text-[#6B7280] mt-1 font-sans">
            Log in with your IIT Ropar credentials
          </p>
        </div>

        {notice && !error && (
          <div className="p-4 rounded-2xl bg-[#047857]/10 border border-[#047857]/20 text-[#047857] text-sm mb-6 font-medium">
            {NOTICES[notice]}
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-[#D94F3B]/10 border border-[#D94F3B]/20 text-[#D94F3B] text-sm mb-6 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-2">
              Institute Email
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

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-[#047857] hover:underline font-medium"
              >
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-[#1C1C1E] text-sm shadow-sm"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-full bg-[#047857] hover:bg-[#10B981] text-white text-sm font-semibold shadow-md transition-all disabled:opacity-50 mt-2 cursor-pointer"
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-sm text-[#6B7280] mt-8">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-[#047857] font-semibold hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<SessionCheck />}>
      <LoginForm />
    </Suspense>
  );
}
