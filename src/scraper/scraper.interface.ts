import { Product } from '../entities/product.entity';
export interface PlatformScraper {
  scrape(
    searchTerm: string,
    $?: cheerio.CheerioAPI,
  ): Promise<Partial<Product>[]>;
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
