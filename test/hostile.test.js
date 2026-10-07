import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { JSON_LIMITS, ORDER_LIMITS, checkText } from '../src/index.js';
import { ARGS, GOOD, NOW, OFFER, addr, allowed, cli, file, order, run, text, withFiles, withOrders } from './helpers.js';

// Each test builds input meant to make the tool slow or to exhaust the stack or the memory, and checks that it ends with
// an answer in good time. The time allowed is four times as long under coverage (NODE_V8_COVERAGE is set only when
// coverage is on).

function timed(fn) {
  const start = process.hrtime.bigint();
  const value = fn();
  return { value, ms: Number(process.hrtime.bigint() - start) / 1e6 };
}

test('a hundred thousand listings of one token by one maker: the first ten thousand are read, each compared once, in good time', () => {
  const orders = Array.from({ length: 100000 }, (_, i) => order({ id: `L${i}`, fees: [] }));
  const { value, ms } = timed(() => checkText(text(withOrders(...orders)), { now: NOW }));
  assert.equal(value.read.orders.length, ORDER_LIMITS.maxOrders);
  assert.equal(value.findings.filter((f) => f.id === 'duplicate-listing').length, ORDER_LIMITS.maxOrders - 1);
  assert.ok(value.notes.includes('the file holds 100000 orders; the tool read the first 10000 and left the rest out'));
  assert.ok(ms < allowed(20000), `took ${ms} ms`);
});

test('deep nesting ends with a file-unreadable finding at the limit, never a stack overflow, and the secret scan does not recurse', () => {
  const deep = `${'['.repeat(100000)}${']'.repeat(100000)}`;
  const { value } = timed(() => checkText(deep));
  assert.equal(value.findings[0].id, 'file-unreadable');
  assert.match(value.findings[0].message, new RegExp(`nested more than ${JSON_LIMITS.maxDepth} deep`));
  const nested = text(file()).replace('"chain": "ethereum"', `"notes": ${'['.repeat(JSON_LIMITS.maxDepth - 2)}"x"${']'.repeat(JSON_LIMITS.maxDepth - 2)}, "chain": "ethereum"`);
  assert.deepEqual(checkText(nested, { now: NOW }).findings, []);
  const keyed = `{"privateKey": ${'{"a": '.repeat(JSON_LIMITS.maxDepth - 1)}1${'}'.repeat(JSON_LIMITS.maxDepth - 1)}}`;
  assert.equal(checkText(keyed).findings.filter((f) => f.id === 'secret-in-file').length, 1);
  const roots = `{"root": ${'{"root": '.repeat(JSON_LIMITS.maxDepth - 2)}"${'1'.repeat(64)}"${'}'.repeat(JSON_LIMITS.maxDepth - 1)}`;
  assert.deepEqual(checkText(roots).findings.filter((f) => f.id === 'secret-in-file'), [], 'the walk for hashes does not recurse either');
});

test('numbers with thousands of digits and huge exponents are refused, not worked out', () => {
  const huge = `1${'0'.repeat(5000)}`;
  const big = text(withOrders(order({ price: huge, amount: 1, start: NOW }))).replace('"amount": 1', `"amount": ${huge}`).replace(`"start": ${NOW}`, `"start": ${huge}`);
  const { value, ms } = timed(() => checkText(big));
  assert.ok(value.findings.some((f) => f.id === 'price-malformed' && /price of order L1/.test(f.message)));
  assert.ok(value.findings.some((f) => f.id === 'field-invalid' && /amount of order L1/.test(f.message)));
  assert.ok(value.findings.some((f) => f.id === 'field-invalid' && /start of order L1/.test(f.message)));
  assert.ok(value.findings.every((f) => f.message.length < 700));
  assert.ok(ms < allowed(3000), `took ${ms} ms`);
  const exp = checkText(text(withOrders(order())).replace('"bps": 500', '"bps": 1e999999'));
  assert.ok(exp.findings.some((f) => f.id === 'field-invalid' && /bps/.test(f.message)));
  const token = checkText(text(withOrders(order({ tokenId: huge }))));
  assert.ok(token.findings.some((f) => f.id === 'field-invalid' && /tokenId of order L1/.test(f.message) && f.message.length < 400));
  const far = checkText(text(withOrders(order({ end: huge }))));
  assert.ok(far.findings.some((f) => f.id === 'field-invalid' && /end of order L1/.test(f.message)), 'an end of more than 78 digits is not read as never');
});

test('long strings, long names and long fields are read in good time, and the messages stay short', () => {
  const long = file({ collections: [{ contract: addr('1'), name: 'n'.repeat(200000), standard: 'ERC-721', royalty: { receiver: addr('9'), bps: 500 } }] });
  const { value, ms } = timed(() => checkText(text(long), { now: NOW }));
  assert.ok(value.findings.every((x) => x.message.length < 900));
  assert.ok(ms < allowed(5000), `took ${ms} ms`);
  const wide = checkText(text(withOrders(order({ maker: `0x${'1'.repeat(200000)}`, currency: 'X'.repeat(200000) }))));
  const f = wide.findings.find((x) => x.id === 'address-malformed');
  assert.ok(f.message.length < 600);
  assert.ok(wide.findings.every((x) => x.message.length < 900));
  assert.ok(wide.notes.every((n) => n.length < 900));
  const id = checkText(text(withOrders(order({ id: 'p'.repeat(200000), end: 'never' }))));
  assert.ok(id.findings.every((x) => x.message.length < 900 && (x.subject ?? '').length < 200));
});

test('names such as __proto__, constructor and toString are only names', () => {
  const t = text(file()).replace('"chain": "ethereum"', '"__proto__": {"polluted": 1}, "hasOwnProperty": 2, "chain": "ethereum"');
  const { value } = timed(() => checkText(t, { now: NOW }));
  assert.ok(value.findings.some((f) => f.id === 'field-unknown' && /"__proto__"/.test(f.message)));
  assert.ok(value.findings.some((f) => f.id === 'field-unknown' && /"hasOwnProperty"/.test(f.message)));
  assert.equal({}.polluted, undefined);
  const cur = checkText(text(withOrders(order({ currency: '__proto__', id: 'constructor', fees: [] }), { ...OFFER, currency: 'toString' })), { now: NOW });
  assert.deepEqual(cur.findings.map((f) => f.id), ['royalty-below-declared'], 'the listing pays no royalty; nothing else is found');
  assert.ok(cur.notes.some((n) => n.includes('__PROTO__ and TOSTRING are not one the tool knows')));
  assert.deepEqual(checkText(text(file({ chain: 'constructor' }))).findings.map((f) => f.id), ['field-invalid']);
  assert.deepEqual(checkText(text(withOrders(order({ side: '__proto__' })))).findings.map((f) => f.id), ['field-invalid']);
});

test('a run leaves the folder as it was: the tool writes nothing', async () => {
  await withFiles(GOOD, async (dir) => {
    const before = (await readdir(dir, { recursive: true })).sort();
    await cli([...ARGS, '--format', 'sarif'], dir);
    await cli([...ARGS, '--json', '--explain'], dir);
    assert.deepEqual((await readdir(dir, { recursive: true })).sort(), before);
  });
  assert.equal((await run(GOOD, ARGS)).code, 0);
});
