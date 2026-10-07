// Runs the README examples, checks that they report what the README shows, and writes the reports of the two made-up
// order files to examples/output. CI runs it and then fails if those files changed, so the example output in the
// repository is always the real output.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

// The arguments of the examples; every path is relative to the root of the repository. Both name the second to compare
// the ends of the orders with, so that the reports do not move with the clock.
export const NOW = '1800000000';
export const BAD = ['examples/bad/orders.json', '--now', NOW];
export const GOOD = ['examples/good/orders.json', '--now', NOW];

// Runs the tool on files of the repository; the paths shown in the report are relative to the root of the repository.
export async function run(argv, base = root) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

// What the README says of the bad file: the counts, a finding of nearly every check, and the result.
export const EXPECTED = [
  'chain: ethereum',
  'orders: 9 (5 listings, 3 offers)',
  'now: unix second 1800000000, from --now',
  'findings: 27 (18 error, 6 warning, 3 info)',
  'Order L1 is for 2 of token #7 of the ERC-721 collection Harbor Example Owls, but an ERC-721 holder has none or one of a token.',
  'Order L3 has a price of 0 and is not marked as a transfer',
  'Order L3 starts at unix second 1800500000 and ends at 1800400000, so it is open for no second: it ends before it starts.',
  'Order L4 lists 12 of token #3 of the ERC-1155 collection Meadow Example Badges, but the file declares a balance of 5 for its maker.',
  'The price of order L4 has 7 decimal places, but USDC holds 6',
  'The taker of order L5 is its own maker',
  'Order L5 is for 0 of token #4 of the ERC-1155 collection Meadow Example Badges.',
  'The currency of order L5 is SOL, which the tool knows on no chain of the EVM family, but the chain of the file is ethereum.',
  'The fees of order L5 add up to 3 SOL, 1 SOL above its price of 2 SOL',
  'The maker of order O1, "0x12345", has 5 characters after 0x, not 40',
  'Offer O1 is priced in ETH, the native currency of ethereum',
  'Order O1 ends at unix second 1799900000, 100,000 seconds before the second given with --now, 1800000000',
  'The recipient of fee 1 of order O1, "0x0000000000000000000000000000000000000000", is the zero address',
  'Order O2 is an offer for a set of tokens with no criteria',
  'The id o1 is also the id of the order at line 14',
  'The file holds the key "seedPhrase", which names a seed, a mnemonic or a private key.',
  'Order O4 has no price.',
  'The side of order O4 is "bid"; it must be one of listing, offer.',
  'Order L1 is open for more than 358 days from its start, longer than the 180 days of --max-expiry-days.',
  'Fee 2 of order L1 pays royalty to 0x7777777777777777777777777777777777777777, but collection Harbor Example Owls declares 0x9999999999999999999999999999999999999999 as its receiver.',
  'Order L2 lists token #7 of Harbor Example Owls by the same maker as order L1 at line 9 at another price, 1.5 ETH there and 1.2 ETH here.',
  'Order L2 has no end, so it stays open for good',
  'Order L2 pays 0.09 ETH of royalty, but the royalty of 5% that collection Harbor Example Owls declares works out to 0.06 ETH on the price of 1.2 ETH.',
  'The key "makerBalanse" of order 5 is not one the tool reads, so its value was left out of every check. Did you mean "makerBalance"?',
  'Order L1 pays 0.045 ETH of royalty, but the royalty of 5% that collection Harbor Example Owls declares works out to 0.075 ETH on the price of 1.5 ETH.',
  'Order L5 pays no royalty',
  'Order o1 is a collection offer, so any holder of Harbor Example Owls may fill it with the token they want least.',
  'not legal or financial advice, not an audit of the marketplace or its contracts and not a guarantee that an order will fill as intended',
  'RESULT: FAIL - 18 findings at or above error (18 error, 6 warning, 3 info)'
];
// What must not be reported: the check the bad file does not hold, the seed, and a pass.
export const UNWANTED = ['ERROR    file-unreadable', 'lantern', 'RESULT: PASS'];

// What the README says of the good file: no finding.
export const GOOD_EXPECTED = [
  'chain: ethereum',
  'orders: 5 (3 listings, 2 offers)',
  'findings: 0',
  'RESULT: PASS - no finding at or above error'
];

