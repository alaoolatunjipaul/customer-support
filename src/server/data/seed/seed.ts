import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateAll, SEED_CONTEXT } from './generator.js';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, 'seed-data.json');

async function main() {
  const data = generateAll();
  const payload = {
    generatedAt: 'deterministic',
    context: SEED_CONTEXT,
    data,
  };
  await writeFile(outPath, JSON.stringify(payload, null, 2));
  const activityCount = Object.values(data.activitiesByCustomer).reduce((n, list) => n + list.length, 0);
  console.log(`Seeded ${data.customers.length} customers and ${activityCount} logged activities.`);
  console.log(`Snapshot written to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});