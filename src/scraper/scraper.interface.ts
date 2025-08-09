import * as cheerio from 'cheerio';
import { Product } from '../entities/product.entity';

export interface PlatformScraper {
  scrape($: cheerio.CheerioAPI, searchTerm: string): Partial<Product>[];
}