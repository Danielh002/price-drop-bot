import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from '../entities/product.entity';
import {
  FilterConfig,
  StoreConfig,
  StoreScraper,
  ScrapedProduct,
} from './scraper.interface';
import { MercadoLibreScraper } from './platforms/mercadolibre.scraper';
import { FalabellaScraper } from './platforms/falabella.scraper';
import { ExitoScraper } from './platforms/exito.scraper';
import { AlkostoScraper } from './platforms/alkosto.scraper';
import { kmeans } from 'ml-kmeans';
import { Store, ScrapeType } from '../entities/store.entity';
import { ProductPrice } from '../entities/product-price.entity';

export enum StoreCode {
  FALABELLA = 'falabella',
  MERCADO_LIBRE = 'mercadolibre',
  EXITO = 'exito',
  ALKOSTO = 'alkosto',
}

const storeConfig: Record<StoreCode, StoreConfig> = {
  [StoreCode.MERCADO_LIBRE]: {
    baseUrl: 'https://listado.mercadolibre.com.co/',
    separator: '-',
    country: 'Colombia',
    currency: 'COP',
    store: 'mercadolibre',
    filterConfig: {
      priceQuantile: 0.75,
    },
  },
  [StoreCode.FALABELLA]: {
    baseUrl: 'https://www.falabella.com.co/falabella-co/search?Ntt=',
    separator: '+',
    country: 'Colombia',
    currency: 'COP',
    store: 'falabella',
    filterConfig: {
      priceQuantile: 0.75,
    },
  },
  [StoreCode.EXITO]: {
    baseUrl: 'https://www.exito.com/',
    separator: '%20',
    country: 'Colombia',
    currency: 'COP',
    store: 'exito',
    filterConfig: {
      priceQuantile: 0.75,
    },
  },
  [StoreCode.ALKOSTO]: {
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

const storeMetadata: Record<
  StoreCode,
  { name: string; urlBase: string; scrapeType: ScrapeType; logoUrl?: string }
> = {
  [StoreCode.MERCADO_LIBRE]: {
    name: 'Mercado Libre',
    urlBase: 'https://www.mercadolibre.com.co',
    scrapeType: 'html',
  },
  [StoreCode.FALABELLA]: {
    name: 'Falabella',
    urlBase: 'https://www.falabella.com.co',
    scrapeType: 'headless',
  },
  [StoreCode.EXITO]: {
    name: 'Éxito',
    urlBase: 'https://www.exito.com',
    scrapeType: 'api',
  },
  [StoreCode.ALKOSTO]: {
    name: 'Alkosto',
    urlBase: 'https://www.alkosto.com',
    scrapeType: 'api',
  },
};

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private readonly storeCache = new Map<StoreCode, Store>();
  private readonly scrapers: Record<
    StoreCode,
    (config: StoreConfig, httpService: HttpService) => StoreScraper
  > = {
    [StoreCode.MERCADO_LIBRE]: (config, httpService) =>
      new MercadoLibreScraper(config, httpService),
    [StoreCode.FALABELLA]: (config) => new FalabellaScraper(config),
    [StoreCode.EXITO]: (config, httpService) =>
      new ExitoScraper(config, httpService),
    [StoreCode.ALKOSTO]: (config, httpService) =>
      new AlkostoScraper(config, httpService),
  };

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(ProductPrice)
    private readonly productPriceRepository: Repository<ProductPrice>,
  ) {}

  private getStoreScraper(store: string): StoreScraper {
    const source = store.toLowerCase() as StoreCode;
    if (!this.scrapers[source]) {
      throw new HttpException(
        `Store ${store} is not supported`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.scrapers[source](storeConfig[source], this.httpService);
  }

  private async getOrCreateStore(source: StoreCode): Promise<Store> {
    if (this.storeCache.has(source)) {
      return this.storeCache.get(source)!;
    }

    let store = await this.storeRepository.findOne({
      where: { code: source },
    });

    if (!store) {
      const metadata = storeMetadata[source];
      const config = storeConfig[source];
      store = this.storeRepository.create({
        code: source,
        name: metadata.name,
        urlBase: metadata.urlBase,
        logoUrl: metadata.logoUrl,
        scrapeType: metadata.scrapeType,
        country: config.country,
      });
      store = await this.storeRepository.save(store);
    }

    this.storeCache.set(source, store);
    return store;
  }

  private async persistProducts(
    searchTerm: string,
    source: StoreCode,
    products: ScrapedProduct[],
  ): Promise<Product[]> {
    const store = await this.getOrCreateStore(source);
    const savedProducts: Product[] = [];

    for (const scrapedProduct of products) {
      const existing = await this.productRepository.findOne({
        where: {
          url: scrapedProduct.url,
          store: { id: store.id },
        },
        relations: {
          store: true,
        },
      });

      const entity =
        existing ??
        this.productRepository.create({
          store,
          url: scrapedProduct.url,
        });

      entity.name = scrapedProduct.name;
      entity.price = scrapedProduct.price;
      entity.currency = scrapedProduct.currency || entity.currency || 'COP';
      entity.image = scrapedProduct.image ?? entity.image;
      entity.brand = scrapedProduct.brand ?? entity.brand;
      entity.seller = scrapedProduct.seller ?? entity.seller;
      entity.country =
        scrapedProduct.country ??
        entity.country ??
        storeConfig[source].country;
      entity.searchTerm = searchTerm;
      entity.category = scrapedProduct.category ?? entity.category;
      entity.sku = scrapedProduct.sku ?? entity.sku;
      entity.ean = scrapedProduct.ean ?? entity.ean;
      entity.scrapedAt = scrapedProduct.scrapedAt ?? new Date();

      const saved = await this.productRepository.save(entity);
      const priceRecord = this.productPriceRepository.create({
        product: saved,
        price: scrapedProduct.price,
        scrapedAt: scrapedProduct.scrapedAt ?? new Date(),
      });
      await this.productPriceRepository.save(priceRecord);
      savedProducts.push(saved);
    }

    return savedProducts;
  }

  async scrape(searchTerm: string, store: string): Promise<Product[]> {
    const source = store.toLowerCase() as StoreCode;
    const config = storeConfig[source];
    if (!config) {
      throw new HttpException(
        `Store ${store} is not supported`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const products = await this.getStoreScraper(store).scrape(searchTerm);
    if (!products.length) {
      throw new HttpException(
        `No data scraped from ${store}`,
        HttpStatus.NOT_FOUND,
      );
    }

    const filteredProducts = this.filterPreciseProducts(
      products,
      searchTerm,
      config.filterConfig,
    );
    this.logger.debug(
      `Filtered ${filteredProducts.length} products from ${store}`,
      filteredProducts.map((product) => ({
        name: product.name,
        price: product.price,
        url: product.url,
        store: product.store,
      })),
    );
    if (!filteredProducts.length) {
      throw new HttpException(
        `No precise data after filtering for ${store}`,
        HttpStatus.NOT_FOUND,
      );
    }

    const normalizedProducts = this.deduplicateProducts(filteredProducts);
    const persistedProducts = await this.persistProducts(
      searchTerm,
      source,
      normalizedProducts,
    );
    return persistedProducts;
  }

  async scrapeRaw(
    searchTerm: string,
    store: string,
  ): Promise<ScrapedProduct[]> {
    const source = store.toLowerCase() as StoreCode;
    const config = storeConfig[source];
    if (!config) {
      throw new HttpException(
        `Store ${store} is not supported`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const products = await this.getStoreScraper(store).scrape(searchTerm);
    if (!products.length) {
      throw new HttpException(
        `No data scraped from ${store}`,
        HttpStatus.NOT_FOUND,
      );
    }

    return products;
  }

  private filterPreciseProducts(
    products: ScrapedProduct[],
    searchTerm: string,
    filterConfig: FilterConfig,
  ): ScrapedProduct[] {
    if (!products.length) return [];

    const matchingProducts = products.filter((p) =>
      this.isRelevantProduct(p.name ?? '', searchTerm),
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
    let filteredProducts: ScrapedProduct[];
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

  private isRelevantProduct(name: string, searchTerm: string): boolean {
    if (!name) return false;
    const normalizedName = this.normalizeText(name);
    const normalizedSearchTerm = this.normalizeText(searchTerm);

    if (!normalizedName || !normalizedSearchTerm) return false;

    if (
      normalizedName.includes(normalizedSearchTerm) ||
      normalizedSearchTerm.includes(normalizedName)
    ) {
      return true;
    }

    const nameTokens = new Set(normalizedName.split(' '));
    const searchTokens = normalizedSearchTerm.split(' ');
    const matchingTokens = searchTokens.filter((token) =>
      nameTokens.has(token),
    );

    const matchRatio = matchingTokens.length / searchTokens.length;
    return matchRatio >= 0.6; // Require at least 60% token overlap
  }

  private normalizeText(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private deduplicateProducts(products: ScrapedProduct[]): ScrapedProduct[] {
    const seen = new Map<string, ScrapedProduct>();
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
      .leftJoinAndSelect('product.store', 'store')
      .where('product.searchTerm = :searchTerm', { searchTerm })
      .orderBy('product.price', 'ASC')
      .limit(5)
      .getMany();
  }

}
