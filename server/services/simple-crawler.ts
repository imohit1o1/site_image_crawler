import { storage } from '../storage';
import { type CrawlJob } from '@shared/schema';

interface CrawlProgress {
  status: string;
  progress: number;
  pagesProcessed: number;
  totalPagesFound: number;
  imagesFound: number;
  currentPage: string | null;
  error: string | null;
}

class SimpleCrawlerService {
  private activeJobs = new Map<string, boolean>();
  private progressListeners = new Map<string, (progress: CrawlProgress) => void>();

  async startCrawl(jobId: string): Promise<void> {
    if (this.activeJobs.get(jobId)) {
      return; // Already running
    }

    this.activeJobs.set(jobId, true);

    try {
      const job = await storage.getCrawlJob(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      await this.performSimpleCrawl(job);
    } catch (error) {
      console.error('Crawl error:', error);
      await storage.updateCrawlJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date()
      });
      this.emitProgress(jobId, {
        status: 'failed',
        progress: 0,
        pagesProcessed: 0,
        totalPagesFound: 0,
        imagesFound: 0,
        currentPage: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      this.activeJobs.set(jobId, false);
    }
  }

  private async performSimpleCrawl(job: CrawlJob): Promise<void> {
    await storage.updateCrawlJob(job.id, { status: 'running' });
    
    const visitedUrls = new Set<string>();
    const urlsToVisit: string[] = [job.targetUrl];
    let totalImages = 0;
    let pagesProcessed = 0;
    const baseUrl = new URL(job.targetUrl).origin;

    this.emitProgress(job.id, {
      status: 'running',
      progress: 0,
      pagesProcessed: 0,
      totalPagesFound: 1,
      imagesFound: 0,
      currentPage: job.targetUrl,
      error: null
    });

    try {
      while (urlsToVisit.length > 0 && pagesProcessed < job.maxPages) {
        const currentUrl = urlsToVisit.shift()!;
        
        if (visitedUrls.has(currentUrl)) {
          continue;
        }
        
        visitedUrls.add(currentUrl);
        
        this.emitProgress(job.id, {
          status: 'running',
          progress: Math.round((pagesProcessed / job.maxPages) * 100),
          pagesProcessed,
          totalPagesFound: visitedUrls.size + urlsToVisit.length,
          imagesFound: totalImages,
          currentPage: currentUrl,
          error: null
        });

        try {
          // Use fetch to get the HTML content
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), job.timeout);
          
          const response = await fetch(currentUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; Site Image Crawler/1.0)'
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);

          if (!response.ok) {
            console.warn(`Failed to fetch ${currentUrl}: ${response.status}`);
            continue;
          }

          const html = await response.text();
          
          // Extract images from this page
          const images = this.extractImages(html, currentUrl, job.includeCssBackgrounds);

          // Save images
          for (const imageData of images) {
            await storage.createCrawledImage({
              jobId: job.id,
              pageUrl: currentUrl,
              imageUrl: imageData.imageUrl,
              altText: imageData.altText,
              imgTagHtml: imageData.html,
              imageType: this.getImageType(imageData.imageUrl),
              filename: this.getFilename(imageData.imageUrl),
              dimensions: null
            });
          }

          totalImages += images.length;
          
          // Extract links for further crawling (only same domain)
          const newUrls = this.extractLinks(html, currentUrl, baseUrl);
          for (const url of newUrls) {
            if (!visitedUrls.has(url) && !urlsToVisit.includes(url)) {
              urlsToVisit.push(url);
            }
          }

          pagesProcessed++;

          // Update progress
          await storage.updateCrawlJob(job.id, {
            progress: Math.round((pagesProcessed / job.maxPages) * 100),
            pagesProcessed,
            totalPagesFound: visitedUrls.size + urlsToVisit.length,
            imagesFound: totalImages,
            currentPage: currentUrl
          });

        } catch (pageError) {
          console.warn(`Error processing page ${currentUrl}:`, pageError);
          continue;
        }
      }

      // Crawl completed
      await storage.updateCrawlJob(job.id, {
        status: 'completed',
        progress: 100,
        pagesProcessed,
        totalPagesFound: visitedUrls.size,
        imagesFound: totalImages,
        currentPage: null,
        completedAt: new Date()
      });

