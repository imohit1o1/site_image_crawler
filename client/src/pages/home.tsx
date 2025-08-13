import { useState } from "react";
import { Settings, Worm } from "lucide-react";
import CrawlerForm from "@/components/crawler-form";
import CrawlStatus from "@/components/crawl-status";
import ResultsTable from "@/components/results-table";
import ImagePreviewModal from "@/components/image-preview-modal";
import { type CrawledImage } from "@shared/schema";

export default function Home() {
  const [activeCrawlId, setActiveCrawlId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<CrawledImage | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleCrawlStart = (crawlId: string) => {
    setActiveCrawlId(crawlId);
  };

  const handleCrawlComplete = () => {
    setActiveCrawlId(null);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleImageView = (image: CrawledImage) => {
    console.log('Home: handleImageView called with image:', {
      id: image.id,
      imageUrl: image.imageUrl,
      pageUrl: image.pageUrl
    });
    setSelectedImage(image);
    console.log('Home: selectedImage state set to:', image);
  };

  const handleCloseModal = () => {
    console.log('Home: handleCloseModal called, clearing selectedImage');
    setSelectedImage(null);
    console.log('Home: selectedImage state cleared');
  };

  return (
    <div className="bg-background min-h-screen font-inter">
      {/* Header */}
      <header className="glass-effect border-b border-border/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center shadow-lg">
                <Worm className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Site Image Crawler</h1>
                <p className="text-muted-foreground">Professional Web Interface</p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  <span data-testid="crawls-today-count">0</span>
                </div>
                <div className="text-sm text-muted-foreground">crawls today</div>
              </div>
              <button 
                className="p-3 text-muted-foreground hover:text-foreground transition-colors bg-card rounded-xl hover:bg-card/80"
                data-testid="button-settings"
              >
                <Settings size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Row: Crawler Form and Crawl Status side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Section 1: Crawler Form */}
          <div className="hover-lift">
            <CrawlerForm 
              onCrawlStart={handleCrawlStart}
              activeCrawlId={activeCrawlId}
            />
          </div>

          {/* Section 2: Crawl Status */}
          <div className="hover-lift">
            <CrawlStatus 
              crawlId={activeCrawlId}
              onCrawlComplete={handleCrawlComplete}
            />
          </div>
        </div>

        {/* Bottom Row: Results Section spanning full width */}
        <div className="w-full hover-lift">
          <ResultsTable 
            refreshTrigger={refreshTrigger}
            onImageView={handleImageView}
          />
        </div>
      </div>

      {/* Image Preview Modal */}
      <ImagePreviewModal 
        image={selectedImage}
        isOpen={!!selectedImage}
        onClose={handleCloseModal}
      />
    </div>
  );
}
