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

  describe('/scraper/validate (GET)', () => {
    const searchTerm =
      process.env.SCRAPER_E2E_TERM ?? 'Consola Nintendo Switch 2';
    const skipLiveTests = process.env.SCRAPER_SKIP_LIVE_TESTS === 'true';
    const availableSources = Object.values(Source);

    const maybeTest = skipLiveTests ? it.skip : it;

    maybeTest.each(availableSources)(
      'returns products for %s',
      async (source) => {
        const response = await request(app.getHttpServer())
          .get('/scraper/validate')
          .query({ term: searchTerm, source })
          .expect(200);

        expect(response.body.source).toBe(source);
        expect(response.body.error).toBeUndefined();
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
      },
      120000,
    );
  });
});
