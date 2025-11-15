import { Module } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { ScraperController } from './scraper.controller';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../entities/product.entity';
import { Store } from '../entities/store.entity';
import { ProductPrice } from '../entities/product-price.entity';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([Product, Store, ProductPrice])],
  controllers: [ScraperController],
  providers: [ScraperService],
  exports: [ScraperService],
})
export class ScraperModule {}
