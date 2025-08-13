import { X, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { type CrawledImage } from "@shared/schema";

interface ImagePreviewModalProps {
  image: CrawledImage | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ImagePreviewModal({ image, isOpen, onClose }: ImagePreviewModalProps) {
  if (!image) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-medium text-gray-900">
              Image Preview
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              data-testid="button-close-modal"
            >
              <X size={20} />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="mt-4">
          <div className="bg-gray-100 rounded-lg p-4 mb-4 flex items-center justify-center min-h-96">
            <img 
              src={image.imageUrl} 
              alt={image.altText || 'Image preview'} 
              className="max-h-96 max-w-full object-contain rounded-lg shadow-lg"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.parentElement!.innerHTML = '<div class="text-gray-500 text-center p-8">Failed to load image</div>';
              }}
              data-testid="img-modal-preview"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="font-medium text-gray-700">Source URL:</label>
              <p className="text-gray-600 break-all mt-1" data-testid="text-modal-source-url">
                <a 
                  href={image.imageUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 hover:underline"
                >
                  {image.imageUrl}
                  <ExternalLink className="inline ml-1" size={12} />
                </a>
              </p>
            </div>
            <div>
              <label className="font-medium text-gray-700">Source Page:</label>
              <p className="text-gray-600 break-all mt-1" data-testid="text-modal-source-page">
                <a 
                  href={image.pageUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 hover:underline"
                >
                  {image.pageUrl}
                  <ExternalLink className="inline ml-1" size={12} />
                </a>
              </p>
            </div>
            <div>
              <label className="font-medium text-gray-700">Alt Text:</label>
              <p className="text-gray-600 mt-1" data-testid="text-modal-alt-text">
                {image.altText || (
                  <span className="italic text-gray-400">No alt text provided</span>
                )}
              </p>
            </div>
            <div>
              <label className="font-medium text-gray-700">File Info:</label>
              <p className="text-gray-600 mt-1" data-testid="text-modal-file-info">
                {image.filename || 'unknown'} • {(image.imageType || 'unknown').toUpperCase()}
                {image.dimensions && ` • ${image.dimensions}`}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
