import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTION_KEYS, CRITERIA_KEYS, FEE_KEYS, FEE_KINDS, HASH_FORM, KINDS, MAX_TOKEN_ID, ORDER_KEYS, ORDER_LIMITS, ROYALTY_KEYS, Reader, SIDES, STANDARDS, TOP_KEYS, checkText, cut, describe, oneEdit, readAmount, readBps, readJson, readOrders, standardOf, suggestKey, where } from '../src/index.js';
import { BADGE, BADGES, FEES, NOW, OFFER, OWLS, WEEK, addr, fee, file, findingsOf, hash, idsOf, lineOf, order, text, withOrders } from './helpers.js';

const readOf = (p) => readOrders(readJson(text(p)));
const messages = (p) => findingsOf(p).map((f) => [f.id, f.message]);

test('readOrders: every part and field of a clean file, with the line of each', () => {
  const p = withOrders(order({ orderHash: hash('4') }), OFFER, BADGE);
  const r = readOf(p);
  assert.deepEqual(r.findings, []);
  const f = r.file;
  assert.equal(f.chain, 'ethereum');
  assert.deepEqual(f.collections.map((c) => [c.title, c.contract, c.standard, c.royalty.bps, c.royalty.receiver]), [['Harbor Example Owls', addr('1'), 'ERC-721', 500, addr('9')], ['Meadow Example Badges', addr('2'), 'ERC-1155', 250, addr('8')]]);
  const [l, o, b] = f.orders;
  assert.deepEqual([l.id, l.side, l.kind, l.maker, l.taker, l.contract, l.tokenId, l.amount, l.currency, l.start, l.end, l.never, l.orderHash, l.transfer], ['L1', 'listing', 'item', addr('a'), null, addr('1'), '7', 1, 'ETH', NOW, NOW + WEEK, false, true, false]);
  assert.deepEqual(l.price, { int: 1n, scale: 0 });
  assert.deepEqual(l.fees.map((x) => [x.kind, x.recipient, x.bps, x.amount]), [['marketplace', addr('f'), 250, null], ['royalty', addr('9'), 500, null]]);
  assert.deepEqual([o.side, o.currency, o.tokenId], ['offer', 'WETH', '9']);
  assert.deepEqual([b.amount, b.balance, b.price], [2, 5, { int: 40n, scale: 0 }]);
  assert.equal(l.idEntry.line, lineOf(text(p), '"id": "L1"'));
  assert.equal(f.collections[1].contractEntry.line, lineOf(text(p), `"contract": "${addr('2')}"`));
});

test('readOrders: a top level that is not an object, and parts that are not lists or objects, are findings', () => {
  const r = readOrders(readJson('[1]'));
  assert.equal(r.file, null);
  assert.deepEqual(r.findings.map((f) => f.id), ['file-unreadable']);
  assert.match(r.findings[0].message, /^The top level of the file is a list, not an object with the chain, the collections and the orders/);
  assert.deepEqual(messages(file({ orders: 'all' })), [['field-invalid', 'The orders of the file are text; they must be a list of objects, one for each listing or offer.']]);
  assert.deepEqual(messages(file({ collections: {} })).map((x) => x[0]), ['field-invalid', 'field-missing', 'field-missing']);
  assert.deepEqual(messages(file({ orders: [order(), 7] })), [['field-invalid', 'Item 2 of the orders is the number 7; it must be an object.']]);
  assert.deepEqual(idsOf(withOrders(order({ fees: 'all' }))), ['field-invalid', 'royalty-below-declared']);
  assert.match(messages(withOrders(order({ fees: [7, FEES[1]] })))[0][1], /^Fee 1 of order L1 is the number 7; it must be an object\.$/);
  assert.deepEqual(messages(withOrders(order({ criteria: 'x' }))), [['field-invalid', 'The criteria of order L1 is text; it must be an object with its root.']]);
});

