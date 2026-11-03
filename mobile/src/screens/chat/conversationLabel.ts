import { Conversation, Participant } from "../../api/chat";

/** The person on the other side of a student conversation. */
export function otherParticipant(conv: Conversation, myId?: string): Participant | undefined {
  return conv.participants.find((p) => p.id !== myId);
}

export function conversationTitle(conv: Conversation, myId?: string): string {
  if (conv.conversation_type !== "student") return "Admin office";
  return otherParticipant(conv, myId)?.full_name || "Student";
}

/** One short line under the title in the list. */
export function conversationNote(conv: Conversation, myId?: string): string {
  if (conv.request_status === "declined") return "Request declined";
  if (conv.request_status === "pending") {
    return conv.requested_by === myId ? "Request sent, waiting for them to accept" : "Wants to message you";
  }
  if (conv.item) {
    return conv.item.owner_id === myId ? `About your ${conv.item.name}` : `About ${conv.item.name}`;
  }
  return conv.last_message?.content || "No messages yet";
}
