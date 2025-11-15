import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { Source } from '../src/scraper/scraper.service';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  describe('/scraper/stores/:store/search (GET)', () => {
    const searchQuery =
      process.env.SCRAPER_E2E_QUERY ?? 'Consola Nintendo Switch 2';
    const skipLiveTests = process.env.SCRAPER_SKIP_LIVE_TESTS === 'true';
    const [falabella, ...rest] = Object.values(Source);
    const availableStores = rest;

    const maybeTest = skipLiveTests ? it.skip : it;

    maybeTest.each(availableStores)(
      'returns products for %s',
      async (store) => {
        const response = await request(app.getHttpServer())
          .get(`/scraper/stores/${store}/search`)
          .query({ query: searchQuery })
          .expect(200);

        expect(response.body.store).toBe(store);
        expect(response.body.error).toBeUndefined();
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
      },
      120000,
    );
  });
});
