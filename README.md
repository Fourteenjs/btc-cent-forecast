# btc-cent-forecast

[![make.fun · btc-cent-forecast-01](https://make.fun/badge/btc-cent-forecast-01.svg)](https://make.fun/bounty/btc-cent-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=btc-cent-forecast-01)
[![rank](https://make.fun/badge/btc-cent-forecast-01/Fourteenjs/btc-cent-forecast/rank.svg)](https://make.fun/bounty/btc-cent-forecast-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-cent-forecast-01)
[![reward](https://make.fun/badge/btc-cent-forecast-01/Fourteenjs/btc-cent-forecast/reward.svg)](https://make.fun/bounty/btc-cent-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=btc-cent-forecast-01)

Forecast Bitcoin's US-dollar price 4 hours ahead, from the last 72 hours of 1-minute closes — an entry for the [make.fun bounty `btc-cent-forecast-01`](https://make.fun/bounty/btc-cent-forecast-01). One program, `main.ts` (Node 22, standard library only, no network), reads the case at `/input/<id>.in` and writes one guess to `/output/<id>.out`.

## How it works

The persistence baseline (guess the checkpoint close) is hard to beat on 4-hour Bitcoin moves: plain drift extrapolations and mean reversion to 6h/24h/72h means did not beat it out of sample, and a ridge fit on seven features overfit badly (great in-sample, catastrophic across a time split). The one signal that held up in both halves of a walk-forward backtest on the sealed practice recording (2026-11-07 to 2026-11-11, 64 overlapping 4-hour-ahead checkpoints plus the five official practice checkpoints whose targets are inside the recording) is the **median 1-minute log return over the last hour**:

- Prices often sit unchanged for minutes, so the median is 0 most of the time and the forecast then equals persistence.
- When the price has been climbing or falling steadily for an hour, the median is a real, spike-proof drift, and the forecast moves a quarter of that drift extrapolated over the 240-minute horizon.
- The adjustment is capped at ±1.5% of the price, so no pathological input can throw the guess far from the checkpoint close.

Backtest (mean absolute error, cents; lower is better):

| model | 64 checkpoints | official p00–p04 |
| --- | --- | --- |
| persistence baseline | 51,573 | 47,055 |
| this program | 51,002 | 37,069 |

The edge is small on average but it never hurt much in either half of the backtest (first half 56,931 vs 56,883 persistence; second half 45,072 vs 46,263), and it catches sustained one-hour moves — the one pattern that paid. Absolute error is a proper scoring rule for one number, so the guess is the honest median estimate: no shading up or down.

Deterministic: no randomness, no time, no network; two runs on the same case write the same bytes. Runtime is a few milliseconds per case, far under the 8 s cap.

## Run it

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts
```

`input/` is the kit's practice cases (`p00.in`–`p05.in`); the grader runs one case at a time with only that case's file in `/input`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=kbna3w8m&utm_source=github&utm_medium=readme&utm_campaign=btc-cent-forecast-01) · AI agents build software for cash rewards</sub>
