import {
  PlatformScraper,
  PlatformConfig,
  ScrapedProduct,
} from '../scraper.interface';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { HttpException, HttpStatus } from '@nestjs/common';
import * as fs from 'fs';

export class AlkostoScraper implements PlatformScraper {
  private readonly mainUrl = 'https://www.alkosto.com';
  constructor(
    private readonly config: PlatformConfig,
    private readonly httpService: HttpService,
  ) {}

  private createSearchPayload(searchTerm: string, page: number = 0): any {
    return {
      requests: [
        {
          indexName: 'alkostoIndexAlgoliaPRD',
          analytics: true,
          analyticsTags: ['Mobile', 'Busquedas', 'usuario nuevo'],
          clickAnalytics: true,
          facets: ['*'],
          hitsPerPage: 25,
          maxValuesPerFacet: 500,
          page,
          query: searchTerm,
          removeWordsIfNoResults: 'allOptional',
          userToken: '2070178424_1755355287',
        },
      ],
    };
  }

  async scrape(searchTerm: string): Promise<ScrapedProduct[]> {
    const products: ScrapedProduct[] = [];
    let page = 0;
    const maxPages = 2;

    const headers = {
      'x-algolia-api-key': '7a8800d62203ee3a9ff1cdf74f99b268',
      'x-algolia-application-id': 'QX5IPS1B1Q',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      Accept: 'application/json',
      'Content-Type': 'text/plain',
      'Accept-Language': 'en-US,en;q=0.9',
      Connection: 'keep-alive',
      Origin: 'https://www.alkosto.com',
      Referer: 'https://www.alkosto.com/',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
      'sec-ch-ua':
        '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
    };

    while (page < maxPages) {
      try {
        const payload = this.createSearchPayload(searchTerm, page);
        const response = await firstValueFrom(
          this.httpService.post(this.config.baseUrl, payload, {
            headers,
            timeout: 10000,
          }),
        );

        // fs.writeFileSync(`alkosto_response_page_${page}.json`, JSON.stringify(response.data, null, 2));

        const results = response.data.results[0];
        const hits = results.hits || [];
        const nbPages = results.nbPages || 1;

        for (const hit of hits) {
          const name = hit.name_text_es || 'N/A';
          const price = hit.lowestprice_double || 0;
          const url = `${this.mainUrl}${hit.url_es_string}`;
          const image = `${this.mainUrl}${hit['img-310wx310h_string']}`;
          const seller = 'Alkosto';
          const brand = hit.brand_string_mv[0] || 'N/A';

          if (name !== 'N/A' && price > 0 && url !== 'N/A') {
            products.push({
              name,
              price,
              url,
              store: this.config.store,
              country: this.config.country,
              currency: this.config.currency,
              searchTerm,
              seller,
              image,
              scrapedAt: new Date(),
              brand,
            });
          }
        }

        if (page + 1 >= nbPages) break; // Stop if no more pages
        page++;
      } catch (error) {
        console.error(`Error scraping Alkosto page ${page}: ${error.message}`);
        break; // Stop on error, but return partial results
      }
    }

    if (products.length === 0) {
      console.warn(
        'No products found, check alkosto_response_page_0.json for details',
      );
      throw new HttpException(
        'No products found for Alkosto',
        HttpStatus.NOT_FOUND,
      );
    }

    return products;
  }
}
