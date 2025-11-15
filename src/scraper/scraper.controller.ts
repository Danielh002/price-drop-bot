import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  Logger,
  Param,
  Query,
} from '@nestjs/common';
import { ScraperService, Source } from './scraper.service';
import { Product } from 'src/entities/product.entity';

@Controller('scraper')
export class ScraperController {
  private readonly logger = new Logger(ScraperController.name);
  private readonly defaultStores: Source[] = [
    Source.MERCADO_LIBRE,
    Source.FALABELLA,
    Source.EXITO,
    Source.ALKOSTO,
  ];

  constructor(private readonly scraperService: ScraperService) {}

  @Get('search')
  async search(
    @Query('query') query: string,
    @Query('stores') stores?: string | string[],
  ) {
    const normalizedTerm = this.normalizeSearchTerm(query);
    const selectedStores = this.parseStoresParam(stores);

    const allProducts: Product[] = [];

    for (const store of selectedStores) {
      try {
        const products = await this.scraperService.scrape(
          normalizedTerm,
          store,
        );
        allProducts.push(...products);
      } catch (error) {
        this.logger.log(`Failed to scrape ${store}: ${error.message}`);
      }
    }

    this.scraperService.writeProductsToCsv(normalizedTerm, allProducts);

    const cheapestProducts =
      await this.scraperService.getCheapestProducts(normalizedTerm);

    return { data: allProducts, cheapest: cheapestProducts };
  }

  @Get('stores/:store/search')
  async validate(
    @Param('store') store: string,
    @Query('query') query: string,
  ) {
    const normalizedTerm = this.normalizeSearchTerm(query);
    const normalizedStore = this.normalizeStore(store);

    return this.executeSingleStoreScrape(normalizedTerm, normalizedStore, {
      raw: false,
      context: 'Validation',
    });
  }

  @Get('stores/:store/raw-search')
  async raw(
    @Param('store') store: string,
    @Query('query') query: string,
  ) {
    const normalizedTerm = this.normalizeSearchTerm(query);
    const normalizedStore = this.normalizeStore(store);

    return this.executeSingleStoreScrape(normalizedTerm, normalizedStore, {
      raw: true,
      context: 'Raw scrape',
    });
  }

  private normalizeSearchTerm(term?: string): string {
    const normalized = term?.trim();
    if (!normalized) {
      throw new BadRequestException('Search term is required');
    }
    return normalized;
  }

  private parseStoresParam(
    stores?: string | string[],
    defaults: Source[] = this.defaultStores,
  ): Source[] {
    if (!stores) {
      return defaults;
    }

    const parsedStores = (Array.isArray(stores) ? stores : stores.split(','))
      .map((store) => store.trim().toLowerCase())
      .filter(Boolean);

    if (!parsedStores.length) {
      throw new BadRequestException('At least one store must be provided');
    }

    const uniqueStores = [...new Set(parsedStores)];
    const invalidStores = uniqueStores.filter(
      (store) => !Object.values(Source).includes(store as Source),
    );

    if (invalidStores.length) {
      throw new BadRequestException(
        `Unsupported stores: ${invalidStores.join(', ')}`,
      );
    }

    return uniqueStores as Source[];
  }

  private normalizeStore(store?: string): Source {
    const normalized = store?.trim().toLowerCase();
    if (!normalized) {
      throw new BadRequestException('Store is required');
    }

    if (!Object.values(Source).includes(normalized as Source)) {
      throw new BadRequestException(`Unsupported store: ${normalized}`);
    }

    return normalized as Source;
  }

  private async executeSingleStoreScrape(
    searchTerm: string,
    store: Source,
    options: { raw: boolean; context: string },
  ) {
    try {
      const data = options.raw
        ? await this.scraperService.scrapeRaw(searchTerm, store)
        : await this.scraperService.scrape(searchTerm, store);

      return {
        store,
        data,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        this.logger.warn(
          `${options.context} failed for ${store}: ${error.message}`,
        );
        return {
          store,
          data: [],
          error: {
            status: error.getStatus(),
            message: error.message,
          },
        };
      }
      throw error;
    }
  }
}
