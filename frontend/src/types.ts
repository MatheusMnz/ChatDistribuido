// Data models — must match docs/ARCHITECTURE.md exactly.

export interface User {
  id: string;
  username: string;
}

export interface LastMessage {
  content: string;
  senderId: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name?: string;
  participantIds: string[];
  lastMessage?: LastMessage;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderUsername: string;
  content: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Socket.IO event payloads
export interface TypingPayload {
  conversationId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

export interface PresencePayload {
  userId: string;
  online: boolean;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';
