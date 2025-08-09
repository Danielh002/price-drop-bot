import { PlatformConfig, PlatformScraper } from '../scraper.interface';
import { Product } from '../../entities/product.entity';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nestjs/common';

export class ExitoScraper implements PlatformScraper {
  private readonly logger = new Logger(ExitoScraper.name);

  private readonly graphqlUrl =
    'https://www.exito.com/api/graphql?operationName=QuerySearch';

  constructor(
    private readonly config: PlatformConfig,
    private readonly httpService: HttpService,
  ) {}

  async scrape(
    searchTerm: string,
    $?: cheerio.CheerioAPI,
  ): Promise<Partial<Product>[]> {
    const products: Partial<Product>[] = [];

    const query = {
      operationName: 'QuerySearch',
      variables: {
        first: 16,
        after: '0',
        sort: 'score_desc',
        term: searchTerm,
        selectedFacets: [
          { key: 'channel', value: '{"salesChannel":"1","regionId":""}' },
          { key: 'locale', value: 'es-CO' },
        ],
      },
    };

    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(this.graphqlUrl, query, {
          headers,
          timeout: 10000,
        }),
      );

      const edges = response.data?.data?.search?.products.edges || [];
      const items = edges.map((edge: any) => edge.node);

      for (const item of items) {
        const name = item.name || 'N/A';
        const price = item.offers?.lowPrice || 'N/A';
        const url = item.slug ? `https://www.exito.com/${item.slug}/p` : 'N/A';
        const seller = item.sellers?.[0]?.sellerName || 'Exito';
        const brand = item.brand?.brandName || 'N/A';
        const image = item.items?.[0]?.images?.[0]?.imageUrl || 'N/A';

        if (name !== 'N/A' && price !== 'N/A' && url !== 'N/A') {
          products.push({
            name,
            price: parseFloat(price.toString()),
            url,
            store: this.config.store,
            country: this.config.country,
            currency: this.config.currency,
            searchTerm,
            seller,
            scrapedAt: new Date(),
            brand: brand !== 'N/A' ? brand : undefined,
            image: image !== 'N/A' ? image : undefined,
          });
        }
      }

      return products;
    } catch (error) {
      this.logger.error(`Error scraping ${this.graphqlUrl}:`, error);
      throw new Error(`Failed to scrape Exito: ${error.message}`);
    }
  }
}
