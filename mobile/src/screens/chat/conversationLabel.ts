import { Conversation, Participant } from "../../api/chat";

/** The person on the other side of a conversation. */
export function otherParticipant(conv: Conversation, myId?: string): Participant | undefined {
  return conv.participants.find((p) => p.id !== myId);
}

/** True for the student's thread with the admin office (rather than student to student). */
export function isAdminThread(conv: Conversation): boolean {
  return conv.conversation_type !== "student";
}

/**
 * Students see their admin thread as "Admin office"; admins see it under the student's name.
 */
export function conversationTitle(conv: Conversation, myId?: string, isStaff = false): string {
  if (isAdminThread(conv) && !isStaff) return "Admin office";
  return otherParticipant(conv, myId)?.full_name || (isAdminThread(conv) ? "Student" : "Campus member");
}

/** One short line under the title in the list. */
export function conversationNote(conv: Conversation, myId?: string): string {
  if (conv.request_status === "declined") return "Request declined";
  if (conv.request_status === "pending") {
    return conv.requested_by === myId ? "Request sent, waiting for them to accept" : "Wants to message you";
  }
  if (conv.last_message?.content) {
    const fromMe = !!myId && conv.last_message.sender_id === myId;
    return `${fromMe ? "You: " : ""}${conv.last_message.content}`;
  }
  if (conv.item) {
    return conv.item.owner_id === myId ? `About your ${conv.item.name}` : `About ${conv.item.name}`;
  }
  return "No messages yet";
}

/** When the conversation last had activity, for sorting and the list's time stamp. */
export function lastActivity(conv: Conversation): string {
  return conv.last_message?.created_at || conv.created_at;
}