test('field-missing: the chain, the collections, the orders, and each field the checks need, with the part named', () => {
  assert.deepEqual(messages(file({ chain: undefined })), [['field-missing', 'The file has no chain; write one of ethereum, base, arbitrum, optimism, polygon, avalanche, bnb.']]);
  assert.deepEqual(messages(file({ chain: '' })).map((x) => x[0]), ['field-missing']);
  assert.deepEqual(messages(file({ orders: undefined })), [['field-missing', 'The file has no orders.']]);
  assert.deepEqual(messages(file({ collections: undefined })).map((x) => x[1]), ['The file has no collections.', `The contract ${addr('1')} of order L1 is not declared in the collections of the file, so its standard and its royalty are not known; declare it with its standard.`, `The contract ${addr('1')} of order O1 is not declared in the collections of the file, so its standard and its royalty are not known; declare it with its standard.`]);
  for (const key of ['side', 'maker', 'contract', 'price']) {
    const m = messages(withOrders(order({ [key]: undefined }))).filter((x) => x[0] === 'field-missing').map((x) => x[1]);
    assert.ok(m[0].startsWith(`Order L1 has no ${key}`), key);
  }
  assert.deepEqual(messages(withOrders(order({ id: undefined }))), [['field-missing', 'Order 1 has no id.']]);
  assert.deepEqual(messages(withOrders(order({ tokenId: undefined }))), [['field-missing', 'Order L1 is for one token and has no tokenId.']]);
  assert.deepEqual(messages(withOrders(order({ currency: undefined }))), [['field-missing', 'Order L1 has no currency, such as ETH or WETH.']]);
  assert.deepEqual(messages(withOrders(order({ price: '0', currency: undefined, transfer: true, fees: [] }))), [], 'a transfer needs no currency');
  assert.deepEqual(messages(withOrders(order({ side: '' }))).map((x) => x[1]), ['Order L1 has no side; write listing or offer.']);
  const c = (over) => messages(file({ collections: [{ ...OWLS, ...over }, BADGES], orders: [BADGE] }));
  assert.deepEqual(c({ contract: undefined }), [['field-missing', 'Collection Harbor Example Owls has no contract.']]);
  assert.deepEqual(c({ standard: undefined }), [['field-missing', 'Collection Harbor Example Owls has no standard; write ERC-721 or ERC-1155.']]);
  assert.deepEqual(c({ name: undefined, standard: '' }), [['field-missing', 'Collection 1 has no standard; write ERC-721 or ERC-1155.']]);
  assert.deepEqual(c({ royalty: { receiver: addr('9') } }), [['field-missing', 'The royalty of collection Harbor Example Owls has no bps.']]);
  assert.deepEqual(c({ royalty: { bps: 500 } }), [['field-missing', 'The royalty of collection Harbor Example Owls has no receiver.']]);
  assert.deepEqual(c({ royalty: { bps: 0 } }), [], 'a royalty of 0 needs no receiver');
  const f = (over) => messages(withOrders(order({ fees: [{ ...FEES[0], ...over }, FEES[1]] })));
  assert.deepEqual(f({ kind: undefined }), [['field-missing', 'Fee 1 of order L1 has no kind; write marketplace, royalty or other.']]);
  assert.deepEqual(f({ recipient: undefined }), [['field-missing', 'Fee 1 of order L1 has no recipient.']]);
  assert.deepEqual(f({ bps: undefined }), [['field-missing', 'Fee 1 of order L1 has no bps or amount.']]);
});

