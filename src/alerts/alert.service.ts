import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from '../entities/alert.entity';
import { Product } from '../entities/product.entity';
import { ScraperService } from '../scraper/scraper.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Source } from '../scraper/scraper.service';

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly scraperService: ScraperService,
  ) {}

  async createAlert(
    searchTerm: string,
    priceThreshold: number,
    email: string,
  ): Promise<Alert> {
    const alert = this.alertRepository.create({
      searchTerm,
      priceThreshold,
      email,
    });
    return this.alertRepository.save(alert);
  }

  @Cron(CronExpression.EVERY_HOUR) // Runs hourly
  async checkAlerts(): Promise<void> {
    const alerts = await this.alertRepository.find();
    const platforms = [
      Source.MERCADO_LIBRE,
      Source.FALABELLA,
      Source.EXITO,
      Source.ALKOSTO,
    ];

    for (const alert of alerts) {
      let lowestPrice = Infinity;
      let cheapestProduct: Product | null = null;

      for (const platform of platforms) {
        try {
          const products = await this.scraperService.scrape(
            alert.searchTerm,
            platform,
          );
          const cheapest = products.reduce(
            (min, p) => (p.price < min.price ? p : min),
            products[0],
          );
          if (cheapest && cheapest.price < lowestPrice) {
            lowestPrice = cheapest.price;
            cheapestProduct = cheapest;
          }
          // Delay to avoid rate-limiting
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(
            `Failed to scrape ${platform} for alert ${alert.searchTerm}: ${error.message}`,
          );
        }
      }

      if (cheapestProduct && lowestPrice <= alert.priceThreshold) {
        const previousLowest = await this.productRepository
          .createQueryBuilder('product')
          .where('product.searchTerm = :searchTerm', {
            searchTerm: alert.searchTerm,
          })
          .orderBy('product.price', 'ASC')
          .getOne();

        if (!previousLowest || lowestPrice < previousLowest.price) {
          console.log(
            `Alert triggered for ${alert.email}: ${cheapestProduct.name} is ${lowestPrice} COP at ${cheapestProduct.store} (Seller: ${cheapestProduct.seller})`,
          );
          // TODO: Implement email or Telegram notification
        }
      }
    }
  }
}
