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
  constructor(private readonly scraperService: ScraperService) {}

  @Get('search')
  async search(
    @Query('term') searchTerm: string,
    @Query('sources') sources?: string | string[],
  ) {
    if (!searchTerm) {
      throw new BadRequestException('Search term is required');
    }

    const defaultPlatforms: Source[] = [
      Source.MERCADO_LIBRE,
      Source.FALABELLA,
      Source.EXITO,
      Source.ALKOSTO,
    ];

    let platforms = defaultPlatforms;

    if (sources) {
      const parsedSources = (
        Array.isArray(sources) ? sources : sources.split(',')
      )
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

      platforms = uniqueSources as Source[];
    }

    const allProducts: Product[] = [];

    for (const platform of platforms) {
      try {
        const products = await this.scraperService.scrape(searchTerm, platform);
        allProducts.push(...products);
      } catch (error) {
        this.logger.log(`Failed to scrape ${platform}: ${error.message}`);
      }
    }

    this.scraperService.writeProductsToCsv(searchTerm, allProducts);

    const cheapestProducts =
      await this.scraperService.getCheapestProducts(searchTerm);

    return { data: allProducts, cheapest: cheapestProducts };
  }

  @Get('validate')
  async validate(
    @Query('term') searchTerm: string,
    @Query('source') source: string,
  ) {
    if (!searchTerm) {
      throw new BadRequestException('Search term is required');
    }

    if (!source) {
      throw new BadRequestException('Source is required');
    }

    const normalizedSource = source.trim().toLowerCase();

    if (!Object.values(Source).includes(normalizedSource as Source)) {
      throw new BadRequestException(
        `Unsupported source: ${normalizedSource}`,
      );
    }

    try {
      const products = await this.scraperService.scrape(
        searchTerm,
        normalizedSource,
      );

      return {
        source: normalizedSource,
        data: products,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        this.logger.warn(
          `Validation failed for ${normalizedSource}: ${error.message}`,
        );
        return {
          source: normalizedSource,
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

  @Get('raw')
  async raw(
    @Query('term') searchTerm: string,
    @Query('source') source: string,
  ) {
    if (!searchTerm) {
      throw new BadRequestException('Search term is required');
    }

    if (!source) {
      throw new BadRequestException('Source is required');
    }

    const normalizedSource = source.trim().toLowerCase();

    if (!Object.values(Source).includes(normalizedSource as Source)) {
      throw new BadRequestException(
        `Unsupported source: ${normalizedSource}`,
      );
    }

    try {
      const products = await this.scraperService.scrapeRaw(
        searchTerm,
        normalizedSource,
      );

      return {
        source: normalizedSource,
        data: products,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        this.logger.warn(
          `Raw scrape failed for ${normalizedSource}: ${error.message}`,
        );
        return {
          source: normalizedSource,
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
