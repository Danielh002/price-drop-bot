import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScraperModule } from './scraper/scraper.module';
import { Product } from './entities/product.entity';
import { Alert } from './entities/alert.entity';
import { AlertsModule } from './alerts/alert.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'products.db',
      entities: [Product, Alert],
      synchronize: true,
    }),
    ScheduleModule.forRoot(),
    ScraperModule,
    AlertsModule,
  ],
})
export class AppModule {}
