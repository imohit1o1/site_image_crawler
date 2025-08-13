export interface CrawlFormData {
  targetUrl: string;
  maxPages: number;
  timeout: number;
  includeCssBackgrounds: boolean;
}

export interface CrawlProgress {
  status: string;
  progress: number;
  pagesProcessed: number;
  totalPagesFound: number;
  imagesFound: number;
  currentPage?: string;
  elapsedTime?: string;
  error?: string;
}

export interface ImageFilter {
  search: string;
  altTextFilter: 'all' | 'with-alt' | 'without-alt';
  imageTypeFilter: string;
}
