import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { SnykApiClient } from "./services/snyk-api";
import { analyzeAuditLogs, chatWithAI, generateExecutiveSummary } from "./services/gemini-ai";
import { auditLogFilterSchema, chatMessageSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // API Configuration routes
  app.get("/api/config", async (req, res) => {
    try {
      const config = await storage.getApiConfiguration();
      if (!config) {
        return res.status(404).json({ error: "No configuration found" });
      }
      
      // Don't return the API token for security, but indicate if it exists
      const { snykApiToken, ...safeConfig } = config;
      res.json({ ...safeConfig, snykApiToken: !!snykApiToken ? "***" : null });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/config", async (req, res) => {
    try {
      const { snykApiToken, groupId, orgId } = req.body;
      
      if (!snykApiToken) {
        return res.status(400).json({ error: "Snyk API token is required" });
      }

      // Test the API connection
      const { apiVersion } = req.body;
      const snykApi = new SnykApiClient(snykApiToken, apiVersion);
      const result = await snykApi.testConnection();
      
      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      const existingConfig = await storage.getApiConfiguration();
      
      let config;
      if (existingConfig) {
        config = await storage.updateApiConfiguration(existingConfig.id, {
          snykApiToken,
          groupId,
          orgId,
          apiVersion
        });
      } else {
        config = await storage.createApiConfiguration({
          snykApiToken,
          groupId,
          orgId,
          apiVersion,
          userId: "default"
        });
      }

      const { snykApiToken: _, ...safeConfig } = config;
      res.json({ ...safeConfig, snykApiToken: "***" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Audit logs routes
  app.get("/api/audit-logs", async (req, res) => {
    try {
      // Parse query parameters properly
      const queryParams = {
        from: req.query.from,
        to: req.query.to,
        events: Array.isArray(req.query.events) ? req.query.events : (req.query.events ? [req.query.events] : []),
        excludeEvents: Array.isArray(req.query.excludeEvents) ? req.query.excludeEvents : (req.query.excludeEvents ? [req.query.excludeEvents] : []),
        size: req.query.size ? parseInt(req.query.size as string) : 50,
        cursor: req.query.cursor,
        search: req.query.search,
      };
      
      const filters = auditLogFilterSchema.parse(queryParams);
      
      console.log(`[SEARCH DEBUG] Received filters:`, JSON.stringify(filters, null, 2));
      
      const config = await storage.getApiConfiguration();
      if (!config || !config.snykApiToken) {
        return res.status(400).json({ error: "Snyk API not configured" });
      }

      const snykApi = new SnykApiClient(config.snykApiToken, config.apiVersion || "2024-10-15");

      // Convert dates to RFC3339 format if provided
      const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toISOString();
      };

      const snykFilters = {
        from: filters.from ? formatDate(filters.from) : undefined,
        to: filters.to ? formatDate(filters.to) : undefined,
        events: filters.events,
        excludeEvents: filters.excludeEvents,
        size: filters.size,
        cursor: filters.cursor,
        search: filters.search
      };

      let snykResponse;
      // Prefer organization logs, fall back to group logs
      if (config.orgId) {
        snykResponse = await snykApi.getOrganizationAuditLogs(config.orgId, snykFilters);
      } else if (config.groupId) {
        snykResponse = await snykApi.getGroupAuditLogs(config.groupId, snykFilters);
      } else {
        return res.status(400).json({ error: "No organization or group ID configured" });
      }

      // Store audit logs in our storage for future reference
      for (const item of snykResponse.items) {
        try {
          await storage.createAuditLog({
            event: item.event,
            created: new Date(item.created),
            orgId: item.orgId || null,
            groupId: item.groupId || null,
            projectId: item.projectId || null,
            content: item.content as any
          });
        } catch (storageError) {
          // Continue if storage fails, don't block the response
          console.error("Failed to store audit log:", storageError);
        }
      }

      res.json({
        items: snykResponse.items,
        nextCursor: snykResponse.nextCursor,
        total: snykResponse.total
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Export audit logs
  app.get("/api/audit-logs/export", async (req, res) => {
    try {
      const { format = 'json' } = req.query;
      const filters = auditLogFilterSchema.parse(req.query);

      const config = await storage.getApiConfiguration();
      if (!config || !config.snykApiToken) {
        return res.status(400).json({ error: "Snyk API not configured" });
      }

      const snykApi = new SnykApiClient(config.snykApiToken, config.apiVersion || "2024-10-15");

      const snykFilters = {
        from: filters.from ? new Date(filters.from).toISOString() : undefined,
        to: filters.to ? new Date(filters.to).toISOString() : undefined,
        events: filters.events,
        excludeEvents: filters.excludeEvents,
        size: 1000, // Max export size
        search: filters.search
      };

      let snykResponse;
      if (config.orgId) {
        snykResponse = await snykApi.getOrganizationAuditLogs(config.orgId, snykFilters);
      } else if (config.groupId) {
        snykResponse = await snykApi.getGroupAuditLogs(config.groupId, snykFilters);
      } else {
        return res.status(400).json({ error: "No organization or group ID configured" });
      }

      if (format === 'csv') {
        // Convert to CSV
        const csvHeaders = 'Timestamp,Event,Organization ID,Group ID,Project ID,Content\n';
        const csvRows = snykResponse.items.map(item => 
          `${item.created},${item.event},${item.orgId || ''},${item.groupId || ''},${item.projectId || ''},"${JSON.stringify(item.content).replace(/"/g, '""')}"`
        ).join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="snyk-audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvHeaders + csvRows);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="snyk-audit-logs-${new Date().toISOString().split('T')[0]}.json"`);
        res.json(snykResponse.items);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Executive Summary endpoint
  app.get("/api/executive-summary", async (req, res) => {
    try {
      const config = await storage.getApiConfiguration();
      if (!config || !config.snykApiToken) {
        return res.json({ summary: "No API configuration found. Please configure your Snyk API settings." });
      }

      const snykApi = new SnykApiClient(config.snykApiToken, config.apiVersion || "2024-10-15");

      // Fetch fresh audit logs for the last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const snykFilters = {
        from: oneDayAgo.toISOString(),
        to: new Date().toISOString(),
        size: 500, // Get more data for better analysis
      };

      let snykResponse;
      if (config.orgId) {
        snykResponse = await snykApi.getOrganizationAuditLogs(config.orgId, snykFilters);
      } else if (config.groupId) {
        snykResponse = await snykApi.getGroupAuditLogs(config.groupId, snykFilters);
      } else {
        return res.json({ summary: "No organization or group ID configured for analysis." });
      }

      if (snykResponse.items.length === 0) {
        return res.json({ summary: "No audit logs found in the last 24 hours for analysis." });
      }

      // Convert to our audit log format for analysis
      const auditLogs = snykResponse.items.map(item => ({
        id: item.id || `temp-${Date.now()}-${Math.random()}`,
        event: item.event,
        created: new Date(item.created),
        orgId: item.orgId || null,
        groupId: item.groupId || null,
        projectId: item.projectId || null,
        content: item.content as any
      }));

      const summary = await generateExecutiveSummary(auditLogs);
      
      res.json({ summary });
    } catch (error: any) {
      console.error("Executive summary error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Chat routes
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, sessionId } = chatMessageSchema.parse(req.body);
      
      // Get current audit logs for context
      const auditLogs = await storage.getAllAuditLogs();
      
      // Get or create chat session
      let session;
      if (sessionId) {
        session = await storage.getChatSession(sessionId);
      }
      
      if (!session) {
        session = await storage.createChatSession({
          userId: "default",
          messages: []
        });
      }

      // Add user message to session
      const userMessage = {
        role: "user" as const,
        content: message,
        timestamp: new Date().toISOString()
      };

      const currentMessages = Array.isArray(session.messages) ? session.messages as any[] : [];
      
      // Get AI response
      const aiResponse = await chatWithAI(message, auditLogs, currentMessages);
      
      const assistantMessage = {
        role: "assistant" as const,
        content: aiResponse,
        timestamp: new Date().toISOString()
      };

      // Update session with both messages
      const updatedMessages = [...currentMessages, userMessage, assistantMessage];
      await storage.updateChatSession(session.id, {
        messages: updatedMessages as any
      });

      res.json({
        sessionId: session.id,
        response: aiResponse,
        messages: updatedMessages
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Security insights route
  app.get("/api/insights", async (req, res) => {
    try {
      const auditLogs = await storage.getAllAuditLogs();
      
      if (auditLogs.length === 0) {
        return res.json({ insights: [] });
      }

      const insights = await analyzeAuditLogs(auditLogs);
      res.json({ insights });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}