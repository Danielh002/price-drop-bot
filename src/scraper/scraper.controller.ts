import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  Logger,
  Query,
} from '@nestjs/common';
import { ScraperService, Source } from './scraper.service';
import { Product } from 'src/entities/product.entity';

@Controller('scraper')
export class ScraperController {
  private readonly logger = new Logger(ScraperController.name);
  private readonly defaultPlatforms: Source[] = [
    Source.MERCADO_LIBRE,
    Source.FALABELLA,
    Source.EXITO,
    Source.ALKOSTO,
  ];

  constructor(private readonly scraperService: ScraperService) {}

  @Get('search')
  async search(
    @Query('term') searchTerm: string,
    @Query('sources') sources?: string | string[],
  ) {
    const normalizedTerm = this.normalizeSearchTerm(searchTerm);
    const platforms = this.parseSourcesParam(sources);

    const allProducts: Product[] = [];

    for (const platform of platforms) {
      try {
        const products = await this.scraperService.scrape(
          normalizedTerm,
          platform,
        );
        allProducts.push(...products);
      } catch (error) {
        this.logger.log(`Failed to scrape ${platform}: ${error.message}`);
      }
    }

    this.scraperService.writeProductsToCsv(normalizedTerm, allProducts);

    const cheapestProducts =
      await this.scraperService.getCheapestProducts(normalizedTerm);

    return { data: allProducts, cheapest: cheapestProducts };
  }

  @Get('validate')
  async validate(
    @Query('term') searchTerm: string,
    @Query('source') source: string,
  ) {
    const normalizedTerm = this.normalizeSearchTerm(searchTerm);
    const normalizedSource = this.normalizeSource(source);

    return this.executeSingleSourceScrape(normalizedTerm, normalizedSource, {
      raw: false,
      context: 'Validation',
    });
  }

  @Get('raw')
  async raw(
    @Query('term') searchTerm: string,
    @Query('source') source: string,
  ) {
    const normalizedTerm = this.normalizeSearchTerm(searchTerm);
    const normalizedSource = this.normalizeSource(source);

    return this.executeSingleSourceScrape(normalizedTerm, normalizedSource, {
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

  private parseSourcesParam(
    sources?: string | string[],
    defaults: Source[] = this.defaultPlatforms,
  ): Source[] {
    if (!sources) {
      return defaults;
    }

    const parsedSources = (Array.isArray(sources) ? sources : sources.split(','))
      .map((source) => source.trim().toLowerCase())
      .filter(Boolean);

    if (!parsedSources.length) {
      throw new BadRequestException('At least one source must be provided');
    }

    const uniqueSources = [...new Set(parsedSources)];
    const invalidSources = uniqueSources.filter(
      (source) => !Object.values(Source).includes(source as Source),
    );

    if (invalidSources.length) {
      throw new BadRequestException(
        `Unsupported sources: ${invalidSources.join(', ')}`,
      );
    }

    return uniqueSources as Source[];
  }

  private normalizeSource(source?: string): Source {
    const normalized = source?.trim().toLowerCase();
    if (!normalized) {
      throw new BadRequestException('Source is required');
    }

    if (!Object.values(Source).includes(normalized as Source)) {
      throw new BadRequestException(`Unsupported source: ${normalized}`);
    }

    return normalized as Source;
  }

  private async executeSingleSourceScrape(
    searchTerm: string,
    source: Source,
    options: { raw: boolean; context: string },
  ) {
    try {
      const data = options.raw
        ? await this.scraperService.scrapeRaw(searchTerm, source)
        : await this.scraperService.scrape(searchTerm, source);

      return {
        source,
        data,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        this.logger.warn(
          `${options.context} failed for ${source}: ${error.message}`,
        );
        return {
          source,
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
