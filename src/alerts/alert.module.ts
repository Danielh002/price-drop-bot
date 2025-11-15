import { Module } from '@nestjs/common';
import { AlertsService } from './alert.service';
import { AlertsController } from './alert.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alert } from '../entities/alert.entity';
import { Product } from '../entities/product.entity';
import { Store } from '../entities/store.entity';
import { ProductPrice } from '../entities/product-price.entity';
import { ScraperService } from '../scraper/scraper.service';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    TypeOrmModule.forFeature([Alert, Product, Store, ProductPrice]),
    HttpModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AlertsController],
  providers: [AlertsService, ScraperService],
})
export class AlertsModule {}
