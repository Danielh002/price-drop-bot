import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from '../entities/product.entity';
import { AxiosError } from 'axios';
import { PlatformScraper } from './scraper.interface';
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

const platformConfig: Record<
  Source,
  { baseUrl: string; separator: string; country: string; currency: string }
> = {
  [Source.MERCADO_LIBRE]: {
    baseUrl: 'https://listado.mercadolibre.com.co/',
    separator: '-',
    country: 'Colombia',
    currency: 'COP',
  },
  [Source.FALABELLA]: {
    baseUrl: 'https://www.falabella.com.co/falabella-co/search?Ntt=',
    separator: '+',
    country: 'Colombia',
    currency: 'COP',
  },
  [Source.EXITO]: {
    baseUrl: 'https://www.exito.com/s?q=',
    separator: '%20',
    country: 'Colombia',
    currency: 'COP',
  },
  [Source.ALKOSTO]: {
    baseUrl: 'https://www.alkosto.com/search/?text=',
    separator: '%20',
    country: 'Colombia',
    currency: 'COP',
  },
};

@Injectable()
export class ScraperService {
  private readonly scrapers: Record<Source, PlatformScraper> = {
    [Source.MERCADO_LIBRE]: new MercadoLibreScraper(),
    [Source.FALABELLA]: new FalabellaScraper(),
    [Source.EXITO]: new ExitoScraper(),
    [Source.ALKOSTO]: new AlkostoScraper(),
  };

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  private createSearchUrl(searchTerm: string, platform: string): string {
    const normalizedPlatform = platform.toLowerCase() as Source;
    const config = platformConfig[normalizedPlatform];
    if (!config) {
      throw new HttpException(
        `Invalid platform. Use ${Object.values(Source).join(', ')}.`,
        HttpStatus.BAD_REQUEST,
      );
    }
    const query = searchTerm.trim().split(/\s+/).join(config.separator);
    return `${config.baseUrl}${query}`;
  }

  async scrape(searchTerm: string, platform: string): Promise<Product[]> {
    const normalizedPlatform = platform.toLowerCase() as Source;
    const scraper = this.scrapers[normalizedPlatform];
    if (!scraper) {
      throw new HttpException(
        `Invalid platform. Use ${Object.values(Source).join(', ')}.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const url = this.createSearchUrl(searchTerm, platform);
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
      const $ = cheerio.load(response.data) as cheerio.CheerioAPI;
      const products = scraper.scrape($, searchTerm);

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
        `An error occurred while scraping ${platform}`,
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
