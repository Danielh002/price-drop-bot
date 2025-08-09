import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from '../entities/product.entity';
import { AxiosError } from 'axios';
import { PlatformConfig, PlatformScraper } from './scraper.interface';
import { MercadoLibreScraper } from './platforms/mercadolibre.scraper';
import { FalabellaScraper } from './platforms/falabella.scraper';
import { ExitoScraper } from './platforms/exito.scraper';
import { AlkostoScraper } from './platforms/alkosto.scraper';

export enum Source {
  MERCADO_LIBRE = 'mercadolibre',
  FALABELLA = 'falabella',
  EXITO = 'exito',
  ALKOSTO = 'alkosto',
}

const platformConfig: Record<Source, PlatformConfig> = {
  [Source.MERCADO_LIBRE]: {
    baseUrl: 'https://listado.mercadolibre.com.co/',
    separator: '-',
    country: 'Colombia',
    currency: 'COP',
    store: 'mercadolibre',
  },
  [Source.FALABELLA]: {
    baseUrl: 'https://www.falabella.com.co/falabella-co/search?Ntt=',
    separator: '+',
    country: 'Colombia',
    currency: 'COP',
    store: 'falabella',
  },
  [Source.EXITO]: {
    baseUrl: 'https://www.exito.com/s?q=',
    separator: '%20',
    country: 'Colombia',
    currency: 'COP',
    store: 'exito',
  },
  [Source.ALKOSTO]: {
    baseUrl: 'https://www.alkosto.com/search/?text=',
    separator: '%20',
    country: 'Colombia',
    currency: 'COP',
    store: 'alkosto',
  },
};

@Injectable()
export class ScraperService {
  private readonly scrapers: Record<
    Source,
    (config: PlatformConfig, httpService: HttpService) => PlatformScraper
  > = {
    [Source.MERCADO_LIBRE]: (config, httpService) =>
      new MercadoLibreScraper(config, httpService),
    [Source.FALABELLA]: (config, httpService) =>
      new FalabellaScraper(config, httpService),
    [Source.EXITO]: (config, httpService) =>
      new ExitoScraper(config, httpService),
    [Source.ALKOSTO]: (config, httpService) =>
      new AlkostoScraper(config, httpService),
  };

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async scrape(searchTerm: string, platform: string): Promise<Product[]> {
    const normalizedPlatform = platform.toLowerCase() as Source;
    const config = platformConfig[normalizedPlatform];
    const scraperFactory = this.scrapers[normalizedPlatform];

    if (!config || !scraperFactory) {
      throw new HttpException(
        `Invalid platform. Use ${Object.values(Source).join(', ')}.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const scraper = scraperFactory(config, this.httpService);

    try {
      const products = await scraper.scrape(searchTerm);

      if (products.length === 0) {
        throw new HttpException(
          `No data scraped from ${platform}`,
          HttpStatus.NOT_FOUND,
        );
      }

      const normalizedProducts = this.deduplicateProducts(products);
      await this.productRepository.save(normalizedProducts);
      return normalizedProducts as Product[];
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new HttpException(
          `Failed to fetch data from ${platform}: ${error.message}`,
          HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(
        `An error occurred while scraping ${platform}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private deduplicateProducts(
    products: Partial<Product>[],
  ): Partial<Product>[] {
    const seen = new Map<string, Partial<Product>>();
    for (const product of products) {
      const key = `${product.store}:${product.name.toLowerCase().replace(/[^a-z0-9]/g, '')}:${product.seller}`;
      if (
        !seen.has(key) ||
        (seen.get(key)!.price || Infinity) > (product.price || Infinity)
      ) {
        seen.set(key, product);
      }
    }
    return Array.from(seen.values());
  }

  async getCheapestProducts(searchTerm: string): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder('product')
      .where('product.searchTerm = :searchTerm', { searchTerm })
      .orderBy('product.price', 'ASC')
      .limit(5)
      .getMany();
  }
}
