"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient, getErrorMessage, ListResponse, unwrapList } from "@/lib/api";

interface CategorySummary {
  id: string;
  slug: string;
  name: string;
  icon?: string;
}

interface RegisteredItem {
  id: string;
  name: string;
  category: CategorySummary;
  description: string;
  serial_number: string;
  qr_uuid: string;
  is_active: boolean;
  deactivated_at: string | null;
  scan_url: string;
  created_at: string;
}

export default function MyValuablesPage() {
  const [items, setItems] = useState<RegisteredItem[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Register modal
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("bicycle");
  const [descInput, setDescInput] = useState("");
  const [serialInput, setSerialInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Sticker modal
  const [stickerItem, setStickerItem] = useState<RegisteredItem | null>(null);
  const [stickerSvg, setStickerSvg] = useState<string>("");
  const [loadingSticker, setLoadingSticker] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient("/items/");
      if (res?.data) {
        setItems(Array.isArray(res.data) ? res.data : res.data.results || []);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load registered valuables."));
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await apiClient<ListResponse<CategorySummary>>("/posts/categories/");
      const list = unwrapList(res);
      if (list.length > 0) {
        setCategories(list);
        setCategoryInput((prev) => (prev ? prev : list[0].slug));
      }
    } catch (err) {
      console.error("Failed to load categories", err);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchCategories();
  }, []);

  const handleRegisterItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await apiClient("/items/", {
        method: "POST",
        data: {
          name: nameInput.trim(),
          category: categoryInput || "bicycle",
          description: descInput.trim(),
          serial_number: serialInput.trim(),
        },
      });

      setSuccessMsg("Valuable item registered successfully! You can now print your QR sticker.");
      setIsRegisterOpen(false);
      setNameInput("");
      setDescInput("");
      setSerialInput("");
      await fetchItems();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to register item."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (item: RegisteredItem) => {
    try {
      const res = await apiClient<{ message?: string }>(`/items/${item.id}/toggle-active/`, {
        method: "POST",
      });
      setSuccessMsg(res?.message || "QR sticker status updated.");
      await fetchItems();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to toggle active state."));
    }
  };

  const handleDeleteItem = async (item: RegisteredItem) => {
    if (!confirm(`Are you sure you want to remove "${item.name}" from your registered valuables?`)) {
      return;
    }
    try {
      await apiClient(`/items/${item.id}/`, { method: "DELETE" });
      setSuccessMsg(`"${item.name}" removed successfully.`);
      await fetchItems();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to remove item."));
    }
  };

  const handleOpenSticker = async (item: RegisteredItem) => {
    setStickerItem(item);
    setLoadingSticker(true);
    try {
      const res = await apiClient<{ svg?: string; data?: { svg?: string } } | string>(
        `/items/${item.id}/sticker/?format=json`
      );
      const svg = typeof res === "string" ? res : res?.svg || res?.data?.svg || "";
      if (svg) {
        setStickerSvg(svg);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to generate QR sticker."));
    } finally {
      setLoadingSticker(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C1C1E] flex flex-col">
      {/* Navigation Header */}
      <header className="border-b border-[#EFEAE0] bg-[#FAF7F2]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
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
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-semibold text-[#6B7280] hover:text-[#1C1C1E] transition-colors"
            >
              ← Back to Portal
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl w-full mx-auto px-6 py-8 flex-1 space-y-6">
        {/* Banner */}
        <div className="bg-white p-6 rounded-2xl border border-[#EFEAE0] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏷️</span>
              <h1 className="font-serif text-2xl font-bold text-[#1C1C1E]">
                My Registered Valuables
              </h1>
            </div>
            <p className="text-xs text-[#6B7280] mt-1 max-w-xl">
              Register your bicycles, laptops, phones, and gear. Generate printable QR stickers that allow finders to identify you while keeping your phone number and personal details completely confidential.
            </p>
          </div>

          <button
            onClick={() => setIsRegisterOpen(true)}
            className="px-5 py-2.5 bg-[#047857] hover:bg-[#065F46] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-2"
          >
            <span>+ Register New Item</span>
          </button>
        </div>

        {/* Alerts */}
        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg("")} className="font-bold ml-2">✕</button>
          </div>
        )}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="font-bold ml-2">✕</button>
          </div>
        )}

        {/* Items Listing */}
        {loading ? (
          <div className="p-16 text-center text-xs text-[#6B7280]">
            Loading your registered valuables...
          </div>
        ) : items.length === 0 ? (
          <div className="p-16 bg-white rounded-2xl border border-[#EFEAE0] text-center max-w-lg mx-auto">
            <div className="text-4xl mb-3">🚲</div>
            <h3 className="font-serif text-lg font-bold text-[#1C1C1E]">
              No items registered yet
            </h3>
            <p className="text-xs text-[#6B7280] mt-1">
              Protect your bicycle, laptop, or personal gear with a printable QR sticker before heading to campus.
            </p>
            <button
              onClick={() => setIsRegisterOpen(true)}
              className="mt-4 px-5 py-2 bg-[#047857] hover:bg-[#065F46] text-white text-xs font-bold rounded-xl shadow-sm transition"
            >
              Register Your First Item
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-[#EFEAE0] overflow-hidden shadow-sm hover:border-[#047857]/40 transition flex flex-col justify-between"
              >
                <div className="p-6 space-y-4">
                  {/* Category & Status */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#FAF7F2] border border-[#EFEAE0] text-[#6B7280]">
                      {item.category?.name || "Valuable"}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        item.is_active
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "bg-gray-100 text-gray-500 border border-gray-200"
                      }`}
                    >
                      {item.is_active ? "QR Active" : "Deactivated"}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#1C1C1E]">
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="text-xs text-[#6B7280] mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {item.serial_number && (
                    <div className="bg-[#FAF7F2] p-2.5 rounded-xl border border-[#EFEAE0] text-xs">
                      <span className="text-[10px] uppercase font-bold text-[#6B7280] block">
                        🔒 Confidential Serial / Frame No:
                      </span>
                      <span className="font-mono font-medium text-[#1C1C1E]">
                        {item.serial_number}
                      </span>
                    </div>
                  )}

                  <div className="text-[11px] text-[#9CA3AF] flex items-center justify-between">
                    <span>Registered: {new Date(item.created_at).toLocaleDateString()}</span>
                    <span className="font-mono">UUID: {item.qr_uuid.slice(0, 8)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="px-6 py-3.5 bg-[#FAF7F2] border-t border-[#EFEAE0] flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenSticker(item)}
                    className="px-3 py-1.5 bg-[#047857] hover:bg-[#065F46] text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5"
                  >
                    <span>🖨️ Print Sticker</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(item)}
                      className={`px-2.5 py-1.5 border rounded-lg text-xs font-semibold transition ${
                        item.is_active
                          ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                          : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                      }`}
                    >
                      {item.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item)}
                      className="px-2.5 py-1.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg transition"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Register Item Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-[#EFEAE0] max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-serif text-lg font-bold text-[#1C1C1E]">
              Register Valuable Belonging
            </h3>
            <p className="text-xs text-[#6B7280]">
              Register your gear to generate a confidential QR sticker link.
            </p>

            <form onSubmit={handleRegisterItem} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#1C1C1E] mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Firefox Mountain Bike Red / Dell Inspiron 15"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EFEAE0] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#047857]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1C1E] mb-1">
                  Category *
                </label>
                <select
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EFEAE0] rounded-xl text-xs font-semibold"
                >
                  {categories.map((c) => (
                    <option key={c.id || c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1C1E] mb-1">
                  Description (Color, brand, distinguishing stickers)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Matte black frame with blue water bottle holder"
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EFEAE0] rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1C1E] mb-1">
                  Serial Number / Frame Number (Private to you)
                </label>
                <input
                  type="text"
                  placeholder="e.g. SN-88219-X99"
                  value={serialInput}
                  onChange={(e) => setSerialInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EFEAE0] rounded-xl text-xs font-mono"
                />
                <span className="text-[10px] text-[#6B7280] block mt-1">
                  🔒 Never shown on public scan pages. Used only for ownership verification.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-[#6B7280]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#047857] hover:bg-[#065F46] text-white text-xs font-bold rounded-xl shadow-sm transition"
                >
                  {submitting ? "Registering..." : "Register & Get QR"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable QR Sticker Modal */}
      {stickerItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 print:p-0 print:bg-white">
          <div className="bg-white rounded-2xl border border-[#EFEAE0] max-w-sm w-full p-6 shadow-2xl space-y-4 print:shadow-none print:border-none print:max-w-none">
            <div className="flex items-center justify-between print:hidden">
              <h3 className="font-serif text-lg font-bold text-[#1C1C1E]">
                Printable QR Sticker
              </h3>
              <button onClick={() => setStickerItem(null)} className="font-bold text-[#6B7280]">
                ✕
              </button>
            </div>

            {/* Sticker Printable Preview Box */}
            <div className="border-2 border-dashed border-[#047857] rounded-2xl p-6 bg-white text-center space-y-3">
              <div className="flex items-center justify-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#047857] flex items-center justify-center text-white font-bold text-xs">
                  LF
                </div>
                <span className="font-serif font-bold text-sm tracking-tight text-[#1C1C1E]">
                  IIT Ropar Lost & Found
                </span>
              </div>

              <div className="py-2 flex justify-center">
                {loadingSticker ? (
                  <div className="w-40 h-40 flex items-center justify-center text-xs text-[#6B7280]">
                    Generating SVG...
                  </div>
                ) : stickerSvg ? (
                  <div
                    className="w-40 h-40 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                    dangerouslySetInnerHTML={{ __html: stickerSvg }}
                  />
                ) : (
                  <div className="w-40 h-40 bg-gray-100 flex items-center justify-center text-xs">
                    QR Ready
                  </div>
                )}
              </div>

              <div>
                <strong className="block text-xs text-[#1C1C1E]">{stickerItem.name}</strong>
                <span className="text-[10px] text-[#6B7280] block mt-0.5">
                  Scan to report found or contact via portal
                </span>
              </div>

              <div className="text-[9px] font-mono text-[#9CA3AF] border-t border-[#EFEAE0] pt-2">
                iitrpr.ac.in/lostandfound • ID: {stickerItem.qr_uuid.slice(0, 8)}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 print:hidden">
              <button
                onClick={() => setStickerItem(null)}
                className="px-4 py-2 text-xs font-semibold text-[#6B7280]"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 bg-[#047857] hover:bg-[#065F46] text-white text-xs font-bold rounded-xl shadow-sm transition"
              >
                🖨️ Print Sticker Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
