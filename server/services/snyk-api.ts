import { AuditLog } from "../../shared/schema";

export interface SnykAuditLogResponse {
  items: AuditLog[];
  total: number;
  nextCursor?: string;
}

export interface AuditLogFilters {
  from?: string;
  to?: string;
  events?: string[];
  excludeEvents?: string[];
  size?: number;
  search?: string;
  cursor?: string;
}

class SnykApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'SnykApiError';
  }
}

export class SnykApiClient {
  private baseUrl = 'https://api.snyk.io/rest';
  private apiToken: string;
  private apiVersion: string;

  constructor(apiToken: string, apiVersion: string = "2024-10-15") {
    this.apiToken = apiToken;
    this.apiVersion = apiVersion;
  }

  private async makeRequest(endpoint: string, params?: Record<string, any>): Promise<any> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            value.forEach(item => url.searchParams.append(key, String(item)));
          } else {
            url.searchParams.append(key, String(value));
          }
        }
      });
    }

    console.log(`Final API URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `token ${this.apiToken}`,
        'Content-Type': 'application/vnd.api+json',
        'User-Agent': 'Snyk-Audit-Dashboard/1.0',
        'version': this.apiVersion,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Snyk API error: ${response.status}`;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.errors?.[0]?.detail || errorData.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      
      throw new SnykApiError(errorMessage, response.status);
    }

    return response.json();
  }

  async getOrganizationAuditLogs(
    orgId: string,
    filters: AuditLogFilters = {}
  ): Promise<SnykAuditLogResponse> {
    try {
      const params: Record<string, any> = {
        version: this.apiVersion,
        limit: String(filters.size || 50),
      };

      // Only add non-empty parameters
      if (filters.cursor) params.starting_after = filters.cursor;
      if (filters.from) params['filter[from]'] = filters.from;
      if (filters.to) params['filter[to]'] = filters.to;
      if (filters.events && filters.events.length > 0) params['filter[event]'] = filters.events;
      if (filters.excludeEvents && filters.excludeEvents.length > 0) params['filter[exclude_event]'] = filters.excludeEvents;
      // Note: Snyk API doesn't support general text search
      // Search functionality is handled client-side in the frontend

      console.log(`Making API request with params:`, JSON.stringify(params, null, 2));
      const response = await this.makeRequest(`/orgs/${orgId}/audit_logs/search`, params);
      
      // Handle different response structures
      const data = response.data || response;
      const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
      
      return {
        items: items.map((item: any) => this.transformAuditLogItem(item)),
        total: response.meta?.count || response.total || items.length,
        nextCursor: response.links?.next ? this.extractCursor(response.links.next) : undefined,
      };
    } catch (error) {
      if (error instanceof SnykApiError) {
        throw error;
      }
      throw new SnykApiError(`Failed to fetch organization audit logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getGroupAuditLogs(
    groupId: string,
    filters: AuditLogFilters = {}
  ): Promise<SnykAuditLogResponse> {
    try {
      const params: Record<string, any> = {
        version: this.apiVersion,
        limit: String(filters.size || 50),
      };

      // Only add non-empty parameters
      if (filters.cursor) params.starting_after = filters.cursor;
      if (filters.from) params['filter[from]'] = filters.from;
      if (filters.to) params['filter[to]'] = filters.to;
      if (filters.events && filters.events.length > 0) params['filter[event]'] = filters.events;
      if (filters.excludeEvents && filters.excludeEvents.length > 0) params['filter[exclude_event]'] = filters.excludeEvents;
      // Note: Snyk API doesn't support general text search
      // Search functionality is handled client-side in the frontend

      console.log(`Making Group API request with params:`, JSON.stringify(params, null, 2));
      const response = await this.makeRequest(`/groups/${groupId}/audit_logs/search`, params);
      
      // Handle different response structures
      const data = response.data || response;
      const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
      
      return {
        items: items.map((item: any) => this.transformAuditLogItem(item)),
        total: response.meta?.count || response.total || items.length,
        nextCursor: response.links?.next ? this.extractCursor(response.links.next) : undefined,
      };
    } catch (error) {
      if (error instanceof SnykApiError) {
        throw error;
      }
      throw new SnykApiError(`Failed to fetch group audit logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private transformAuditLogItem(item: any): AuditLog {
    // Handle different item structures from different API versions
    return {
      id: item.id || item.uuid || crypto.randomUUID(),
      event: item.attributes?.event || item.event || 'unknown.event',
      created: item.attributes?.created || item.created || item.timestamp || new Date().toISOString(),
      content: item.attributes?.content || item.content || item.data || {},
      orgId: item.relationships?.org?.data?.id || item.orgId || item.org_id || null,
      groupId: item.relationships?.group?.data?.id || item.groupId || item.group_id || null,
      projectId: item.relationships?.project?.data?.id || item.projectId || item.project_id || null,
    };
  }

  private extractCursor(nextUrl: string): string | undefined {
    try {
      const url = new URL(nextUrl);
      return url.searchParams.get('starting_after') || undefined;
    } catch {
      return undefined;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Test with a simple API call to verify token and connectivity  
      // Use the orgs endpoint which is reliable for testing
      await this.makeRequest('/orgs', { 
        version: this.apiVersion
      });
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      const message = error instanceof SnykApiError 
        ? error.message 
        : 'Failed to connect to Snyk API';
      return { success: false, message };
    }
  }
}

export { SnykApiError };