import { Product } from '../entities/product.entity';

export interface PlatformConfig {
  baseUrl: string;
  separator: string;
  country: string;
  currency: string;
  store: string;
}

export interface PlatformScraper {
  scrape(
    searchTerm: string,
    $?: cheerio.CheerioAPI,
  ): Promise<Partial<Product>[]>;
}
