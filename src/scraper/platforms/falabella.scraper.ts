import { PlatformConfig, PlatformScraper } from '../scraper.interface';
import { HttpService } from '@nestjs/axios';
import type { Product } from '../../entities/product.entity';

export class FalabellaScraper implements PlatformScraper {
  constructor(
    private readonly config: PlatformConfig,
    private readonly httpService: HttpService,
  ) {}

  async scrape(
    searchTerm: string,
    $?: cheerio.CheerioAPI,
  ): Promise<Partial<Product>[]> {
    const products: Partial<Product>[] = [];
    return products;
  }
}
