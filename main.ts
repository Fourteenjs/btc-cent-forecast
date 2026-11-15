// btc-cent-forecast-01 entry (Node 22, standard library only): a robust short-horizon
// forecaster for Bitcoin's US-dollar price 240 minutes after a checkpoint.
//
// The case gives the 4,320 one-minute closes of the 72 hours up to the checkpoint, one
// market (btc-usdc), and asks for ONE number: the close 240 minutes after the checkpoint.
// The program runs offline in the sandbox, once per case, and writes /output/<id>.out.
//
// Method (chosen by walk-forward backtest on the sealed practice recording, 2026-11-07 to
// 2026-11-11, 64 overlapping 4-hour-ahead checkpoints plus the five official practice
// checkpoints whose targets are inside the recording):
//   - The persistence baseline (guess the checkpoint close) is hard to beat on 4-hour
//     Bitcoin moves: plain drift extrapolations and mean reversion to 6h/24h/72h means
//     did not beat it out of sample, and a ridge fit on seven features overfit badly
//     (great in-sample, catastrophic across a time split).
//   - The one signal that held up in both halves of the backtest, and on the official
//     practice checkpoints, is the *median* 1-minute log return over the last hour:
//     prices often sit unchanged for minutes, so the median is 0 most of the time and
//     the forecast then equals persistence; when the price has been climbing or falling
//     steadily for an hour, the median is a real, spike-proof drift, and the forecast
//     moves a quarter of that drift extrapolated over the 240-minute horizon.
//   - The adjustment is capped at +/-1.5% of the price, so no pathological input can
//     throw the guess far from the checkpoint close.
//
// Backtest (mean absolute error, cents; lower is better):
//   persistence .......... 51,573 on 64 checkpoints | 47,055 on official p00-p04
//   this program ......... 51,002 on 64 checkpoints | 37,069 on official p00-p04
// The edge is small on average but it never hurt much in either half of the backtest
// (first half 56,931 vs 56,883 persistence; second half 45,072 vs 46,263), and it
// catches sustained one-hour moves, the one pattern that paid. Absolute error is a
// proper scoring rule for one number, so the guess is the honest median estimate: no
// shading up or down.
//
// Deterministic: no randomness, no time, no network; two runs on the same case write
// the same bytes. Runtime is a few milliseconds per case, far under the 8 s cap.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The smallest positive price on the grid: one unit of its 5 decimals. */
const MIN_PRICE = 0.00001;
/** The largest grid price below the scorer's exclusive 10,000,000-dollar cap. */
const MAX_PRICE = 9_999_999.99999;

/** How many of the last 1-minute log returns the median is taken over. */
const MEDIAN_WINDOW = 60;
/** Fraction of the median 1-hour drift, extrapolated over the 240-minute horizon. */
const DRIFT_SHARE = 0.25;
/** Cap on the log-price adjustment, either way. */
const MAX_LOG_SHIFT = 0.015;

interface CaseMarket {
  id: string;
  prices: number[];
}

interface Case {
  markets: CaseMarket[];
}

/** x kept on the grid's 5 decimals and inside the scorer's (0, 10,000,000). */
const price5 = (x: number): number => Math.round(Math.min(MAX_PRICE, Math.max(MIN_PRICE, x)) * 1e5) / 1e5;

/** Median of a sorted-ascending copy; for an even count, the upper middle value.
 *  (This is the definition the backtest was tuned with: sorted[floor(n/2)].) */
function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] as number;
}

/** The forecast for one market: checkpoint close, shifted by the robust hourly drift. */
function forecast(m: CaseMarket): number {
  if (!Array.isArray(m.prices) || m.prices.length === 0) throw new Error(`market ${m.id} has no prices`);
  const last = m.prices[m.prices.length - 1] as number;
  if (typeof last !== 'number' || !Number.isFinite(last) || last <= 0) {
    throw new Error(`market ${m.id}'s last price is not a finite positive number`);
  }
  // 1-minute log returns over the last hour (61 closes give 60 returns); fewer when
  // the case is short, in which case use whatever returns exist.
  const n = Math.min(MEDIAN_WINDOW, m.prices.length - 1);
  let shift = 0;
  if (n > 0) {
    const rets: number[] = [];
    for (let i = m.prices.length - n; i < m.prices.length; i++) {
      const prev = m.prices[i - 1] as number;
      const cur = m.prices[i] as number;
      if (typeof prev !== 'number' || typeof cur !== 'number' || !Number.isFinite(prev) || !Number.isFinite(cur) || prev <= 0 || cur <= 0) {
        throw new Error(`market ${m.id} has a non-finite or non-positive price`);
      }
      rets.push(Math.log(cur / prev));
    }
    // Median 1-minute log return, extrapolated over the 240-minute horizon (x240)
    // and taken at a quarter strength, then capped.
    const drift = median(rets) * 240 * DRIFT_SHARE;
    shift = Math.max(-MAX_LOG_SHIFT, Math.min(MAX_LOG_SHIFT, drift));
  }
  return price5(last * Math.exp(shift));
}

mkdirSync(OUTPUT_DIR, { recursive: true });
// Every case file, in name order, so two runs write the same bytes.
const inputs = readdirSync(INPUT_DIR).filter((f) => f.endsWith('.in')).sort();
for (const file of inputs) {
  const id = file.slice(0, -'.in'.length);
  const c = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as Case;
  if (!Array.isArray(c.markets) || c.markets.length !== 1) throw new Error(`${file} does not hold exactly one market`);
  writeFileSync(join(OUTPUT_DIR, `${id}.out`), `${JSON.stringify({ forecasts: [{ case: id, price: forecast(c.markets[0] as CaseMarket) }] })}\n`);
}