test('field-invalid: values of the wrong type or form, each with the form it needs', () => {
  assert.deepEqual(messages(file({ chain: 'solana' })), [['field-invalid', 'The chain of the file is "solana"; it must be one of ethereum, base, arbitrum, optimism, polygon, avalanche, bnb.']]);
  assert.deepEqual(messages(withOrders(order({ side: 'bid' }))), [['field-invalid', 'The side of order L1 is "bid"; it must be one of listing, offer.']]);
  assert.deepEqual(messages(withOrders(order({ kind: 'bundle' }))), [['field-invalid', 'The kind of order L1 is "bundle"; it must be one of item, collection, criteria.']]);
  assert.deepEqual(messages(withOrders(order({ kind: 'collection', tokenId: undefined }))), [['field-invalid', 'Order L1 is a listing of kind collection; a listing sells one token id, so its kind is item, and only an offer may be of kind collection or criteria.']]);
  assert.deepEqual(messages(withOrders({ ...OFFER, kind: 'collection' })), [['field-invalid', 'Order O1 is an offer of kind collection and names a tokenId; write kind item for an offer on one token.'], ['collection-offer-without-criteria', 'Order O1 is a collection offer, so any holder of Harbor Example Owls may fill it with the token they want least. This is a best practice of this tool, not a rule in the pages it cites.']]);
  for (const bad of ['0x07', '-1', '1.5', '', 'seven', 7.5, true, (MAX_TOKEN_ID + 1n).toString()]) {
    const m = messages(withOrders(order({ tokenId: bad })));
    assert.equal(m.length, 1, String(bad));
    assert.match(m[0][1], /^The tokenId of order L1 is .*; it must be a whole number of at most 78 digits, as a uint256 holds, written as a number or as text\.$/, String(bad));
  }
  assert.deepEqual(messages(withOrders(order({ tokenId: MAX_TOKEN_ID.toString() }), OFFER)), [], 'the largest token id');
  assert.deepEqual(messages(withOrders(order({ tokenId: 0 }))), [], 'token id 0 as a number');
  assert.deepEqual(messages(withOrders(order({ amount: 'one' }))), [['field-invalid', 'The amount of order L1 is "one"; it must be a whole number of tokens from 0 to 999999999999.']]);
  assert.deepEqual(messages(withOrders(order({ start: -5 }))), [['field-invalid', 'The start of order L1 is the number -5; it must be a whole number of unix seconds from 0 to 999999999999.']]);
  assert.deepEqual(messages(withOrders(order({ end: 'soon' }))), [['field-invalid', 'The end of order L1 is "soon"; it must be a whole number of unix seconds, or never from 0 to 999999999999.']]);
  assert.deepEqual(messages(withOrders(order({ end: {} }))), [['field-invalid', 'The end of order L1 is an object; it must be a whole number of unix seconds, or never from 0 to 999999999999.']]);
  assert.deepEqual(messages(withOrders(order({ price: {} }))), [['field-invalid', 'The price of order L1 is an object; it must be a decimal number, written as a number or as text.']]);
  assert.deepEqual(messages(withOrders(order({ maker: 7 }))), [['field-invalid', 'The maker of order L1 is the number 7; it must be text.']]);
  assert.deepEqual(messages(withOrders(order({ transfer: 'yes' }))), [['field-invalid', 'The transfer of order L1 is "yes"; it must be true or false.']]);
  assert.deepEqual(messages(withOrders(order({ transfer: true }))), [['field-invalid', 'Order L1 is marked as a transfer but has a price above 0; a transfer has a price of 0.']]);
  assert.deepEqual(messages(withOrders(order({ orderHash: '0x1234' }))), [['field-invalid', 'The orderHash of order L1 is not a hash of 32 bytes; it must be 64 hex digits, with or without 0x in front.']]);
  assert.deepEqual(messages(withOrders(order({ criteria: { root: hash('3') } }))), [['field-invalid', 'Order L1 is of kind item and has criteria; criteria belong to an offer of kind criteria.']]);
  const crit = { ...OFFER, kind: 'criteria', tokenId: undefined };
  assert.deepEqual(messages(withOrders(order({ ...crit, criteria: { root: 'abc' } }))).map((x) => x[1]), ['The root of the criteria of order O1 is not a hash of 32 bytes; it must be 64 hex digits, with or without 0x in front.']);
  const c = (over) => messages(file({ collections: [{ ...OWLS, ...over }, BADGES], orders: [BADGE] }));
  assert.deepEqual(c({ standard: 'ERC-20' }), [['field-invalid', 'The standard of collection Harbor Example Owls is "ERC-20", which is not one the tool reads; write ERC-721 or ERC-1155.']]);
  assert.deepEqual(c({ royalty: 500 }), [['field-invalid', 'The royalty of collection Harbor Example Owls is the number 500; it must be an object with its receiver and bps.']]);
  for (const bps of ['5%', -1, 7.5, 10001]) assert.match(c({ royalty: { receiver: addr('9'), bps } })[0][1], /^The bps of the royalty of collection Harbor Example Owls is ".*"; it must be a whole number of basis points from 0 to 10000, where 100 is 1% of the price\.$/, String(bps));
  const f = (over) => messages(withOrders(order({ fees: [{ ...FEES[0], ...over }, FEES[1]] })));
  assert.deepEqual(f({ kind: 'gas' }), [['field-invalid', 'The kind of fee 1 of order L1 is "gas"; it must be one of marketplace, royalty, other.']]);
  assert.deepEqual(f({ amount: '0.025' }), [['field-invalid', 'Fee 1 of order L1 gives both bps and amount; give one, a share of the price in basis points or an amount in the currency of the order.']]);
  assert.deepEqual(f({ bps: '2.5' }), [['field-invalid', 'The bps of fee 1 of order L1 is "2.5"; it must be a whole number of basis points from 0 to 10000, where 100 is 1% of the price.']]);
  assert.deepEqual(f({ bps: [] }), [['field-invalid', 'The bps of fee 1 of order L1 is a list; it must be a decimal number, written as a number or as text.']]);
});

