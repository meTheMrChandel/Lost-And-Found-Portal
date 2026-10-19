"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { SiteSettings } from "@/types/auth";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const [matchThreshold, setMatchThreshold] = useState<number>(0.65);
  const [postExpiryDays, setPostExpiryDays] = useState<number>(30);
  const [otpExpirySeconds, setOtpExpirySeconds] = useState<number>(300);
  const [otpMaxAttempts, setOtpMaxAttempts] = useState<number>(5);

  const fetchSettings = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient("/adminpanel/settings/");
      if (res?.data) {
        setSettings(res.data);
        setMatchThreshold(res.data.match_threshold ?? 0.65);
        setPostExpiryDays(res.data.post_expiry_days ?? 30);
        setOtpExpirySeconds(res.data.otp_expiry_seconds ?? 300);
        setOtpMaxAttempts(res.data.otp_max_attempts ?? 5);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load site configuration.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMsg("");

    try {
      const res = await apiClient("/adminpanel/settings/", {
        method: "PATCH",
        data: {
          match_threshold: Number(matchThreshold),
          post_expiry_days: Number(postExpiryDays),
          otp_expiry_seconds: Number(otpExpirySeconds),
          otp_max_attempts: Number(otpMaxAttempts),
        },
      });

      setMsg(res.message || "Site settings updated successfully.");
      if (res.data) {
        setSettings(res.data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to update site configuration.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#1C1C1E]">
          Site Configuration
        </h1>
        <p className="text-sm text-[#6B7280]">
          Adjust matching algorithm sensitivity, post expiry lifecycle, and security constraints.
        </p>
      </div>

      {msg && (
        <div className="p-4 rounded-2xl bg-[#047857]/10 border border-[#047857]/20 text-[#047857] text-xs font-semibold">
          {msg}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-[#D94F3B]/10 border border-[#D94F3B]/20 text-[#D94F3B] text-xs font-semibold">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 rounded-2xl bg-white border border-[#E2DDD2] text-center text-xs text-[#6B7280]">
          Loading configuration...
        </div>
      ) : (
        <form
          onSubmit={handleSave}
          className="p-8 rounded-3xl bg-white border border-[#E2DDD2] shadow-sm flex flex-col gap-6"
        >
          {/* Match Threshold */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-[#1C1C1E] uppercase tracking-wider">
                Lost/Found Match Sensitivity
              </label>
              <span className="font-mono text-xs font-bold text-[#047857]">
                {(matchThreshold * 100).toFixed(0)}% ({matchThreshold})
              </span>
            </div>
            <p className="text-[11px] text-[#6B7280] mb-3">
              Minimum similarity score required to trigger an automatic match notification between lost and found items.
            </p>
            <input
              type="range"
              min="0.30"
              max="0.95"
              step="0.05"
              value={matchThreshold}
              onChange={(e) => setMatchThreshold(parseFloat(e.target.value))}
              className="w-full accent-[#047857] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#6B7280] mt-1">
              <span>30% (Loose)</span>
              <span>65% (Recommended)</span>
              <span>95% (Strict)</span>
            </div>
          </div>

          <hr className="border-[#EFEAE0]" />

          {/* Post Expiry Days */}
          <div>
            <label className="block text-xs font-bold text-[#1C1C1E] uppercase tracking-wider mb-1">
              Post Expiry Window (Days)
            </label>
            <p className="text-[11px] text-[#6B7280] mb-2">
              Number of days after which an unclaimed lost or found post automatically transitions to expired status.
            </p>
            <input
              type="number"
              min="7"
              max="365"
              required
              value={postExpiryDays}
              onChange={(e) => setPostExpiryDays(parseInt(e.target.value) || 30)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#E2DDD2] text-xs font-mono focus:ring-2 focus:ring-[#047857] outline-none"
            />
          </div>

          <hr className="border-[#EFEAE0]" />

          {/* OTP Expiry Seconds */}
          <div>
            <label className="block text-xs font-bold text-[#1C1C1E] uppercase tracking-wider mb-1">
              Email OTP Expiry (Seconds)
            </label>
            <p className="text-[11px] text-[#6B7280] mb-2">
              Lifetime of verification codes dispatched to campus emails for registration and password resets.
            </p>
            <input
              type="number"
              min="60"
              max="1800"
              step="30"
              required
              value={otpExpirySeconds}
              onChange={(e) => setOtpExpirySeconds(parseInt(e.target.value) || 300)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#E2DDD2] text-xs font-mono focus:ring-2 focus:ring-[#047857] outline-none"
            />
          </div>

          <hr className="border-[#EFEAE0]" />

          {/* OTP Max Attempts */}
          <div>
            <label className="block text-xs font-bold text-[#1C1C1E] uppercase tracking-wider mb-1">
              Maximum OTP Verification Attempts
            </label>
            <p className="text-[11px] text-[#6B7280] mb-2">
              Number of incorrect code submissions permitted before an OTP is invalidated for brute-force protection.
            </p>
            <input
              type="number"
              min="3"
              max="10"
              required
              value={otpMaxAttempts}
              onChange={(e) => setOtpMaxAttempts(parseInt(e.target.value) || 5)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#E2DDD2] text-xs font-mono focus:ring-2 focus:ring-[#047857] outline-none"
            />
          </div>

          {settings?.updated_at && (
            <p className="text-[10px] text-[#6B7280]">
              Last updated on{" "}
              {new Date(settings.updated_at).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-[#047857] hover:bg-[#10B981] text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving Changes..." : "Save Settings"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
