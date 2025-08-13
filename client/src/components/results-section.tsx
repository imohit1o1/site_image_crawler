import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Trash2, 
  Download, 
  Search, 
  Eye, 
  Copy,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertTriangle
} from "lucide-react";
import { type CrawlResult } from "@shared/schema";

interface ResultsSectionProps {
  jobId: string | null;
  onImageSelect: (image: CrawlResult) => void;
}

interface ResultsResponse {
  results: CrawlResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function ResultsSection({ jobId, onImageSelect }: ResultsSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [altTextFilter, setAltTextFilter] = useState("all");
  const [imageTypeFilter, setImageTypeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: resultsData, isLoading } = useQuery<ResultsResponse>({
    queryKey: ["/api/crawl", jobId, "results", currentPage, searchQuery, altTextFilter, imageTypeFilter],
    enabled: !!jobId,
    refetchInterval: 5000, // Refresh every 5 seconds during crawling
  });

  const clearResultsMutation = useMutation({
    mutationFn: async () => {
      if (!jobId) throw new Error("No job ID");
      await apiRequest("DELETE", `/api/crawl/${jobId}/results`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crawl"] });
      toast({
        title: "Results Cleared",
        description: "All crawl results have been cleared successfully.",
      });
      setCurrentPage(1);
    },
    onError: () => {
      toast({
        title: "Failed to Clear Results",
        description: "An error occurred while clearing the results.",
        variant: "destructive",
      });
    },
  });

  const handleDownloadCSV = async () => {
    if (!jobId) return;
    
    try {
      window.open(`/api/crawl/${jobId}/download`, '_blank');
      toast({
        title: "Download Started",
        description: "Your CSV file is being downloaded.",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download the CSV file.",
        variant: "destructive",
      });
    }
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "URL Copied",
        description: "Image URL copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Copy Failed", 
        description: "Failed to copy URL to clipboard.",
        variant: "destructive",
      });
    }
  };

  const getImageTypeVariant = (type: string | null) => {
    if (!type) return "outline";
    switch (type.toLowerCase()) {
      case "jpg":
      case "jpeg":
        return "default";
      case "png":
        return "secondary";
      case "gif":
        return "destructive";
      case "svg":
        return "outline";
      case "webp":
        return "secondary";
      default:
        return "outline";
    }
  };

  const results = resultsData?.results || [];
  const pagination = resultsData?.pagination;

  // Reset page when filters change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleAltTextFilterChange = (value: string) => {
    setAltTextFilter(value);
    setCurrentPage(1);
  };

  const handleImageTypeFilterChange = (value: string) => {
    setImageTypeFilter(value);
    setCurrentPage(1);
  };

  return (
    <Card>
      {/* Results Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900" data-testid="text-results-title">
              Crawl Results
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              <span data-testid="text-total-images">{pagination?.total || 0}</span> images found from{" "}
              <span data-testid="text-total-pages">0</span> pages
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={() => clearResultsMutation.mutate()}
              disabled={clearResultsMutation.isPending || !results.length}
              data-testid="button-clear-results"
            >
              <Trash2 size={16} className="mr-2" />
              Clear
            </Button>
            <Button
              onClick={handleDownloadCSV}
              disabled={!results.length}
              data-testid="button-download-csv"
            >
              <Download size={16} className="mr-2" />
              Download CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <Input
                type="text"
                placeholder="Search images..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
                data-testid="input-search-images"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                <Search className="text-gray-400" size={16} />
              </div>
            </div>
          </div>

          {/* Alt Text Filter */}
          <div>
            <Select value={altTextFilter} onValueChange={handleAltTextFilterChange}>
              <SelectTrigger data-testid="select-alt-text-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Images</SelectItem>
                <SelectItem value="with-alt">With Alt Text</SelectItem>
                <SelectItem value="without-alt">Missing Alt Text</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Image Type Filter */}
          <div>
            <Select value={imageTypeFilter} onValueChange={handleImageTypeFilterChange}>
              <SelectTrigger data-testid="select-image-type-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="jpg">JPG</SelectItem>
                <SelectItem value="png">PNG</SelectItem>
                <SelectItem value="gif">GIF</SelectItem>
                <SelectItem value="svg">SVG</SelectItem>
                <SelectItem value="webp">WebP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="text-gray-500">Loading results...</div>
          </div>
        ) : results.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-500" data-testid="text-no-results">
              {jobId ? "No images found yet." : "Start a crawl to see results here."}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>Source Page</TableHead>
                  <TableHead>Alt Text</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={result.id} className="hover:bg-gray-50" data-testid={`row-image-${result.id}`}>
                    <TableCell>
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-12 w-12 bg-gray-200 rounded-lg overflow-hidden">
                          <img
                            src={result.imageUrl}
                            alt={result.altText || ""}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiB# thoughts

I need to create a web-based image crawler tool that converts the provided Node.js script into a full-stack web application. The design reference shows a clean, professional interface with:

1. A header with app branding
2. A left sidebar with crawl form and status
3. A main results section with table, filters, and pagination
4. Modal for image preview
5. Error handling with toasts

Key requirements:
- Convert existing Node.js Puppeteer script to server-side API
- Implement real-time progress tracking via Server-Sent Events
- Create searchable results table with filtering
- Add CSV download functionality
- Proper error handling and validation
- Professional UI matching the design reference

The existing project structure already has React, Express, and Tailwind set up, so I need to:
1. Define the data schema for crawl jobs and results
2. Implement the backend API with Puppeteer integration
3. Create the frontend components matching the design
4. Add real-time progress tracking
5. Implement CSV export functionality

# useful_guidelines_from_blueprints

N/A - No specific blueprints provided for this task.

# directory_structure

```json
[
    {"path": "shared/schema.ts", "status": "overwritten"},
    {"path": "server/storage.ts", "status": "overwritten"},
    {"path": "server/routes.ts", "status": "overwritten"},
    {"path": "server/services/crawler.ts", "status": "new"},
    {"path": "client/src/App.tsx", "status": "overwritten"},
    {"path": "client/src/pages/home.tsx", "status": "new"},
    {"path": "client/src/components/crawler-form.tsx", "status": "new"},
    {"path": "client/src/components/crawl-status.tsx", "status": "new"},
    {"path": "client/src/components/results-table.tsx", "status": "new"},
    {"path": "client/src/components/image-preview-modal.tsx", "status": "new"},
    {"path": "client/src/lib/types.ts", "status": "new"}
]
