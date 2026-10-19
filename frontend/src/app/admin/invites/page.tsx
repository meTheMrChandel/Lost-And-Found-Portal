"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { AdminInvite } from "@/types/auth";

export default function AdminInvitesPage() {
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchInvites = async () => {
    try {
      const res = await apiClient("/adminpanel/invites/");
      if (res?.data) {
        setInvites(res.data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load invites list.");
    }
  };

  useEffect(() => {
    fetchInvites();
  }, []);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await apiClient("/adminpanel/invites/", {
        method: "POST",
        data: { email },
      });
      setSuccess(res.message || "Invitation sent successfully!");
      setEmail("");
      fetchInvites();
    } catch (err: any) {
      setError(err.message || "Failed to send invitation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#1C1C1E]">
          Staff Invitations
        </h1>
        <p className="text-sm text-[#6B7280]">
          Invite campus staff and student coordinators to help moderate posts.
        </p>
      </div>

      {/* Invite Dispatch Form Card */}
      <div className="p-6 rounded-2xl bg-[#EFEAE0]/80 border border-[#EFEAE0] shadow-sm max-w-xl">
        <h2 className="font-serif text-lg font-bold text-[#1C1C1E] mb-2">
          Invite New Administrator
        </h2>
        <p className="text-xs text-[#6B7280] mb-4">
          A unique invitation link valid for 3 days will be emailed to the address.
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-[#D94F3B]/10 border border-[#D94F3B]/20 text-[#D94F3B] text-xs font-semibold mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 rounded-xl bg-[#047857]/10 border border-[#047857]/20 text-[#047857] text-xs font-semibold mb-4">
            {success}
          </div>
        )}

        <form onSubmit={handleSendInvite} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            required
            placeholder="e.g. staff.member@iitrpr.ac.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-[#047857] hover:bg-[#10B981] text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            {loading ? "Sending..." : "Send Invitation"}
          </button>
        </form>
      </div>

      {/* Sent Invites Table */}
      <div className="p-6 rounded-2xl bg-white border border-[#E2DDD2] shadow-sm">
        <h2 className="font-serif text-lg font-bold text-[#1C1C1E] mb-4">
          Invitation History ({invites.length})
        </h2>

        {invites.length === 0 ? (
          <p className="text-xs text-[#6B7280] py-6 text-center">
            No admin invitations sent yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#EFEAE0] text-[#6B7280] font-semibold uppercase">
                <tr>
                  <th className="pb-3 px-2">Invited Email</th>
                  <th className="pb-3 px-2">Invited By</th>
                  <th className="pb-3 px-2">Status</th>
                  <th className="pb-3 px-2">Sent At</th>
                  <th className="pb-3 px-2">Token</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEAE0]/60">
                {invites.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#FAF7F2]/50">
                    <td className="py-3 px-2 font-medium text-[#1C1C1E]">
                      {inv.email}
                    </td>
                    <td className="py-3 px-2 text-[#6B7280]">
                      {inv.invited_by_email || "System"}
                    </td>
                    <td className="py-3 px-2">
                      {inv.is_used ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#047857]/15 text-[#047857]">
                          ACCEPTED
                        </span>
                      ) : inv.is_expired ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D94F3B]/15 text-[#D94F3B]">
                          EXPIRED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F5B73B]/20 text-[#1C1C1E]">
                          PENDING
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-[#6B7280]">
                      {new Date(inv.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-2 font-mono text-[11px] text-[#6B7280]">
                      {inv.token.substring(0, 8)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
