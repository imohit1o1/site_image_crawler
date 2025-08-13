import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { simpleCrawlerService } from "./services/simple-crawler";
import { insertCrawlJobSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Create crawl job
  app.post("/api/crawl", async (req, res) => {
    try {
      const jobData = insertCrawlJobSchema.parse(req.body);
      const job = await storage.createCrawlJob(jobData);
      
      // Start crawling asynchronously
      simpleCrawlerService.startCrawl(job.id).catch(console.error);
      
      res.json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid input", details: error.errors });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // Get all crawl jobs
  app.get("/api/crawl", async (req, res) => {
    try {
      const jobs = await storage.getCrawlJobs();
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get specific crawl job
  app.get("/api/crawl/:id", async (req, res) => {
    try {
      const job = await storage.getCrawlJob(req.params.id);
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get images for a crawl job
  app.get("/api/crawl/:id/images", async (req, res) => {
    try {
      const images = await storage.getCrawledImagesByJobId(req.params.id);
      res.json(images);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all images with filtering and search
  app.get("/api/images", async (req, res) => {
    try {
      let images = await storage.getAllCrawledImages();
      
      console.log('API /api/images: Retrieved images from storage:', {
        totalCount: images.length,
        sampleImages: images.slice(0, 3).map(img => ({
          id: img.id,
          imageUrl: img.imageUrl,
          pageUrl: img.pageUrl,
          altText: img.altText
        }))
      });
      
      const { search, altTextFilter, imageTypeFilter } = req.query;
      
      // Apply search filter
      if (search && typeof search === 'string') {
        const searchLower = search.toLowerCase();
        images = images.filter(img => 
          img.imageUrl.toLowerCase().includes(searchLower) ||
          img.pageUrl.toLowerCase().includes(searchLower) ||
          (img.altText && img.altText.toLowerCase().includes(searchLower)) ||
          (img.filename && img.filename.toLowerCase().includes(searchLower))
        );
      }
      
      // Apply alt text filter
      if (altTextFilter === 'with-alt') {
        images = images.filter(img => img.altText && img.altText.trim() !== '');
      } else if (altTextFilter === 'without-alt') {
        images = images.filter(img => !img.altText || img.altText.trim() === '');
      }
      
      // Apply image type filter
      if (imageTypeFilter && typeof imageTypeFilter === 'string' && imageTypeFilter !== 'all') {
        images = images.filter(img => img.imageType === imageTypeFilter);
      }
      
      console.log('API /api/images: Returning filtered images:', {
        filteredCount: images.length,
        filters: { search, altTextFilter, imageTypeFilter }
      });
      
      res.json(images);
    } catch (error) {
      console.error('API /api/images: Error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Download CSV
  app.get("/api/images/csv", async (req, res) => {
    try {
      const images = await storage.getAllCrawledImages();
      
      // Create CSV content
      const headers = ['page_url', 'image_url', 'alt_text', 'img_tag_html', 'filename', 'image_type'];
      const csvRows = [headers.join(',')];
      
      for (const image of images) {
        const row = [
          `"${image.pageUrl}"`,
          `"${image.imageUrl}"`,
          `"${image.altText || ''}"`,
          `"${(image.imgTagHtml || '').replace(/"/g, '""')}"`,
          `"${image.filename || ''}"`,
          `"${image.imageType || ''}"`
        ];
        csvRows.push(row.join(','));
      }
      
      const csvContent = csvRows.join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="crawled_images.csv"');
      res.send(csvContent);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Fix existing image URLs (remove HTML entities and fix Next.js URLs)
  app.post("/api/fix-image-urls", async (req, res) => {
    try {
      console.log('API: Starting to fix existing image URLs...');
      
      const images = await storage.getAllCrawledImages();
      console.log(`API: Found ${images.length} images to process`);
      
      let fixedCount = 0;
      
      for (const image of images) {
        let needsUpdate = false;
        let fixedImageUrl = image.imageUrl;
        let fixedAltText = image.altText;
        
        console.log(`API: Processing image ${image.id}:`, {
          originalUrl: image.imageUrl,
          hasAmp: image.imageUrl.includes('&amp;')
        });
        
        // Fix HTML entities in image URL
        if (fixedImageUrl.includes('&amp;')) {
          const beforeFix = fixedImageUrl;
          fixedImageUrl = fixedImageUrl.replace(/&amp;/g, '&');
          console.log(`API: Fixed HTML entities in URL:`, {
            before: beforeFix,
            after: fixedImageUrl
          });
          needsUpdate = true;
        }
        
        // Fix Next.js image URLs
        if (fixedImageUrl.includes('/_next/image') && fixedImageUrl.includes('url=')) {
          if (!fixedImageUrl.includes('w=') && !fixedImageUrl.includes('width=')) {
            const separator = fixedImageUrl.includes('?') ? '&' : '?';
            fixedImageUrl += `${separator}w=640`;
            console.log(`API: Added width parameter to Next.js URL:`, fixedImageUrl);
            needsUpdate = true;
          }
          
          if (!fixedImageUrl.includes('q=')) {
            fixedImageUrl += '&q=75';
            console.log(`API: Added quality parameter to Next.js URL:`, fixedImageUrl);
            needsUpdate = true;
          }
        }
        
        // Fix HTML entities in alt text
        if (fixedAltText && fixedAltText.includes('&amp;')) {
          const beforeFix = fixedAltText;
          fixedAltText = fixedAltText.replace(/&amp;/g, '&');
          console.log(`API: Fixed HTML entities in alt text:`, {
            before: beforeFix,
            after: fixedAltText
          });
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          console.log(`API: Updating image ${image.id} with fixed data`);
          const result = await storage.updateCrawledImage(image.id, {
            imageUrl: fixedImageUrl,
            altText: fixedAltText
          });
          
          if (result) {
            fixedCount++;
            console.log(`API: Successfully updated image ${image.id}:`, {
              oldUrl: image.imageUrl,
              newUrl: result.imageUrl
            });
          } else {
            console.error(`API: Failed to update image ${image.id}`);
          }
        } else {
          console.log(`API: Image ${image.id} doesn't need fixing`);
        }
      }
      
      console.log(`API: Fix operation completed. Fixed ${fixedCount} image URLs`);
      res.json({ 
        message: `Fixed ${fixedCount} image URLs`,
        fixedCount 
      });
    } catch (error) {
      console.error('API /api/fix-image-urls: Error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Server-Sent Events for real-time progress
  app.get("/api/crawl/:id/progress", (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const jobId = req.params.id;
    
    const sendProgress = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial status
    storage.getCrawlJob(jobId).then(job => {
      if (job) {
        sendProgress({
          status: job.status,
          progress: job.progress,
          pagesProcessed: job.pagesProcessed,
          totalPagesFound: job.totalPagesFound,
          imagesFound: job.imagesFound,
          currentPage: job.currentPage,
          error: job.error
        });
      }
    });

    const progressHandler = (progressJobId: string, data: any) => {
      if (progressJobId === jobId) {
        sendProgress(data);
      }
    };

    simpleCrawlerService.addProgressListener(jobId, sendProgress);

    req.on('close', () => {
      simpleCrawlerService.removeProgressListener(jobId);
      res.end();
    });
  });

  // Clear all results
  app.delete("/api/results", async (req, res) => {
    try {
      const jobs = await storage.getCrawlJobs();
      for (const job of jobs) {
        await storage.deleteCrawledImagesByJobId(job.id);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return httpServer;
}
