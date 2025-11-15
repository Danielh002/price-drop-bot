import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from '../entities/alert.entity';
import { Product } from '../entities/product.entity';
import { ScraperService, StoreCode } from '../scraper/scraper.service';
import { Cron, CronExpression } from '@nestjs/schedule';

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
    const stores = [
      StoreCode.MERCADO_LIBRE,
      StoreCode.FALABELLA,
      StoreCode.EXITO,
      StoreCode.ALKOSTO,
    ];

    for (const alert of alerts) {
      let lowestPrice = Infinity;
      let cheapestProduct: Product | null = null;

      for (const platform of stores) {
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
          .leftJoinAndSelect('product.store', 'store')
          .where('product.searchTerm = :searchTerm', {
            searchTerm: alert.searchTerm,
          })
          .orderBy('product.price', 'ASC')
          .getOne();

        if (!previousLowest || lowestPrice < previousLowest.price) {
          const storeLabel =
            cheapestProduct.store?.name ??
            cheapestProduct.store?.code ??
            'N/A';
          console.log(
            `Alert triggered for ${alert.email}: ${cheapestProduct.name} is ${lowestPrice} COP at ${storeLabel} (Seller: ${cheapestProduct.seller ?? 'N/A'})`,
          );
          // TODO: Implement email or Telegram notification
        }
      }
    }
  }
}
