import { type AuditLog, type InsertAuditLog, type ChatSession, type InsertChatSession, type ApiConfiguration, type InsertApiConfiguration } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Audit Logs
  getAuditLogs(filters: {
    from?: string;
    to?: string;
    events?: string[];
    excludeEvents?: string[];
    size?: number;
    cursor?: string;
    search?: string;
  }): Promise<{ items: AuditLog[]; nextCursor?: string; total: number }>;
  createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog>;
  
  // Chat Sessions
  getChatSession(id: string): Promise<ChatSession | undefined>;
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  updateChatSession(id: string, update: Partial<InsertChatSession>): Promise<ChatSession>;
  getAllAuditLogs(): Promise<AuditLog[]>;
  
  // API Configuration
  getApiConfiguration(userId?: string): Promise<ApiConfiguration | undefined>;
  createApiConfiguration(config: InsertApiConfiguration): Promise<ApiConfiguration>;
  updateApiConfiguration(id: string, config: Partial<InsertApiConfiguration>): Promise<ApiConfiguration>;
}

export class MemStorage implements IStorage {
  private auditLogs: Map<string, AuditLog>;
  private chatSessions: Map<string, ChatSession>;
  private apiConfigurations: Map<string, ApiConfiguration>;

  constructor() {
    this.auditLogs = new Map();
    this.chatSessions = new Map();
    this.apiConfigurations = new Map();
  }

  async getAuditLogs(filters: {
    from?: string;
    to?: string;
    events?: string[];
    excludeEvents?: string[];
    size?: number;
    cursor?: string;
    search?: string;
  }): Promise<{ items: AuditLog[]; nextCursor?: string; total: number }> {
    let logs = Array.from(this.auditLogs.values());
    
    // Apply filters
    if (filters.from) {
      logs = logs.filter(log => log.created >= new Date(filters.from!));
    }
    if (filters.to) {
      logs = logs.filter(log => log.created < new Date(filters.to!));
    }
    if (filters.events && filters.events.length > 0) {
      logs = logs.filter(log => filters.events!.includes(log.event));
    }
    if (filters.excludeEvents && filters.excludeEvents.length > 0) {
      logs = logs.filter(log => !filters.excludeEvents!.includes(log.event));
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      logs = logs.filter(log => 
        log.event.toLowerCase().includes(searchLower) ||
        JSON.stringify(log.content).toLowerCase().includes(searchLower)
      );
    }

    // Sort by created date (newest first)
    logs.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
    
    const total = logs.length;
    const size = filters.size || 50;
    let startIndex = 0;
    
    if (filters.cursor) {
      const cursorIndex = logs.findIndex(log => log.id === filters.cursor);
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1;
      }
    }
    
    const items = logs.slice(startIndex, startIndex + size);
    const nextCursor = items.length === size && startIndex + size < total 
      ? items[items.length - 1].id 
      : undefined;
    
    return { items, nextCursor, total };
  }

  async createAuditLog(insertAuditLog: InsertAuditLog): Promise<AuditLog> {
    const id = randomUUID();
    const auditLog: AuditLog = { 
      ...insertAuditLog, 
      id,
      orgId: insertAuditLog.orgId || null,
      groupId: insertAuditLog.groupId || null,
      projectId: insertAuditLog.projectId || null
    };
    this.auditLogs.set(id, auditLog);
    return auditLog;
  }

  async getChatSession(id: string): Promise<ChatSession | undefined> {
    return this.chatSessions.get(id);
  }

  async createChatSession(insertSession: InsertChatSession): Promise<ChatSession> {
    const id = randomUUID();
    const now = new Date();
    const session: ChatSession = { 
      ...insertSession, 
      id,
      userId: insertSession.userId || null,
      messages: insertSession.messages || [],
      createdAt: now,
      updatedAt: now
    };
    this.chatSessions.set(id, session);
    return session;
  }

  async updateChatSession(id: string, update: Partial<InsertChatSession>): Promise<ChatSession> {
    const session = this.chatSessions.get(id);
    if (!session) {
      throw new Error("Chat session not found");
    }
    const updatedSession = { 
      ...session, 
      ...update,
      updatedAt: new Date() 
    };
    this.chatSessions.set(id, updatedSession);
    return updatedSession;
  }

  async getAllAuditLogs(): Promise<AuditLog[]> {
    return Array.from(this.auditLogs.values());
  }

  async getApiConfiguration(userId?: string): Promise<ApiConfiguration | undefined> {
    return Array.from(this.apiConfigurations.values()).find(
      config => config.userId === userId || !userId
    );
  }

  async createApiConfiguration(insertConfig: InsertApiConfiguration): Promise<ApiConfiguration> {
    const id = randomUUID();
    const now = new Date();
    const config: ApiConfiguration = { 
      ...insertConfig, 
      id,
      userId: insertConfig.userId || null,
      snykApiToken: insertConfig.snykApiToken || null,
      groupId: insertConfig.groupId || null,
      orgId: insertConfig.orgId || null,
      apiVersion: insertConfig.apiVersion || null,
      createdAt: now,
      updatedAt: now
    };
    this.apiConfigurations.set(id, config);
    return config;
  }

  async updateApiConfiguration(id: string, updateConfig: Partial<InsertApiConfiguration>): Promise<ApiConfiguration> {
    const config = this.apiConfigurations.get(id);
    if (!config) {
      throw new Error("API configuration not found");
    }
    const updatedConfig = { 
      ...config, 
      ...updateConfig,
      updatedAt: new Date() 
    };
    this.apiConfigurations.set(id, updatedConfig);
    return updatedConfig;
  }
}

export const storage = new MemStorage();
