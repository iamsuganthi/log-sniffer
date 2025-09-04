import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, ChevronLeft, ChevronRight, AlertCircle, RefreshCw, X } from "lucide-react";
import { AuditLogResponse, AuditLogItem } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { useState, useMemo } from "react";

interface AuditLogTableProps {
  data?: AuditLogResponse;
  isLoading: boolean;
  error?: Error;
  onRefresh: () => void;
  searchTerm?: string;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  // RED - High Criticality (Immediate security threats)
  "org.service_account.create": "bg-red-100 text-red-800",
  "org.service_account.delete": "bg-red-100 text-red-800",
  "org.service_account.edit": "bg-red-100 text-red-800",
  "org.user.role.permissions.edit": "bg-red-100 text-red-800",
  "org.policy.delete": "bg-red-100 text-red-800",
  "org.policy.edit": "bg-red-100 text-red-800",
  "org.policy.create": "bg-red-100 text-red-800",
  "org.user.remove": "bg-red-100 text-red-800",
  "org.user.role.delete": "bg-red-100 text-red-800",
  "org.user.provision.delete": "bg-red-100 text-red-800",
  "org.integration.delete": "bg-red-100 text-red-800",
  "org.integration.settings.edit": "bg-red-100 text-red-800",
  "org.cloud_config.settings.edit": "bg-red-100 text-red-800",
  "org.sast_settings.edit": "bg-red-100 text-red-800",

  // YELLOW - Medium Criticality (Important to monitor)
  "org.app.create": "bg-yellow-100 text-yellow-800",
  "org.app.delete": "bg-yellow-100 text-yellow-800",
  "org.app.edit": "bg-yellow-100 text-yellow-800",
  "org.app_bot.create": "bg-yellow-100 text-yellow-800",
  "org.user.add": "bg-yellow-100 text-yellow-800",
  "org.user.invite": "bg-yellow-100 text-yellow-800",
  "org.user.invite.revoke": "bg-yellow-100 text-yellow-800",
  "org.user.invite_link.create": "bg-yellow-100 text-yellow-800",
  "org.user.provision.create": "bg-yellow-100 text-yellow-800",
  "org.webhook.add": "bg-yellow-100 text-yellow-800",
  "org.project.delete": "bg-yellow-100 text-yellow-800",
  "org.project.remove": "bg-yellow-100 text-yellow-800",
  "org.project.settings.edit": "bg-yellow-100 text-yellow-800",
  "org.project.pr_check.edit": "bg-yellow-100 text-yellow-800",
  "org.project.fix_pr.auto_open": "bg-yellow-100 text-yellow-800",
  "org.project.fix_pr.manual_open": "bg-yellow-100 text-yellow-800",
  "org.ignore_policy.edit": "bg-yellow-100 text-yellow-800",
  "org.integration.create": "bg-yellow-100 text-yellow-800",
  "org.project.ignore.create": "bg-yellow-100 text-yellow-800",
  "org.request_access_settings.edit": "bg-yellow-100 text-yellow-800",
  "org.target.create": "bg-yellow-100 text-yellow-800",
  "org.target.delete": "bg-yellow-100 text-yellow-800",

  // GREEN - Low Criticality (Routine/administrative)
  "api.access": "bg-green-100 text-green-800",
  "org.collection.create": "bg-green-100 text-green-800",
  "org.collection.delete": "bg-green-100 text-green-800",
  "org.collection.edit": "bg-green-100 text-green-800",
  "org.create": "bg-green-100 text-green-800",
  "org.delete": "bg-green-100 text-green-800",
  "org.edit": "bg-green-100 text-green-800",
  "org.language_settings.edit": "bg-green-100 text-green-800",
  "org.notification_settings.edit": "bg-green-100 text-green-800",
  "org.org_source.create": "bg-green-100 text-green-800",
  "org.org_source.delete": "bg-green-100 text-green-800",
  "org.org_source.edit": "bg-green-100 text-green-800",
  "org.project_filter.create": "bg-green-100 text-green-800",
  "org.project_filter.delete": "bg-green-100 text-green-800",
  "org.project.add": "bg-green-100 text-green-800",
  "org.project.attributes.edit": "bg-green-100 text-green-800",
  "org.project.edit": "bg-green-100 text-green-800",
  "org.project.monitor": "bg-green-100 text-green-800",
  "org.project.stop_monitor": "bg-green-100 text-green-800",
  "org.project.tag.add": "bg-green-100 text-green-800",
  "org.project.tag.remove": "bg-green-100 text-green-800",
  "org.project.test": "bg-green-100 text-green-800",
  "org.project.files.create": "bg-green-100 text-green-800",
  "org.project.files.edit": "bg-green-100 text-green-800",
  "org.project.files.access": "bg-green-100 text-green-800",
  "org.project.issue.create": "bg-green-100 text-green-800",
  "org.settings.feature_flag.edit": "bg-green-100 text-green-800",
  "org.user.invite.accept": "bg-green-100 text-green-800",
  "org.user.invite_link.accept": "bg-green-100 text-green-800",
  "org.user.leave": "bg-green-100 text-green-800",
  "org.user.role.create": "bg-green-100 text-green-800",
  "org.user.role.details.edit": "bg-green-100 text-green-800",
  "org.user.role.edit": "bg-green-100 text-green-800",
  "org.webhook.delete": "bg-green-100 text-green-800",
  "user.org.notification_settings.edit": "bg-green-100 text-green-800",
  "user.invite": "bg-green-100 text-green-800", 
  "user.login": "bg-green-100 text-green-800",
};

