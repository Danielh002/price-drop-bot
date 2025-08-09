import { PlatformScraper } from '../scraper.interface';
import type { Product } from '../../entities/product.entity';

export class FalabellaScraper implements PlatformScraper {
  private readonly config = {
    store: 'falabella',
    country: 'Colombia',
    currency: 'COP',
  };

  scrape($: cheerio.CheerioAPI, searchTerm: string): Partial<Product>[] {
    const products: Partial<Product>[] = [];

    $('.search-results-4-grid .pod-4_GRID').each((_, element) => {
      const name =
        $(element).find('.pod-subTitle.subTitle-rebrand').text().trim() ||
        'N/A';
      let price =
        $(element)
          .find('.prices-4_GRID .copy10')
          .text()
          .trim()
          .replace(/[^\d]/g, '') || 'N/A';
      const url = $(element).attr('href') || 'N/A';
      const seller =
        $(element)
          .find('.pod-sellerText.seller-text-rebrand')
          .text()
          .trim()
          .replace('Por ', '') || 'Falabella';

      if (name !== 'N/A' && price !== 'N/A' && url !== 'N/A') {
        products.push({
          name,
          price: parseFloat(price),
          url,
          store: this.config.store,
          country: this.config.country,
          currency: this.config.currency,
          searchTerm,
          seller,
          scrapedAt: new Date(),
        });
      }
    });

    return products;
  }
}
