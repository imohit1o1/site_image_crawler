import puppeteer from 'puppeteer';
import { storage } from '../storage';
import { type CrawlJob } from '@shared/schema';
import { EventEmitter } from 'events';

export class CrawlerService extends EventEmitter {
  private activeCrawls: Map<string, boolean> = new Map();

  async startCrawl(jobId: string): Promise<void> {
    if (this.activeCrawls.get(jobId)) {
      throw new Error('Crawl already in progress');
    }

    const job = await storage.getCrawlJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    this.activeCrawls.set(jobId, true);
    
    // Update job status to running
    await storage.updateCrawlJob(jobId, { status: 'running' });
    this.emit('progress', jobId, { status: 'running' });

    try {
      await this.performCrawl(job);
      await storage.updateCrawlJob(jobId, { 
        status: 'completed', 
        completedAt: new Date(),
        progress: 100 
      });
      this.emit('progress', jobId, { status: 'completed', progress: 100 });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await storage.updateCrawlJob(jobId, { 
        status: 'failed', 
        error: errorMessage,
        completedAt: new Date() 
      });
      this.emit('progress', jobId, { status: 'failed', error: errorMessage });
    } finally {
      this.activeCrawls.delete(jobId);
    }
  }

  private async performCrawl(job: CrawlJob): Promise<void> {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(job.timeout);

    try {
      const origin = new URL(job.targetUrl).origin;
      const toVisit = [job.targetUrl];
      const visited = new Set<string>();
      const startTime = Date.now();

      await storage.updateCrawlJob(job.id, { totalPagesFound: 1 });
      this.emit('progress', job.id, { totalPagesFound: 1 });

      while (toVisit.length > 0 && visited.size < job.maxPages) {
        const url = toVisit.shift()!;
        if (visited.has(url)) continue;
        
        visited.add(url);
        
        try {
          await page.goto(url, { waitUntil: 'networkidle2' });
          
          // Update progress
          const progress = Math.floor((visited.size / Math.min(job.maxPages, toVisit.length + visited.size)) * 100);
          const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
          
          await storage.updateCrawlJob(job.id, {
            currentPage: url,
            pagesProcessed: visited.size,
            progress
          });
          
          this.emit('progress', job.id, {
            currentPage: url,
            pagesProcessed: visited.size,
            progress,
            elapsedTime: `${elapsedSeconds}s`
          });

          // Extract links for BFS
          const links = await page.evaluate(() => 
            Array.from(document.querySelectorAll('a[href]')).map((a) => (a as HTMLAnchorElement).href)
          );

          for (const link of links) {
            try {
              const linkUrl = new URL(link, url);
              if (linkUrl.origin === origin) {
                const cleanUrl = linkUrl.toString().split('#')[0];
                if (!visited.has(cleanUrl) && !toVisit.includes(cleanUrl)) {
                  toVisit.push(cleanUrl);
                }
              }
            } catch (e) {
              // Invalid URL, skip
            }
          }

          // Update total pages found
          const totalPagesFound = visited.size + toVisit.length;
          await storage.updateCrawlJob(job.id, { totalPagesFound });
          this.emit('progress', job.id, { totalPagesFound });

          // Extract images
          const images = await this.extractImagesFromPage(page, job.includeCssBackgrounds);
          
          for (const imageData of images) {
            const fullImageUrl = this.normalizeUrl(url, imageData.image_url);
            if (!fullImageUrl) continue;

            const filename = this.extractFilename(fullImageUrl);
            const imageType = this.extractImageType(fullImageUrl);

            await storage.createCrawledImage({
              jobId: job.id,
              pageUrl: url,
              imageUrl: fullImageUrl,
              altText: imageData.alt_text || null,
              imgTagHtml: imageData.html?.replace(/\n|\r/g, ' ').slice(0, 400) || null,
              filename,
              imageType,
              dimensions: null, // Could be enhanced to get actual dimensions
            });
          }

          // Update images found count
          const totalImages = await storage.getCrawledImagesByJobId(job.id);
          await storage.updateCrawlJob(job.id, { imagesFound: totalImages.length });
          this.emit('progress', job.id, { imagesFound: totalImages.length });

        } catch (pageError) {
          console.warn('Failed to load page:', url, pageError);
          continue;
        }
      }

    } finally {
      await browser.close();
    }
  }

  private async extractImagesFromPage(page: any, includeCssBackgrounds: boolean) {
    return await page.evaluate((includeCss: boolean) => {
      const imgs: Array<{image_url: string, alt_text: string, html: string}> = [];
      
      // <img> elements
      document.querySelectorAll('img').forEach((img: HTMLImageElement) => {
        const src = img.currentSrc || img.getAttribute('src') || '';
        if (src) {
          imgs.push({
            image_url: src,
            alt_text: img.getAttribute('alt') || '',
            html: img.outerHTML || ''
          });
        }
      });
      
      // <picture> <source srcset=...>
      document.querySelectorAll('picture source').forEach((source) => {
        const sourceEl = source as HTMLSourceElement;
        const srcset = sourceEl.getAttribute('srcset') || '';
        const firstSrc = srcset.split(',').map(s => s.trim()).filter(Boolean)[0] || '';
        if (firstSrc) {
          imgs.push({
            image_url: firstSrc.split(' ')[0], // Remove descriptor
            alt_text: '',
            html: sourceEl.outerHTML
          });
        }
      });
      
      if (includeCss) {
        // Inline style background-image
        document.querySelectorAll('[style]').forEach((el) => {
          const element = el as HTMLElement;
          const style = element.getAttribute('style') || '';
          const match = style.match(/background-image:\s*url\(['\"]?(.*?)['\"]?\)/i);
          if (match && match[1]) {
            imgs.push({
              image_url: match[1],
              alt_text: element.getAttribute('aria-label') || '',
              html: style
            });
          }
        });
      }
      
      return imgs.filter(i => i.image_url && i.image_url.trim());
    }, includeCssBackgrounds);
  }

  private normalizeUrl(base: string, url: string): string | null {
    try {
      return new URL(url, base).toString();
    } catch (e) {
      return null;
    }
  }

  private extractFilename(url: string): string {
    try {
      const pathname = new URL(url).pathname;
      const filename = pathname.split('/').pop() || '';
      return filename || 'unknown';
    } catch (e) {
      return 'unknown';
    }
  }

  private extractImageType(url: string): string {
    const filename = this.extractFilename(url);
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext || 'unknown';
  }

  isActive(jobId: string): boolean {
    return this.activeCrawls.get(jobId) || false;
  }
}

export const crawlerService = new CrawlerService();
