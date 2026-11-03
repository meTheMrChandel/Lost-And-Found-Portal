"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiClient, getErrorMessage, ListResponse, unwrapList, websocketUrl } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";
import Logo from "@/components/Logo";
import HeaderAccount from "@/components/HeaderAccount";
import LoginRequired from "@/components/LoginRequired";
import SessionCheck from "@/components/SessionCheck";

interface Participant {
  id: string;
  full_name: string;
  email?: string;
  registration_number: string;
}

interface Conversation {
  id: string;
  conversation_type: "owner_admin" | "finder_admin" | "direct" | "student";
  origin?: "qr_scan" | "registration_search" | "";
  request_status?: "pending" | "accepted" | "declined";
  requested_by?: string | null;
  item?: { id: string; name: string; owner_id: string } | null;
  match_id?: string;
  match?: {
    id: string;
    lost_item_name: string;
    found_item_name: string;
    status: string;
  };
  participants: Participant[];
  is_direct_approved: boolean;
  unread_count: number;
  last_message?: {
    content: string;
    created_at: string;
    sender_name: string;
  };
  created_at: string;
}

interface FoundStudent {
  id: string;
  full_name: string;
  registration_number: string;
  existing_conversation_id: string | null;
}

interface Message {
  id: string;
  conversation: string;
  sender_id: string;
  sender: Participant;
  content: string;
  is_read: boolean;
  read_at?: string;
  is_me: boolean;
  created_at: string;
}

