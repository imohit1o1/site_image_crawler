import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Download, Trash2, Eye, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type CrawledImage } from "@shared/schema";
import { type ImageFilter } from "@/lib/types";

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

interface ResultsTableProps {
  refreshTrigger: number;
  onImageView: (image: CrawledImage) => void;
}

export default function ResultsTable({ refreshTrigger, onImageView }: ResultsTableProps) {
  const { toast } = useToast();
  const [filters, setFilters] = useState<ImageFilter>({
    search: '',
    altTextFilter: 'all',
    imageTypeFilter: 'all'
  });
  const [customAltTexts, setCustomAltTexts] = useState<Record<string, string>>({});

  // Debounced function to update custom alt texts state
  const debouncedUpdateState = useCallback(
    debounce((imageId: string, value: string) => {
      setCustomAltTexts(prev => ({ ...prev, [imageId]: value }));
    }, 500),
    []
  );

  // Debounced function to save custom alt text
  const debouncedSave = useCallback(
    debounce((imageId: string, value: string) => {
      handleSaveCustomAlt(imageId, value);
    }, 200),
    []
  );

  const { data: images = [], refetch } = useQuery({
    queryKey: ['/api/images', filters],
    queryFn: async () => {
      console.log('ResultsTable: Starting API request for images with filters:', filters);
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.altTextFilter !== 'all') params.append('altTextFilter', filters.altTextFilter);
      if (filters.imageTypeFilter !== 'all') params.append('imageTypeFilter', filters.imageTypeFilter);
      
      const response = await fetch(`/api/images?${params}`);
      if (!response.ok) throw new Error('Failed to fetch images');
      const data = await response.json();
      console.log('ResultsTable: API response received:', {
        status: response.status,
        dataLength: data.length,
        sampleData: data.slice(0, 2).map((img: any) => ({
          id: img.id,
          imageUrl: img.imageUrl,
          pageUrl: img.pageUrl,
          altText: img.altText
        }))
      });
      return data;
    },
  });

  // Log when images data changes
  useEffect(() => {
    console.log('ResultsTable: Images data changed:', {
      count: images.length,
      refreshTrigger,
      sampleImages: images.slice(0, 2).map((img: CrawledImage) => ({
        id: img.id,
        imageUrl: img.imageUrl,
        pageUrl: img.pageUrl
      }))
    });
  }, [images, refreshTrigger]);

  const clearResultsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', '/api/results');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/images'] });
      toast({
        title: "Results Cleared",
        description: "All crawl results have been cleared.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear results",
        variant: "destructive",
      });
    },
  });

  // Refresh when triggered from parent
  useEffect(() => {
    if (refreshTrigger > 0) {
      refetch();
    }
  }, [refreshTrigger, refetch]);

  const handleDownloadCSV = async () => {
    try {
      // Create CSV with custom alt tags included
      const headers = ['Image URL', 'Page URL', 'Original Alt Text', 'Custom Alt Tag', 'Image Type', 'Filename', 'Dimensions'];
      
      const csvContent = [
        headers.join(','),
        ...images.map((img: CrawledImage) => [
          `"${img.imageUrl}"`,
          `"${img.pageUrl}"`,
          `"${img.altText || ''}"`,
          `"${customAltTexts[img.id] || ''}"`,
          `"${img.imageType || ''}"`,
          `"${img.filename || ''}"`,
          `"${img.dimensions || ''}"`
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'crawled_images_with_custom_alt_tags.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download Started",
        description: "CSV file with custom alt tags is being downloaded.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download CSV",
        variant: "destructive",
      });
    }
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Copied",
        description: "Image URL copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy URL",
        variant: "destructive",
      });
    }
  };

  const handleSaveCustomAlt = async (imageId: string, customAltText: string) => {
    try {
      const response = await fetch(`/api/images/${imageId}/alt-tag`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ altTag: customAltText }),
      });

      if (!response.ok) {
        throw new Error('Failed to update alt tag');
      }

      toast({
        title: "Alt Tag Updated",
        description: "Custom alt text has been saved successfully.",
      });

      // Update local state
      setCustomAltTexts(prev => ({ ...prev, [imageId]: customAltText }));
      
      // Refresh the data
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update alt tag",
        variant: "destructive",
      });
    }
  };

  const getImageTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'jpg':
      case 'jpeg':
        return 'bg-primary/20 text-primary border border-primary/30';
      case 'png':
        return 'bg-accent/20 text-accent border border-accent/30';
      case 'gif':
        return 'bg-warning/20 text-warning border border-warning/30';
      case 'svg':
        return 'bg-success/20 text-success border border-success/30';
      case 'webp':
        return 'bg-chart-4/20 text-chart-4 border border-chart-4/30';
      default:
        return 'bg-muted text-muted-foreground border border-border';
    }
  };

  const uniquePages = Array.from(new Set(images.map((img: CrawledImage) => img.pageUrl))).length;

  console.log('ResultsTable: Rendering with images:', {
    count: images.length,
    uniquePages,
    images: images.slice(0, 3) // Log first 3 images for debugging
  });

  return (
    <Card className="modern-card border-0 shadow-2xl">
      <CardContent className="p-0">
        {/* Results Header */}
        <div className="p-6 border-b border-border/20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">Crawl Results</h2>
              <p className="text-muted-foreground mt-2">
                <span data-testid="text-total-images" className="text-primary font-semibold">{images.length}</span> images found from{' '}
                <span data-testid="text-total-pages" className="text-primary font-semibold">{uniquePages}</span> pages
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    console.log('ResultsTable: Fixing image URLs...');
                    const response = await fetch('/api/fix-image-urls', { method: 'POST' });
                    if (!response.ok) throw new Error('Failed to fix image URLs');
                    const result = await response.json();
                    console.log('ResultsTable: Image URLs fixed:', result);
                    toast({
                      title: "URLs Fixed",
                      description: `Fixed ${result.fixedCount} image URLs.`,
                    });
                    // Refresh the data
                    refetch();
                  } catch (error) {
                    console.error('ResultsTable: Error fixing image URLs:', error);
                    toast({
                      title: "Error",
                      description: "Failed to fix image URLs",
                      variant: "destructive",
                    });
                  }
                }}
                className="modern-input px-4 py-2 text-sm font-medium text-foreground bg-card hover:bg-card/80 border-border"
                data-testid="button-fix-urls"
              >
                Fix URLs
              </Button>
              <Button
                variant="outline"
                onClick={() => clearResultsMutation.mutate()}
                disabled={clearResultsMutation.isPending}
                className="modern-input px-4 py-2 text-sm font-medium text-foreground bg-card hover:bg-card/80 border-border"
                data-testid="button-clear-results"
              >
                <Trash2 className="mr-2" size={16} />
                Clear
              </Button>
              <Button
                onClick={handleDownloadCSV}
                className="modern-button px-4 py-2 text-sm font-medium"
                data-testid="button-download-csv"
              >
                <Download className="mr-2" size={16} />
                Download CSV
              </Button>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="p-6 border-b border-border/20 bg-card/50">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search images..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="modern-input pl-10 border-border focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                  data-testid="input-search"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <Search className="text-muted-foreground" size={16} />
                </div>
              </div>
            </div>

            {/* Alt Text Filter */}
            <div>
              <Select 
                value={filters.altTextFilter} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, altTextFilter: value as any }))}
              >
                <SelectTrigger 
                  className="modern-input border-border focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                  data-testid="select-alt-text-filter"
                >
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
              <Select 
                value={filters.imageTypeFilter} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, imageTypeFilter: value }))}
              >
                <SelectTrigger 
                  className="modern-input border-border focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                  data-testid="select-image-type-filter"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="jpg">JPG</SelectItem>
                  <SelectItem value="jpeg">JPEG</SelectItem>
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
        <div className="overflow-hidden">
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader className="bg-card/50 sticky top-0 z-10">
                <TableRow className="border-border/20">
                  <TableHead className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-card/50 rounded-tl-xl">
                    Image
                  </TableHead>
                  <TableHead className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-card/50">
                    Source Page
                  </TableHead>
                  <TableHead className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-card/50">
                    Alt Text
                  </TableHead>
                  <TableHead className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-card/50">
                    Custom Alt Tag
                  </TableHead>
                  <TableHead className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-card/50">
                    Type
                  </TableHead>
                  <TableHead className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-card/50 rounded-tr-xl">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-card divide-y divide-border/20">
                {images.length === 0 ? (
                  <TableRow>
                    <TableCell 
                      colSpan={6} 
                      className="px-6 py-12 text-center text-muted-foreground"
                      data-testid="text-no-results"
                    >
                      <div className="space-y-2">
                        <div className="text-lg font-medium">No images found</div>
                        <div className="text-sm">Start a crawl to see results here</div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  images.map((image: CrawledImage) => {
                    console.log('ResultsTable: Rendering image row:', {
                      id: image.id,
                      imageUrl: image.imageUrl,
                      pageUrl: image.pageUrl
                    });
                    
                    return (
                      <TableRow 
                        key={image.id} 
                        className="hover:bg-card/80 transition-colors border-border/20"
                        data-testid={`row-image-${image.id}`}
                      >
                        <TableCell className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-14 w-14 bg-card rounded-xl overflow-hidden border border-border/20">
                              <img 
                                src={image.imageUrl} 
                                alt={image.altText || 'Image'} 
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  target.parentElement!.innerHTML = '<div class="h-full w-full bg-muted flex items-center justify-center text-muted-foreground text-xs rounded-xl">No Preview</div>';
                                }}
                                data-testid={`img-preview-${image.id}`}
                              />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm text-foreground font-medium truncate max-w-xs" data-testid={`text-filename-${image.id}`}>
                                {image.filename || 'unknown'}
                              </div>
                              <div className="text-xs text-muted-foreground" data-testid={`text-dimensions-${image.id}`}>
                                {image.dimensions || 'Unknown size'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="text-sm text-foreground break-all max-w-xs" data-testid={`text-source-page-${image.id}`}>
                            <a 
                              href={image.pageUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:text-primary hover:underline transition-colors"
                            >
                              {image.pageUrl}
                              <ExternalLink className="inline ml-2" size={14} />
                            </a>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="text-sm text-foreground" data-testid={`text-alt-text-${image.id}`}>
                            {image.altText || (
                              <span className="text-muted-foreground italic">No alt text</span>
                            )}
                          </div>
                          <Badge 
                            className={`mt-2 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              image.altText 
                                ? 'bg-success/20 text-success border border-success/30' 
                                : 'bg-warning/20 text-warning border border-warning/30'
                            }`}
                            data-testid={`badge-alt-status-${image.id}`}
                          >
                            {image.altText ? '✓ Has Alt' : '⚠ Missing Alt'}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-6 py-4 w-96">
                          <Input
                            type="text"
                            placeholder="Enter custom alt text..."
                            className="modern-input text-sm py-2"
                            data-testid={`input-custom-alt-${image.id}`}
                            onChange={(e) => debouncedUpdateState(image.id, e.target.value)}
                            onBlur={() => debouncedSave(image.id, customAltTexts[image.id] || '')}
                          />
                        </TableCell>
                        <TableCell className="px-6 py-4 whitespace-nowrap">
                          <Badge 
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getImageTypeColor(image.imageType || '')}`}
                            data-testid={`badge-image-type-${image.id}`}
                          >
                            {(image.imageType || 'unknown').toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                console.log('ResultsTable: View button clicked for image:', {
                                  id: image.id,
                                  imageUrl: image.imageUrl,
                                  pageUrl: image.pageUrl
                                });
                                onImageView(image);
                              }}
                              className="text-primary hover:text-primary/80 hover:bg-primary/10 rounded-lg border border-white/20 p-2"
                              data-testid={`button-view-${image.id}`}
                            >
                              <Eye size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyUrl(image.imageUrl)}
                              className="text-muted-foreground hover:text-foreground hover:bg-card rounded-lg border border-white/20 p-2"
                              data-testid={`button-copy-${image.id}`}
                            >
                              <Copy size={16} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
