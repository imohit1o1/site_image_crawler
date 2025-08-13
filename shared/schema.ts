import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const crawlJobs = pgTable("crawl_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  targetUrl: text("target_url").notNull(),
  maxPages: integer("max_pages").notNull().default(100),
  timeout: integer("timeout").notNull().default(60000),
  includeCssBackgrounds: boolean("include_css_backgrounds").notNull().default(true),
  status: text("status").notNull().default("pending"), // pending, running, completed, failed
  progress: integer("progress").notNull().default(0),
  pagesProcessed: integer("pages_processed").notNull().default(0),
  totalPagesFound: integer("total_pages_found").notNull().default(0),
  imagesFound: integer("images_found").notNull().default(0),
  currentPage: text("current_page"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  completedAt: timestamp("completed_at"),
});

export const crawledImages = pgTable("crawled_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => crawlJobs.id),
  pageUrl: text("page_url").notNull(),
  imageUrl: text("image_url").notNull(),
  altText: text("alt_text"),
  imgTagHtml: text("img_tag_html"),
  imageType: text("image_type"),
  filename: text("filename"),
  dimensions: text("dimensions"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertCrawlJobSchema = createInsertSchema(crawlJobs).omit({
  id: true,
  status: true,
  progress: true,
  pagesProcessed: true,
  totalPagesFound: true,
  imagesFound: true,
  currentPage: true,
  error: true,
  createdAt: true,
  completedAt: true,
});

export const insertCrawledImageSchema = createInsertSchema(crawledImages).omit({
  id: true,
  createdAt: true,
});

export type InsertCrawlJob = z.infer<typeof insertCrawlJobSchema>;
export type CrawlJob = typeof crawlJobs.$inferSelect;
export type InsertCrawledImage = z.infer<typeof insertCrawledImageSchema>;
export type CrawledImage = typeof crawledImages.$inferSelect;

// Keep existing user schema for compatibility
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
