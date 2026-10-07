// Command line: marketplace-order-check <orders.json> [options]

import { readFileSync } from 'node:fs';
import { DEFAULT_MAX_EXPIRY_DAYS, InputError, LIMITS, checkFile } from './check.js';
import { LEVELS } from './data.js';
import { listChecksJson, listChecksMarkdown, listChecksText, toJson, toMarkdown, toSarif, toText } from './report.js';
import { RULES } from './rules.js';
import { safeText } from './text.js';

export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const FORMATS = { text: toText, markdown: toMarkdown, json: toJson, sarif: toSarif };
const LISTS = { text: listChecksText, markdown: listChecksMarkdown, json: listChecksJson };

// The largest --max-expiry-days, and the form of --now: unix seconds of at most 12 digits.
export const MAX_EXPIRY_DAYS = 36500;
const DAYS = /^[1-9][0-9]{0,4}$/;
const SECONDS = /^(?:0|[1-9][0-9]{0,11})$/;

export const USAGE = `Usage: marketplace-order-check <orders.json> [options]

Reads an export of NFT marketplace orders before they are signed or filled (JSON: the chain, the collections with
their standard and their declared ERC-2981 royalty, and the listings and offers, each with its maker, taker, contract,
token, amount, price, currency, start, end, fees and criteria) and lists the mistakes of the orders: fees that add up
to the whole price, a royalty paid to another receiver or above or below the declared one, an order that never
expires, lasts too long, has expired or ends before it starts, a price of 0 or written wrong, a currency of another
chain, an offer in the native currency, a token listed twice, an ERC-721 amount other than 1, an ERC-1155 amount of 0
or above the balance, a malformed or zero address, a maker that is its own taker, and an offer for a set of tokens with
no merkle root. A private key or a seed in the file is an error whose value is never shown. It reads the file and is
not legal or financial advice: it contacts no chain, node, marketplace or API, fetches nothing, signs nothing, runs
nothing, reads no clock and writes nothing to disk.

Options:
  --format <name>            text, markdown, json or sarif (default: text)
  --json                     the same as --format json
  --min-severity <level>     the lowest level of a finding that is shown: ${LEVELS.join(', ')} (default: info)
  --fail-on <level>          the lowest level of a finding that fails the run: ${LEVELS.join(', ')} (default: error)
  --now <seconds>            the unix second to compare the end of each order with; without it order-expired does not run
  --max-expiry-days <n>      the length above which expiry-too-long warns, 1 to ${MAX_EXPIRY_DAYS} days (default: ${DEFAULT_MAX_EXPIRY_DAYS})
  --explain                  show the points of the pages behind each finding (text, markdown and JSON)
  --list-checks              list the checks with their level and kind, and exit
  --help                     show this text
  --version                  show the version

Checks: ${RULES.map((r) => r.id).join(', ')}.

Exit codes: 0 no finding at or above the fail-on level, 1 a finding at or above it, 2 usage or input error.
`;

const isUrl = (f) => /^[a-z][a-z0-9+.-]*:\/\//i.test(f);

