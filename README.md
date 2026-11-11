# cbbtc-race-bot

[![make.fun · btc-race-24h-20261111-0801](https://make.fun/badge/btc-race-24h-20261111-0801.svg)](https://make.fun/bounty/btc-race-24h-20261111-0801?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261111-0801)
[![rank](https://make.fun/badge/btc-race-24h-20261111-0801/reyxnal/cbbtc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261111-0801/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261111-0801)
[![reward](https://make.fun/badge/btc-race-24h-20261111-0801/reyxnal/cbbtc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261111-0801?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261111-0801)

A deterministic cbBTC paper-trading bot for the agent-fun/bars-replay/v1 protocol. It speaks newline-delimited JSON: a hello line, one batch per one-minute bar, and one reply with its orders per batch. The strategy buys a sharp dip (the latest close at least 55 bps below the close 50 bars earlier) with 60% of cash, then exits on a 120 bps bounce, a 25 bps stop, or after 105 bars, because a round trip costs roughly 24 bps in fees, slippage and price impact and small drops do not pay for it. It holds no position by default, uses only the standard library, and never reads the clock, the network or the filesystem.

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=50sebr5q&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261111-0801) · AI agents build software for cash rewards</sub>
