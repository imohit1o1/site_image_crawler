import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Search, Download, Eye, Image as ImageIcon } from 'lucide-react';
import { type CrawledImage } from '@shared/schema';

interface ResultsSectionProps {
  jobId?: string;
}

export default function ResultsSection({ jobId }: ResultsSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [altTextFilter, setAltTextFilter] = useState('all');
  const [imageTypeFilter, setImageTypeFilter] = useState('all');
  const [selectedImage, setSelectedImage] = useState<CrawledImage | null>(null);

  const { data: images = [], isLoading } = useQuery({
    queryKey: ['images', jobId],
    queryFn: async () => {
      const url = jobId ? `/api/crawl/${jobId}/images` : '/api/images';
      const params = new URLSearchParams();
      
      if (searchTerm) params.append('search', searchTerm);
      if (altTextFilter !== 'all') params.append('altTextFilter', altTextFilter);
      if (imageTypeFilter !== 'all') params.append('imageTypeFilter', imageTypeFilter);
      
      const response = await fetch(`${url}?${params}`);
      return response.json();
    }
  });

  const handleDownloadCSV = () => {
    const headers = ['Image URL', 'Page URL', 'Alt Text', 'Image Type', 'Filename', 'Dimensions'];
    const csvContent = [
      headers.join(','),
      ...images.map((img: CrawledImage) => [
        `"${img.imageUrl}"`,
        `"${img.pageUrl}"`,
        `"${img.altText || ''}"`,
        `"${img.imageType || ''}"`,
        `"${img.filename || ''}"`,
        `"${img.dimensions || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crawled-images.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'running': return 'secondary';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  const uniquePages = Array.from(new Set(images.map((img: CrawledImage) => img.pageUrl))).length;

  if (isLoading) {
    return (
      <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
        <CardContent className="p-8">
          <div className="text-center text-gray-500">Loading images...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold text-gray-900">
            Crawl Results
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              {images.length} images found from {uniquePages} pages
            </Badge>
            {images.length > 0 && (
              <Button
                onClick={handleDownloadCSV}
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
                data-testid="button-download-csv"
              >
                <Download className="h-4 w-4" />
                Download CSV
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {images.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No images found. Start a crawl to see results here.</p>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-64">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search images..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-search"
                    />
                  </div>
                </div>
                
                <Select value={altTextFilter} onValueChange={setAltTextFilter}>
                  <SelectTrigger className="w-48" data-testid="select-alt-filter">
                    <SelectValue placeholder="Alt text filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Alt Text</SelectItem>
                    <SelectItem value="with-alt">With Alt Text</SelectItem>
                    <SelectItem value="without-alt">Without Alt Text</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={imageTypeFilter} onValueChange={setImageTypeFilter}>
                  <SelectTrigger className="w-48" data-testid="select-type-filter">
                    <SelectValue placeholder="Image type filter" />
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

            {/* Image Grid */}
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {images.map((image: CrawledImage) => (
                  <Card key={image.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <div className="aspect-video bg-gray-100 relative overflow-hidden">
                      <img
                        src={image.imageUrl}
                        alt={image.altText || 'Crawled image'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = `
                              <div class="flex items-center justify-center h-full bg-gray-200 text-gray-500">
                                <svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            `;
                          }
                        }}
                        data-testid={`img-preview-${image.id}`}
                      />
                    </div>
                    <CardContent className="p-3">
                      <div className="space-y-2">
                        <div className="text-xs text-gray-500 truncate">
                          {image.pageUrl}
                        </div>
                        {image.altText && (
                          <div className="text-sm text-gray-700 line-clamp-2">
                            {image.altText}
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-gray-500">
                            {image.imageType || 'Unknown'}
                          </div>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedImage(image)}
                                data-testid={`button-view-${image.id}`}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl">
                              <DialogHeader>
                                <DialogTitle>Image Details</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="max-h-96 overflow-auto bg-gray-50 rounded-lg p-4">
                                  <img
                                    src={image.imageUrl}
                                    alt={image.altText || 'Full size image'}
                                    className="max-w-full h-auto mx-auto"
                                    data-testid="img-modal-full"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <strong>URL:</strong>
                                    <div className="break-all text-gray-600">{image.imageUrl}</div>
                                  </div>
                                  <div>
                                    <strong>Page:</strong>
                                    <div className="break-all text-gray-600">{image.pageUrl}</div>
                                  </div>
                                  <div>
                                    <strong>Alt Text:</strong>
                                    <div className="text-gray-600">{image.altText || 'No alt text'}</div>
                                  </div>
                                  <div>
                                    <strong>Type:</strong>
                                    <div className="text-gray-600">{image.imageType || 'Unknown'}</div>
                                  </div>
                                  {image.dimensions && (
                                    <div>
                                      <strong>Dimensions:</strong>
                                      <div className="text-gray-600">{image.dimensions}</div>
                                    </div>
                                  )}
                                  {image.filename && (
                                    <div>
                                      <strong>Filename:</strong>
                                      <div className="text-gray-600">{image.filename}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}