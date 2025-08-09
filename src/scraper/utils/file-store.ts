import fs from 'fs/promises';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const RESULTS_PATH = path.join(DATA_DIR, 'results.json');

export async function saveScrapeResult(item: any) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const raw = await fs.readFile(RESULTS_PATH, 'utf8').catch(() => '[]');
  const arr = JSON.parse(raw);
  arr.push(item);
  await fs.writeFile(RESULTS_PATH, JSON.stringify(arr, null, 2));
}
