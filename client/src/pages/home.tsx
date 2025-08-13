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
    setSelectedImage(image);
  };

  const handleCloseModal = () => {
    setSelectedImage(null);
  };

  return (
    <div className="bg-gray-50 min-h-screen font-inter">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Worm className="text-white" size={16} />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Site Image Crawler</h1>
                <p className="text-sm text-gray-500">Web Interface</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                <span data-testid="crawls-today-count">0</span> crawls today
              </div>
              <button 
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                data-testid="button-settings"
              >
                <Settings size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Crawler Form */}
          <div className="lg:col-span-1">
            <CrawlerForm 
              onCrawlStart={handleCrawlStart}
              activeCrawlId={activeCrawlId}
            />
            
            <CrawlStatus 
              crawlId={activeCrawlId}
              onCrawlComplete={handleCrawlComplete}
            />
          </div>

          {/* Results Section */}
          <div className="lg:col-span-2">
            <ResultsTable 
              refreshTrigger={refreshTrigger}
              onImageView={handleImageView}
            />
          </div>
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
