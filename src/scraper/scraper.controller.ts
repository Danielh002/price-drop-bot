import { Controller, Get, Logger, Query } from '@nestjs/common';
import { ScraperService, Source } from './scraper.service';
import { Product } from 'src/entities/product.entity';

@Controller('scraper')
export class ScraperController {
  private readonly logger = new Logger(ScraperController.name);
  constructor(private readonly scraperService: ScraperService) { }

  @Get('search')
  async search(@Query('term') searchTerm: string) {
    if (!searchTerm) {
      throw new Error('Search term is required');
    }

    const platforms = [
      Source.MERCADO_LIBRE,
      Source.FALABELLA,
      Source.EXITO,
      Source.ALKOSTO,
    ];

    const allProductsPromises: Promise<Product[]>[] = [];
    for (const platform of platforms) {
      try {
        allProductsPromises.push(
          this.scraperService.scrape(searchTerm, platform),
        );
      } catch (error) {
        this.logger.log(`Failed to scrape ${platform}: ${error.message}`);
      }
    }
    const allProducts: Product[] = (await Promise.allSettled(allProductsPromises)).filter(result => result.status === 'fulfilled').map(result => result.value).flat();

    this.scraperService.writeProductsToCsv(searchTerm, allProducts);

    const cheapestProducts =
      await this.scraperService.getCheapestProducts(searchTerm);

    return { data: allProducts, cheapest: cheapestProducts };
  }
}