function getReadableEventType(eventType: string): string {
  const eventMappings: Record<string, string> = {
    // High Criticality Events
    "org.service_account.create": "Service Account Created",
    "org.service_account.delete": "Service Account Deleted",
    "org.service_account.edit": "Service Account Modified",
    "org.user.role.permissions.edit": "User Role Permissions Modified",
    "org.policy.delete": "Security Policy Deleted",
    "org.policy.edit": "Security Policy Modified",
    "org.policy.create": "Security Policy Created",
    "org.user.remove": "User Removed from Organization",
    "org.user.role.delete": "User Role Deleted",
    "org.user.provision.delete": "User Provisioning Deleted",
    "org.integration.delete": "Integration Deleted",
    "org.integration.settings.edit": "Integration Settings Modified",
    "org.cloud_config.settings.edit": "Cloud Configuration Modified",
    "org.sast_settings.edit": "SAST Settings Modified",

    // Medium Criticality Events
    "org.app.create": "Application Created",
    "org.app.delete": "Application Deleted",
    "org.app.edit": "Application Modified",
    "org.app_bot.create": "App Bot Created",
    "org.user.add": "User Added to Organization",
    "org.user.invite": "User Invited",
    "org.user.invite.revoke": "User Invitation Revoked",
    "org.user.invite_link.create": "User Invite Link Created",
    "org.user.provision.create": "User Provisioning Created",
    "org.webhook.add": "Webhook Added",
    "org.project.delete": "Project Deleted",
    "org.project.remove": "Project Removed",
    "org.project.settings.edit": "Project Settings Modified",
    "org.project.pr_check.edit": "PR Check Settings Modified",
    "org.project.fix_pr.auto_open": "Fix PR Auto-Opened",
    "org.project.fix_pr.manual_open": "Fix PR Manually Opened",
    "org.ignore_policy.edit": "Ignore Policy Modified",
    "org.integration.create": "Integration Created",
    "org.project.ignore.create": "Project Ignore Rule Created",
    "org.request_access_settings.edit": "Access Request Settings Modified",
    "org.target.create": "Target Created",
    "org.target.delete": "Target Deleted",

    // Low Criticality Events
    "api.access": "API Access",
    "org.collection.create": "Collection Created",
    "org.collection.delete": "Collection Deleted",
    "org.collection.edit": "Collection Modified",
    "org.create": "Organization Created",
    "org.delete": "Organization Deleted",
    "org.edit": "Organization Settings Modified",
    "org.language_settings.edit": "Language Settings Modified",
    "org.notification_settings.edit": "Notification Settings Modified",
    "org.org_source.create": "Organization Source Created",
    "org.org_source.delete": "Organization Source Deleted",
    "org.org_source.edit": "Organization Source Modified",
    "org.project_filter.create": "Project Filter Created",
    "org.project_filter.delete": "Project Filter Deleted",
    "org.project.add": "Project Added",
    "org.project.attributes.edit": "Project Attributes Modified",
    "org.project.edit": "Project Modified",
    "org.project.monitor": "Project Monitoring Started",
    "org.project.stop_monitor": "Project Monitoring Stopped",
    "org.project.tag.add": "Project Tag Added",
    "org.project.tag.remove": "Project Tag Removed",
    "org.project.test": "Project Test Executed",
    "org.project.files.create": "Project Files Added",
    "org.project.files.edit": "Project Files Modified",
    "org.project.files.access": "Project Files Accessed",
    "org.project.issue.create": "Security Issue Detected",
    "org.settings.feature_flag.edit": "Feature Flag Settings Modified",
    "org.user.invite.accept": "User Invitation Accepted",
    "org.user.invite_link.accept": "User Invite Link Accepted",
    "org.user.leave": "User Left Organization",
    "org.user.role.create": "User Role Created",
    "org.user.role.details.edit": "User Role Details Modified",
    "org.user.role.edit": "User Role Modified",
    "org.webhook.delete": "Webhook Deleted",
    "user.org.notification_settings.edit": "User Notification Settings Modified",
    "user.invite": "User Invited",
    "user.login": "User Login",
  };

  return eventMappings[eventType] || eventType;
}

