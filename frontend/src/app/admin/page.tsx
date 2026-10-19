"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import Link from "next/link";

export default function AdminOverviewPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    staffCount: 0,
    bannedCount: 0,
    pendingInvites: 0,
    totalAuditLogs: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [usersRes, invitesRes, auditRes] = await Promise.all([
          apiClient("/adminpanel/users/"),
          apiClient("/adminpanel/invites/"),
          apiClient("/adminpanel/audit-logs/"),
        ]);

        const users = usersRes?.data || [];
        const invites = invitesRes?.data || [];
        const logs = auditRes?.data || [];

        setStats({
          totalUsers: users.length,
          staffCount: users.filter((u: any) => u.is_staff).length,
          bannedCount: users.filter((u: any) => u.is_banned).length,
          pendingInvites: invites.filter((i: any) => !i.is_used && !i.is_expired).length,
          totalAuditLogs: logs.length,
        });
      } catch (err) {
        console.error("Failed to load admin stats:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="flex flex-col gap-8">
      {/* Page Title */}
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#1C1C1E]">
          System Overview
        </h1>
        <p className="text-sm text-[#6B7280]">
          Campus monitoring dashboard and administrative controls.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-6 rounded-2xl bg-[#EFEAE0]/80 border border-[#EFEAE0] shadow-sm">
          <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider block mb-1">
            Registered Students
          </span>
          <span className="font-serif text-3xl font-bold text-[#1C1C1E]">
            {loading ? "..." : stats.totalUsers}
          </span>
          <span className="text-xs text-[#047857] font-medium block mt-2">
            Active campus accounts
          </span>
        </div>

        <div className="p-6 rounded-2xl bg-[#EFEAE0]/80 border border-[#EFEAE0] shadow-sm">
          <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider block mb-1">
            Admin Staff Members
          </span>
          <span className="font-serif text-3xl font-bold text-[#047857]">
            {loading ? "..." : stats.staffCount}
          </span>
          <span className="text-xs text-[#6B7280] block mt-2">
            With moderation permissions
          </span>
        </div>

        <div className="p-6 rounded-2xl bg-[#EFEAE0]/80 border border-[#EFEAE0] shadow-sm">
          <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider block mb-1">
            Suspended Accounts
          </span>
          <span className="font-serif text-3xl font-bold text-[#D94F3B]">
            {loading ? "..." : stats.bannedCount}
          </span>
          <span className="text-xs text-[#D94F3B] block mt-2">
            Policy / abuse violations
          </span>
        </div>

        <div className="p-6 rounded-2xl bg-[#EFEAE0]/80 border border-[#EFEAE0] shadow-sm">
          <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider block mb-1">
            Pending Invites
          </span>
          <span className="font-serif text-3xl font-bold text-[#F5B73B]">
            {loading ? "..." : stats.pendingInvites}
          </span>
          <span className="text-xs text-[#6B7280] block mt-2">
            Awaiting acceptance
          </span>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div>
        <h2 className="font-serif text-xl font-bold text-[#1C1C1E] mb-4">
          Quick Management Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Link
            href="/admin/invites"
            className="p-6 rounded-2xl bg-white border border-[#E2DDD2] hover:border-[#047857] shadow-sm transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#047857]/10 text-[#047857] flex items-center justify-center font-bold text-lg mb-4 group-hover:bg-[#047857] group-hover:text-white transition-colors">
              ✉
            </div>
            <h3 className="font-serif text-lg font-bold text-[#1C1C1E] mb-1">
              Invite Administrators
            </h3>
            <p className="text-xs text-[#6B7280]">
              Generate secure invitation links for new campus staff members.
            </p>
          </Link>

          <Link
            href="/admin/users"
            className="p-6 rounded-2xl bg-white border border-[#E2DDD2] hover:border-[#047857] shadow-sm transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#047857]/10 text-[#047857] flex items-center justify-center font-bold text-lg mb-4 group-hover:bg-[#047857] group-hover:text-white transition-colors">
              👥
            </div>
            <h3 className="font-serif text-lg font-bold text-[#1C1C1E] mb-1">
              Student Moderation
            </h3>
            <p className="text-xs text-[#6B7280]">
              Inspect student profiles, verify departments, and manage bans.
            </p>
          </Link>

          <Link
            href="/admin/settings"
            className="p-6 rounded-2xl bg-white border border-[#E2DDD2] hover:border-[#047857] shadow-sm transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#047857]/10 text-[#047857] flex items-center justify-center font-bold text-lg mb-4 group-hover:bg-[#047857] group-hover:text-white transition-colors">
              ⚙
            </div>
            <h3 className="font-serif text-lg font-bold text-[#1C1C1E] mb-1">
              Site Configuration
            </h3>
            <p className="text-xs text-[#6B7280]">
              Configure matching engine thresholds and post expiration days.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
