import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HASH_KEYS, SECRET_KEYS, checkText, fileSecrets, findSecrets, hashNodes, isSecretKey, readJson, secretShape } from '../src/index.js';
import { ARGS, OFFER, addr, file, findingsOf, hash, lineOf, order, run, text, withOrders } from './helpers.js';

// Shapes built from repeated characters, so that no file of the repository holds anything that could be a real seed or
// key.
const MNEMONIC = Array.from({ length: 12 }, () => 'lantern').join(' ');
const MNEMONIC_24 = Array.from({ length: 24 }, (_, i) => (i % 2 ? 'harbor' : 'lantern')).join(' ');
const XPRV = `x${'prv'}${'9'.repeat(107)}`;
const HEX = `0x${'ab'.repeat(32)}`;
const WIF = `5${'H'.repeat(50)}`;

// An offer for a set of tokens with a criteria root, and an order with the hash of the order.
const CRITERIA = order({ id: 'O2', side: 'offer', kind: 'criteria', maker: addr('b'), tokenId: undefined, currency: 'WETH', criteria: { root: hash('3') } });
const HASHED = order({ orderHash: hash('4') });

test('secretShape: a mnemonic of 12 to 24 words, an extended private key, a key in hex and a key in WIF', () => {
  assert.equal(secretShape(MNEMONIC), 'a mnemonic');
  assert.equal(secretShape(MNEMONIC_24), 'a mnemonic');
  assert.equal(secretShape(`  ${MNEMONIC}  `), 'a mnemonic');
  assert.equal(secretShape(XPRV), 'an extended private key');
  assert.equal(secretShape(HEX), 'a private key in hex');
  assert.equal(secretShape(HEX.slice(2)), 'a private key in hex');
  assert.equal(secretShape(WIF), 'a private key in WIF');
  assert.equal(secretShape(`K${'z'.repeat(51)}`), 'a private key in WIF');
});

test('secretShape: addresses, names, token ids and other near misses are not secrets', () => {
  for (const ok of [addr(), addr('ab'), 'Harbor Example Owls', 'harbor example owls', `0x${'ab'.repeat(31)}`, Array.from({ length: 11 }, () => 'lantern').join(' '), `x${'pub'}${'9'.repeat(107)}`, '7', '9'.repeat(77), 'ERC-721', '']) assert.equal(secretShape(ok), null, ok);
});

test('isSecretKey: names of keys and seeds in any case and with any separator, and near misses', () => {
  for (const k of ['privateKey', 'private_key', 'PRIVATE-KEY', 'mnemonic', 'seedPhrase', 'seed phrase', 'xprv', 'wif', 'secret', 'passphrase', 'password']) assert.ok(isSecretKey(k), k);
  for (const k of ['maker', 'taker', 'contract', 'tokenId', 'root', 'orderHash', 'receiver', 'recipient', 'publicKey']) assert.ok(!isSecretKey(k), k);
  assert.ok(SECRET_KEYS.includes('privatekey'));
});

test('secret-in-file: a key named for a seed in an order, at its line, reported once and never shown in any format', async () => {
  const p = withOrders(order({ seedPhrase: MNEMONIC }), OFFER);
  const f = findingsOf(p);
  assert.deepEqual(f.map((x) => x.id), ['secret-in-file'], 'the key is reported once, as a secret, and not as unknown');
  assert.match(f[0].message, /^The file holds the key "seedPhrase", which names a seed, a mnemonic or a private key\. The tool never reads one, and the value is not shown\.$/);
  assert.equal(f[0].line, lineOf(text(p), '"seedPhrase"'));
  assert.equal(f[0].file, 'orders');
  for (const format of ['text', 'markdown', 'json', 'sarif']) {
    const r = await run({ 'orders.json': text(p) }, [...ARGS, '--format', format]);
    assert.equal(r.code, 1, format);
    assert.ok(!r.out.includes('lantern'), format);
  }
});

test('secret-in-file: a value shaped like a key under any field, the field left out of the checks and never echoed', async () => {
  for (const [shape, value] of [['a mnemonic', MNEMONIC], ['an extended private key', XPRV], ['a private key in hex', HEX], ['a private key in WIF', WIF]]) {
    const p = withOrders(order({ taker: value, fees: [{ kind: 'marketplace', recipient: value, bps: 250 }, { kind: 'royalty', recipient: addr('9'), bps: 500 }] }), OFFER);
    const r = checkText(text(p));
    const secrets = r.findings.filter((f) => f.id === 'secret-in-file');
    assert.equal(secrets.length, 2, shape);
    assert.ok(secrets.some((f) => f.message.startsWith(`The value of "recipient" is shaped like ${shape}.`)), shape);
    assert.match(secrets.find((f) => f.message.includes('"taker"')).message, new RegExp(`^The value of "taker" is shaped like ${shape}\\. The tool never reads a seed or a key, and the value is not shown\\.$`));
    assert.ok(!r.findings.some((f) => f.message.includes(value)), shape);
    assert.ok(!r.findings.some((f) => ['address-malformed', 'field-missing', 'maker-is-taker'].includes(f.id)), `${shape}: the fields are there, but not read`);
    const out = await run({ 'orders.json': text(p) }, [...ARGS, '--json', '--explain']);
    assert.ok(!out.out.includes(value), shape);
  }
});

