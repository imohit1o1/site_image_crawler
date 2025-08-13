import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { type CrawlProgress } from "@/lib/types";

interface CrawlStatusProps {
  crawlId: string | null;
  onCrawlComplete: () => void;
}

export default function CrawlStatus({ crawlId, onCrawlComplete }: CrawlStatusProps) {
  const [progress, setProgress] = useState<CrawlProgress>({
    status: 'idle',
    progress: 0,
    pagesProcessed: 0,
    totalPagesFound: 0,
    imagesFound: 0,
    currentPage: '',
    elapsedTime: '0s'
  });

  useEffect(() => {
    if (!crawlId) {
      setProgress({
        status: 'idle',
        progress: 0,
        pagesProcessed: 0,
        totalPagesFound: 0,
        imagesFound: 0,
        currentPage: '',
        elapsedTime: '0s'
      });
      return;
    }

    const eventSource = new EventSource(`/api/crawl/${crawlId}/progress`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(prev => ({ ...prev, ...data }));
      
      if (data.status === 'completed' || data.status === 'failed') {
        eventSource.close();
        onCrawlComplete();
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [crawlId, onCrawlComplete]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running': return 'Running';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      case 'pending': return 'Pending';
      default: return 'Idle';
    }
  };

  return (
    <Card className="modern-card border-0 shadow-2xl">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-foreground">Crawl Status</h3>
          <Badge 
            className={`px-3 py-1.5 text-sm font-semibold rounded-full ${getStatusColor(progress.status)}`}
            data-testid="status-badge"
          >
            {getStatusText(progress.status)}
          </Badge>
        </div>
        
        <div className="space-y-4">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-sm text-muted-foreground mb-3">
              <span>Pages Crawled</span>
              <span className="font-semibold">
                <span data-testid="text-pages-processed">{progress.pagesProcessed}</span> / 
                <span data-testid="text-total-pages">{progress.totalPagesFound}</span>
              </span>
            </div>
            <Progress 
              value={progress.progress} 
              className="w-full bg-card h-3 rounded-full modern-progress"
              data-testid="progress-bar"
            />
          </div>

          {/* Current Page */}
          <div className="text-sm">
            <span className="text-muted-foreground">Current Page:</span>
            <span 
              className="text-foreground break-all ml-3 font-medium" 
              data-testid="text-current-page"
            >
              {progress.currentPage || '-'}
            </span>
          </div>

          {/* Error Message */}
          {progress.error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-xl" data-testid="text-error">
              <span className="font-semibold">Error:</span> {progress.error}
            </div>
          )}

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-4 pt-3">
            <div className="text-center p-4 bg-gradient-to-br from-success/20 to-success/10 rounded-xl border border-success/20">
              <div 
                className="text-2xl font-bold text-success" 
                data-testid="text-images-found"
              >
                {progress.imagesFound}
              </div>
              <div className="text-sm text-muted-foreground font-medium">Images Found</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl border border-primary/20">
              <div 
                className="text-2xl font-bold text-primary" 
                data-testid="text-elapsed-time"
              >
                {progress.elapsedTime}
              </div>
              <div className="text-sm text-muted-foreground font-medium">Elapsed Time</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
