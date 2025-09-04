// Re-export types from shared schema
export type {
  AuditLog,
  ChatSession,
  ApiConfiguration,
  InsertAuditLog,
  InsertChatSession,
  InsertApiConfiguration,
  AuditLogFilter,
  ChatMessage as ChatMessageInput,
} from "../../../shared/schema";

// Frontend-specific types
export interface AuditLogResponse {
  items: AuditLog[];
  total: number;
  nextCursor?: string;
}

export interface AuditLogItem {
  id: string;
  event: string;
  created: string;
  content: any;
  orgId?: string;
  groupId?: string;
  projectId?: string;
  org_id?: string;  // API compatibility
  group_id?: string;  // API compatibility
  project_id?: string;  // API compatibility
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface SecurityInsight {
  type: "pattern" | "risk" | "recommendation" | "anomaly";
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  affectedEvents: number;
  details?: string;
}

export interface ApiError {
  error: string;
  message?: string;
  details?: any;
}