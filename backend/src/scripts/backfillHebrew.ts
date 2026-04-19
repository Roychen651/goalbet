import 'dotenv/config';
import { runPreMatchBatch, runPostMatchBatch } from '../services/aiScout';

async function main() {
  console.log('\n== Pre-match HE backfill ==');
  for (let i = 0; i < 5; i++) {
    console.log(`Batch ${i + 1}/5`);
    await runPreMatchBatch(3);
  }
  console.log('\n== Post-match HE backfill ==');
  for (let i = 0; i < 8; i++) {
    console.log(`Batch ${i + 1}/8`);
    await runPostMatchBatch(3);
  }
  console.log('\nDone.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
