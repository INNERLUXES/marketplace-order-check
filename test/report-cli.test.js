import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MAX_EXPIRY_DAYS, MAX_EXPIRY_DAYS, RULES, USAGE, VERSION, buildReport, checkText, listChecksJson, listChecksMarkdown, listChecksText, parseArgs, toJson, toMarkdown, toSarif, toText } from '../src/index.js';
import { ARGS, BAD, BADGE, FEES, GOOD, NOW, OFFER, OWLS, addr, cli, fee, file, order, run, text, withOrders } from './helpers.js';

const ch = (...codes) => String.fromCharCode(...codes);
// A file with an error and a warning: a listing at a price of 0, and an offer that never expires.
const MIXED = { 'orders.json': text(withOrders(order({ price: '0', fees: [] }), { ...OFFER, end: 'never' })) };
const mem = { file: 'mem.json', bytes: 1, lines: 1 };

test('exit codes: 0 for a pass, 1 for a finding at or above the fail-on level, 2 for a usage or input error', async () => {
  assert.equal((await run(GOOD, ARGS)).code, 0);
  assert.equal((await run(BAD, ARGS)).code, 1);
  assert.equal((await run(GOOD, ['nothing.json'])).code, 2);
  assert.equal((await run(GOOD, [])).code, 2);
  assert.equal((await run(GOOD, ['orders.json', 'other.json'])).code, 2);
  assert.equal((await run(GOOD, ['orders.json', '--bogus'])).code, 2);
  const none = await run({}, ['a.json']);
  assert.equal(none.code, 2);
  assert.match(none.err, /the input has a problem:\n {2}a\.json: does not exist\n/);
});

test('--fail-on and --min-severity: a warning fails the run at warning, and a hidden finding still counts for the result', async () => {
  const w = { 'w.json': text(withOrders(order({ end: 'never' }))) };
  assert.equal((await run(w, ['w.json'])).code, 0);
  assert.equal((await run(w, ['w.json', '--fail-on', 'warning'])).code, 1);
  assert.equal((await run(w, ['w.json', '--fail-on', 'info'])).code, 1);
  const r = await run(MIXED, [...ARGS, '--min-severity', 'error']);
  assert.match(r.out, /findings: 1 \(1 error\); 1 below error not shown\n/);
  const hidden = await run(w, ['w.json', '--min-severity', 'error', '--fail-on', 'warning']);
  assert.match(hidden.out, /findings: 0; 1 below error not shown/);
  assert.equal(hidden.code, 1);
  const info = { 'i.json': text(withOrders(order({ fees: [FEES[0]] }))) };
  assert.equal((await run(info, ['i.json', '--now', String(NOW)])).code, 0);
  assert.equal((await run(info, ['i.json', '--now', String(NOW), '--fail-on', 'info'])).code, 1, 'a note fails the run at info');
});

test('--now and --max-expiry-days: whole numbers, given once, that move the checks of the end', async () => {
  assert.equal(DEFAULT_MAX_EXPIRY_DAYS, 180);
  assert.equal(MAX_EXPIRY_DAYS, 36500);
  assert.equal(parseArgs(['o.json']).now, null);
  assert.equal(parseArgs(['o.json']).maxExpiryDays, null);
  assert.equal(parseArgs(['o.json', '--now', '0']).now, 0);
  assert.equal(parseArgs(['o.json', '--now', '999999999999']).now, 999999999999);
  assert.equal(parseArgs(['o.json', '--max-expiry-days', '1']).maxExpiryDays, 1);
  assert.equal(parseArgs(['o.json', '--max-expiry-days', '36500']).maxExpiryDays, 36500);
  for (const bad of ['-1', '1.5', '01', 'now', '1e9', '1000000000000']) assert.throws(() => parseArgs(['o.json', '--now', bad]), /--now: .* is not a whole number of unix seconds of at most 12 digits/, bad);
  for (const bad of ['0', '36501', '7.5', '07', 'week']) assert.throws(() => parseArgs(['o.json', '--max-expiry-days', bad]), /--max-expiry-days: .* is not a whole number of days from 1 to 36500/, bad);
  assert.throws(() => parseArgs(['o.json', '--now', '1', '--now', '2']), /given twice/);
  assert.throws(() => parseArgs(['o.json', '--max-expiry-days', '1', '--max-expiry-days', '2']), /given twice/);
  const late = { 'o.json': text(withOrders(order({ end: NOW + 200 * 86400 }))) };
  const r = await run(late, ['o.json', '--now', String(NOW)]);
  assert.match(r.out, /WARNING {2}expiry-too-long/);
  assert.equal((await run(late, ['o.json', '--now', String(NOW), '--max-expiry-days', '365'])).out.includes('expiry-too-long  '), true, 'the table of checks still names it');
  assert.doesNotMatch((await run(late, ['o.json', '--now', String(NOW), '--max-expiry-days', '365'])).out, /WARNING {2}expiry-too-long/);
  const json = JSON.parse((await run(late, ['o.json', '--json', '--now', String(NOW), '--max-expiry-days', '365'])).out);
  assert.deepEqual(json.config, { minSeverity: 'info', failOn: 'error', maxExpiryDays: 365, now: NOW });
});

