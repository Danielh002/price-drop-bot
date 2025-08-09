import { PlatformConfig, PlatformScraper } from '../scraper.interface';
import { Product } from '../../entities/product.entity';
import { HttpService } from '@nestjs/axios';

export class AlkostoScraper implements PlatformScraper {
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
