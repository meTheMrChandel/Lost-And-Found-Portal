"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiClient, getErrorMessage } from "@/lib/api";
import { loginUrl } from "@/lib/redirect";
import Breadcrumbs from "@/components/Breadcrumbs";
import { User } from "@/types/auth";

const toFormData = (user: User | null) => ({
  full_name: user?.full_name || "",
  hostel: user?.hostel || "",
  phone: user?.phone || "",
  department: user?.department || "CSE",
  program_year: user?.program_year || "BTECH_1",
});

export default function ProfilePage() {
  const { user, loading, logout, setUser } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState(() => toFormData(user));

  // Re-seed the form whenever a different user object arrives (initial load
  // or after saving), during render instead of in an effect
  const [seededFrom, setSeededFrom] = useState(user);
  if (user !== seededFrom) {
    setSeededFrom(user);
    setFormData(toFormData(user));
  }

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  // Set on purpose-logout so the "not signed in" redirect below doesn't send us to /login
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!loading && !user && !loggingOut) {
      router.replace(loginUrl("/profile"));
    }
  }, [user, loading, loggingOut, router]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMsg("");
    try {
      const res = await apiClient("/users/me/", {
        method: "PATCH",
        data: formData,
      });
      setUser(res.data);
      setMsg("Profile details saved successfully.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update profile."));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2]">
        <div className="text-sm font-semibold text-[#6B7280]">Loading student profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <Breadcrumbs className="mb-5" />
        {/* Header bar */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-3xl font-bold text-[#1C1C1E]">
              My Profile
            </h1>
            <p className="text-sm text-[#6B7280]">
              Manage your personal student details and campus contact info
            </p>
          </div>
          <button
            onClick={() => {
              setLoggingOut(true);
              router.replace("/");
              logout();
            }}
            className="px-4 py-2 rounded-full border border-[#D94F3B] text-[#D94F3B] hover:bg-[#D94F3B] hover:text-white text-xs font-semibold transition-all cursor-pointer"
          >
            Log Out
          </button>
        </div>

        {/* Profile Card */}
        <div className="p-8 rounded-3xl bg-[#EFEAE0]/80 border border-[#EFEAE0] shadow-sm">
          {error && (
            <div className="p-4 rounded-2xl bg-[#D94F3B]/10 border border-[#D94F3B]/20 text-[#D94F3B] text-sm mb-6">
              {error}
            </div>
          )}

          {msg && (
            <div className="p-4 rounded-2xl bg-[#047857]/10 border border-[#047857]/20 text-[#047857] text-sm mb-6">
              {msg}
            </div>
          )}

          <form onSubmit={handleUpdate} className="flex flex-col gap-5">
            {/* Read-Only Account Identity */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-[#FAF7F2] border border-[#E2DDD2]">
              <div>
                <span className="text-xs font-semibold text-[#6B7280] block mb-1">
                  Institute Email (Fixed)
                </span>
                <span className="text-sm font-medium text-[#1C1C1E]">
                  {user.email}
                </span>
              </div>

              <div>
                <span className="text-xs font-semibold text-[#6B7280] block mb-1">
                  Registration Number (Fixed)
                </span>
                <span className="text-sm font-medium text-[#1C1C1E] uppercase">
                  {user.registration_number}
                </span>
              </div>
            </div>

            {/* Editable Fields */}
            <div>
              <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-2">
                Full Name
              </label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-sm shadow-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-2">
                  Department
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-sm shadow-sm"
                >
                  <option value="CSE">Computer Science</option>
                  <option value="ECE">Electrical Engineering</option>
                  <option value="ME">Mechanical Engineering</option>
                  <option value="CE">Civil Engineering</option>
                  <option value="MATHS">Mathematics</option>
                  <option value="PHYSICS">Physics</option>
                  <option value="CHEMISTRY">Chemistry</option>
                  <option value="HSS">Humanities</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-2">
                  Program & Year
                </label>
                <select
                  value={formData.program_year}
                  onChange={(e) => setFormData({ ...formData, program_year: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-sm shadow-sm"
                >
                  <option value="BTECH_1">B.Tech 1st Year</option>
                  <option value="BTECH_2">B.Tech 2nd Year</option>
                  <option value="BTECH_3">B.Tech 3rd Year</option>
                  <option value="BTECH_4">B.Tech 4th Year</option>
                  <option value="MTECH_1">M.Tech 1st Year</option>
                  <option value="MTECH_2">M.Tech 2nd Year</option>
                  <option value="PHD">Ph.D</option>
                  <option value="FACULTY">Faculty / Staff</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-2">
                  Hostel
                </label>
                <input
                  type="text"
                  placeholder="e.g. Satluj"
                  value={formData.hostel}
                  onChange={(e) => setFormData({ ...formData, hostel: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-sm shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-sm shadow-sm"
                />
              </div>
            </div>

            <div className="flex justify-between items-center mt-4">
              <Link
                href="/"
                className="text-xs text-[#6B7280] hover:text-[#1C1C1E] font-medium"
              >
                ← Back to Home
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="px-8 py-3 rounded-full bg-[#047857] hover:bg-[#10B981] text-white text-sm font-semibold shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                {saving ? "Saving Changes..." : "Save Profile"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
