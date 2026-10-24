"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
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

function ReportFoundContent() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lastSeenPlace, setLastSeenPlace] = useState("");
  const [lastSeenTime, setLastSeenTime] = useState("");
  const [maxDate, setMaxDate] = useState("");
  const [custodyLocation, setCustodyLocation] = useState<string>("finder");
  const [informAdminPrivately, setInformAdminPrivately] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const nowStr = new Date().toISOString().slice(0, 16);
    setLastSeenTime(nowStr);
    setMaxDate(nowStr);

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
      formData.append("custody_location", custodyLocation);
      formData.append("inform_admin_privately", String(informAdminPrivately));

      images.forEach((img) => {
        formData.append("images", img);
      });

      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const res = await fetch("http://127.0.0.1:8000/api/v1/posts/found/", {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to submit found item report.");
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
            ✨
          </div>
          <h2 className="font-serif text-2xl font-bold text-[#1C1C1E] mb-2">
            Campus Sign-in Required
          </h2>
          <p className="text-xs text-[#6B7280] mb-6">
            Please log in with your verified IIT Ropar student account to report items found on campus.
          </p>
          <Link
            href="/login?redirect=/report/found"
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
      {/* Header */}
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
              href="/feed"
              className="font-medium text-[#6B7280] hover:text-[#1C1C1E] transition-colors"
            >
              Public Feed
            </Link>
            <Link
              href="/my-reports"
              className="font-medium text-[#6B7280] hover:text-[#1C1C1E] transition-colors"
            >
              My Reports
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#047857]/10 text-[#047857] mb-2">
            User 2 Flow • Found Report
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1C1C1E]">
            Report a Found Belonging
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Thank you for being a responsible campus member! Share details of the item you found to help reunite it with its owner.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-[#D94F3B]/10 border border-[#D94F3B]/20 text-[#D94F3B] text-xs font-semibold mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          {/* Section 1: Item Details */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#E2DDD2] shadow-sm flex flex-col gap-6">
            <h2 className="font-serif text-xl font-bold text-[#1C1C1E]">
              1. Item Information
            </h2>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#1C1C1E] mb-2">
                What did you find? <span className="text-[#D94F3B]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Set of room keys with blue ribbon, Black HP laptop charger, Steel water bottle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-[#FAF7F2] border border-[#E2DDD2] text-sm focus:ring-2 focus:ring-[#047857] outline-none"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#1C1C1E] mb-2">
                Item Category <span className="text-[#D94F3B]">*</span>
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
                Description & Appearance <span className="text-[#D94F3B]">*</span>
              </label>
              <textarea
                rows={4}
                required
                placeholder="Describe visible features (color, brand, visible stickers, physical condition)..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-[#FAF7F2] border border-[#E2DDD2] text-sm focus:ring-2 focus:ring-[#047857] outline-none"
              />
            </div>
          </div>

          {/* Section 2: Found Location & Time */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#E2DDD2] shadow-sm flex flex-col gap-6">
            <h2 className="font-serif text-xl font-bold text-[#1C1C1E]">
              2. Where & When Did You Find It?
            </h2>

            <div>
              <label className="block text-xs font-bold uppercase text-[#1C1C1E] mb-2">
                Location Found <span className="text-[#D94F3B]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Left on bench near Cafeteria entrance, Computer Lab 2..."
                value={lastSeenPlace}
                onChange={(e) => setLastSeenPlace(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-[#FAF7F2] border border-[#E2DDD2] text-sm focus:ring-2 focus:ring-[#047857] outline-none mb-3"
              />

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

            <div>
              <label className="block text-xs font-bold uppercase text-[#1C1C1E] mb-2">
                Found Date & Time <span className="text-[#D94F3B]">*</span>
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

          {/* Section 3: Custody & Privacy Settings (Phase 5 Feature) */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#E2DDD2] shadow-sm flex flex-col gap-6">
            <h2 className="font-serif text-xl font-bold text-[#1C1C1E]">
              3. Custody & Privacy
            </h2>

            {/* Custody Location Options */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#1C1C1E] mb-2">
                Where is the item currently kept?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    key: "finder",
                    title: "With Finder (You)",
                    desc: "You are safely holding it until owner claims it.",
                  },
                  {
                    key: "admin_office",
                    title: "Admin Office",
                    desc: "Handed over to staff in Student Affairs / Admin.",
                  },
                  {
                    key: "security_office",
                    title: "Security Office",
                    desc: "Handed over to campus security main gate post.",
                  },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    onClick={() => setCustodyLocation(item.key)}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                      custodyLocation === item.key
                        ? "border-[#047857] bg-[#047857]/5 ring-1 ring-[#047857]"
                        : "border-[#E2DDD2] bg-[#FAF7F2] hover:border-[#1C1C1E]/30"
                    }`}
                  >
                    <span className="font-bold text-xs text-[#1C1C1E] block mb-1">
                      {item.title}
                    </span>
                    <span className="text-[11px] text-[#6B7280] block">
                      {item.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Private Admin Checkbox */}
            <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E2DDD2] flex items-start gap-3">
              <input
                type="checkbox"
                id="privateAdmin"
                checked={informAdminPrivately}
                onChange={(e) => setInformAdminPrivately(e.target.checked)}
                className="mt-0.5 accent-[#047857] cursor-pointer"
              />
              <label htmlFor="privateAdmin" className="cursor-pointer text-xs">
                <span className="font-bold text-[#1C1C1E] block">
                  Inform Campus Administration Privately
                </span>
                <span className="text-[#6B7280] block mt-0.5">
                  Keep this post hidden from the public feed. Only campus admins will review and manage matching (recommended for sensitive items, wallets, or cash).
                </span>
              </label>
            </div>
          </div>

          {/* Section 4: Photos */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#E2DDD2] shadow-sm flex flex-col gap-6">
            <h2 className="font-serif text-xl font-bold text-[#1C1C1E]">
              4. Photos of Found Belonging
            </h2>

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
          </div>

          {/* Submit */}
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
              {submitting ? "Submitting Found Report..." : "Submit Found Report"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default function ReportFoundPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center text-xs text-[#6B7280]">
          Loading form...
        </div>
      }
    >
      <ReportFoundContent />
    </Suspense>
  );
}
