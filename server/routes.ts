import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { crawlerService } from "./services/crawler";
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
      crawlerService.startCrawl(job.id).catch(console.error);
      
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
      
      res.json(images);
    } catch (error) {
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

    crawlerService.on('progress', progressHandler);

    req.on('close', () => {
      crawlerService.removeListener('progress', progressHandler);
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