const problems = [];
function expect(name, result, code, expected, unwanted, stream = 'out') {
  const text = result[stream];
  const missing = expected.filter((e) => !text.includes(e));
  const wrong = unwanted.filter((e) => text.includes(e));
  if (result.code !== code || missing.length || wrong.length) {
    problems.push(`${name}: unexpected report (exit code ${result.code}, expected ${code}; missing: ${missing.join(' / ') || 'none'}; should not appear: ${wrong.join(' / ') || 'none'})${result.err ? `\n${result.err}` : ''}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bad = await run(BAD);
  process.stdout.write(bad.out);
  expect('bad file', bad, 1, EXPECTED, UNWANTED);

  const good = await run(GOOD);
  expect('good file', good, 0, GOOD_EXPECTED, ['ERROR    ', 'WARNING  ', 'INFO     ', 'RESULT: FAIL', '4444444444444444444444444444444444444444444444444444444444444444', '3333333333333333333333333333333333333333333333333333333333333333']);
  // The good file also passes when warnings and notes fail the run.
  expect('good, fail on warning', await run([...GOOD, '--fail-on', 'warning']), 0, ['RESULT: PASS - no finding at or above warning'], []);
  expect('good, fail on info', await run([...GOOD, '--fail-on', 'info']), 0, ['RESULT: PASS - no finding at or above info'], []);
  // A shorter length makes the good file warn, and the warning fails the run at warning.
  expect('good, max expiry 7 days', await run([...GOOD, '--max-expiry-days', '7', '--fail-on', 'warning']), 1, ['WARNING  expiry-too-long', 'Order L1 is open for 30 days from its start, longer than the 7 days of --max-expiry-days.'], []);
  // A later --now makes the orders of the good file expire.
  expect('good, a later now', await run(['examples/good/orders.json', '--now', '1802592000']), 1, ['ERROR    order-expired', 'Order L1 ends at unix second 1802592000, the second given with --now'], []);
  // Without --now the good file passes, and a note says that order-expired did not run.
  expect('good, no now', await run(['examples/good/orders.json']), 0, ['note: no --now was given, so order-expired did not run'], []);
  // The bad file with only the errors shown still counts the rest.
  expect('bad, errors only', await run([...BAD, '--min-severity', 'error']), 1, ['findings: 18 (18 error); 9 below error not shown'], ['WARNING  ', 'INFO     ']);
  // A file that is not there stops the run with no report, and so does a --now that is not a number of seconds.
  expect('missing file', await run(['examples/none/orders.json']), 2, ['examples/none/orders.json: does not exist'], [], 'err');
  expect('now not whole', await run(['examples/good/orders.json', '--now', '1.5']), 2, ['--now: 1.5 is not a whole number of unix seconds of at most 12 digits'], [], 'err');

  // The README shows the head of the report of the bad file with its table of checks, one finding, the table of orders
  // and the end of the report, and the end of the report of the good file.
  const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
  const lines = bad.out.split('\n');
  const head = lines.slice(0, lines.findIndex((l) => l.startsWith('Findings ('))).join('\n');
  if (!readme.includes(head)) problems.push('README: the head of the sample output of the bad file differs from a real run');
  const explained = (await run([...BAD, '--explain'])).out.split('\n');
  const at = explained.findIndex((l) => l.includes('royalty-receiver-mismatch') && l.includes('examples/bad/orders.json:'));
  const sample = explained.slice(at, at + 4).join('\n');
  if (at < 0 || !readme.includes(sample)) problems.push('README: the sample finding of the royalty receiver differs from a real run');
  const t = lines.findIndex((l) => l.startsWith('Orders ('));
  const table = lines.slice(t, t + 12).join('\n');
  if (t < 0 || !readme.includes(table)) problems.push('README: the table of orders of the bad file differs from a real run');
  const tail = lines.slice(-4).join('\n');
  if (!readme.includes(tail)) problems.push('README: the tail of the sample output of the bad file differs from a real run');
  const goodTail = good.out.split('\n').slice(-15).join('\n');
  if (!readme.includes(goodTail)) problems.push('README: the tail of the sample output of the good file differs from a real run');

  await mkdir(resolve(root, 'examples/output'), { recursive: true });
  await writeFile(resolve(root, 'examples/output/bad.txt'), bad.out);
  await writeFile(resolve(root, 'examples/output/good.txt'), good.out);
  const outputs = [
    ['bad-explain.txt', [...BAD, '--explain'], 1],
    ['bad.md', [...BAD, '--format', 'markdown'], 1],
    ['bad-explain.md', [...BAD, '--format', 'markdown', '--explain'], 1],
    ['bad.json', [...BAD, '--json', '--explain'], 1],
    ['bad.sarif', [...BAD, '--format', 'sarif'], 1],
    ['good.md', [...GOOD, '--format', 'markdown'], 0],
    ['good.json', [...GOOD, '--json'], 0],
    ['good.sarif', [...GOOD, '--format', 'sarif'], 0],
    ['checks.txt', ['--list-checks'], 0],
    ['checks.json', ['--list-checks', '--format', 'json'], 0]
  ];
  for (const [name, args, code] of outputs) {
    const r = await run(args);
    if (r.code !== code) problems.push(`${name}: exit code ${r.code}, expected ${code}`);
    await writeFile(resolve(root, 'examples/output', name), r.out);
  }

  if (problems.length) {
    for (const p of problems) console.error(`example: ${p}`);
    process.exit(1);
  }
}
