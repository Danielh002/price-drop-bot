import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScraperModule } from './scraper/scraper.module';
import { Product } from './entities/product.entity';
import { Alert } from './entities/alert.entity';
import { AlertsModule } from './alerts/alert.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Store } from './entities/store.entity';
import { ProductPrice } from './entities/product-price.entity';
import { ProductGroup } from './entities/product-group.entity';
import { ProductGroupItem } from './entities/product-group-item.entity';
import { User } from './entities/user.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { appConfig, databaseConfig } from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const database = configService.get('database', { infer: true }) as {
          host: string;
          port: number;
          user: string;
          password: string;
          name: string;
          sync: boolean;
          ssl: boolean;
        };

        return {
          type: 'postgres',
          host: database.host,
          port: database.port,
          username: database.user,
          password: database.password,
          database: database.name,
          entities: [
            Product,
            Alert,
            Store,
            ProductPrice,
            ProductGroup,
            ProductGroupItem,
            User,
          ],
          synchronize: database.sync,
          ssl: database.ssl ? { rejectUnauthorized: false } : undefined,
        };
      },
    }),
    ScheduleModule.forRoot(),
    ScraperModule,
    AlertsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