test('price-malformed: a price or a fee amount that is not a plain decimal, or has more places than its currency', () => {
  for (const bad of ['1e3', '-1', '1,5', '.5', 'one']) {
    const m = messages(withOrders(order({ price: bad })));
    assert.deepEqual(m.map((x) => x[0]), ['price-malformed'], bad);
    assert.match(m[0][1], /^The price of order L1 is ".*"; it must be a plain decimal number of 0 or more, such as 0\.25, with no sign, exponent or separator\.$/);
  }
  const usdc = messages(withOrders(order({ price: '1.0000001', currency: 'USDC', fees: [] })));
  assert.deepEqual(usdc, [['price-malformed', 'The price of order L1 has 7 decimal places, but USDC holds 6, so it cannot be paid as written.']]);
  assert.deepEqual(messages(withOrders(order({ price: '1.000000', currency: 'USDC', fees: [fee('royalty', addr('9'), '0.05')] }))), [], 'trailing zeros are not places a value needs');
  assert.ok(!idsOf(withOrders(order({ price: `0.${'0'.repeat(17)}1`, fees: [] }))).includes('price-malformed'), 'ETH holds 18 places');
  assert.deepEqual(messages(withOrders(order({ price: '1.2500000000000000001', currency: 'DOGE', fees: [] }))).map((x) => x[0]), ['royalty-below-declared'], 'the places of an unknown currency are not checked');
  const fees = (amount) => messages(withOrders(order({ fees: [fee('marketplace', addr('f'), amount), FEES[1]] })));
  assert.deepEqual(fees('-0.1'), [['price-malformed', 'The amount of fee 1 of order L1 is "-0.1"; it must be a plain decimal number of 0 or more, such as 0.025, with no sign, exponent or separator.']]);
  assert.deepEqual(fees(`0.${'1'.repeat(19)}`), [['price-malformed', 'The amount of fee 1 of order L1 has 19 decimal places, but ETH holds 18, so it cannot be paid as written.']]);
  assert.deepEqual(fees('0.025'), []);
});