      this.emitProgress(job.id, {
        status: 'completed',
        progress: 100,
        pagesProcessed,
        totalPagesFound: visitedUrls.size,
        imagesFound: totalImages,
        currentPage: null,
        error: null
      });

    } catch (error) {
      throw error;
    }
  }

  private extractImages(html: string, baseUrl: string, includeCssBackgrounds: boolean): Array<{imageUrl: string, altText: string, html: string}> {
    const images: Array<{imageUrl: string, altText: string, html: string}> = [];
    
    // Extract img tags
    const imgRegex = /<img[^>]+>/gi;
    const imgMatches = html.match(imgRegex) || [];
    
    for (const imgTag of imgMatches) {
      const srcMatch = imgTag.match(/src\s*=\s*["']([^"']*)["']/i);
      if (srcMatch && srcMatch[1]) {
        const altMatch = imgTag.match(/alt\s*=\s*["']([^"']*)["']/i);
        const imageUrl = this.resolveUrl(srcMatch[1], baseUrl);
        
        images.push({
          imageUrl,
          altText: altMatch ? altMatch[1] : '',
          html: imgTag
        });
      }
    }

    // Extract picture source elements
    const pictureRegex = /<picture[^>]*>(.*?)<\/picture>/gis;
    const pictureMatches = html.match(pictureRegex) || [];
    
    for (const picture of pictureMatches) {
      const sourceRegex = /<source[^>]+>/gi;
      const sourceMatches = picture.match(sourceRegex) || [];
      
      for (const source of sourceMatches) {
        const srcsetMatch = source.match(/srcset\s*=\s*["']([^"']*)["']/i);
        if (srcsetMatch && srcsetMatch[1]) {
          const firstSrc = srcsetMatch[1].split(',')[0].trim().split(' ')[0];
          if (firstSrc) {
            const imageUrl = this.resolveUrl(firstSrc, baseUrl);
            images.push({
              imageUrl,
              altText: '',
              html: source
            });
          }
        }
      }
    }

    // Extract CSS background images if requested
    if (includeCssBackgrounds) {
      const cssUrlRegex = /background-image\s*:\s*url\s*\(\s*["']?([^"')]+)["']?\s*\)/g;
      let cssMatch;
      
      while ((cssMatch = cssUrlRegex.exec(html)) !== null) {
        const imageUrl = this.resolveUrl(cssMatch[1], baseUrl);
        images.push({
          imageUrl,
          altText: '',
          html: cssMatch[0]
        });
      }
    }

    return images;
  }

  private resolveUrl(url: string, baseUrl: string): string {
    try {
      return new URL(url, baseUrl).toString();
    } catch {
      return url;
    }
  }

  private getImageType(url: string): string | null {
    const extension = url.split('.').pop()?.toLowerCase().split('?')[0];
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'];
    return extension && imageExtensions.includes(extension) ? extension : null;
  }

  private extractLinks(html: string, currentUrl: string, baseUrl: string): string[] {
    const links: string[] = [];
    const linkRegex = /<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      try {
        const href = match[1];
        const absoluteUrl = this.resolveUrl(href, currentUrl);
        const url = new URL(absoluteUrl);
        
        // Only include same-domain links
        if (url.origin === baseUrl) {
          // Remove fragments and normalize
          url.hash = '';
          const cleanUrl = url.toString();
          
          // Skip common non-page resources
          const pathname = url.pathname.toLowerCase();
          const skipExtensions = ['.pdf', '.doc', '.docx', '.zip', '.exe', '.dmg', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.css', '.js'];
          
          if (!skipExtensions.some(ext => pathname.endsWith(ext))) {
            links.push(cleanUrl);
          }
        }
      } catch {
        // Invalid URL, skip
      }
    }

    return links;
  }

  private getFilename(url: string): string | null {
    try {
      const pathname = new URL(url).pathname;
      const filename = pathname.split('/').pop();
      return filename || null;
    } catch {
      return null;
    }
  }

  private emitProgress(jobId: string, progress: CrawlProgress): void {
    const listener = this.progressListeners.get(jobId);
    if (listener) {
      listener(progress);
    }
  }

  addProgressListener(jobId: string, listener: (progress: CrawlProgress) => void): void {
    this.progressListeners.set(jobId, listener);
  }

  removeProgressListener(jobId: string): void {
    this.progressListeners.delete(jobId);
  }
}

export const simpleCrawlerService = new SimpleCrawlerService();