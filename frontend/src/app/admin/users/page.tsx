"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { User } from "@/types/auth";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [banReason, setBanReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const endpoint = search
        ? `/adminpanel/users/?search=${encodeURIComponent(search)}`
        : "/adminpanel/users/";
      const res = await apiClient(endpoint);
      if (res?.data) {
        setUsers(res.data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch student accounts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search]);

  const handleModerate = async (isBanned: boolean) => {
    if (!selectedUser) return;
    setActionLoading(true);
    setError("");
    setMsg("");

    try {
      const res = await apiClient(`/adminpanel/users/${selectedUser.id}/moderate/`, {
        method: "POST",
        data: {
          is_banned: isBanned,
          ban_reason: isBanned ? banReason : "",
        },
      });

      setMsg(res.message || "User moderation status updated.");
      setSelectedUser(null);
      setBanReason("");
      fetchUsers();
    } catch (err: any) {
      setError(err.message || "Moderation action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#1C1C1E]">
          Student Accounts & Moderation
        </h1>
        <p className="text-sm text-[#6B7280]">
          Search student records, verify departments, and manage suspensions.
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

      {/* Search Input */}
      <div className="max-w-md">
        <input
          type="text"
          placeholder="Search by name, email, or reg number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#E2DDD2] focus:outline-none focus:ring-2 focus:ring-[#047857] text-xs"
        />
      </div>

      {/* Users Table */}
      <div className="p-6 rounded-2xl bg-white border border-[#E2DDD2] shadow-sm">
        <h2 className="font-serif text-lg font-bold text-[#1C1C1E] mb-4">
          All Users ({users.length})
        </h2>

        {loading ? (
          <p className="text-xs text-[#6B7280] py-6 text-center">
            Loading student accounts...
          </p>
        ) : users.length === 0 ? (
          <p className="text-xs text-[#6B7280] py-6 text-center">
            No accounts match your query.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#EFEAE0] text-[#6B7280] font-semibold uppercase">
                <tr>
                  <th className="pb-3 px-2">Student Name</th>
                  <th className="pb-3 px-2">Campus Email</th>
                  <th className="pb-3 px-2">Reg #</th>
                  <th className="pb-3 px-2">Department</th>
                  <th className="pb-3 px-2">Role</th>
                  <th className="pb-3 px-2">Status</th>
                  <th className="pb-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEAE0]/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#FAF7F2]/50">
                    <td className="py-3 px-2 font-medium text-[#1C1C1E]">
                      {u.full_name}
                    </td>
                    <td className="py-3 px-2 text-[#6B7280]">{u.email}</td>
                    <td className="py-3 px-2 font-mono uppercase text-[11px]">
                      {u.registration_number}
                    </td>
                    <td className="py-3 px-2 text-[#6B7280]">
                      {u.department} • {u.program_year}
                    </td>
                    <td className="py-3 px-2">
                      {u.is_superuser ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1C1C1E] text-white">
                          SUPERUSER
                        </span>
                      ) : u.is_staff ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#047857]/15 text-[#047857]">
                          STAFF
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EFEAE0] text-[#1C1C1E]">
                          STUDENT
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      {u.is_banned ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D94F3B]/15 text-[#D94F3B]">
                          SUSPENDED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#047857]/15 text-[#047857]">
                          ACTIVE
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right">
                      {!u.is_superuser && (
                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setBanReason(u.ban_reason || "");
                          }}
                          className="px-3 py-1 rounded-lg border border-[#E2DDD2] hover:bg-[#EFEAE0] text-[11px] font-semibold transition-all cursor-pointer"
                        >
                          {u.is_banned ? "Reinstate" : "Moderate"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Moderation Dialog Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-[#1C1C1E]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-[#E2DDD2]">
            <h3 className="font-serif text-xl font-bold text-[#1C1C1E] mb-2">
              Moderate: {selectedUser.full_name}
            </h3>
            <p className="text-xs text-[#6B7280] mb-4">
              {selectedUser.email} • {selectedUser.registration_number}
            </p>

            {selectedUser.is_banned ? (
              <div>
                <p className="text-xs text-[#6B7280] mb-4">
                  Account is currently suspended. Ban reason:{" "}
                  <span className="italic text-[#D94F3B]">
                    "{selectedUser.ban_reason || "None specified"}"
                  </span>
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[#6B7280] hover:bg-[#EFEAE0]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleModerate(false)}
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-xl bg-[#047857] hover:bg-[#10B981] text-white text-xs font-bold"
                  >
                    {actionLoading ? "Processing..." : "Lift Suspension"}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-[#1C1C1E] uppercase mb-1">
                  Reason for Suspension
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Reporting fraudulent items / repeated false matches"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#E2DDD2] text-xs focus:ring-2 focus:ring-[#D94F3B] mb-4"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[#6B7280] hover:bg-[#EFEAE0]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleModerate(true)}
                    disabled={actionLoading || !banReason.trim()}
                    className="px-5 py-2 rounded-xl bg-[#D94F3B] hover:opacity-95 text-white text-xs font-bold disabled:opacity-50"
                  >
                    {actionLoading ? "Suspending..." : "Suspend Account"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