test('field-unknown: a misspelt key with the key it is meant to be, at every level', () => {
  const unknown = (p) => findingsOf(p).filter((f) => f.id === 'field-unknown').map((f) => f.message);
  assert.match(unknown(withOrders(order({ makerBalanse: 5 })))[0], /^The key "makerBalanse" of order 1 is not one the tool reads, so its value was left out of every check\. Did you mean "makerBalance"\?/);
  assert.match(unknown(withOrders(order({ token_id: '7' })))[0], /Did you mean "tokenId"\?/);
  assert.match(unknown({ ...file(), Chains: 1 })[0], /^The key "Chains" of the file .* Did you mean "chain"\?/);
  assert.match(unknown(file({ collections: [{ ...OWLS, royalty: { ...OWLS.royalty, bp: 5 } }, BADGES] }))[0], /^The key "bp" of the royalty of collection Harbor Example Owls/);
  assert.match(unknown(withOrders(order({ fees: [{ ...FEES[0], recipent: addr('f') }, FEES[1]] })))[0], /^The key "recipent" of fee 1 of order L1 .* Did you mean "recipient"\?/);
  assert.match(unknown(withOrders(order({ ...OFFER, kind: 'criteria', tokenId: undefined, criteria: { root: hash('3'), proof: [] } })))[0], /^The key "proof" of the criteria of order O1/);
  assert.match(unknown(file({ collections: [{ ...OWLS, symbol: 'HXO' }, BADGES] }))[0], /^The key "symbol" of collection 1 .* The keys of collection 1 are contract, name, standard, royalty, notes\.$/);
  assert.deepEqual(unknown(withOrders(order({ notes: 'any text' }))), [], 'notes are never read');
  for (const keys of [TOP_KEYS, COLLECTION_KEYS, ROYALTY_KEYS, ORDER_KEYS, FEE_KEYS, CRITERIA_KEYS]) assert.ok(keys.includes('notes'));
});

test('the end of an order: missing, never, empty, far ahead or a number of seconds', () => {
  const r = (end) => readOf(withOrders(order({ end }))).file.orders[0];
  assert.deepEqual([r(undefined).never, r(undefined).endText, r(undefined).endEntry], [true, null, null]);
  assert.deepEqual([r('never').never, r('NEVER').endText], [true, 'never']);
  assert.equal(r('').never, true);
  const far = (2n ** 256n - 1n).toString();
  assert.deepEqual([r(far).never, r(far).endText], [true, far]);
  assert.deepEqual([r('1000000000000').never, r(999999999999).end], [true, 999999999999]);
  assert.deepEqual([r(NOW).end, r(String(NOW)).end, r(NOW).never], [NOW, NOW, false]);
});

test('the limits of the reader: orders, collections and fees past their limit are left out with a note', () => {
  const p = withOrders(order(), order({ id: 'L2', tokenId: '8' }), order({ id: 'L3', tokenId: '9', fees: [FEES[1], FEES[0], FEES[0]] }));
  const r = readOrders(readJson(text(p)), { ...ORDER_LIMITS, maxOrders: 2, maxCollections: 1 });
  assert.equal(r.file.orders.length, 2);
  assert.equal(r.file.collections.length, 1);
  assert.deepEqual(r.notes, ['the file holds 2 collections; the tool read the first 1 and left the rest out', 'the file holds 3 orders; the tool read the first 2 and left the rest out']);
  const fees = readOrders(readJson(text(withOrders(order({ fees: [FEES[1], FEES[0], FEES[0]] })))), { ...ORDER_LIMITS, maxFees: 1 });
  assert.deepEqual(fees.notes, ['order L1 holds 3 fees; the tool read the first 1']);
  assert.equal(fees.file.orders[0].fees.length, 1);
  assert.equal(ORDER_LIMITS.maxOrders, 10000);
});

