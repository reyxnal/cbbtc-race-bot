// cbBTC dip-bounce bot for the agent-fun/bars-replay/v1 protocol.
//
// Idea, from studying the dev window: cbBTC on this pool moves in small
// steps and sharp drops tend to bounce back within the next hour, while
// strength after a rise tends to fade. A full round trip costs roughly
// 24 bps (4 bps fee + 2 bps slippage per side plus price impact), so the
// bot only buys a drop that is large compared with that cost, holds for
// a short bounce, and otherwise stays in cash. Staying in cash is the
// default: in a falling window cash loses nothing.
//
// Protocol: the harness sends a hello line, then one batch line per bar,
// then done. For every batch the bot answers exactly one reply line with
// its orders. Orders decided on a batch fill at the next bar's open.
//
// Parameters below were tuned on the dev window with a simulator that
// replicates this bot exactly, and confirmed on both halves of the window.
//
// Strategy, per batch, for the single symbol CBBTC:
//   entry: flat, at least LOOKBACK closes seen, no position opened or
//     closed in the last COOLDOWN bars, and the latest close is at least
//     DROP_BPS below the close LOOKBACK bars ago -> buy FRAC of cash.
//   exit (whole position, valued at the latest close against its cost):
//     value >= cost * (1 + TAKE_BPS)  -> take the bounce
//     value <= cost * (1 - STOP_BPS)  -> the drop was not a bounce, cut it
//     held for HOLD_BARS bars         -> time out, back to cash
// All decisions use only the bars and account of the batches themselves:
// no clock, no network, no files, no randomness, so two runs of the same
// window produce the same orders byte for byte.

import { createInterface } from 'node:readline';

const LOOKBACK = 50;
const DROP_BPS = 55;
const TAKE_BPS = 120;
const STOP_BPS = 25;
const HOLD_BARS = 105;
const COOLDOWN = 20;
const FRAC_NUM = 60n;
const FRAC_DEN = 100n;
const MAX_SLIPPAGE_BPS = 150;

interface Pos { qty: bigint; cost: bigint }

const closes: number[] = [];
let cash = 0n;
let pos: Pos | null = null;
let heldBars = 0;
let sinceFlat = 1000000; // bars since the last exit (or since the start)
let orderSeq = 0;
let quoteScale = 6;
let priceScale = 5;
let qtyScale = 8;
let minNotional = 1000000n;
let symbol = 'CBBTC';

function valueAt(qty: bigint, closeRaw: bigint): bigint {
  return (qty * closeRaw * 10n ** BigInt(quoteScale)) / 10n ** BigInt(qtyScale + priceScale);
}

function decide(closeRaw: bigint): unknown[] {
  const orders: unknown[] = [];
  if (pos !== null) {
    heldBars++;
    const value = valueAt(pos.qty, closeRaw);
    const take = value * 10000n >= pos.cost * BigInt(10000 + TAKE_BPS);
    const stop = value * 10000n <= pos.cost * BigInt(10000 - STOP_BPS);
    if (take || stop || heldBars >= HOLD_BARS) {
      orderSeq++;
      orders.push({ side: 'sell', client_id: 'o' + orderSeq, symbol, qty: pos.qty.toString(), max_slippage_bps: MAX_SLIPPAGE_BPS });
    }
    return orders;
  }
  sinceFlat++;
  if (closes.length > LOOKBACK && sinceFlat > COOLDOWN) {
    const now = closes[closes.length - 1]!;
    const before = closes[closes.length - 1 - LOOKBACK]!;
    // now <= before * (1 - DROP_BPS/10000), compared in float64 on the raw
    // closes: the same bars always give the same comparison.
    if (now * 10000 <= before * (10000 - DROP_BPS)) {
      const notional = (cash * FRAC_NUM) / FRAC_DEN;
      if (notional >= minNotional) {
        orderSeq++;
        orders.push({ side: 'buy', client_id: 'o' + orderSeq, symbol, notional_quote_units: notional.toString(), max_slippage_bps: MAX_SLIPPAGE_BPS });
      }
    }
  }
  return orders;
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of rl) {
  if (line.trim() === '') continue;
  const msg = JSON.parse(line);
  if (msg.type === 'hello') {
    quoteScale = msg.capital.quote_scale;
    minNotional = BigInt(msg.fees.min_notional_quote_units);
    if (msg.symbols.length > 0) {
      symbol = msg.symbols[0].symbol;
      priceScale = msg.symbols[0].price_scale;
      qtyScale = msg.symbols[0].qty_scale;
    }
    cash = BigInt(msg.capital.quote_units);
  } else if (msg.type === 'batch') {
    cash = BigInt(msg.account.cash_quote_units);
    const held: Pos | null = msg.account.positions.length > 0
      ? { qty: BigInt(msg.account.positions[0].qty), cost: BigInt(msg.account.positions[0].cost_quote_units) }
      : null;
    if (held !== null && pos === null) heldBars = 0;
    if (held === null && pos !== null) sinceFlat = 0;
    pos = held;
    let closeRaw: bigint | null = null;
    for (const bar of msg.bars) {
      if (bar.symbol === symbol) {
        closes.push(Number(bar.c));
        closeRaw = BigInt(bar.c);
      }
    }
    const orders = closeRaw === null ? [] : decide(closeRaw);
    process.stdout.write(JSON.stringify({ type: 'reply', seq: msg.seq, orders }) + '\n');
  } else if (msg.type === 'done') {
    break;
  }
}
