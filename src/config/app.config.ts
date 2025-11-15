import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  webOrigins: process.env.WEB_ORIGINS?.split(',').map((origin) =>
    origin.trim(),
  ) ?? ['http://localhost:5173', 'http://127.0.0.1:5173'],
}));

export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'mysecretpassword',
  name: process.env.DB_NAME ?? 'price_drop',
  sync: process.env.TYPEORM_SYNC !== 'false',
  ssl: process.env.DB_SSL === 'true',
}));
