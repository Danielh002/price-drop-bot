import {
  StoreConfig,
  StoreScraper,
  ScrapedProduct,
} from '../scraper.interface';
import * as cheerio from 'cheerio';
import * as puppeteer from 'puppeteer';
import { Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { writeFile, writeFileSync } from 'fs';

export class FalabellaScraper implements StoreScraper {
  private readonly logger = new Logger(FalabellaScraper.name);

  constructor(
    private readonly config: StoreConfig,
    private readonly httpService: HttpService,
  ) {}

  private createSearchUrl(searchTerm: string): string {
    const query = searchTerm.trim().split(/\s+/).join(this.config.separator);
    return `${this.config.baseUrl}${query}`;
  }

  private parseSrcset(srcset: string): string | undefined {
    const match = srcset.match(/^(.*?)\s+2x/);
    return match ? match[1] : undefined;
  }

  async scrape(
    searchTerm: string,
    $?: cheerio.CheerioAPI,
  ): Promise<ScrapedProduct[]> {
    const products: ScrapedProduct[] = [];
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

      writeFileSync('falabella.html', response.data, 'utf-8');
      const $local = cheerio.load(response.data);

      // Flexible selector for dynamic grid classes
      $local('#testId-searchResults-products .grid-pod').each((_, element) => {
        const link = $local(element).find('a.pod-link');
        const name =
          $local(element).find('.subTitle-rebrand').text().trim() || 'N/A';
        const brand =
          $local(element).find('.title-rebrand').text().trim() || 'N/A';
        let price =
          $local(element)
            .find('.copy10.primary, .copy10')
            .text()
            .trim()
            .replace(/[^\d]/g, '') || 'N/A';
        const productUrl = link.attr('href') || 'N/A';
        const seller =
          $local(element)
            .find('.pod-sellerText-rebrand')
            .text()
            .trim()
            .replace('Por ', '') || 'Falabella';
        const imageElement = $local(element).find(
          '.image-slider picture:first-child img',
        );
        const image =
          this.parseSrcset(imageElement.attr('srcset') || '') ||
          imageElement.attr('src') ||
          'N/A';
        if (name !== 'N/A' && price !== 'N/A' && productUrl !== 'N/A') {
          products.push({
            name,
            price: parseFloat(price),
            url: productUrl.startsWith('http')
              ? productUrl
              : `https://www.falabella.com.co${productUrl}`,
            store: this.config.store,
            country: this.config.country,
            currency: this.config.currency,
            searchTerm,
            seller,
            image,
            brand,
            scrapedAt: new Date(),
          });
        }
      });

      if (products.length === 0) {
        this.logger.debug(
          'No products found, check falabella.html for correct selectors',
        );
      }

      return products;
    } catch (error) {
      this.logger.error(`Error scraping Falabella: ${error.message}`);
      throw new Error(`Failed to scrape Falabella: ${error.message}`);
    }
  }
}
