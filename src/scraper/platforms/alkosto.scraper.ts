import { PlatformScraper } from '../scraper.interface';
import { Product } from '../../entities/product.entity';

export class AlkostoScraper implements PlatformScraper {
  private readonly config = {
    store: 'alkosto',
    country: 'Colombia',
    currency: 'COP',
  };

  scrape($: cheerio.CheerioAPI, searchTerm: string): Partial<Product>[] {
    const products: Partial<Product>[] = [];

    $('.product__item').each((_, element) => {
      const name = $(element).find('.product__name').text().trim() || 'N/A';
      let price =
        $(element)
          .find('.product__price--discount')
          .text()
          .trim()
          .replace(/[^\d]/g, '') || 'N/A';
      const url = $(element).find('.product__image a').attr('href') || 'N/A';

      if (name !== 'N/A' && price !== 'N/A' && url !== 'N/A') {
        products.push({
          name,
          price: parseFloat(price),
          url: `https://www.alkosto.com${url}`,
          store: this.config.store,
          country: this.config.country,
          currency: this.config.currency,
          searchTerm,
          seller: 'Alkosto',
          scrapedAt: new Date(),
        });
      }
    });

    return products;
  }
}