function formatEventContent(item: AuditLogItem): string {
  const content = item.content;
  
  // Try to create a readable description from content
  if (content.description) {
    return content.description;
  }
  
  switch (item.event) {
    case "org.create":
      return `Organization "${content.name || content.organizationName || 'New Org'}" was created`;
    case "user.invite":
      return `User ${content.email || content.inviteeEmail || 'unknown'} was invited`;
    case "project.create":
      return `Project "${content.name || content.projectName || 'New Project'}" was created`;
    case "api.access":
      return `API accessed via ${content.method || 'GET'} ${content.url || content.endpoint || ''}`;
    default:
      return `${item.event} event occurred`;
  }
}

function formatEventMetadata(item: AuditLogItem): string {
  const content = item.content;
  const parts = [];
  
  if (content.ip || content.ipAddress) {
    parts.push(`IP: ${content.ip || content.ipAddress}`);
  }
  
  if (content.userAgent) {
    const shortAgent = content.userAgent.length > 50 
      ? content.userAgent.substring(0, 50) + "..." 
      : content.userAgent;
    parts.push(`User Agent: ${shortAgent}`);
  }
  
  if (content.integration) {
    parts.push(`Integration: ${content.integration}`);
  }
  
  return parts.join(" • ") || "No additional metadata";
}

function extractUserInfo(item: AuditLogItem): { email?: string; userId?: string; name?: string } {
  const content = item.content;
  
  return {
    email: content.email || content.inviteeEmail || content.userEmail || content.inviterEmail,
    userId: content.userId || content.user_id || content.inviteeId || content.inviterId,
    name: content.name || content.userName || content.inviteeName || content.inviterName
  };
}