test('the text report names the file, the export, the checks, each finding with its line and fix, the orders, and ends with the notice and the result', async () => {
  const r = await run(MIXED, ARGS);
  assert.match(r.out, /^marketplace-order-check: orders\.json\n/);
  assert.match(r.out, /\nfile: orders\.json \(JSON, \d+ lines, [\d,]+ bytes\)\n/);
  assert.match(r.out, /\nchain: ethereum\n/);
  assert.match(r.out, /\ncollections: 2: Harbor Example Owls, ERC-721, royalty 500 basis points \(5%\) to 0x9{40}; Meadow Example Badges, ERC-1155, royalty 250 basis points \(2\.5%\) to 0x8{40}\n/);
  assert.match(r.out, /\norders: 2 \(1 listing, 1 offer\)\n/);
  assert.match(r.out, /\nnow: unix second 1800000000, from --now\n/);
  assert.match(r.out, /\nmax expiry: 180 days\n/);
  assert.match(r.out, /\nfindings: 2 \(1 error, 1 warning\)\n/);
  assert.match(r.out, /ERROR {4}price-zero {25}orders\.json:\d+\n/);
  assert.match(r.out, /fix: Set the price, or mark a gift/);
  assert.match(r.out, /\nChecks \(26\)\n/);
  assert.ok(r.out.includes(['Orders (2)', '', '  order  side     collection           token  amount  price   fees        seller gets', '  L1     listing  Harbor Example Owls  #7     1       0       0           -', '  O1     offer    Harbor Example Owls  #9     1       1 WETH  0.075 WETH  0.925 WETH', ''].join('\n')));
  assert.match(r.out, /will fill as intended\.\n\nRESULT: FAIL - 1 finding at or above error \(1 error, 1 warning\)\n$/);
  const good = await run(GOOD, ARGS);
  assert.match(good.out, /Findings \(0\)\n\n {2}none\n/);
  const bare = await run({ 'o.json': text(file({ collections: [{ ...OWLS, royalty: undefined, standard: 'x' }, { contract: addr('2'), standard: 'ERC-1155', royalty: { receiver: addr('8'), bps: 'x' } }], orders: [] })) }, ['o.json']);
  assert.match(bare.out, /\ncollections: 2: Harbor Example Owls, standard not read, no royalty declared; 2, ERC-1155, royalty not read to 0x8{40}\n/);
  assert.match(bare.out, /\norders: 0 \(0 listings, 0 offers\)\n/);
  assert.match(bare.out, /\nnow: not given, so order-expired did not run\n/);
  assert.doesNotMatch(bare.out, /\nOrders \(/);
  const empty = await run({ 'o.json': text(file({ collections: [], chain: 'x' })) }, ['o.json']);
  assert.match(empty.out, /\nchain: not read\ncollections: none read\n/);
});

test('the table of orders: the side, collection, token, amount, price, fees and what the seller gets, with a dash for what was not read', async () => {
  const r = JSON.parse((await run({ 'o.json': text(withOrders(order(), { ...OFFER, kind: 'criteria', tokenId: undefined, criteria: { root: `0x${'3'.repeat(64)}` } }, { ...OFFER, id: 'O3', kind: 'collection', tokenId: undefined }, order({ id: 'T1', tokenId: '2', price: '0', transfer: true, fees: [] }), order({ id: 'X1', side: 'bid', tokenId: 'x', price: '1x', contract: addr('3') }), BADGE)) }, ['o.json', '--json'])).out);
  assert.deepEqual(r.orders.map((x) => [x.id, x.side, x.collection, x.token, x.amount, x.price, x.fees, x.sellerGets]), [
    ['L1', 'listing', 'Harbor Example Owls', '#7', 1, '1 ETH', '0.075 ETH', '0.925 ETH'],
    ['O1', 'offer', 'Harbor Example Owls', 'by root', 1, '1 WETH', '0.075 WETH', '0.925 WETH'],
    ['O3', 'offer', 'Harbor Example Owls', 'any', 1, '1 WETH', '0.075 WETH', '0.925 WETH'],
    ['T1', 'listing', 'Harbor Example Owls', '#2', 1, 'transfer', '0', null],
    ['X1', null, null, null, 1, null, null, null],
    ['B1', 'listing', 'Meadow Example Badges', '#3', 2, '40 USDC', '2 USDC', '38 USDC']
  ]);
  const text0 = (await run({ 'o.json': text(withOrders(order({ price: '0', fees: [] }), order({ id: 'L2', tokenId: '8', fees: [fee('marketplace', addr('f'), 10000)] }))) }, ['o.json'])).out;
  assert.ok(text0.includes(['  order  side     collection           token  amount  price  fees   seller gets', '  L1     listing  Harbor Example Owls  #7     1       0      0      -', '  L2     listing  Harbor Example Owls  #8     1       1 ETH  1 ETH  -'].join('\n')));
});

test('--explain adds the points of the pages to text, markdown and JSON, and the tool\'s own choice to a best practice check', async () => {
  const set = { 'orders.json': text(withOrders(order({ fees: [FEES[0], fee('royalty', addr('7'), 500)], end: 'never' }))) };
  const r = await run(set, [...ARGS, '--explain']);
  assert.match(r.out, /basis: The royaltyInfo function of ERC-2981 answers a marketplace with two values for a sale.*\(ERC-2981: NFT Royalty Standard, https:\/\/eips\.ethereum\.org\/EIPS\/eip-2981\)/);
  assert.match(r.out, /the tool's own choice: asking for an end on every order is a best practice of this tool/);
  const md = (await run(set, [...ARGS, '--format', 'markdown', '--explain'])).out;
  assert.match(md, /## Basis\n\n### order-never-expires\n\n- The tool's own choice: asking for an end/);
  assert.match(md, /### royalty-receiver-mismatch\n\n- The royaltyInfo function of ERC-2981/);
  const input = (await run({ 'o.json': text(withOrders(order({ makerBalanse: 1 }))) }, ['o.json', '--format', 'markdown', '--explain'])).out;
  assert.match(input, /### field-unknown\n\n- A problem with the file itself; it rests on no page\./);
  const json = JSON.parse((await run(set, [...ARGS, '--json', '--explain'])).out);
  assert.equal(json.findings.find((f) => f.id === 'royalty-receiver-mismatch').basis[0].url, 'https://eips.ethereum.org/EIPS/eip-2981');
  const plain = JSON.parse((await run(set, [...ARGS, '--json'])).out);
  assert.equal(plain.findings[0].basis, undefined);
  assert.equal((await run(set, [...ARGS, '--format', 'sarif', '--explain'])).code, 2);
});

test('the JSON report: the tool, the input, the export, totals by level, the rules, the findings, the orders and the result', async () => {
  const r = JSON.parse((await run(BAD, [...ARGS, '--json'])).out);
  assert.equal(r.tool, 'marketplace-order-check');
  assert.equal(r.version, VERSION);
  assert.equal(r.input.file, 'orders.json');
  assert.equal(r.input.format, 'json');
  assert.equal(r.export.chain, 'ethereum');
  assert.deepEqual(r.export.collections[0], { name: 'Harbor Example Owls', contract: addr('1'), standard: 'ERC-721', royalty: { bps: 500, percent: '5%', receiver: addr('9') } });
  assert.deepEqual(r.export.orders, { total: 2, listings: 1, offers: 1 });
  assert.deepEqual(r.totals, { findings: 1, byLevel: { error: 1, warning: 0, info: 0 }, hidden: 0 });
  assert.equal(r.rules.length, RULES.length);
  assert.deepEqual(r.config, { minSeverity: 'info', failOn: 'error', maxExpiryDays: 180, now: NOW });
  const f = r.findings[0];
  assert.deepEqual(Object.keys(f), ['id', 'severity', 'message', 'file', 'line', 'column', 'at', 'subject', 'fix', 'kind']);
  assert.deepEqual([f.id, f.file, f.at.startsWith('orders.json:'), f.subject], ['price-zero', 'orders.json', true, 'L1']);
  assert.deepEqual(r.orders[1], { id: 'O1', side: 'offer', collection: 'Harbor Example Owls', token: '#9', amount: 1, price: '1 WETH', fees: '0.075 WETH', sellerGets: '0.925 WETH' });
  assert.deepEqual(r.result, { pass: false, failOn: 'error', text: 'FAIL - 1 finding at or above error (1 error)' });
  assert.equal(r.export.collections[1].royalty.percent, '2.5%');
});

test('the SARIF report: version 2.1.0, every check as a rule, the file as the artifact and a result with its line and column', async () => {
  const s = JSON.parse((await run(MIXED, [...ARGS, '--format', 'sarif'])).out);
  assert.equal(s.version, '2.1.0');
  const runOf = s.runs[0];
  assert.equal(runOf.tool.driver.name, 'marketplace-order-check');
  assert.equal(runOf.tool.driver.rules.length, RULES.length);
  assert.deepEqual(runOf.artifacts.map((a) => a.location.uri), ['orders.json']);
  assert.deepEqual(runOf.results.map((x) => [x.ruleId, x.level, x.locations[0].physicalLocation.artifactLocation.uri]), [['price-zero', 'error', 'orders.json'], ['order-never-expires', 'warning', 'orders.json']]);
  assert.ok(runOf.results[0].locations[0].physicalLocation.region.startLine > 1);
  assert.equal(runOf.results[0].ruleIndex, RULES.findIndex((x) => x.id === 'price-zero'));
  assert.equal(runOf.properties.sources.length, 3);
  const info = JSON.parse((await run({ 'o.json': text(withOrders(order({ fees: [FEES[0]] }))) }, ['o.json', '--format', 'sarif'])).out);
  assert.equal(info.runs[0].results[0].level, 'note');
});

test('the markdown report escapes what markdown gives a meaning to, and every format replaces control and direction characters', async () => {
  const name = `Example [link](https://x.example) | ${ch(0x1b)}[31m red ${ch(0x202e)}rtl ${ch(7)}`;
  const set = { 'orders.json': text(file({ collections: [{ ...OWLS, name }], orders: [order({ id: `L|${ch(0x1b)}9`, end: 'never' }), order({ id: `L${ch(0x2028)}2`, tokenId: '8' })] })) };
  for (const format of ['text', 'markdown', 'json', 'sarif']) {
    const out = (await run(set, [...ARGS, '--format', format])).out;
    assert.ok(![...out].some((c) => [0x1b, 0x202e, 0x2028, 7].includes(c.charCodeAt(0))), format);
  }
  const md = (await run(set, [...ARGS, '--format', 'markdown'])).out;
  assert.match(md, /Order L\\\| 9 has no end|Order L\\\| 9 ends never/);
  assert.doesNotMatch(md, /\]\(https/);
  assert.match(md, /## Orders \(2\)\n\n\| Order \| Side \|/);
});

test('--list-checks in text, markdown and JSON, and no SARIF form', async () => {
  assert.match((await cli(['--list-checks'], process.cwd())).out, /^marketplace-order-check checks\n\n {2}file-unreadable/);
  assert.equal(listChecksText().split('\n').filter((l) => /^ {2}[a-z]/.test(l)).length, RULES.length);
  assert.match(listChecksText(), /None of it is legal or financial advice\./);
  assert.match(listChecksText(), /A documented check rests on ERC-2981, ERC-721 and ERC-1155;/);
  assert.match(listChecksMarkdown(), /\| royalty-receiver-mismatch \| warning \| documented \|/);
  assert.equal(JSON.parse(listChecksJson()).length, RULES.length);
  assert.equal((await cli(['--list-checks', '--format', 'markdown'], process.cwd())).code, 0);
  assert.equal((await cli(['--list-checks', '--format', 'sarif'], process.cwd())).code, 2);
});

test('--help, --version and usage errors: the usage names every check and option, and a value that looks like an option is refused', async () => {
  const help = await cli(['--help'], process.cwd());
  assert.equal(help.code, 0);
  for (const r of RULES) assert.ok(help.out.includes(r.id), r.id);
  for (const o of ['--format', '--json', '--min-severity', '--fail-on', '--now', '--max-expiry-days', '--explain', '--list-checks', '--help', '--version']) assert.ok(USAGE.includes(o), o);
  assert.match(USAGE, /is\s+not legal or financial advice/);
  assert.equal((await cli(['-h'], process.cwd())).code, 0);
  assert.equal((await cli(['--version'], process.cwd())).out, `${VERSION}\n`);
  assert.equal((await cli(['-v'], process.cwd())).out, `${VERSION}\n`);
  assert.throws(() => parseArgs(['a', '--fail-on', '--json']), /--fail-on needs a value/);
  assert.throws(() => parseArgs(['a', '--now']), /--now needs a value/);
  assert.throws(() => parseArgs(['a', '--fail-on', 'fatal']), /unknown level fatal/);
  assert.throws(() => parseArgs(['a', '--min-severity', 'all']), /--min-severity: unknown level all/);
  assert.throws(() => parseArgs(['a', '--format', 'xml']), /unknown format xml/);
  assert.throws(() => parseArgs(['a', '--json', '--format', 'text']), /ask for two formats/);
  assert.equal(parseArgs(['a', '--json', '--format', 'json']).format, 'json');
  assert.throws(() => parseArgs(['-']), /standard input is not supported/);
  assert.throws(() => parseArgs(['a', '--format', '-']), /standard input is not supported/);
  assert.throws(() => parseArgs(['https://example.com/orders.json']), /never fetches a URL/);
  assert.throws(() => parseArgs(['a', '--fail-on', 'error', '--fail-on', 'warning']), /given twice/);
  assert.throws(() => parseArgs([]), /give the order file/);
  const err = await cli(['--bogus'], process.cwd());
  assert.match(err.err, /^marketplace-order-check: unknown argument --bogus\n\nUsage:/);
});

test('an error that is not about the input is reported with exit code 2 and no report', async () => {
  const r = await cli(['orders.json'], `${process.cwd()}\u0000`);
  assert.equal(r.code, 2);
  assert.equal(r.out, '');
  assert.match(r.err, /^marketplace-order-check: /);
});

test('buildReport and the formats can be used without the file system, and a file that could not be read', () => {
  const report = buildReport({ file: mem, checked: checkText(text(withOrders(order(), BADGE))), version: '0' });
  assert.match(toText(report), /^marketplace-order-check: mem\.json/);
  assert.match(toMarkdown(report), /^# marketplace-order-check: mem\.json/);
  assert.equal(JSON.parse(toJson(report)).input.file, 'mem.json');
  assert.equal(JSON.parse(toSarif(report)).runs[0].results.length, 0);
  const none = buildReport({ file: mem, checked: checkText('['), version: '0' });
  assert.match(toText(none), /\norders: not read\n/);
  assert.equal(none.export, null);
  assert.equal(none.orders, null);
  assert.match(toMarkdown(none), /- Orders: not read/);
  const top = buildReport({ file: mem, checked: checkText('[1]'), version: '0' });
  assert.equal(top.export, null);
  assert.throws(() => checkText(null), TypeError, 'an error that is not one of the reader is not swallowed');
});
