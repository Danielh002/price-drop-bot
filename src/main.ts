import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const allowedOrigins =
    configService.get<string[]>('app.webOrigins') || [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  await app.listen(configService.get<number>('app.port') ?? 3000);
}
bootstrap();