test('a hash under root or orderHash is read as a hash, not as a key, and never shown', async () => {
  const p = withOrders(HASHED, CRITERIA);
  assert.deepEqual(findingsOf(p), []);
  assert.deepEqual(HASH_KEYS, ['root', 'orderHash']);
  assert.equal(hashNodes(readJson(text(p))).length, 2);
  assert.deepEqual(fileSecrets(readJson(text(p))), []);
  assert.equal(findSecrets(readJson(text(p))).length, 2, 'the search of the sibling tools alone takes both hashes for keys');
  for (const format of ['text', 'markdown', 'json', 'sarif']) {
    const r = await run({ 'orders.json': text(p) }, [...ARGS, '--format', format]);
    assert.ok(!r.out.includes('3'.repeat(64)) && !r.out.includes('4'.repeat(64)), format);
  }
  const bare = withOrders(order({ orderHash: 'ab'.repeat(32) }));
  assert.deepEqual(findingsOf(bare), [], 'a hash with no 0x in front');
});

test('a 64-hex value under any other key is still a key, and a mnemonic or a WIF under root is still a secret', () => {
  assert.deepEqual(findingsOf(withOrders(order({ notes: hash('4') }))).map((f) => f.id), ['secret-in-file']);
  assert.deepEqual(findingsOf(file({ notes: { root: hash('4') } })).map((f) => f.id), [], 'a hash under root in the notes is a hash in a note no one reads');
  assert.deepEqual(findingsOf(withOrders(order({ merkleRoot: hash('4') }))).map((f) => f.id), ['secret-in-file', 'field-unknown'], 'merkleRoot is not a key of this tool, so its value is a key, and the key is unknown');
  for (const value of [MNEMONIC, WIF, XPRV]) {
    const f = findingsOf(withOrders(order({ ...CRITERIA, tokenId: undefined, criteria: { root: value } })));
    assert.deepEqual(f.map((x) => x.id), ['secret-in-file'], 'the root is there but not read, as every secret field is');
    assert.ok(!f.some((x) => x.message.includes(value)));
  }
  const keyed = findingsOf(withOrders(order({ privateKey: { root: hash('4') } })));
  assert.deepEqual(keyed.map((f) => f.id), ['secret-in-file'], 'a hash under a key named for a key stays hidden');
});

test('secret-in-file: a key shaped like a mnemonic is not shown, and a secret in a list or under a secret key is reported once', () => {
  const r = checkText(text({ ...file(), [MNEMONIC]: 1, extra: [HEX], privateKey: { nested: XPRV } }));
  const secrets = r.findings.filter((f) => f.id === 'secret-in-file');
  assert.equal(secrets.length, 3);
  assert.ok(secrets.some((f) => /a key shaped like a mnemonic/.test(f.message)));
  assert.ok(secrets.some((f) => /^The value of "extra" is shaped like a private key in hex/.test(f.message)));
  assert.ok(secrets.some((f) => /the key "privateKey"/.test(f.message)));
  assert.ok(!r.findings.some((f) => f.message.includes('lantern') || f.message.includes(HEX) || f.message.includes(XPRV)));
  assert.ok(r.findings.some((f) => f.id === 'field-unknown' && /"extra"/.test(f.message)), 'a list under an unknown key is still an unknown key');
});

test('secret-in-file: a secret value where a number, a list or a part belongs is not described', () => {
  assert.deepEqual(findingsOf(withOrders(order({ price: HEX }))).map((f) => f.id), ['secret-in-file']);
  assert.deepEqual(findingsOf(file({ orders: WIF })).map((f) => f.id), ['secret-in-file']);
  assert.deepEqual(findingsOf(file({ collections: WIF, orders: [] })).map((f) => f.id), ['secret-in-file']);
  assert.deepEqual(findingsOf(file({ orders: [order(), WIF] })).map((f) => f.id), ['secret-in-file']);
  assert.deepEqual(findingsOf(withOrders(order({ fees: WIF }))).map((f) => f.id).sort(), ['royalty-below-declared', 'secret-in-file']);
  assert.deepEqual(findingsOf(withOrders(order({ fees: [WIF, { kind: 'royalty', recipient: addr('9'), bps: 500 }] }))).map((f) => f.id), ['secret-in-file']);
  assert.deepEqual(findingsOf(withOrders(order({ tokenId: WIF }))).map((f) => f.id), ['secret-in-file']);
  assert.deepEqual(findingsOf(withOrders(order({ end: WIF }))).map((f) => f.id), ['secret-in-file']);
});