export default function ChatPage() {
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loadingConvs, setLoadingConvs] = useState(true);
  // Conversation whose messages are currently loaded; loading is derived from it
  const [loadedConvId, setLoadedConvId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  // "New chat" by registration number
  const [composing, setComposing] = useState(false);
  const [regNo, setRegNo] = useState("");
  const [found, setFound] = useState<FoundStudent | null>(null);
  const [firstMessage, setFirstMessage] = useState("");
  const [composeError, setComposeError] = useState("");
  const [composeBusy, setComposeBusy] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch list of conversations once; selecting a conversation must not refetch it
  useEffect(() => {
    apiClient<ListResponse<Conversation>>("/chat/conversations/")
      .then((res) => {
        const items = unwrapList(res);
        setConversations(items);
        // /chat?c=<id> opens that conversation (links from the scan page and notifications)
        const wanted = new URLSearchParams(window.location.search).get("c");
        setActiveConv((prev) => prev ?? items.find((c) => c.id === wanted) ?? items[0] ?? null);
      })
      .catch((err) => console.error("Failed to load conversations", err))
      .finally(() => setLoadingConvs(false));
  }, []);

  const activeConvId = activeConv?.id ?? null;
  const loadingMsgs = activeConvId !== null && loadedConvId !== activeConvId;

  // Fetch messages for the active conversation, ignoring responses that
  // arrive after the user has already switched to another conversation
  useEffect(() => {
    if (!activeConvId) return;
    let cancelled = false;

    apiClient<ListResponse<Message>>(`/chat/conversations/${activeConvId}/messages/`)
      .then(async (res) => {
        if (cancelled) return;
        setMessages(unwrapList(res));
        setLoadedConvId(activeConvId);

        // Mark conversation as read
        await apiClient(`/chat/conversations/${activeConvId}/read/`, { method: "POST" });
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConvId ? { ...c, unread_count: 0 } : c))
        );
      })
      .catch((err) => {
        console.error("Failed to fetch messages", err);
        if (!cancelled) setLoadedConvId(activeConvId);
      });

    return () => {
      cancelled = true;
    };
  }, [activeConvId]);

  // Set up WebSocket connection for active conversation
  useEffect(() => {
    if (!activeConvId) return;

    // Close any previous WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!token) return;

    // Connect to the API host, not the frontend host, so this also works when deployed separately
    const wsUrl = websocketUrl(`/ws/chat/${activeConvId}/?token=${token}`);

    try {
      const socket = new WebSocket(wsUrl);

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "error" && payload.error) {
            setErrorMsg(payload.error);
            return;
          }
          if (payload.type === "chat_message" && payload.message) {
            const newMsg: Message = {
              id: payload.message.id,
              conversation: activeConvId,
              sender_id: payload.message.sender_id,
              sender: {
                id: payload.message.sender_id,
                full_name: payload.message.sender_name || "Campus User",
                email: "",
                registration_number: "",
              },
              content: payload.message.content,
              is_read: false,
              is_me: payload.message.sender_id === user?.id,
              created_at: payload.message.created_at || new Date().toISOString(),
            };

            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });

            // Update last message in list
            setConversations((prev) =>
              prev.map((c) =>
                c.id === activeConvId
                  ? {
                      ...c,
                      last_message: {
                        content: newMsg.content,
                        created_at: newMsg.created_at,
                        sender_name: newMsg.sender.full_name,
                      },
                    }
                  : c
              )
            );
          }
        } catch (e) {
          console.error("Error parsing WebSocket message:", e);
        }
      };

      socket.onerror = () => {
        // Fallback gracefully to REST polling if WebSocket is unavailable
      };

      wsRef.current = socket;
    } catch {
      // WS connection fallback
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [activeConvId, user?.id]);

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConv || sending) return;

    setErrorMsg("");
    setSuccessMsg("");
    setSending(true);

    const messageContent = inputText.trim();
    setInputText("");

    try {
      // Attempt WebSocket send if open
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            action: "send_message",
            content: messageContent,
          })
        );
      } else {
        // Fallback to REST endpoint
        const res = await apiClient<{ data?: Message }>(`/chat/conversations/${activeConv.id}/messages/`, {
          method: "POST",
          data: { content: messageContent },
        });
        const sent = res.data;
        if (sent) {
          setMessages((prev) => [...prev, sent]);
        }
      }
      if (activeConv.request_status === "pending" && activeConv.requested_by !== user?.id) {
        updateConv({ ...activeConv, request_status: "accepted" });
      }
    } catch (err) {
      setErrorMsg(getErrorMessage(err, "Failed to send message."));
    } finally {
      setSending(false);
    }
  };

  const updateConv = (conv: Conversation) => {
    setActiveConv(conv);
    setConversations((prev) =>
      prev.some((c) => c.id === conv.id) ? prev.map((c) => (c.id === conv.id ? conv : c)) : [conv, ...prev]
    );
  };

  const startCompose = () => {
    setComposing(true);
    setRegNo("");
    setFound(null);
    setFirstMessage("");
    setComposeError("");
  };

  const handleFindStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNo.trim()) return;
    setComposeBusy(true);
    setComposeError("");
    setFound(null);
    try {
      const res = await apiClient<{ data: FoundStudent }>(
        `/chat/students/lookup/?registration_number=${encodeURIComponent(regNo.trim())}`
      );
      setFound(res.data);
    } catch (err) {
      setComposeError(getErrorMessage(err, "Couldn't look that up. Try again."));
    } finally {
      setComposeBusy(false);
    }
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!found || !firstMessage.trim()) return;
    setComposeBusy(true);
    setComposeError("");
    try {
      const res = await apiClient<{ data: Conversation }>("/chat/requests/", {
        method: "POST",
        data: { registration_number: found.registration_number, message: firstMessage.trim() },
      });
      setComposing(false);
      updateConv(res.data);
    } catch (err) {
      setComposeError(getErrorMessage(err, "Couldn't send the request."));
    } finally {
      setComposeBusy(false);
    }
  };

  const openExisting = (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    setComposing(false);
    if (conv) setActiveConv(conv);
  };

  const handleRespond = async (action: "accept" | "decline") => {
    if (!activeConv) return;
    setErrorMsg("");
    try {
      const res = await apiClient<{ data: Conversation; message?: string }>(
        `/chat/requests/${activeConv.id}/respond/`,
        { method: "POST", data: { action } }
      );
      updateConv(res.data);
      setSuccessMsg(res.message || "Done.");
    } catch (err) {
      setErrorMsg(getErrorMessage(err, "Couldn't answer the request."));
    }
  };

  // Admin approves direct chat
  const handleApproveDirect = async () => {
    if (!activeConv) return;
    try {
      await apiClient(`/chat/conversations/${activeConv.id}/approve-direct/`, { method: "POST" });
      setActiveConv({ ...activeConv, is_direct_approved: true });
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConv.id ? { ...c, is_direct_approved: true } : c))
      );
      setSuccessMsg("Direct chat approved for parties.");
    } catch (err) {
      setErrorMsg(getErrorMessage(err, "Approval failed."));
    }
  };

  // Block/Unblock toggle
  const handleToggleBlock = async (participantId: string) => {
    if (!confirm("Are you sure you want to toggle block status for this user?")) return;
    try {
      const res = await apiClient<{ message?: string }>("/chat/block/", {
        method: "POST",
        data: { user_id: participantId, reason: "Inappropriate communication" },
      });
      alert(res.message || "Block status updated.");
    } catch (err) {
      alert(getErrorMessage(err, "Failed to update block status."));
    }
  };

  const getOtherParticipant = (conv: Conversation): Participant => {
    const others = conv.participants.filter((p) => p.id !== user?.id);
    if (others.length > 0) return others[0];
    return { id: "system-admin", full_name: "Admin Moderator", email: "admin@iitrpr.ac.in", registration_number: "" };
  };

  const getConvTypeLabel = (conv: Conversation) => {
    if (conv.conversation_type === "student") {
      return conv.origin === "qr_scan" ? "From a QR sticker" : "Student chat";
    }
    switch (conv.conversation_type) {
      case "owner_admin":
        return "Owner ↔ Admin Mediated";
      case "finder_admin":
        return "Finder ↔ Admin Mediated";
      case "direct":
        return "Direct (Owner ↔ Finder)";
      default:
        return conv.conversation_type;
    }
  };

  // The requester of a pending request has used their one message
  const waitingForAccept =
    activeConv?.request_status === "pending" &&
    activeConv.requested_by === user?.id &&
    messages.some((m) => m.is_me || m.sender_id === user?.id);
  const inputLocked =
    (activeConv?.conversation_type === "direct" && !activeConv.is_direct_approved) ||
    activeConv?.request_status === "declined" ||
    waitingForAccept;

  if (authLoading) return <SessionCheck />;
  if (!user) {
    return (
      <LoginRequired
        returnTo="/chat"
        message="Sign in with your campus account to chat with owners, finders and the admin office."
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#1C1C1E]">
      {/* Navigation Header */}
      <header className="border-b border-[#EFEAE0] bg-[#FAF7F2]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={36} />
            <div>
              <span className="font-serif text-xl font-bold tracking-tight text-[#1C1C1E]">
                Campus Chat
              </span>
              <span className="text-[10px] text-[#6B7280] block font-sans uppercase tracking-wider">
                IIT Ropar Verified
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/feed"
              className="text-xs font-semibold text-[#1C1C1E] hover:text-[#047857] transition-colors"
            >
              Feed
            </Link>
            <Link
              href="/my-reports"
              className="text-xs font-semibold text-[#1C1C1E] hover:text-[#047857] transition-colors"
            >
              My Reports
            </Link>
            <NotificationBell />
            <HeaderAccount />
          </div>
        </div>
      </header>

      {/* Main Chat Interface */}
      <div className="max-w-7xl mx-auto w-full flex-1 px-4 sm:px-6 py-6 flex">
        <div className="w-full bg-white rounded-3xl shadow-sm border border-[#EFEAE0] overflow-hidden flex flex-col md:flex-row h-[78vh]">
          {/* Left Sidebar: Conversations List */}
          <div className="w-full md:w-80 lg:w-96 border-r border-[#EFEAE0] flex flex-col bg-[#FAF7F2]/50">
            <div className="p-4 border-b border-[#EFEAE0] flex items-center justify-between">
              <h2 className="font-serif text-lg font-bold text-[#1C1C1E]">Messages</h2>
              <button
                onClick={startCompose}
                className="text-xs font-semibold text-[#047857] hover:underline underline-offset-2"
              >
                + New chat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#EFEAE0]">
              {loadingConvs ? (
                <div className="p-8 text-center text-xs text-gray-500">Loading threads...</div>
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs">
                  <p className="text-3xl mb-2">💬</p>
                  <p className="font-semibold text-gray-600 mb-1">No chats yet</p>
                  <p className="text-[11px] text-gray-400">
                    Chats start when an admin mediates a match, when you scan someone&apos;s QR sticker, or with
                    &ldquo;New chat&rdquo; and a registration number.
                  </p>
                </div>
              ) : (
                conversations.map((conv) => {
                  const other = getOtherParticipant(conv);
                  const isSelected = activeConv?.id === conv.id;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => {
                        setComposing(false);
                        setActiveConv(conv);
                      }}
                      className={`w-full text-left p-4 transition-all flex items-start gap-3 hover:bg-stone-50 ${
                        isSelected ? "bg-white border-l-4 border-l-[#047857] shadow-sm" : ""
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-emerald-100 text-[#047857] flex items-center justify-center font-bold text-sm shrink-0">
                        {other.full_name?.charAt(0) || "U"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <h4 className="text-xs font-bold text-[#1C1C1E] truncate">
                            {other.full_name || "Campus Member"}
                          </h4>
                          {conv.unread_count > 0 && (
                            <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-white bg-[#047857] rounded-full shrink-0">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#047857] font-semibold truncate mb-1">
                          {conv.conversation_type === "student"
                            ? conv.item
                              ? `About ${conv.item.owner_id === user?.id ? "your " : ""}${conv.item.name}`
                              : other.registration_number
                            : conv.match?.lost_item_name || "Case Mediation"}
                        </p>
                        <p className="text-[11px] text-[#6B7280] truncate">
                          {conv.last_message ? conv.last_message.content : "No messages yet"}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-stone-200/60 text-stone-700">
                            {conv.conversation_type === "student"
                              ? conv.origin === "qr_scan"
                                ? "QR sticker"
                                : "Student"
                              : conv.conversation_type === "direct"
                                ? "Direct"
                                : "Mediated"}
                          </span>
                          {conv.request_status === "pending" && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                              {conv.requested_by === user?.id ? "Request sent" : "Wants to chat"}
                            </span>
                          )}
                          {conv.conversation_type === "direct" && !conv.is_direct_approved && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                              Pending Approval
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Area: Active Chat Thread */}
          {composing ? (
            <div className="flex-1 flex flex-col bg-white p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-serif text-lg font-bold text-[#1C1C1E]">New chat</h3>
                <button onClick={() => setComposing(false)} className="text-xs text-[#6B7280] hover:text-[#1C1C1E]">
                  Cancel
                </button>
              </div>
              <p className="text-xs text-[#6B7280] mb-5 max-w-md leading-relaxed">
                Enter the exact registration number. They get your first message as a request and can accept,
                decline or block you. You can send more once they reply.
              </p>

              <form onSubmit={handleFindStudent} className="flex gap-2 max-w-md">
                <input
                  type="text"
                  value={regNo}
                  onChange={(e) => {
                    setRegNo(e.target.value.toUpperCase());
                    setFound(null);
                  }}
                  placeholder="e.g. 2024CSM1001"
                  autoFocus
                  className="flex-1 px-4 py-2.5 text-xs font-mono bg-[#FAF7F2] border border-[#EFEAE0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#047857] focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={!regNo.trim() || composeBusy}
                  className="px-4 py-2.5 border border-[#EFEAE0] bg-white hover:border-[#047857] disabled:opacity-40 text-xs font-semibold rounded-lg"
                >
                  Find
                </button>
              </form>

              {composeError && <p className="mt-3 text-xs text-[#D94F3B] max-w-md">{composeError}</p>}

              {found && (
                <div className="mt-5 max-w-md border border-[#EFEAE0] rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 text-[#047857] flex items-center justify-center font-bold text-sm">
                      {found.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#1C1C1E]">{found.full_name}</p>
                      <p className="text-[11px] font-mono text-[#6B7280]">{found.registration_number}</p>
                    </div>
                  </div>
                  {found.existing_conversation_id &&
                  conversations.some((c) => c.id === found.existing_conversation_id) ? (
                    <button
                      onClick={() => openExisting(found.existing_conversation_id as string)}
                      className="text-xs font-semibold text-[#047857] hover:underline underline-offset-2"
                    >
                      You already have a conversation with them. Open it
                    </button>
                  ) : (
                    <form onSubmit={handleSendRequest} className="space-y-2">
                      <textarea
                        value={firstMessage}
                        onChange={(e) => setFirstMessage(e.target.value)}
                        rows={3}
                        maxLength={5000}
                        placeholder="Say who you are and why you're writing, e.g. I think I found your ID card near the mess."
                        className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#EFEAE0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#047857] focus:bg-white resize-none"
                      />
                      <button
                        type="submit"
                        disabled={!firstMessage.trim() || composeBusy}
                        className="px-4 py-2 bg-[#047857] hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg"
                      >
                        {composeBusy ? "Sending..." : "Send request"}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          ) : activeConv ? (
            <div className="flex-1 flex flex-col bg-white">
              {/* Active Conversation Header */}
              <div className="p-4 border-b border-[#EFEAE0] flex items-center justify-between bg-[#FAF7F2]/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#047857] text-white flex items-center justify-center font-bold text-sm">
                    {getOtherParticipant(activeConv).full_name?.charAt(0) || "M"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#1C1C1E]">
                        {getOtherParticipant(activeConv).full_name}
                      </h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-[#047857] border border-emerald-200">
                        {getConvTypeLabel(activeConv)}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280]">
                      {activeConv.conversation_type === "student"
                        ? [
                            getOtherParticipant(activeConv).registration_number,
                            activeConv.item &&
                              `About ${activeConv.item.owner_id === user?.id ? "your " : ""}${activeConv.item.name}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : activeConv.match
                          ? `Ref: ${activeConv.match.lost_item_name} ↔ ${activeConv.match.found_item_name}`
                          : "Campus Lost and Found Mediation"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Staff approve button */}
                  {user?.is_staff &&
                    activeConv.conversation_type === "direct" &&
                    !activeConv.is_direct_approved && (
                      <button
                        onClick={handleApproveDirect}
                        className="px-3 py-1.5 bg-[#047857] hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
                      >
                        ✓ Approve Direct Chat
                      </button>
                    )}

                  {/* Block / Safety Action */}
                  <button
                    onClick={() => handleToggleBlock(getOtherParticipant(activeConv).id)}
                    className="px-3 py-1.5 border border-red-200 text-[#D94F3B] hover:bg-red-50 text-xs font-medium rounded-lg transition-colors"
                    title="Block or report user"
                  >
                    🚫 Block
                  </button>
                </div>
              </div>

              {/* Status alerts */}
              {errorMsg && (
                <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-xs text-red-700 flex justify-between items-center">
                  <span>⚠️ {errorMsg}</span>
                  <button onClick={() => setErrorMsg("")} className="font-bold">
                    ×
                  </button>
                </div>
              )}
              {successMsg && (
                <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-100 text-xs text-emerald-800 flex justify-between items-center">
                  <span>✓ {successMsg}</span>
                  <button onClick={() => setSuccessMsg("")} className="font-bold">
                    ×
                  </button>
                </div>
              )}

              {/* Direct chat pending approval notice */}
              {activeConv.conversation_type === "direct" && !activeConv.is_direct_approved && (
                <div className="m-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                  <span className="text-base">🛡️</span>
                  <div>
                    <h5 className="font-bold mb-0.5">Admin Approval Required</h5>
                    <p className="text-[11px] leading-relaxed">
                      To protect campus community members against off-platform scams or harassment, direct communication between owner and finder requires initial moderator approval. Messaging is locked until an administrator reviews this case.
                    </p>
                  </div>
                </div>
              )}

              {/* Message requests */}
              {activeConv.request_status === "pending" && activeConv.requested_by === user?.id && (
                <div className="mx-4 mt-4 px-3 py-2.5 border border-[#EFEAE0] bg-[#FAF7F2] rounded-lg text-[11px] text-[#4B5563]">
                  Waiting for {getOtherParticipant(activeConv).full_name} to accept your request. You can send
                  more once they reply.
                </div>
              )}
              {activeConv.request_status === "pending" && activeConv.requested_by !== user?.id && (
                <div className="mx-4 mt-4 p-3 border border-amber-200 bg-amber-50 rounded-lg text-xs text-amber-900">
                  <p className="mb-2">
                    <strong>{getOtherParticipant(activeConv).full_name}</strong> (
                    {getOtherParticipant(activeConv).registration_number}) wants to message you. They can&apos;t send
                    more until you accept or reply.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRespond("accept")}
                      className="px-3 py-1.5 bg-[#047857] hover:bg-emerald-700 text-white text-xs font-semibold rounded-md"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleRespond("decline")}
                      className="px-3 py-1.5 border border-[#EFEAE0] bg-white hover:border-stone-400 text-xs font-semibold rounded-md"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleToggleBlock(getOtherParticipant(activeConv).id)}
                      className="px-3 py-1.5 text-[#D94F3B] hover:underline text-xs font-medium"
                    >
                      Block
                    </button>
                  </div>
                </div>
              )}
              {activeConv.request_status === "declined" && (
                <div className="mx-4 mt-4 px-3 py-2.5 border border-[#EFEAE0] bg-[#FAF7F2] rounded-lg text-[11px] text-[#4B5563]">
                  This message request was declined, so the conversation is closed.
                </div>
              )}

              {/* Messages Scroll Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#FAF7F2]/20">
                {loadingMsgs ? (
                  <div className="p-8 text-center text-xs text-gray-500">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="p-12 text-center text-gray-400 text-xs">
                    <p className="text-2xl mb-1">🕊️</p>
                    <p>No messages in this conversation yet. Send the first message below!</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = m.is_me || m.sender_id === user?.id;
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                      >
                        <span className="text-[10px] text-gray-400 mb-0.5 px-1">
                          {isMe ? "You" : m.sender?.full_name || "Participant"}
                        </span>
                        <div
                          className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                            isMe
                              ? "bg-[#047857] text-white rounded-br-none"
                              : "bg-white text-[#1C1C1E] border border-[#EFEAE0] rounded-bl-none"
                          }`}
                        >
                          <p className="break-words whitespace-pre-wrap">{m.content}</p>
                          <div
                            className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${
                              isMe ? "text-emerald-100" : "text-gray-400"
                            }`}
                          >
                            <span>
                              {new Date(m.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {isMe && <span>{m.is_read ? "✓✓" : "✓"}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Box */}
              <div className="p-4 border-t border-[#EFEAE0] bg-white">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      activeConv.conversation_type === "direct" && !activeConv.is_direct_approved
                        ? "Chat locked pending admin approval..."
                        : waitingForAccept
                          ? "Waiting for them to accept..."
                          : activeConv.request_status === "declined"
                            ? "This request was declined"
                            : "Type your message here..."
                    }
                    disabled={inputLocked || sending}
                    className="flex-1 px-4 py-2.5 text-xs bg-[#FAF7F2] border border-[#EFEAE0] rounded-full focus:outline-none focus:ring-2 focus:ring-[#047857] focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || inputLocked || sending}
                    className="px-5 py-2.5 bg-[#047857] hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-full shadow-sm transition-all flex items-center gap-1.5"
                  >
                    <span>Send</span>
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                      />
                    </svg>
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-gray-400">
              <p className="text-4xl mb-2">💬</p>
              <h3 className="font-serif text-lg font-bold text-[#1C1C1E] mb-1">
                Select a conversation
              </h3>
              <p className="text-xs max-w-sm text-center">
                Choose a conversation from the sidebar to view messages or coordinate handovers.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
