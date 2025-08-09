import { PlatformScraper } from '../scraper.interface';
import { Product } from '../../entities/product.entity';

export class MercadoLibreScraper implements PlatformScraper {
  private readonly config = {
    store: 'mercadolibre',
    country: 'Colombia',
    currency: 'COP',
  };

  scrape($: cheerio.CheerioAPI, searchTerm: string): Partial<Product>[] {
    const products: Partial<Product>[] = [];

    $('.ui-search-layout__item').each((_, element) => {
      const name =
        $(element).find('.poly-component__title').text().trim() || 'N/A';
      let price =
        $(element)
          .find('.poly-price__current .andes-money-amount__fraction')
          .first()
          .text()
          .trim()
          .replace(/\./g, '') || 'N/A';
      const url =
        $(element).find('.poly-component__title').attr('href') || 'N/A';
      const seller =
        $(element)
          .find('.poly-component__seller')
          .text()
          .trim()
          .replace('Por ', '') || 'Unknown';

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

      const altOption = $(element).find('.poly-buy-box__alternative-option');
      if (altOption.length) {
        const altPrice =
          altOption
            .find('.andes-money-amount__fraction')
            .text()
            .trim()
            .replace(/\./g, '') || 'N/A';
        const altUrl = altOption.attr('href') || 'N/A';
        const altSeller =
          altOption
            .find('.poly-component__seller')
            .text()
            .trim()
            .replace('Por ', '') || 'Unknown';
        if (altPrice !== 'N/A' && altUrl !== 'N/A') {
          products.push({
            name,
            price: parseFloat(altPrice),
            url: altUrl,
            store: this.config.store,
            country: this.config.country,
            currency: this.config.currency,
            searchTerm,
            seller: altSeller,
            scrapedAt: new Date(),
          });
        }
      }
    });

    return products;
  }
}
