import 'dotenv/config';
import { runPostMatchBatch } from '../services/aiScout';

async function main() {
  for (let i = 0; i < 5; i++) {
    console.log(`\n--- Batch ${i + 1}/5 ---`);
    await runPostMatchBatch(3);
  }
  console.log('\nDone.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
