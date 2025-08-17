import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from '../entities/product.entity';
import {
  FilterConfig,
  PlatformConfig,
  PlatformScraper,
} from './scraper.interface';
import { MercadoLibreScraper } from './platforms/mercadolibre.scraper';
import { FalabellaScraper } from './platforms/falabella.scraper';
import { ExitoScraper } from './platforms/exito.scraper';
import { AlkostoScraper } from './platforms/alkosto.scraper';
import { createObjectCsvWriter } from 'csv-writer';
import { kmeans } from 'ml-kmeans';

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
    filterConfig: {
      priceQuantile: 0.75,
    },
  },
  [Source.FALABELLA]: {
    baseUrl: 'https://www.falabella.com.co/falabella-co/search?Ntt=',
    separator: '+',
    country: 'Colombia',
    currency: 'COP',
    store: 'falabella',
    filterConfig: {
      priceQuantile: 0.75,
    },
  },
  [Source.EXITO]: {
    baseUrl: 'https://www.exito.com/',
    separator: '%20',
    country: 'Colombia',
    currency: 'COP',
    store: 'exito',
    filterConfig: {
      priceQuantile: 0.75,
    },
  },
  [Source.ALKOSTO]: {
    baseUrl: 'https://qx5ips1b1q-dsn.algolia.net/1/indexes/*/queries',
    separator: '%20',
    country: 'Colombia',
    currency: 'COP',
    store: 'alkosto',
    filterConfig: {
      priceQuantile: 0.75,
    },
  },
};

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private readonly scrapers: Record<
    Source,
    (config: PlatformConfig, httpService: HttpService) => PlatformScraper
  > = {
    [Source.MERCADO_LIBRE]: (config, httpService) =>
      new MercadoLibreScraper(config, httpService),
    [Source.FALABELLA]: (config) => new FalabellaScraper(config),
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

  private getScraper(platform: string): PlatformScraper {
    const source = platform.toLowerCase() as Source;
    if (!this.scrapers[source]) {
      throw new HttpException(
        `Platform ${platform} is not supported`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.scrapers[source](platformConfig[source], this.httpService);
  }

  async scrape(searchTerm: string, platform: string): Promise<Product[]> {
    const source = platform.toLowerCase() as Source;
    const config = platformConfig[source];
    if (!config) {
      throw new HttpException(
        `Platform ${platform} is not supported`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const products = await this.getScraper(platform).scrape(searchTerm);
    if (!products.length) {
      throw new HttpException(
        `No data scraped from ${platform}`,
        HttpStatus.NOT_FOUND,
      );
    }

    const filteredProducts = this.filterPreciseProducts(
      products,
      searchTerm,
      config.filterConfig,
    );
    if (!filteredProducts.length) {
      throw new HttpException(
        `No precise data after filtering for ${platform}`,
        HttpStatus.NOT_FOUND,
      );
    }

    const normalizedProducts = this.deduplicateProducts(filteredProducts);
    await this.productRepository.save(normalizedProducts);
    return normalizedProducts as Product[];
  }

  private filterPreciseProducts(
    products: Partial<Product>[],
    searchTerm: string,
    filterConfig: FilterConfig,
  ): Partial<Product>[] {
    if (!products.length) return [];

    const matchingProducts = products.filter((p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    if (!matchingProducts.length) {
      console.log('No products match the search term:', searchTerm);
      return [];
    }

    this.logger.debug(
      `Before filtering: ${matchingProducts.length} products`,
      matchingProducts.map((p) => ({
        name: p.name,
        price: p.price,
        dataKey: p.url,
      })),
    );

    // Calculate price spread to determine number of clusters
    const prices = matchingProducts.map((p) => p.price).sort((a, b) => a - b);
    const iqr =
      prices[Math.floor(prices.length * 0.75)] -
      prices[Math.floor(prices.length * 0.25)];
    const numClusters = iqr > prices[prices.length - 1] * 0.5 ? 2 : 1; // Use 2 clusters if significant spread (e.g., accessories present)

    // K-means clustering (fallback to median for small sets)
    let filteredProducts: Partial<Product>[];
    if (matchingProducts.length >= 3) {
      // Need at least 3 for clustering
      try {
        const pricesArray = matchingProducts.map((p) => [p.price]);
        const kMeans = kmeans(pricesArray, numClusters, { seed: 0 });
        // Log cluster assignments
        const centroids = kMeans.centroids.map((c, i) => ({
          cluster: i,
          centroid: c[0],
        }));
        this.logger.debug('K-means clusters:', centroids);
        this.logger.debug(
          'Cluster assignments:',
          kMeans.clusters.map((cluster, i) => ({
            name: matchingProducts[i].name,
            price: matchingProducts[i].price,
            cluster,
          })),
        );

        // Select highest cluster (or all if 1 cluster)
        const maxCluster = centroids.reduce(
          (maxIdx, c, i) =>
            c.centroid > centroids[maxIdx].centroid ? i : maxIdx,
          0,
        );
        filteredProducts = matchingProducts.filter(
          (p, i) => numClusters === 1 || kMeans.clusters[i] === maxCluster,
        );
      } catch (error) {
        this.logger.warn(
          `K-means clustering failed: ${error.message}, falling back to median`,
        );
        const quantileIndex = Math.floor(
          prices.length * filterConfig.priceQuantile,
        );
        const priceThreshold = prices[quantileIndex];
        filteredProducts = matchingProducts.filter(
          (p) => p.price >= priceThreshold,
        );
      }
    } else {
      const quantileIndex = Math.floor(
        prices.length * filterConfig.priceQuantile,
      );
      const priceThreshold = prices[quantileIndex];
      filteredProducts = matchingProducts.filter(
        (p) => p.price >= priceThreshold,
      );
    }

    const removedProducts = matchingProducts.filter(
      (p) => !filteredProducts.includes(p),
    );
    this.logger.debug(
      `Removed ${removedProducts.length} products:`,
      removedProducts.map((p) => ({
        name: p.name,
        price: p.price,
        dataKey: p.url,
      })),
    );
    this.logger.debug(
      `After filtering: ${filteredProducts.length} products`,
      filteredProducts.map((p) => ({
        name: p.name,
        price: p.price,
        dataKey: p.url,
      })),
    );

    return filteredProducts;
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

  async writeProductsToCsv(
    searchTerm: string,
    products: Partial<Product>[],
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `products_${searchTerm.replace(' ', '_')}_${timestamp}.csv`;

    const csvWriter = createObjectCsvWriter({
      path: fileName,
      header: [
        { id: 'name', title: 'Name' },
        { id: 'price', title: 'Price' },
        { id: 'url', title: 'URL' },
        { id: 'image', title: 'Image' },
        { id: 'seller', title: 'Seller' },
        { id: 'store', title: 'Store' },
        { id: 'country', title: 'Country' },
        { id: 'currency', title: 'Currency' },
        { id: 'searchTerm', title: 'SearchTerm' },
        { id: 'brand', title: 'Brand' },
        { id: 'scrapedAt', title: 'ScrapedAt' },
      ],
    });

    const records = products.map((p) => ({
      name: p.name || 'N/A',
      price: p.price || 0,
      url: p.url || 'N/A',
      image: p.image || 'N/A',
      seller: p.seller || 'N/A',
      store: p.store || 'N/A',
      brand: p.brand || 'N/A',
      country: p.country || 'N/A',
      currency: p.currency || 'N/A',
      searchTerm: p.searchTerm || 'N/A',
      scrapedAt: p.scrapedAt ? p.scrapedAt.toISOString() : 'N/A',
    }));

    await csvWriter.writeRecords(records);
    console.log(`CSV written to ${fileName}`);
    return fileName;
  }
}
