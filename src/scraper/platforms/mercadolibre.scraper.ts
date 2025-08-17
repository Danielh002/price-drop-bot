import { PlatformScraper, PlatformConfig } from '../scraper.interface';
import { Product } from '../../entities/product.entity';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';
import { Logger } from '@nestjs/common';

export class MercadoLibreScraper implements PlatformScraper {
  private readonly logger = new Logger(MercadoLibreScraper.name);

  constructor(
    private readonly config: PlatformConfig,
    private readonly httpService: HttpService,
  ) {}

  private createSearchUrl(searchTerm: string): string {
    const query = searchTerm.trim().split(/\s+/).join(this.config.separator);
    return `${this.config.baseUrl}${query}`;
  }

  async scrape(
    searchTerm: string,
    $?: cheerio.CheerioAPI,
  ): Promise<Partial<Product>[]> {
    const products: Partial<Product>[] = [];
    const url = this.createSearchUrl(searchTerm);

    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, { headers, timeout: 10000 }),
      );
      const $local = cheerio.load(response.data);

      $local('.ui-search-layout__item').each((_, element) => {
        const name =
          $local(element).find('.poly-component__title').text().trim() || 'N/A';
        let price =
          $local(element)
            .find('.poly-price__current .andes-money-amount__fraction')
            .first()
            .text()
            .trim()
            .replace(/\./g, '') || 'N/A';
        const url =
          $local(element).find('.poly-component__title').attr('href') || 'N/A';
        const seller =
          $local(element)
            .find('.poly-component__seller')
            .text()
            .trim()
            .replace('Por ', '') || 'MercadoLibre';
        const image =
          $local(element).find('.poly-component__picture').attr('src') || 'N/A';
        if (name !== 'N/A' && price !== 'N/A' && url !== 'N/A') {
          products.push({
            name,
            price: parseFloat(price),
            url,
            store: this.config.store,
            country: this.config.country,
            currency: this.config.currency,
            searchTerm,
            seller,
            image: image !== 'N/A' ? image : undefined,
            brand: 'N/A',
            scrapedAt: new Date(),
          });
        }
      });

      return products;
    } catch (error) {
      this.logger.error(`Error scraping ${url}:`, error);
      throw new Error(`Failed to scrape MercadoLibre: ${error.message}`);
    }
  }
}
