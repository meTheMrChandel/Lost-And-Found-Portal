"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient, getErrorMessage } from "@/lib/api";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function RegisterPage() {
  const router = useRouter();

  // Step 1: Request OTP, Step 2: Verify OTP, Step 3: Fill Profile
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [formData, setFormData] = useState({
    password: "",
    full_name: "",
    registration_number: "",
    department: "CSE",
    program_year: "BTECH_1",
    hostel: "",
    phone: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Step 1: Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiClient<{ success: boolean; message: string }>("/auth/request-otp/", {
        method: "POST",
        data: { email, purpose: "registration" },
      });
      setSuccessMsg(res.message);
      setOtpCode("");
      setStep(2);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to send OTP."));
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiClient("/auth/verify-otp/", {
        method: "POST",
        data: { email, code: otpCode, purpose: "registration" },
      });
      setSuccessMsg("OTP Verified! Please complete your student profile.");
      setStep(3);
    } catch (err) {
      setError(getErrorMessage(err, "Invalid OTP code."));
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Complete Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiClient("/auth/register/", {
        method: "POST",
        data: {
          email,
          ...formData,
        },
      });
      router.push("/login?registered=true");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to complete registration."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAF7F2]">
      <div className="w-full max-w-lg p-8 rounded-3xl bg-[#EFEAE0]/80 border border-[#EFEAE0] shadow-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <Logo size={48} variant="tile" className="mx-auto mb-4" />
          <h1 className="font-serif text-3xl font-bold text-[#1C1C1E]">
            Student Registration
          </h1>
          <p className="text-sm text-[#6B7280] mt-1 font-sans">
            Step {step} of 3 • {step === 1 ? "Email Validation" : step === 2 ? "OTP Verification" : "Profile Details"}
          </p>

          {/* Stepper Progress */}
          <div className="flex gap-2 justify-center mt-4">
            <span className={`h-1.5 rounded-full transition-all ${step >= 1 ? "w-8 bg-[#047857]" : "w-4 bg-[#E2DDD2]"}`} />
            <span className={`h-1.5 rounded-full transition-all ${step >= 2 ? "w-8 bg-[#047857]" : "w-4 bg-[#E2DDD2]"}`} />
            <span className={`h-1.5 rounded-full transition-all ${step >= 3 ? "w-8 bg-[#047857]" : "w-4 bg-[#E2DDD2]"}`} />
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-[#D94F3B]/10 border border-[#D94F3B]/20 text-[#D94F3B] text-sm mb-6 font-medium">
            {error}
          </div>
        )}

        {successMsg && !error && (
          <div className="p-4 rounded-2xl bg-[#047857]/10 border border-[#047857]/20 text-[#047857] text-sm mb-6 font-medium">
            {successMsg}
          </div>
        )}

        {/* STEP 1: Email Form */}
        {step === 1 && (
          <form onSubmit={handleRequestOtp} className="flex flex-col gap-5">
            <div>
              <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-2">
                IIT Ropar Email Address
              </label>
              <input
                type="email"
                required
                placeholder="e.g. 2024csm1001@iitrpr.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-[#1C1C1E] text-sm shadow-sm"
              />
              <p className="text-xs text-[#6B7280] mt-2">
                Only valid @iitrpr.ac.in emails are accepted.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full bg-[#047857] hover:bg-[#10B981] text-white text-sm font-semibold shadow-md transition-all disabled:opacity-50 mt-2 cursor-pointer"
            >
              {loading ? "Sending OTP..." : "Send Verification Code"}
            </button>
          </form>
        )}

        {/* STEP 2: OTP Verification Form */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-5">
            <div>
              <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-2">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="Enter 6-digit code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full px-4 py-3 text-center tracking-widest text-lg font-mono rounded-2xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-[#1C1C1E] shadow-sm"
              />
              <div className="flex justify-between items-center mt-2 text-xs">
                <span className="text-[#6B7280]">Sent to {email}</span>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-[#047857] font-medium hover:underline"
                >
                  Change Email
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full bg-[#047857] hover:bg-[#10B981] text-white text-sm font-semibold shadow-md transition-all disabled:opacity-50 mt-2 cursor-pointer"
            >
              {loading ? "Verifying..." : "Verify Code"}
            </button>
          </form>
        )}

        {/* STEP 3: Student Profile Details */}
        {step === 3 && (
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="Aman Sharma"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-sm shadow-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-1">
                  Registration Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="2024CSM1001"
                  value={formData.registration_number}
                  onChange={(e) => setFormData({ ...formData, registration_number: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-sm uppercase shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Min 8 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-sm shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-1">
                  Department
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-sm shadow-sm"
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
                <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-1">
                  Program & Year
                </label>
                <select
                  value={formData.program_year}
                  onChange={(e) => setFormData({ ...formData, program_year: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-sm shadow-sm"
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-1">
                  Hostel (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Satluj / Chenab"
                  value={formData.hostel}
                  onChange={(e) => setFormData({ ...formData, hostel: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-sm shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-1">
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-sm shadow-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full bg-[#047857] hover:bg-[#10B981] text-white text-sm font-semibold shadow-md transition-all disabled:opacity-50 mt-2 cursor-pointer"
            >
              {loading ? "Creating Account..." : "Complete Registration"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-[#6B7280] mt-8">
          Already have an account?{" "}
          <Link href="/login" className="text-[#047857] font-semibold hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
