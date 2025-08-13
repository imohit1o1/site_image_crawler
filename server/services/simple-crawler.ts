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
    let failedPages = 0;
    const baseUrl = new URL(job.targetUrl).origin;
    const maxRetries = 2; // Maximum retry attempts for failed pages

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

        let retryCount = 0;
        let pageSuccess = false;

        while (retryCount <= maxRetries && !pageSuccess) {
          try {
            // Use fetch to get the HTML content
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
              controller.abort();
            }, job.timeout || 60000);
            
            try {
              const response = await fetch(currentUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (compatible; Site Image Crawler/1.0)'
                },
                signal: controller.signal
              });
              
              clearTimeout(timeoutId);

              if (!response.ok) {
                console.warn(`Failed to fetch ${currentUrl}: ${response.status}`);
                if (retryCount < maxRetries) {
                  retryCount++;
                  console.log(`Retrying ${currentUrl} (attempt ${retryCount}/${maxRetries + 1})`);
                  await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
                  continue;
                }
                break;
              }

              const html = await response.text();
              
              // Extract images from this page
              const images = this.extractImages(html, currentUrl, job.includeCssBackgrounds);

              // Save images
              for (const imageData of images) {
                console.log('Crawler: Processing image:', {
                  originalUrl: imageData.imageUrl,
                  pageUrl: currentUrl,
                  hasAmp: imageData.imageUrl.includes('&amp;'),
                  isNextJs: imageData.imageUrl.includes('/_next/image'),
                  htmlContainsAmp: imageData.html.includes('&amp;'),
                  htmlSample: imageData.html.substring(0, 100)
                });
                
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
              pageSuccess = true;

              // Update progress
              await storage.updateCrawlJob(job.id, {
                progress: Math.round((pagesProcessed / job.maxPages) * 100),
                pagesProcessed,
                totalPagesFound: visitedUrls.size + urlsToVisit.length,
                imagesFound: totalImages,
                currentPage: currentUrl
              });

            } catch (fetchError) {
              clearTimeout(timeoutId);
              
              if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                console.warn(`Request timeout for ${currentUrl} after ${job.timeout || 60000}ms`);
                if (retryCount < maxRetries) {
                  retryCount++;
                  console.log(`Retrying ${currentUrl} after timeout (attempt ${retryCount}/${maxRetries + 1})`);
                  await new Promise(resolve => setTimeout(resolve, 2000 * retryCount)); // Longer delay for timeouts
                  continue;
                }
                break;
              }
              
              // Re-throw other fetch errors to be caught by the outer catch
              throw fetchError;
            }

          } catch (pageError) {
            console.warn(`Error processing page ${currentUrl} (attempt ${retryCount + 1}/${maxRetries + 1}):`, pageError);
            
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`Retrying ${currentUrl} (attempt ${retryCount}/${maxRetries + 1})`);
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
              continue;
            } else {
              failedPages++;
              console.warn(`Failed to process ${currentUrl} after ${maxRetries + 1} attempts`);
              break;
            }
          }
        }

        // If we still haven't succeeded after all retries, log it and continue
        if (!pageSuccess) {
          console.warn(`Skipping ${currentUrl} after all retry attempts failed`);
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

      console.log(`Crawl completed for job ${job.id}: ${pagesProcessed} pages processed, ${totalImages} images found, ${failedPages} pages failed`);

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
        let imageUrl = this.resolveUrl(srcMatch[1], baseUrl);
        
        // Fix Next.js image URLs by ensuring width parameter is present
        imageUrl = this.fixNextJsImageUrl(imageUrl);
        
        // Decode HTML entities
        const beforeDecode = imageUrl;
        imageUrl = this.decodeHtmlEntities(imageUrl);
        if (beforeDecode !== imageUrl) {
          console.log('Crawler: HTML entities decoded:', {
            before: beforeDecode,
            after: imageUrl
          });
        }
        
        images.push({
          imageUrl,
          altText: altMatch ? this.decodeHtmlEntities(altMatch[1]) : '',
          html: imgTag
        });
      }
    }

    // Extract picture source elements
    const pictureRegex = /<picture[^>]*>([\s\S]*?)<\/picture>/gi;
    const pictureMatches = html.match(pictureRegex) || [];
    
    for (const picture of pictureMatches) {
      const sourceRegex = /<source[^>]+>/gi;
      const sourceMatches = picture.match(sourceRegex) || [];
      
      for (const source of sourceMatches) {
        const srcsetMatch = source.match(/srcset\s*=\s*["']([^"']*)["']/i);
        if (srcsetMatch && srcsetMatch[1]) {
          const firstSrc = srcsetMatch[1].split(',')[0].trim().split(' ')[0];
          if (firstSrc) {
            let imageUrl = this.resolveUrl(firstSrc, baseUrl);
            
            // Fix Next.js image URLs by ensuring width parameter is present
            imageUrl = this.fixNextJsImageUrl(imageUrl);
            
            // Decode HTML entities
            imageUrl = this.decodeHtmlEntities(imageUrl);
            
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
        let imageUrl = this.resolveUrl(cssMatch[1], baseUrl);
        
        // Fix Next.js image URLs by ensuring width parameter is present
        imageUrl = this.fixNextJsImageUrl(imageUrl);
        
        // Decode HTML entities
        imageUrl = this.decodeHtmlEntities(imageUrl);
        
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

  private fixNextJsImageUrl(url: string): string {
    // Check if this is a Next.js image URL
    if (url.includes('/_next/image') && url.includes('url=')) {
      // Ensure width parameter is present
      if (!url.includes('w=') && !url.includes('width=')) {
        // Add default width parameter
        const separator = url.includes('?') ? '&' : '?';
        url += `${separator}w=640`;
      }
      
      // Ensure quality parameter is present
      if (!url.includes('q=')) {
        url += '&q=75';
      }
    }
    return url;
  }

  private decodeHtmlEntities(text: string): string {
    // Simple HTML entity decoding
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }
}

export const simpleCrawlerService = new SimpleCrawlerService();