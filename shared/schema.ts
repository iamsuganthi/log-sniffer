import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  event: text("event").notNull(),
  created: timestamp("created").notNull(),
  orgId: text("org_id"),
  groupId: text("group_id"),
  projectId: text("project_id"),
  content: jsonb("content").notNull(),
});

export const chatSessions = pgTable("chat_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id"),
  messages: jsonb("messages").notNull().default([]),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const apiConfigurations = pgTable("api_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id"),
  snykApiToken: text("snyk_api_token"),
  groupId: text("group_id"),
  orgId: text("org_id"),
  apiVersion: text("api_version").default("2024-10-15"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertApiConfigurationSchema = createInsertSchema(apiConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatSession = typeof chatSessions.$inferSelect;

export type InsertApiConfiguration = z.infer<typeof insertApiConfigurationSchema>;
export type ApiConfiguration = typeof apiConfigurations.$inferSelect;

// API Request/Response schemas
export const auditLogFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  events: z.array(z.string()).optional(),
  excludeEvents: z.array(z.string()).optional(),
  size: z.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
  search: z.string().optional(),
});

export const chatMessageSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().optional(),
});

export type AuditLogFilter = z.infer<typeof auditLogFilterSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
