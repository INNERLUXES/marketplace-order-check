// Shared test helpers: order files built inline, checked in memory or written into a temporary folder that is removed
// after the test. Paths are built with resolve() from forward-slash names, so the same test runs on Linux, macOS and
// Windows. The line a test expects is found with lineOf(), which counts lines the way the reader does, so a test never
// holds a line number worked out by hand for one system only. No test reads the clock, the time zone or the locale; the
// second a test compares an end with is NOW, given as --now. Every name is made up and every address and hash is one
// character written many times.

import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { checkText, main } from '../src/index.js';

export async function withFiles(files, fn) {
  const dir = await mkdtemp(resolve(tmpdir(), 'marketplace-order-check-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(dirname(resolve(dir, rel)), { recursive: true });
      await writeFile(resolve(dir, rel), content);
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// The line (from 1) of the n-th place where needle starts in text.
export function lineOf(text, needle, n = 1) {
  let at = -1;
  for (let i = 0; i < n; i += 1) {
    at = text.indexOf(needle, at + 1);
    if (at < 0) throw new Error(`${needle} is not in the text ${n} times`);
  }
  return text.slice(0, at).split('\n').length;
}

// A made-up EVM address of one character, or of a short run of characters, written to 40 hex digits.
export const addr = (c = '1') => `0x${c.repeat(40 / c.length)}`;

// A made-up hash of 32 bytes: one hex digit written 64 times, with 0x in front.
export const hash = (c = '3') => `0x${c.repeat(64)}`;

// The second the tests compare the ends of orders with, and a week and a day in seconds.
export const NOW = 1800000000;
export const WEEK = 604800;
export const DAY = 86400;

const drop = (out) => {
  for (const [k, v] of Object.entries(out)) if (v === undefined) delete out[k];
  return out;
};

// A fee: a share in basis points of the price, or an amount when amount is given.
export const fee = (kind, recipient, share) => (typeof share === 'string' ? { kind, recipient, amount: share } : { kind, recipient, bps: share });

// The fees of an order that pass every check: 2.5% to the marketplace and the 5% royalty the owls declare.
export const FEES = [fee('marketplace', addr('f'), 250), fee('royalty', addr('9'), 500)];

// The two collections of a clean file: an ERC-721 with a royalty of 5% to 0x99..99, and an ERC-1155 with 2.5% to 0x88..88.
export const OWLS = { contract: addr('1'), name: 'Harbor Example Owls', standard: 'ERC-721', royalty: { receiver: addr('9'), bps: 500 } };
export const BADGES = { contract: addr('2'), name: 'Meadow Example Badges', standard: 'ERC-1155', royalty: { receiver: addr('8'), bps: 250 } };

// A listing that passes every check: token 7 of the owls for 1 ETH, open for a week from NOW, with FEES. over replaces
// fields, and a field set to undefined is left out.
export const order = (over = {}) => drop({ id: 'L1', side: 'listing', kind: 'item', maker: addr('a'), contract: addr('1'), tokenId: '7', amount: 1, price: '1', currency: 'ETH', start: NOW, end: NOW + WEEK, fees: FEES, ...over });

// An offer that passes every check: 1 WETH for token 9 of the owls, from 0xbb..bb, with FEES.
export const OFFER = order({ id: 'O1', side: 'offer', maker: addr('b'), tokenId: '9', currency: 'WETH' });

// A listing of the badges that passes every check: 2 of token 3 out of a balance of 5, for 40 USDC, with 2.5% of royalty.
export const BADGE = order({ id: 'B1', maker: addr('c'), contract: addr('2'), tokenId: '3', amount: 2, makerBalance: 5, price: '40', currency: 'USDC', fees: [fee('marketplace', addr('f'), 250), fee('royalty', addr('8'), 250)] });

// A file that passes every check: on ethereum, the two collections, a listing and an offer. over replaces the parts of
// the file, and a part set to undefined is left out.
export function file(over = {}) {
  const out = { chain: 'ethereum', collections: [OWLS, BADGES], orders: [order(), OFFER] };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) delete out[k];
    else out[k] = v;
  }
  return out;
}

// A file with these orders.
export const withOrders = (...orders) => file({ orders });

export const text = (obj) => `${JSON.stringify(obj, null, 2)}\n`;

// The findings of a run in memory, for a file object or a text.
export const findingsOf = (p = file(), options = {}) => checkText(typeof p === 'string' ? p : text(p), options).findings;

// The ids of the findings of a run.
export const idsOf = (p, options) => findingsOf(p, options).map((f) => f.id);

// The findings of one check.
export const ofCheck = (p, id, options) => findingsOf(p, options).filter((f) => f.id === id);

// Runs the command line with exactly these arguments, in a folder.
export async function cli(argv, base) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

// Writes the files and runs the command line in the folder.
export async function run(files, args) {
  return withFiles(files, (dir) => cli(args, dir));
}

// A clean file, and one with a listing at a price of 0, for the command line tests.
export const GOOD = { 'orders.json': text(file()) };
export const BAD = { 'orders.json': text(withOrders(order({ price: '0' }), OFFER)) };
export const ARGS = ['orders.json', '--now', String(NOW)];

// The time a hostile test may take: four times as long when the runner collects coverage, which sets NODE_V8_COVERAGE.
export const allowed = (ms) => (process.env.NODE_V8_COVERAGE ? ms * 4 : ms);
