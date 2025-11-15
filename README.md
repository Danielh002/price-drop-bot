# PriceDropBot Backend

PriceDropBot is a NestJS service that scrapes multiple Colombian ecommerce platforms, normalizes the listings, and persists them so we can find and alert on the cheapest offers for any search term.

It powers the public API used by the frontend and by scheduled alert jobs.

## Key Features

- **Multi-store scraping** for Mercado Libre, Falabella, Éxito, and Alkosto with platform-specific scrapers (HTTP, Puppeteer, Algolia APIs).
- **Product enrichment & filtering**: deduplication, quantile filtering, and optional k-means clustering to keep only precise / high-quality results.
- **SQLite persistence** via TypeORM so historical data can be queried and alerts can compare new prices vs previous lowest price.
- **Alerting engine**: cron job runs hourly, scrapes the tracked terms, and logs alert triggers (ready for plugging into email/Telegram).
- **CSV exporting** so manual analyses can be performed outside the app.

## Architecture

| Layer | Description |
| --- | --- |
| `AppModule` | Boots TypeORM (SQLite `products.db`), the global scheduler, and routes traffic to feature modules. |
| `ScraperModule` | REST controller (`GET /scraper/search`) + `ScraperService`, which orchestrates per-platform scrapers and handles filtering/persistence/export. |
| `AlertsModule` | REST endpoint (`POST /alerts/create`) + `AlertsService`, which stores alerts and runs the hourly cron job to check for price drops. |
| Entities | `Product` and `Alert` TypeORM models define the persisted data. |

All modules share the same SQLite database file in the repo root so running locally requires no external services.

## Tech Stack

- Node.js 20+, NestJS 10, TypeScript 5
- TypeORM + SQLite
- Axios + Cheerio + Puppeteer + Algolia APIs
- `@nestjs/schedule` for cron-based alert checks
- `csv-writer` for exports, `ml-kmeans` for price clustering

## Requirements

- Node.js 20 (LTS) and npm 10
- Chromium dependencies for Puppeteer (already bundled for macOS/Linux; install `chromium` libs on headless servers)
- Local write access so the service can create `products.db` and CSV exports

## Environment Variables

Copy `.env` from the provided template and set the values you need. Defaults are safe for local work.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Port where the Nest app listens. |
| `MELI_SITE` | `MCO` | Mercado Libre site code (useful if you want to scrape another locale). |
| `SEED_QUERIES` | `nintendo switch 2,ps5` | Comma-separated default queries used elsewhere in the project. |

## Installation

```bash
cd backend
npm install
```

## Useful Scripts

| Command | Description |
| --- | --- |
| `npm run start` | Start the API once (production mode). |
| `npm run start:dev` | Start with hot reload for development. |
| `npm run start:prod` | Run the compiled `dist` build. |
| `npm run build` | Compile TypeScript to `dist`. |
| `npm run lint` | Run ESLint with `--fix`. |
| `npm test` / `npm run test:e2e` | Jest unit / e2e test suites. |

## API Overview

### `GET /scraper/search?term=<keyword>`

1. Iterates through every supported `Source` (Mercado Libre, Falabella, Éxito, Alkosto).
2. Runs the relevant scraper, deduplicates and filters results, writes them to the database, and persists a CSV file named `products_<term>_<timestamp>.csv`.
3. Returns a payload shaped as:

```json
{
  "data": [ /* all products from every store */ ],
  "cheapest": [ /* up to 5 cheapest persisted entries for this term */ ]
}
```

Each product includes price, store, seller, image URL, and metadata needed by the frontend.

### `POST /alerts/create`

```json
{
  "searchTerm": "nintendo switch 2",
  "priceThreshold": 1500000,
  "email": "you@example.com"
}
```

Stores an alert. Every hour the `AlertsService` cron job re-scrapes all supported stores for that term, compares the cheapest offer to the threshold and to the previously recorded lowest price, and logs a notification message (hook this up to email/SMS/Telegram when ready).

## Data Pipeline Highlights

1. **Scraping:** Each store has its own class under `src/scraper/platforms`. HTTP-only sources use Axios + Cheerio, while complex pages fall back to Puppeteer (Falabella) or Algolia’s API (Alkosto).
2. **Normalization:** `ScraperService` enriches every record with country, currency, store, and timestamps before saving.
3. **Filtering & Dedup:** The service deduplicates by `store + normalized name + seller`, then keeps the most relevant products using either a high-price quantile or k-means clustering on price distribution to remove noise.
4. **Persistence:** All results are saved to SQLite through TypeORM, enabling historical lookups.

## Extending the Scraper

1. Create a new class in `src/scraper/platforms/<store>.scraper.ts` implementing `StoreScraper`.
2. Add its configuration to `storeConfig` in `scraper.service.ts`.
3. Register the factory in `ScraperService.scrapers`.
4. (Optional) Update enums in the frontend so users can query the new store.

The rest of the pipeline (filtering, persistence, alerts) will work automatically.

## Testing

Run the existing Jest suites with `npm test`. Add new spec files under `src` next to the code they validate. End-to-end tests can live under `test/` and run through `npm run test:e2e`.

## Troubleshooting

- **No products returned** – check the logged HTML snapshots (`falabella.html`, `exito.html`) to update CSS selectors if the store changed its markup.
- **Puppeteer launch errors** – ensure the host has Chromium dependencies. On Debian-based systems: `apt-get install -y libnss3 libxss1 libasound2 fonts-liberation`.
- **Rate limiting** – the alerts cron introduces a 2s delay between platforms; adjust if you hit additional throttling.
- **Database locked** – SQLite stores `products.db` in the repo root. Delete it for a clean slate if you are not preserving history.

## License

The backend code is currently marked as `UNLICENSED` in `package.json`. Update the license if you plan to distribute the service publicly.