export default function AuditLogTable({
  data,
  isLoading,
  error,
  onRefresh,
  searchTerm = "",
}: AuditLogTableProps) {
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLogItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!data || !data.items || !searchTerm.trim()) {
      return data;
    }

    const searchLower = searchTerm.toLowerCase().trim();
    const filteredItems = data.items.filter(item => {
      // Search in event type
      if (item.event.toLowerCase().includes(searchLower)) return true;
      
      // Search in readable event type
      if (getReadableEventType(item.event).toLowerCase().includes(searchLower)) return true;
      
      // Search in user info
      const userInfo = extractUserInfo(item);
      if (userInfo.email?.toLowerCase().includes(searchLower)) return true;
      if (userInfo.name?.toLowerCase().includes(searchLower)) return true;
      
      // Search in event content description
      const contentDesc = formatEventContent(item);
      if (contentDesc.toLowerCase().includes(searchLower)) return true;
      
      // Search in metadata
      const metadata = formatEventMetadata(item);
      if (metadata.toLowerCase().includes(searchLower)) return true;
      
      // Search in raw content for additional fields
      const contentStr = JSON.stringify(item.content).toLowerCase();
      if (contentStr.includes(searchLower)) return true;

      return false;
    });

    return {
      ...data,
      items: filteredItems,
      total: filteredItems.length
    };
  }, [data, searchTerm]);

  const handleViewDetails = (item: AuditLogItem) => {
    setSelectedAuditLog(item);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedAuditLog(null);
  };
  
  if (error) {
    return (
      <Card className="mt-8">
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2" data-testid="text-error-title">
            Failed to Load Audit Logs
          </h3>
          <p className="text-gray-600 mb-6" data-testid="text-error-message">
            {error.message || "An unexpected error occurred"}
          </p>
          <Button onClick={onRefresh} data-testid="button-retry">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-snyk-text" data-testid="text-table-title">
              Audit Log Events
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              <span data-testid="text-total-records">
                {filteredData?.total || 0}
              </span>{" "}
              {searchTerm ? "filtered" : ""} events found •{" "}
              Last updated{" "}
              <span data-testid="text-last-updated">
                {formatDistanceToNow(new Date(), { addSuffix: true })}
              </span>
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-sm">
              <span className="text-gray-600">Show:</span>
              <Select defaultValue="50">
                <SelectTrigger className="w-20" data-testid="select-page-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Loading State */}
      {isLoading && (
        <CardContent className="p-8 text-center">
          <div className="inline-flex items-center space-x-2">
            <RefreshCw className="animate-spin h-6 w-6 text-snyk-blue" />
            <span className="text-gray-600" data-testid="text-loading">Loading audit logs...</span>
          </div>
        </CardContent>
      )}

      {/* Data Table */}
      {!isLoading && filteredData && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.items.map((item, index) => (
                  <tr key={item.id || index} className="hover:bg-gray-50" data-testid={`row-audit-${index}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-snyk-text" data-testid={`text-timestamp-${index}`}>
                        {new Date(item.created).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500" data-testid={`text-relative-time-${index}`}>
                        {formatDistanceToNow(new Date(item.created), { addSuffix: true })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge
                        className={EVENT_TYPE_COLORS[item.event] || "bg-gray-100 text-gray-800"}
                        data-testid={`badge-event-${index}`}
                      >
                        {getReadableEventType(item.event)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-snyk-text" data-testid={`text-description-${index}`}>
                        {formatEventContent(item)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1" data-testid={`text-metadata-${index}`}>
                        {formatEventMetadata(item)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(item)}
                        className="text-purple-600 hover:text-purple-700 flex items-center"
                        data-testid={`button-view-${index}`}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        <span>View</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {filteredData.items.length === 0 && (
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2" data-testid="text-no-data-title">
                No Audit Logs Found
              </h3>
              <p className="text-gray-600" data-testid="text-no-data-message">
                {searchTerm ? 
                  `No audit events found matching "${searchTerm}". Try a different search term.` : 
                  "No audit events match your current filters. Try adjusting your search criteria."
                }
              </p>
            </CardContent>
          )}

          {/* Pagination */}
          {filteredData.items.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600" data-testid="text-pagination-info">
                Showing 1 to {filteredData.items.length} of {filteredData.total} results
                {searchTerm && ` (filtered by "${searchTerm}")`}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={true}
                  data-testid="button-previous-page"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-purple-600 text-white"
                  data-testid="button-current-page"
                >
                  1
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data?.nextCursor}
                  data-testid="button-next-page"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Audit Log Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Audit Log Details
            </DialogTitle>
            <DialogDescription>
              Detailed information about this audit log event
            </DialogDescription>
          </DialogHeader>
          
          {selectedAuditLog && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6">
                {/* Event Overview */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3" data-testid="text-event-overview">Event Overview</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-500">Event Type:</span>
                      <div className="mt-1">
                        <Badge 
                          className={EVENT_TYPE_COLORS[selectedAuditLog.event] || "bg-gray-100 text-gray-800"}
                          data-testid="badge-event-type"
                        >
                          {selectedAuditLog.event}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Timestamp:</span>
                      <p className="text-sm text-gray-900 mt-1" data-testid="text-event-timestamp">
                        {new Date(selectedAuditLog.created).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Event ID:</span>
                      <p className="text-sm font-mono text-gray-900 mt-1" data-testid="text-event-id">
                        {selectedAuditLog.id}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Time Ago:</span>
                      <p className="text-sm text-gray-900 mt-1" data-testid="text-time-ago">
                        {formatDistanceToNow(new Date(selectedAuditLog.created), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Resource Information */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3" data-testid="text-resource-info">Resource Information</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {selectedAuditLog.org_id && (
                      <div>
                        <span className="text-sm font-medium text-gray-500">Organization ID:</span>
                        <p className="text-sm font-mono text-gray-900 mt-1" data-testid="text-dialog-org-id">
                          {selectedAuditLog.org_id}
                        </p>
                      </div>
                    )}
                    {selectedAuditLog.group_id && (
                      <div>
                        <span className="text-sm font-medium text-gray-500">Group ID:</span>
                        <p className="text-sm font-mono text-gray-900 mt-1" data-testid="text-dialog-group-id">
                          {selectedAuditLog.group_id}
                        </p>
                      </div>
                    )}
                    {selectedAuditLog.project_id && (
                      <div>
                        <span className="text-sm font-medium text-gray-500">Project ID:</span>
                        <p className="text-sm font-mono text-gray-900 mt-1" data-testid="text-dialog-project-id">
                          {selectedAuditLog.project_id}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Event Description */}
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3" data-testid="text-event-description">Event Description</h3>
                  <p className="text-sm text-gray-900" data-testid="text-event-content">
                    {formatEventContent(selectedAuditLog)}
                  </p>
                  <p className="text-xs text-gray-600 mt-2" data-testid="text-event-metadata">
                    {formatEventMetadata(selectedAuditLog)}
                  </p>
                </div>

                {/* Raw Content */}
                <div className="bg-yellow-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3" data-testid="text-raw-content">Raw Event Content</h3>
                  <pre className="text-xs bg-white p-3 rounded border overflow-x-auto whitespace-pre-wrap" data-testid="pre-raw-content">
                    {JSON.stringify(selectedAuditLog.content, null, 2)}
                  </pre>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}