test('the lists the reader knows: sides, kinds, fee kinds and the names of the standards', () => {
  assert.deepEqual(SIDES, ['listing', 'offer']);
  assert.deepEqual(KINDS, ['item', 'collection', 'criteria']);
  assert.deepEqual(FEE_KINDS, ['marketplace', 'royalty', 'other']);
  assert.deepEqual(STANDARDS.map((s) => s.name), ['ERC-721', 'ERC-1155']);
  for (const [name, std] of [['ERC-721', 'ERC-721'], ['erc721', 'ERC-721'], ['EIP 1155', 'ERC-1155'], ['erc-1155', 'ERC-1155'], ['ERC-20', null], ['', null]]) assert.equal(standardOf(name), std, name);
  assert.equal(readOf(withOrders(order({ side: 'LISTING', kind: 'Item' }))).file.orders[0].kind, 'item');
  assert.equal(readOf(withOrders(order({ kind: '' }))).file.orders[0].kind, 'item', 'an empty kind is an item');
});

test('the field helpers: suggestKey, oneEdit, cut, describe, where, readAmount, readBps, HASH_FORM and Reader', () => {
  assert.equal(suggestKey('makerbalanse', ORDER_KEYS), 'makerBalance');
  assert.equal(suggestKey('PRICE', ORDER_KEYS), 'price');
  assert.equal(suggestKey('curr', ORDER_KEYS), 'currency');
  assert.equal(suggestKey('ab', ORDER_KEYS), null);
  assert.equal(suggestKey('zzzzzz', ORDER_KEYS), null);
  assert.ok(oneEdit('price', 'prices'));
  assert.ok(oneEdit('prices', 'price'));
  assert.ok(oneEdit('price', 'prise'));
  assert.ok(!oneEdit('price', 'price'));
  assert.ok(!oneEdit('price', 'pr'));
  assert.equal(cut('x'.repeat(200)).length, 120);
  assert.equal(cut('short'), 'short');
  assert.equal(describe({ kind: 'null' }), 'null');
  assert.equal(describe({ kind: 'boolean', value: false }), 'false');
  assert.equal(describe({ kind: 'number', raw: '9'.repeat(50) }), `the number ${'9'.repeat(37)}...`);
  assert.equal(describe({ kind: 'string', secret: true }), 'a value that is not shown');
  assert.deepEqual(where({ line: 3, column: 4, other: 1 }), { line: 3, column: 4 });
  assert.deepEqual(readAmount('0.5').state, 'ok');
  assert.deepEqual(readAmount('0.00').state, 'zero');
  assert.deepEqual(readAmount('-2').state, 'negative');
  assert.deepEqual(readAmount('-x').state, 'nan');
  assert.deepEqual([readBps('250').state, readBps('250').value], ['ok', 250]);
  assert.deepEqual([readBps('250.0').state, readBps('-0').state, readBps('-5').state, readBps('2.5').state, readBps('10001').state, readBps('x').state], ['ok', 'ok', 'negative', 'fraction', 'above', 'nan']);
  assert.ok(HASH_FORM.test(hash('3')) && HASH_FORM.test('3'.repeat(64)) && !HASH_FORM.test(addr('3')));
  const reader = new Reader();
  assert.equal(reader.file, 'orders');
  reader.add('field-missing', { line: 1, column: 2 }, 'm');
  assert.deepEqual(reader.findings, [{ id: 'field-missing', file: 'orders', line: 1, column: 2, message: 'm', subject: null }]);
  const m = reader.fields(readJson('{"a": 1}'), ['a'], 'x');
  assert.equal(reader.whole(m, 'a', 'x', { max: 5, what: 'n' }).value, 1);
  assert.equal(reader.whole(m, 'b', 'x', { max: 5, what: 'n' }).value, null);
  assert.deepEqual(reader.whole(new Map([['a', { value: { kind: 'string', value: ' ' } }]]), 'a', 'x', { max: 5, what: 'n' }).value, null, 'an empty text is no value and no finding');
  assert.equal(reader.findings.length, 1);
});

test('checkText: a file read in memory gives the findings and notes of the reader and the checks together', () => {
  const r = checkText(text(withOrders(order({ amount: 3 }))), { now: NOW });
  assert.deepEqual(r.findings.map((f) => f.id), ['erc721-amount-not-one']);
  assert.deepEqual(r.notes, []);
  assert.equal(r.read.orders.length, 1);
});
