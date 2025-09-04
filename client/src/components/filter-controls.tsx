import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RefreshCw, Download } from "lucide-react";

interface FilterControlsProps {
  filters: {
    from: string;
    to: string;
    events: string[];
    excludeEvents: string[];
    size: number;
    search: string;
  };
  onFiltersChange: (filters: any) => void;
  onFetch: () => void;
  onExport: (format: "json" | "csv") => void;
  isLoading: boolean;
  isExporting: boolean;
}

const EVENT_TYPES = [
  "org.create",
  "user.invite", 
  "project.create",
  "api.access",
  "user.login",
  "org.edit",
  "project.edit",
  "integration.create"
];

export default function FilterControls({
  filters,
  onFiltersChange,
  onFetch,
  onExport,
  isLoading,
  isExporting,
}: FilterControlsProps) {
  
  const updateFilter = (key: string, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search audit events..."
                  value={filters.search}
                  onChange={(e) => updateFilter("search", e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Select
                value={filters.events[0] || "all"}
                onValueChange={(value) => 
                  updateFilter("events", value === "all" ? [] : [value])
                }
              >
                <SelectTrigger className="w-40" data-testid="select-event-type">
                  <SelectValue placeholder="All Events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  {EVENT_TYPES.map((event) => (
                    <SelectItem key={event} value={event}>
                      {event}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={filters.from}
                onChange={(e) => updateFilter("from", e.target.value)}
                className="w-40"
                data-testid="input-date-from"
              />

              <Input
                type="date"
                value={filters.to}
                onChange={(e) => updateFilter("to", e.target.value)}
                className="w-40"
                data-testid="input-date-to"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={onFetch}
              disabled={isLoading}
              className="bg-purple-600 text-white hover:bg-purple-700 flex items-center"
              data-testid="button-fetch-logs"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? "Loading..." : "Fetch Logs"}</span>
            </Button>

            <Select onValueChange={(format) => onExport(format as "json" | "csv")}>
              <SelectTrigger className="w-auto">
                <Download className="w-4 h-4 mr-2" />
                {isExporting ? "Exporting..." : "Export"}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">Export as JSON</SelectItem>
                <SelectItem value="csv">Export as CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}