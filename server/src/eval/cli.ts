import { migrate } from '../db/database.js';
import { runGoldenSuite } from './golden.js';
import { runEvalSuite } from './suite.js';

/**
 * Retrieval regression gate for the currently configured workspace.
 *
 *   npm run eval:golden --prefix server
 *   PARITY_MIN_RECALL=0.6 npm run eval:golden --prefix server
 *
 * Exits non-zero when the offline suite fails or recall@k drops below
 * PARITY_MIN_RECALL, so a chunker or reranker change cannot quietly regress
 * search quality. A workspace with no index is reported, not failed.
 */
async function main(): Promise<number> {
  migrate();

  const suite = await runEvalSuite();
  console.log(suite.summary);
  for (const c of suite.cases.filter((x) => !x.passed)) {
    console.log(`  FAIL ${c.id} — ${c.detail}`);
  }

  const golden = await runGoldenSuite();
  console.log(`\n${golden.summary}`);
  for (const c of golden.cases) {
    const mark = c.status === 'skipped' ? 'SKIP' : c.hit ? 'HIT ' : 'MISS';
    console.log(`  ${mark} ${c.id.padEnd(22)} ${c.detail}`);
  }

  if (suite.failed > 0) return 1;

  const min = Number(process.env.PARITY_MIN_RECALL ?? '');
  if (Number.isFinite(min) && golden.recallAtK !== null && golden.recallAtK < min) {
    console.error(
      `\nRetrieval regression: recall@${golden.k} ${golden.recallAtK} below PARITY_MIN_RECALL ${min}`,
    );
    return 1;
  }
  return 0;
}

process.exitCode = await main();
