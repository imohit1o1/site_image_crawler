import { type User, type InsertUser, type CrawlJob, type InsertCrawlJob, type CrawledImage, type InsertCrawledImage } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods (existing)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Crawl job methods
  createCrawlJob(job: InsertCrawlJob): Promise<CrawlJob>;
  getCrawlJob(id: string): Promise<CrawlJob | undefined>;
  updateCrawlJob(id: string, updates: Partial<CrawlJob>): Promise<CrawlJob | undefined>;
  getCrawlJobs(): Promise<CrawlJob[]>;
  
  // Crawled image methods
  createCrawledImage(image: InsertCrawledImage): Promise<CrawledImage>;
  getCrawledImagesByJobId(jobId: string): Promise<CrawledImage[]>;
  getAllCrawledImages(): Promise<CrawledImage[]>;
  deleteCrawledImagesByJobId(jobId: string): Promise<void>;
  updateCrawledImage(id: string, updates: Partial<CrawledImage>): Promise<CrawledImage | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private crawlJobs: Map<string, CrawlJob>;
  private crawledImages: Map<string, CrawledImage>;

  constructor() {
    this.users = new Map();
    this.crawlJobs = new Map();
    this.crawledImages = new Map();
  }

  // User methods (existing)
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Crawl job methods
  async createCrawlJob(insertJob: InsertCrawlJob): Promise<CrawlJob> {
    const id = randomUUID();
    const job: CrawlJob = {
      id,
      targetUrl: insertJob.targetUrl,
      maxPages: insertJob.maxPages || 100,
      timeout: insertJob.timeout || 60000,
      includeCssBackgrounds: insertJob.includeCssBackgrounds || true,
      status: "pending",
      progress: 0,
      pagesProcessed: 0,
      totalPagesFound: 0,
      imagesFound: 0,
      currentPage: null,
      error: null,
      createdAt: new Date(),
      completedAt: null,
    };
    this.crawlJobs.set(id, job);
    return job;
  }

  async getCrawlJob(id: string): Promise<CrawlJob | undefined> {
    return this.crawlJobs.get(id);
  }

  async updateCrawlJob(id: string, updates: Partial<CrawlJob>): Promise<CrawlJob | undefined> {
    const job = this.crawlJobs.get(id);
    if (!job) return undefined;
    
    const updatedJob = { ...job, ...updates };
    this.crawlJobs.set(id, updatedJob);
    return updatedJob;
  }

  async getCrawlJobs(): Promise<CrawlJob[]> {
    return Array.from(this.crawlJobs.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  // Crawled image methods
  async createCrawledImage(insertImage: InsertCrawledImage): Promise<CrawledImage> {
    const id = randomUUID();
    const image: CrawledImage = {
      id,
      jobId: insertImage.jobId,
      pageUrl: insertImage.pageUrl,
      imageUrl: insertImage.imageUrl,
      altText: insertImage.altText || null,
      imgTagHtml: insertImage.imgTagHtml || null,
      imageType: insertImage.imageType || null,
      filename: insertImage.filename || null,
      dimensions: insertImage.dimensions || null,
      createdAt: new Date(),
    };
    this.crawledImages.set(id, image);
    return image;
  }

  async getCrawledImagesByJobId(jobId: string): Promise<CrawledImage[]> {
    return Array.from(this.crawledImages.values()).filter(
      (image) => image.jobId === jobId
    );
  }

  async getAllCrawledImages(): Promise<CrawledImage[]> {
    return Array.from(this.crawledImages.values());
  }

  async deleteCrawledImagesByJobId(jobId: string): Promise<void> {
    const entriesToDelete: string[] = [];
    this.crawledImages.forEach((image, id) => {
      if (image.jobId === jobId) {
        entriesToDelete.push(id);
      }
    });
    entriesToDelete.forEach(id => this.crawledImages.delete(id));
  }

  async updateCrawledImage(id: string, updates: Partial<CrawledImage>): Promise<CrawledImage | undefined> {
    const image = this.crawledImages.get(id);
    if (!image) return undefined;
    
    const updatedImage = { ...image, ...updates };
    this.crawledImages.set(id, updatedImage);
    return updatedImage;
  }
}

export const storage = new MemStorage();
