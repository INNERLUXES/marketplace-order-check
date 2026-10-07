import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BEST, NOT_A, NOTICE, POINTS, RULES, SOURCES, flat, grouped, listText, plural, pointPage, safeText, source } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const read = (rel) => readFile(resolve(root, rel), 'utf8');
const norm = (t) => t.replace(/\s+/g, ' ');

const PLACES = /^https:\/\/eips\.ethereum\.org\/EIPS\/eip-(?:2981|721|1155)$/;

test('every source has an official address, and no number that reads like a year', () => {
  for (const s of SOURCES) {
    assert.match(s.url, PLACES, s.id);
    assert.doesNotMatch(s.url, /(?<!(?:EIP|ERC)[- ]?)\b(?:19|20)\d{2}\b/i, s.id);
    assert.ok(s.title.length > 5);
  }
  assert.equal(new Set(SOURCES.map((s) => s.id)).size, SOURCES.length);
  assert.deepEqual(SOURCES.map((s) => s.id), ['eip-2981', 'eip-721', 'eip-1155']);
  assert.equal(NOTICE, `This report is an input to a review of marketplace orders before they are signed or filled: ${NOT_A}.`);
  assert.match(NOT_A, /^not legal or financial advice/);
});

test('every source has a text copy under research/sources that starts with its address, and research/sources.md lists it', async () => {
  const notes = await read('research/sources.md');
  for (const s of SOURCES) {
    const copy = await read(s.file);
    assert.ok(copy.startsWith(`Source: ${s.url}\n`), s.file);
    assert.ok(copy.length > 1500, `${s.file} holds the page`);
    assert.ok(notes.includes(s.url), `research/sources.md lists ${s.id}`);
    assert.ok(notes.includes(s.file), `research/sources.md names ${s.file}`);
  }
});

test('every point belongs to a listed source, is written in a sentence of its own and is not a long quotation of its page', async () => {
  for (const [id, p] of Object.entries(POINTS)) {
    const page = source(p.source);
    assert.ok(page, `${id}: the source ${p.source}`);
    assert.equal(pointPage(id), page);
    assert.ok(p.text.length > 40 && p.text.length < 400, id);
    assert.match(p.text, /\.$/, id);
    const copy = norm(await read(page.file));
    // No run of 12 words of the point appears word for word in its page.
    const words = norm(p.text).split(' ');
    for (let i = 0; i + 12 <= words.length; i += 1) assert.ok(!copy.includes(words.slice(i, i + 12).join(' ')), `${id} quotes its page`);
  }
});

test('every point is used by a rule, and every basis of a rule is a point', () => {
  const used = new Set(RULES.flatMap((r) => r.basis));
  for (const id of Object.keys(POINTS)) assert.ok(used.has(id), `${id} is not used by a rule`);
  for (const id of used) assert.ok(Object.hasOwn(POINTS, id), `${id} is not a point`);
});

