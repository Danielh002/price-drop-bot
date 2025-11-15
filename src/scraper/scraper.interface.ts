export interface PlatformScraper {
  scrape(searchTerm: string, $?: cheerio.CheerioAPI): Promise<ScrapedProduct[]>;
}

export interface FilterConfig {
  priceQuantile: number; // Fallback for small result sets
}

export interface PlatformConfig {
  baseUrl: string;
  separator: string;
  country: string;
  currency: string;
  store: string;
  filterConfig?: FilterConfig;
}

export interface ScrapedProduct {
  name: string;
  price: number;
  url: string;
  image?: string;
  seller?: string;
  store: string;
  country?: string;
  currency: string;
  searchTerm?: string;
  brand?: string;
  sku?: string;
  ean?: string;
  category?: string;
  scrapedAt?: Date;
}
