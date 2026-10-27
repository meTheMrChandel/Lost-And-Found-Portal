"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { nowForDateTimeInput } from "@/lib/datetime";
import { apiClient, getErrorMessage } from "@/lib/api";
import { Category } from "@/types/post";

const CAMPUS_LOCATIONS = [
  "Central Library",
  "Lecture Hall Complex (LHC)",
  "Main Cafeteria",
  "Satluj Hostel",
  "Beas Hostel",
  "Chenab Hostel",
  "Brahmaputra Hostel",
  "SAC / Sports Ground",
  "Admin Block",
  "Main Gate",
];

export default function ReportLostItemPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lastSeenPlace, setLastSeenPlace] = useState("");
  // The date input only renders after auth resolves on the client, so reading
  // the clock here cannot cause a hydration mismatch
  const [lastSeenTime, setLastSeenTime] = useState(nowForDateTimeInput);
  const [maxDate] = useState(nowForDateTimeInput);
  const [hiddenProof, setHiddenProof] = useState("");
  const [rewardAmount, setRewardAmount] = useState<number | string>(0);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient("/posts/categories/")
      .then((res) => {
        if (res?.data) {
          setCategories(res.data);
          if (res.data.length > 0) {
            setSelectedCategory(res.data[0].slug);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load categories", err);
      });
  }, []);

  // Handle image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);

    if (images.length + newFiles.length > 5) {
      setError("You can attach a maximum of 5 photos.");
      return;
    }

    for (const f of newFiles) {
      if (f.size > 5 * 1024 * 1024) {
        setError(`File "${f.name}" exceeds the 5MB size limit.`);
        return;
      }
    }

    const updatedImages = [...images, ...newFiles];
    setImages(updatedImages);

    // Generate previews
    const newPreviews = newFiles.map((file) => URL.createObjectURL(file));
    setImagePreviews([...imagePreviews, ...newPreviews]);
    setError("");
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImages(images.filter((_, i) => i !== index));
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim() || !selectedCategory || !description.trim() || !lastSeenPlace.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("category", selectedCategory);
      formData.append("description", description.trim());
      formData.append("last_seen_place", lastSeenPlace.trim());
      formData.append("last_seen_time", new Date(lastSeenTime).toISOString());
      formData.append("hidden_proof", hiddenProof.trim());
      formData.append("reward_amount", String(rewardAmount || 0));

      images.forEach((img) => {
        formData.append("images", img);
      });

      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const res = await fetch("http://127.0.0.1:8000/api/v1/posts/lost/", {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to submit lost item report.");
      }

      router.push("/my-reports?submitted=true");
    } catch (err) {
      setError(getErrorMessage(err, "An error occurred while submitting."));
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center text-xs text-[#6B7280]">
        Verifying authorization...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl border border-[#E2DDD2] max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-[#047857]/10 text-[#047857] flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            🔒
          </div>
          <h2 className="font-serif text-2xl font-bold text-[#1C1C1E] mb-2">
            Campus Authentication Required
          </h2>
          <p className="text-xs text-[#6B7280] mb-6">
            Please log in with your verified IIT Ropar student account to report lost belongings.
          </p>
          <Link
            href="/login?redirect=/report/lost"
            className="block w-full py-3 rounded-full bg-[#047857] hover:bg-[#10B981] text-white text-xs font-bold transition-all shadow-sm"
          >
            Log in to Report
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C1C1E] flex flex-col">
      {/* Top Header */}
      <header className="border-b border-[#EFEAE0] bg-[#FAF7F2]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-18 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#047857] flex items-center justify-center text-white font-bold text-sm shadow-sm">
              LF
            </div>
            <span className="font-serif text-lg font-bold text-[#1C1C1E]">
              Lost & Found
            </span>
          </Link>

          <div className="flex items-center gap-4 text-xs">
            <Link
              href="/my-reports"
              className="font-medium text-[#6B7280] hover:text-[#1C1C1E] transition-colors"
            >
              My Reports
            </Link>
            <Link
              href="/"
              className="text-[#6B7280] hover:text-[#1C1C1E] transition-colors"
            >
              Cancel
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#D94F3B]/10 text-[#D94F3B] mb-2">
            User 1 Flow • Student Report
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1C1C1E]">
            Report a Lost Belonging
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Provide details of your missing item. Campus administration will review your report and match incoming custody logs.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-[#D94F3B]/10 border border-[#D94F3B]/20 text-[#D94F3B] text-xs font-semibold mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          {/* Section 1: Item Overview */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#E2DDD2] shadow-sm flex flex-col gap-6">
            <h2 className="font-serif text-xl font-bold text-[#1C1C1E]">
              1. Item Information
            </h2>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#1C1C1E] mb-2">
                Item Name / Title <span className="text-[#D94F3B]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Blue Dell Inspiron 15, Satluj Room 204 Keys, Black Titan Watch"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-[#FAF7F2] border border-[#E2DDD2] text-sm focus:ring-2 focus:ring-[#047857] outline-none"
              />
            </div>

            {/* Category Picker */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#1C1C1E] mb-2">
                Select Category <span className="text-[#D94F3B]">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat.slug;
                  return (
                    <button
                      type="button"
                      key={cat.slug}
                      onClick={() => setSelectedCategory(cat.slug)}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? "border-[#047857] bg-[#047857]/10 text-[#047857] shadow-sm"
                          : "border-[#E2DDD2] bg-[#FAF7F2] text-[#1C1C1E] hover:border-[#1C1C1E]/30"
                      }`}
                    >
                      <span>{cat.name}</span>
                      {cat.is_sensitive && (
                        <span className="text-[10px] text-[#D94F3B] font-bold">
                          [Sensitive]
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#1C1C1E] mb-2">
                Public Description <span className="text-[#D94F3B]">*</span>
              </label>
              <textarea
                rows={4}
                required
                placeholder="Describe general features visible to anyone (colour, brand, model, size, stickers)..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-[#FAF7F2] border border-[#E2DDD2] text-sm focus:ring-2 focus:ring-[#047857] outline-none"
              />
            </div>
          </div>

          {/* Section 2: Last Seen Details */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#E2DDD2] shadow-sm flex flex-col gap-6">
            <h2 className="font-serif text-xl font-bold text-[#1C1C1E]">
              2. When & Where Was It Lost?
            </h2>

            {/* Place */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#1C1C1E] mb-2">
                Last Seen Location <span className="text-[#D94F3B]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Specific room, corridor, bench, or walkway..."
                value={lastSeenPlace}
                onChange={(e) => setLastSeenPlace(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-[#FAF7F2] border border-[#E2DDD2] text-sm focus:ring-2 focus:ring-[#047857] outline-none mb-3"
              />

              {/* Quick campus location buttons */}
              <div className="flex flex-wrap gap-2">
                {CAMPUS_LOCATIONS.map((loc) => (
                  <button
                    type="button"
                    key={loc}
                    onClick={() => setLastSeenPlace(loc)}
                    className="px-2.5 py-1 rounded-lg bg-[#FAF7F2] hover:bg-[#EFEAE0] border border-[#E2DDD2] text-[11px] text-[#6B7280] hover:text-[#1C1C1E] transition-colors"
                  >
                    + {loc}
                  </button>
                ))}
              </div>
            </div>

            {/* Time */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#1C1C1E] mb-2">
                Approximate Date & Time <span className="text-[#D94F3B]">*</span>
              </label>
              <input
                type="datetime-local"
                required
                max={maxDate}
                value={lastSeenTime}
                onChange={(e) => setLastSeenTime(e.target.value)}
                className="px-4 py-2.5 rounded-2xl bg-[#FAF7F2] border border-[#E2DDD2] text-xs font-mono focus:ring-2 focus:ring-[#047857] outline-none"
              />

            </div>
          </div>

          {/* Section 3: Confidential Proof (Crucial for Phase 3) */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-[#047857]/40 shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-[#047857]/15 text-[#047857]">
                🔒 Confidential Verification Proof
              </span>
              <span className="text-[11px] text-[#6B7280]">
                Admin & Owner Only
              </span>
            </div>
            <h2 className="font-serif text-xl font-bold text-[#1C1C1E]">
              3. Secret Ownership Proof
            </h2>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Provide unique details that <strong>only the rightful owner would know</strong>.
              This will <strong>NEVER</strong> appear on public campus feeds. When a found item is submitted, campus administrators use this proof to verify you.
            </p>
            <textarea
              rows={3}
              placeholder="e.g. Phone wallpaper image, serial number ending in 492, tiny scratch near volume button, student ID card inside pocket, keychain letter initial..."
              value={hiddenProof}
              onChange={(e) => setHiddenProof(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-[#FAF7F2] border border-[#E2DDD2] text-sm focus:ring-2 focus:ring-[#047857] outline-none"
            />
          </div>

          {/* Section 4: Photos & Reward */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#E2DDD2] shadow-sm flex flex-col gap-6">
            <h2 className="font-serif text-xl font-bold text-[#1C1C1E]">
              4. Photos & Promised Reward
            </h2>

            {/* Images Dropzone */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#1C1C1E] mb-2">
                Attach Photos (Max 5 photos, 5MB each)
              </label>

              <div className="flex flex-wrap gap-4 items-center">
                {imagePreviews.map((src, idx) => (
                  <div
                    key={idx}
                    className="relative w-24 h-24 rounded-2xl border border-[#E2DDD2] overflow-hidden group shadow-sm bg-[#FAF7F2]"
                  >
                    <img
                      src={src}
                      alt={`Preview ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute inset-0 bg-black/60 text-white font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                    >
                      ✕ Remove
                    </button>
                  </div>
                ))}

                {images.length < 5 && (
                  <label className="w-24 h-24 rounded-2xl border-2 border-dashed border-[#E2DDD2] hover:border-[#047857] flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-[#FAF7F2]/60 hover:bg-[#FAF7F2]">
                    <span className="text-xl text-[#047857]">+</span>
                    <span className="text-[10px] text-[#6B7280] font-semibold">
                      Add Photo
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Promised Reward */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#1C1C1E] mb-1">
                Optional Promised Reward (₹)
              </label>
              <p className="text-[11px] text-[#6B7280] mb-2">
                Honor-based incentive offered to the finder upon successful verification and handover.
              </p>
              <div className="relative max-w-xs">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#6B7280]">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={rewardAmount}
                  onChange={(e) => setRewardAmount(Math.max(0, Number(e.target.value)))}
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#E2DDD2] text-sm font-mono focus:ring-2 focus:ring-[#047857] outline-none"
                />
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-end gap-4 pb-12">
            <Link
              href="/"
              className="px-6 py-3 rounded-full text-xs font-semibold text-[#6B7280] hover:text-[#1C1C1E]"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3.5 rounded-full bg-[#047857] hover:bg-[#10B981] text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Submitting Report..." : "Submit Lost Report"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