export function parseArgs(argv) {
  const o = { paths: [], format: null, json: false, minSeverity: null, failOn: null, now: null, maxExpiryDays: null, explain: false, listChecks: false, help: false, version: false };
  const once = (name, current, value) => {
    if (current !== null) throw new Error(`${name} was given twice`);
    return value;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined || (v.startsWith('--') && v.length > 2)) throw new Error(`${a} needs a value`);
      if (v === '-') throw new Error('reading from standard input is not supported; give a file');
      i += 1;
      return v;
    };
    if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--version' || a === '-v') o.version = true;
    else if (a === '--explain') o.explain = true;
    else if (a === '--json') o.json = true;
    else if (a === '--list-checks') o.listChecks = true;
    else if (a === '--format') o.format = once(a, o.format, next());
    else if (a === '--min-severity') o.minSeverity = once(a, o.minSeverity, next());
    else if (a === '--fail-on') o.failOn = once(a, o.failOn, next());
    else if (a === '--now') o.now = once(a, o.now, next());
    else if (a === '--max-expiry-days') o.maxExpiryDays = once(a, o.maxExpiryDays, next());
    else if (a === '-') throw new Error('reading from standard input is not supported; give a file');
    else if (a.startsWith('-')) throw new Error(`unknown argument ${a}`);
    else {
      if (o.paths.length === 1) throw new Error('give one order file');
      o.paths.push(a);
    }
  }
  if (o.json) {
    if (o.format !== null && o.format !== 'json') throw new Error(`--json and --format ${o.format} ask for two formats; give one`);
    o.format = 'json';
  }
  if (o.format === null) o.format = 'text';
  if (!Object.hasOwn(FORMATS, o.format)) throw new Error(`unknown format ${o.format} (text, markdown, json or sarif)`);
  for (const [flag, v] of [['--min-severity', o.minSeverity], ['--fail-on', o.failOn]]) if (v !== null && !LEVELS.includes(v)) throw new Error(`${flag}: unknown level ${v} (${LEVELS.join(', ')})`);
  if (o.maxExpiryDays !== null) {
    if (!DAYS.test(o.maxExpiryDays) || Number(o.maxExpiryDays) > MAX_EXPIRY_DAYS) throw new Error(`--max-expiry-days: ${o.maxExpiryDays} is not a whole number of days from 1 to ${MAX_EXPIRY_DAYS}`);
    o.maxExpiryDays = Number(o.maxExpiryDays);
  }
  if (o.now !== null) {
    if (!SECONDS.test(o.now)) throw new Error(`--now: ${o.now} is not a whole number of unix seconds of at most 12 digits`);
    o.now = Number(o.now);
  }
  if (o.listChecks && o.format === 'sarif') throw new Error('--list-checks has no SARIF form; use text, markdown or json');
  if (!o.help && !o.version && !o.listChecks) {
    if (o.paths.length !== 1) throw new Error('give the order file, such as marketplace-order-check orders.json');
    if (isUrl(o.paths[0])) throw new Error('give a local path; the tool never fetches a URL');
    if (o.explain && o.format === 'sarif') throw new Error('--explain adds the points of the pages to the text, markdown and JSON reports; the sarif format has no place for them');
  }
  return o;
}

const clean = (text) => safeText(text, 1500);

// Exit code: 0 no finding at or above the fail-on level, 1 a finding at or above it, 2 usage or input error.
export async function main(argv, io = { out: (t) => process.stdout.write(t), err: (t) => process.stderr.write(t) }, limits = undefined, base = process.cwd()) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (error) {
    io.err(`marketplace-order-check: ${clean(error.message)}\n\n${USAGE}`);
    return 2;
  }
  if (o.help) {
    io.out(USAGE);
    return 0;
  }
  if (o.version) {
    io.out(`${VERSION}\n`);
    return 0;
  }
  if (o.listChecks) {
    io.out(LISTS[o.format]());
    return 0;
  }
  let report;
  try {
    report = await checkFile({ path: o.paths[0], minSeverity: o.minSeverity ?? 'info', failOn: o.failOn ?? 'error', maxExpiryDays: o.maxExpiryDays ?? DEFAULT_MAX_EXPIRY_DAYS, now: o.now, version: VERSION, limits: { ...LIMITS, ...(limits ?? {}) }, base });
  } catch (error) {
    if (error instanceof InputError) io.err(`marketplace-order-check: no result, the input has ${error.problems.length === 1 ? 'a problem' : 'problems'}:\n${error.problems.map((p) => `  ${clean(p)}`).join('\n')}\n`);
    else io.err(`marketplace-order-check: ${clean(error.message)}\n`);
    return 2;
  }
  io.out(FORMATS[o.format](report, { explain: o.explain }));
  return report.result.pass ? 0 : 1;
}