test('docs/rules-and-sources.md lists every page with its copy and every check with its level, kind and points', async () => {
  const doc = await read('docs/rules-and-sources.md');
  for (const s of SOURCES) assert.ok(doc.includes(s.url) && doc.includes(s.file), s.id);
  for (const r of RULES) {
    const section = doc.split(/^## /m).find((p) => p.startsWith(`${r.id}\n`));
    assert.ok(section, r.id);
    assert.ok(section.includes(`- Level: ${r.severity}`), r.id);
    assert.ok(section.includes('- Cannot see: '), r.id);
    for (const b of r.basis) assert.ok(section.includes(POINTS[b].text), `${r.id}: ${b}`);
    if (r.kind === 'best practice') assert.ok(norm(section).includes(BEST), r.id);
    if (r.own) assert.ok(section.includes(r.own), `${r.id}: its own choice`);
  }
});

test('the documented checks name a page and say no own choice, the best practice checks say what is their own choice, and the input checks rest on no page', () => {
  for (const r of RULES.filter((x) => x.kind === 'documented')) {
    assert.ok(r.basis.length > 0, r.id);
    assert.equal(r.own, undefined, r.id);
  }
  for (const r of RULES.filter((x) => x.kind === 'best practice')) assert.ok(r.own && r.own.includes(BEST), `${r.id} says what is its own choice`);
  for (const r of RULES.filter((x) => x.kind === 'input')) assert.deepEqual(r.basis, [], r.id);
});

test('the pages say what the documented checks rest on: ERC-2981 names no basis points, no largest royalty and no marketplace fee, and calls payment voluntary', async () => {
  const royalty = norm(await read('research/sources/eip-2981-nft-royalty-standard.txt'));
  for (const s of [
    'Royalty amounts are always a percentage of the sale price.',
    'Implementers of this standard **MUST** calculate a percentage of the `_salePrice` when calculating the royalty amount.',
    '@return receiver - address of who should be sent the royalty payment',
    '@return royaltyAmount - the royalty payment amount for _salePrice',
    'the `_salePrice` parameter and the `royaltyAmount` return value **MUST** be denominated in the same monetary unit',
    'The royalty payment must be voluntary'
  ]) assert.ok(royalty.includes(s), s);
  assert.ok(!/basis point/i.test(royalty), 'ERC-2981 does not speak of basis points');
  assert.ok(!/marketplace fee/i.test(royalty), 'ERC-2981 does not speak of the fee of a marketplace');
  assert.ok(royalty.includes('status: Final'));
  const nft = norm(await read('research/sources/eip-721-non-fungible-token.txt'));
  assert.ok(nft.includes('every NFT is unique, the quantity is none or one'));
  assert.ok(nft.includes('function transferFrom(address _from, address _to, uint256 _tokenId) external payable;'));
  const multi = norm(await read('research/sources/eip-1155-multi-token.txt'));
  assert.ok(multi.includes('MUST revert if balance of holder for token `_id` is lower than the `_value` sent.'));
  assert.ok(multi.includes('function safeTransferFrom(address _from, address _to, uint256 _id, uint256 _value, bytes calldata _data) external;'));
  for (const copy of [royalty, nft, multi]) assert.ok(!/seaport/i.test(copy), 'no saved page speaks of an order format');
});

test('the copies of the ERC pages leave out the authors and the line of the day the page was created', async () => {
  for (const s of SOURCES) {
    const copy = await read(s.file);
    assert.doesNotMatch(copy, /^(?:author|created):/m, s.file);
    assert.match(copy, /^status: Final$/m, s.file);
  }
});

test('the copies of ERC-721 and ERC-1155 are the ones nft-metadata-check saved, with their header', async () => {
  for (const [file, url, md] of [['research/sources/eip-721-non-fungible-token.txt', 'https://eips.ethereum.org/EIPS/eip-721', 'ERCS/erc-721.md'], ['research/sources/eip-1155-multi-token.txt', 'https://eips.ethereum.org/EIPS/eip-1155', 'ERCS/erc-1155.md']]) {
    const copy = await read(file);
    assert.ok(copy.startsWith(`Source: ${url}\nRead as the markdown source of the page in the repository ethereum/ERCs, ${md}`), file);
  }
});

test('size helpers: grouped numbers, lists for a sentence and plurals', () => {
  assert.equal(grouped(12345), '12,345');
  assert.equal(grouped(10n ** 12n), '1,000,000,000,000');
  assert.equal(listText(['a']), 'a');
  assert.equal(listText(['a', 'b']), 'a and b');
  assert.equal(listText(['a', 'b', 'c']), 'a, b and c');
  assert.equal(listText(['a', 'b', 'c', 'd', 'e'], 3), 'a, b, c and 2 more');
  assert.equal(plural(1, 'line'), '1 line');
  assert.equal(plural(2, 'order'), '2 orders');
});

test('text helpers: safeText replaces control, direction and separator characters and caps the length; flat folds white space', () => {
  const bad = ['a', String.fromCharCode(0x1b), '[31m', String.fromCharCode(0x202e), 'b', String.fromCharCode(0x2028), 'c', String.fromCharCode(7), 'd', String.fromCharCode(0x85), 'e'].join('');
  const out = safeText(bad);
  assert.ok(![...out].some((c) => c.charCodeAt(0) < 32 || [0x202e, 0x2028, 0x85].includes(c.charCodeAt(0))));
  assert.equal(safeText('x'.repeat(50), 10), 'xxxxxxx...');
  assert.equal(safeText('short', 10), 'short');
  assert.equal(flat('  a \n  b\t c '), 'a b c');
});
