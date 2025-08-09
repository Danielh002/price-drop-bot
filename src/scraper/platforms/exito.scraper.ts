import { PlatformScraper } from '../scraper.interface';
import { Product } from '../../entities/product.entity';

export class ExitoScraper implements PlatformScraper {
  private readonly config = {
    store: 'exito',
    country: 'Colombia',
    currency: 'COP',
  };

  scrape($: cheerio.CheerioAPI, searchTerm: string): Partial<Product>[] {
    const products: Partial<Product>[] = [];

    // Target product card articles
    $('article.productCard_productCard__M0677').each((_, element) => {
      // Extract product name
      const name =
        $(element).find('h3.styles_name__qQJiK').text().trim() || 'N/A';

      // Extract price and clean it (e.g., "$ 3.119.900" -> "3119900")
      let price =
        $(element)
          .find('p[data-fs-container-price-otros]')
          .text()
          .trim()
          .replace(/[^\d]/g, '') || 'N/A';

      // Extract product URL
      const url =
        $(element).find('a[data-testid="product-link"]').attr('href') || 'N/A';

      // Extract seller (vendor)
      const seller =
        $(element)
          .find('span[data-fs-product-details-seller__name]')
          .text()
          .trim() || 'Exito';

      // Extract brand (optional, for completeness)
      const brand =
        $(element).find('h3.styles_brand__IdJcB').text().trim() || 'N/A';

      // Extract image URL (optional, for completeness)
      const image =
        $(element).find('div[data-fs-product-card-image] img').attr('src') ||
        'N/A';

      // Only include valid products
      if (name !== 'N/A' && price !== 'N/A' && url !== 'N/A') {
        products.push({
          name,
          price: parseFloat(price),
          url: `https://www.exito.com${url}`,
          store: this.config.store,
          country: this.config.country,
          currency: this.config.currency,
          searchTerm,
          seller,
          scrapedAt: new Date(),
          // image: image !== 'N/A' ? image : undefined,
        });
      }
    });

    return products;
  }
}
