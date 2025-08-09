import { Controller, Get, Logger, Query } from '@nestjs/common';
import { ScraperService, Source } from './scraper.service';
import { Product } from 'src/entities/product.entity';

@Controller('scraper')
export class ScraperController {
  private readonly logger = new Logger(ScraperController.name);
  constructor(private readonly scraperService: ScraperService) {}

  @Get('search')
  async search(@Query('term') searchTerm: string) {
    if (!searchTerm) {
      throw new Error('Search term is required');
    }

    const platforms = [
      Source.MERCADO_LIBRE,
      // Source.FALABELLA,
      Source.EXITO,
      // Source.ALKOSTO,
    ];

    const allProducts: Product[] = [];

    for (const platform of platforms) {
      try {
        const products = await this.scraperService.scrape(searchTerm, platform);
        allProducts.push(...products);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        this.logger.log(`Failed to scrape ${platform}: ${error.message}`);
      }
    }

    /*
    const csvContent = [
      'Name,Price,URL,Store,Seller,Country,Currency,ScrapedAt',
      ...allProducts.map(
        (item) =>
          `"${item.name.replace(/"/g, '""')}",${item.price},"${item.url}",${item.store},${item.seller},${item.country},${item.currency},${item.scrapedAt.toISOString()}`,
      ),
    ].join('\n');
    const fileName = `products_${searchTerm.replace(' ', '_')}_${Date.now()}.csv`;
    writeFileSync(fileName, csvContent, 'utf-8');
    */

    const cheapestProducts =
      await this.scraperService.getCheapestProducts(searchTerm);

    return { data: allProducts, cheapest: cheapestProducts, csvFile: 'NoFile' };
  }
}
