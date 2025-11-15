import {
  StoreConfig,
  StoreScraper,
  ScrapedProduct,
} from '../scraper.interface';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nestjs/common';

export class ExitoScraper implements StoreScraper {
  private readonly logger = new Logger(ExitoScraper.name);
  private readonly baseUrl: string;
  private cache: { etag: string; response: any } | null = null;

  constructor(
    private readonly config: StoreConfig,
    private readonly httpService: HttpService,
  ) {
    this.baseUrl = config.baseUrl;
  }

  createSearchUrl(searchTerm: string): string {
    const queryTerm = searchTerm.split(' ').join('+');
    return `${this.baseUrl}api/graphql?operationName=SearchQuery&variables=${encodeURIComponent(
      JSON.stringify({
        first: 16,
        after: '0',
        sort: 'score_desc',
        term: searchTerm,
        selectedFacets: [
          { key: 'channel', value: '{"salesChannel":"1","regionId":""}' },
          { key: 'locale', value: 'es-CO' },
        ],
      }),
    )}`;
  }

  private parseProducts(data: any, searchTerm: string): ScrapedProduct[] {
    const products: ScrapedProduct[] = [];
    const items = data?.data?.search?.products.edges || [];

    for (const item of items) {
      const { node } = item;
      const name = node.name || 'N/A';
      const price = node.offers?.lowPrice || 'N/A';
      const url = node.slug ? `https://www.exito.com/${node.slug}/p` : 'N/A';
      const seller = node.sellers?.[0]?.sellerName || 'Exito';
      const brand = node.brand?.brandName || 'N/A';
      const image = node.items?.[0]?.images?.[0]?.imageUrl || 'N/A';

      products.push({
        name,
        price: Math.round(price * 100),
        url,
        store: this.config.store,
        country: this.config.country,
        currency: this.config.currency,
        searchTerm: searchTerm,
        seller,
        scrapedAt: new Date(),
        brand: brand !== 'N/A' ? brand : undefined,
        image: image !== 'N/A' ? image : undefined,
      });
    }

    this.logger.log(`Parsed ${products.length} products from Exito`);
    return products;
  }

  async scrape(searchTerm: string): Promise<ScrapedProduct[]> {
    const url = this.createSearchUrl(searchTerm);
    try {
      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Cache-Control': 'no-cache',
      };

      if (this.cache) {
        headers['If-None-Match'] = this.cache.etag;
      }

      const response = await firstValueFrom(
        this.httpService.get(url, { headers }),
      );

      if (response.status === 304 && this.cache) {
        this.logger.debug('Using cached response due to 304 Not Modified');
        return this.parseProducts(this.cache.response, searchTerm);
      }

      if (response.status !== 200) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const etag = response.headers['etag'];
      if (etag) {
        this.cache = { etag, response: response.data };
      }

      return this.parseProducts(response.data, searchTerm);
    } catch (error) {
      this.logger.error(`Error scraping Exito: ${error.message}`);
      throw error;
    }
  }
}
