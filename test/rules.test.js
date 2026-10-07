import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BEST, DAY, DEFAULT_MAX_EXPIRY_DAYS, RULES, analyze, atOrAbove, bpsPercent, checkText, daysText, decide, money, parseDecimal, ruleById, shareOf } from '../src/index.js';
import { BADGE, BADGES, FEES, NOW, OFFER, OWLS, WEEK, addr, fee, file, findingsOf, hash, idsOf, lineOf, ofCheck, order, text, withOrders } from './helpers.js';

const at = { now: NOW };
const CRITERIA = { ...OFFER, id: 'O2', kind: 'criteria', tokenId: undefined, criteria: { root: hash('3') } };
const crit = (over) => order({ ...CRITERIA, ...over });

test('the rules: unique ids, a level and a kind each, a fix, and the best practice checks say so', () => {
  assert.equal(new Set(RULES.map((r) => r.id)).size, RULES.length);
  assert.equal(RULES.length, 26);
  for (const r of RULES) {
    assert.ok(['error', 'warning', 'info'].includes(r.severity), r.id);
    assert.ok(['documented', 'best practice', 'input'].includes(r.kind), r.id);
    assert.ok(r.fix.length > 20 && r.summary.length > 20, r.id);
    if (r.kind === 'best practice') assert.ok(r.own.includes(BEST), r.id);
  }
  assert.deepEqual(RULES.filter((r) => r.kind === 'documented').map((r) => r.id), ['royalty-receiver-mismatch', 'royalty-above-declared', 'royalty-below-declared', 'erc721-amount-not-one', 'erc1155-amount-above-balance']);
  assert.equal(ruleById('fees-exceed-price').severity, 'error');
  assert.equal(ruleById('nope'), undefined);
});

test('decide and atOrAbove: the result of a run from the counts by level', () => {
  assert.ok(atOrAbove('error', 'warning'));
  assert.ok(!atOrAbove('info', 'warning'));
  assert.deepEqual(decide({ error: 0, warning: 2, info: 0 }, 'error'), { pass: true, failOn: 'error', text: 'PASS - no finding at or above error (2 warning)' });
  assert.equal(decide({ error: 1, warning: 2, info: 0 }, 'warning').text, 'FAIL - 3 findings at or above warning (1 error, 2 warning)');
  assert.equal(decide({}, 'info').text, 'PASS - no finding at or above info');
});

test('a clean file has no finding, and analyze of no file has none either', () => {
  assert.deepEqual(findingsOf(file(), at), []);
  assert.deepEqual(findingsOf(withOrders(order(), OFFER, BADGE, crit()), at), []);
  assert.deepEqual(analyze(null), { findings: [], notes: [], summary: null });
});

test('the number helpers: basis points as a percent, a share of a price, money and days', () => {
  assert.equal(bpsPercent(500), '5%');
  assert.equal(bpsPercent(250), '2.5%');
  assert.equal(bpsPercent(75), '0.75%');
  assert.equal(bpsPercent(0), '0%');
  assert.equal(money(shareOf(parseDecimal('1.2'), 500), 'ETH'), '0.06 ETH');
  assert.equal(money(shareOf(parseDecimal('0.000000000000000001'), 1), 'ETH'), '0.0000000000000000000001 ETH', 'exact, with no floating point');
  assert.equal(money(parseDecimal('2'), null), '2');
  assert.equal(daysText(30 * DAY), '30 days');
  assert.equal(daysText(DAY + 1), 'more than 1 day');
  assert.equal(DEFAULT_MAX_EXPIRY_DAYS, 180);
});

test('fees-exceed-price: fees of the whole price or more, at the line of the fees; a part of the price passes', () => {
  const p = withOrders(order({ fees: [fee('marketplace', addr('f'), '0.95'), fee('royalty', addr('9'), 500)] }));
  const f = ofCheck(p, 'fees-exceed-price');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(text(p), '"fees"'));
  assert.match(f[0].message, /^The fees of order L1 add up to 1 ETH, the whole of its price of 1 ETH, so the seller would receive nothing\. This is a best practice of this tool/);
  const over = ofCheck(withOrders(order({ fees: [fee('marketplace', addr('f'), 9000), fee('royalty', addr('9'), 5000)] })), 'fees-exceed-price');
  assert.match(over[0].message, /add up to 1\.4 ETH, 0\.4 ETH above its price of 1 ETH, so the seller would receive nothing and the order cannot be filled\./);
  const offer = ofCheck(withOrders({ ...OFFER, fees: [fee('marketplace', addr('f'), 10000)] }), 'fees-exceed-price');
  assert.match(offer[0].message, /so the seller who fills the offer would receive nothing\./);
  assert.deepEqual(ofCheck(withOrders(order({ fees: [fee('marketplace', addr('f'), '0.9499'), fee('royalty', addr('9'), 500)] })), 'fees-exceed-price'), [], 'just under the price');
  assert.deepEqual(ofCheck(withOrders(order({ fees: [] })), 'fees-exceed-price'), []);
  const zero = ofCheck(withOrders(order({ price: '0', transfer: true, fees: [fee('marketplace', addr('f'), '0.01')] })), 'fees-exceed-price');
  assert.equal(zero.length, 1, 'a fee on a transfer at 0 takes more than the price');
  assert.deepEqual(ofCheck(withOrders(order({ price: '0', transfer: true, fees: [fee('marketplace', addr('f'), 250)] })), 'fees-exceed-price'), [], 'a share of 0 is 0');
  assert.deepEqual(ofCheck(withOrders(order({ fees: [fee('marketplace', addr('f'), '2.5'), fee('royalty', addr('9'), 'x')] })), 'fees-exceed-price').length, 1, 'the fees that could be read are still added up');
});

test('royalty-receiver-mismatch: a royalty paid to another address than the declared receiver; the receiver in any case passes', () => {
  const p = withOrders(order({ fees: [FEES[0], fee('royalty', addr('7'), 500)] }));
  const f = ofCheck(p, 'royalty-receiver-mismatch');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(text(p), `"recipient": "${addr('7')}"`));
  assert.equal(f[0].message, `Fee 2 of order L1 pays royalty to ${addr('7')}, but collection Harbor Example Owls declares ${addr('9')} as its receiver. The royaltyInfo of ERC-2981 answers a marketplace with the address the royalty is sent to.`);
  assert.deepEqual(ofCheck(withOrders(order({ fees: [FEES[0], fee('royalty', `0x${'9'.repeat(40)}`.toUpperCase().replace('0X', '0x'), 500)] })), 'royalty-receiver-mismatch'), []);
  assert.deepEqual(ofCheck(withOrders(order({ fees: [fee('marketplace', addr('7'), 250), FEES[1]] })), 'royalty-receiver-mismatch'), [], 'a marketplace fee is not a royalty');
  const bad = file({ collections: [{ ...OWLS, royalty: { receiver: '0x99', bps: 500 } }, BADGES], orders: [order({ fees: [FEES[0], fee('royalty', addr('7'), 500)] })] });
  assert.deepEqual(idsOf(bad), ['address-malformed'], 'a declared receiver that is not an address is not compared');
});

test('royalty-above-declared and royalty-below-declared: the royalty paid against the declared share of the price', () => {
  const above = withOrders(order({ fees: [FEES[0], fee('royalty', addr('9'), '0.06')] }));
  const f = ofCheck(above, 'royalty-above-declared');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(text(above), '"amount": "0.06"'));
  assert.equal(f[0].message, 'Order L1 pays 0.06 ETH of royalty, but the royalty of 5% that collection Harbor Example Owls declares works out to 0.05 ETH on the price of 1 ETH. Under ERC-2981 the royalty owed is a percentage of the sale price.');
  const below = ofCheck(withOrders(order({ fees: [FEES[0], fee('royalty', addr('9'), 499)] })), 'royalty-below-declared');
  assert.match(below[0].message, /^Order L1 pays 0\.0499 ETH of royalty, but .* ERC-2981 leaves the payment of a royalty to the marketplace, so this is a note\.$/);
  const none = withOrders(order({ fees: [FEES[0]] }));
  const n = ofCheck(none, 'royalty-below-declared');
  assert.match(n[0].message, /^Order L1 pays no royalty, but the royalty of 5%/);
  assert.equal(n[0].line, lineOf(text(none), '"price"'));
  assert.deepEqual(idsOf(withOrders(order({ fees: [FEES[0], fee('royalty', addr('9'), 250), fee('royalty', addr('9'), '0.025')] }))), [], 'two royalty fees add up to the declared share');
  const odd = (royalty) => idsOf(withOrders(order({ price: '0.000000000000000999', fees: [fee('royalty', addr('9'), royalty)] })));
  assert.deepEqual(odd('0.000000000000000049'), [], 'ERC-2981 lets the amount be rounded down to a whole wei');
  assert.deepEqual(odd('0.00000000000000005'), [], 'or up');
  assert.deepEqual(odd('0.000000000000000051'), ['royalty-above-declared'], 'a wei more than the rounding is above');
  assert.deepEqual(odd('0.000000000000000048'), ['royalty-below-declared'], 'and a wei less is below');
  assert.deepEqual(idsOf(withOrders(order({ price: '1', currency: 'DOGE', fees: [fee('royalty', addr('9'), '0.0500000001')] }))), ['royalty-above-declared'], 'for a currency the tool does not know, the comparison is exact');
  const zero = file({ collections: [{ ...OWLS, royalty: { bps: 0 } }, BADGES], orders: [order({ fees: [FEES[0], fee('royalty', addr('9'), 100)] })] });
  assert.match(ofCheck(zero, 'royalty-above-declared')[0].message, /the royalty of 0% that collection Harbor Example Owls declares works out to 0 ETH/);
  assert.deepEqual(idsOf(file({ collections: [{ ...OWLS, royalty: { bps: 0 } }, BADGES], orders: [order({ fees: [FEES[0]] })] })), []);
  assert.deepEqual(idsOf(withOrders(order({ price: '0', transfer: true, fees: [] }))), [], 'no royalty is owed on a transfer at 0');
  const silent = checkText(text(file({ collections: [{ ...OWLS, royalty: undefined }, BADGES], orders: [order({ fees: [FEES[0], fee('royalty', addr('7'), 900)] }), BADGE] })), at);
  assert.deepEqual(silent.findings, []);
  assert.deepEqual(silent.notes, ['collection Harbor Example Owls declares no ERC-2981 royalty, so the royalty checks did not run for its orders']);
  const both = checkText(text(file({ collections: [{ ...OWLS, royalty: undefined }, { ...BADGES, royalty: undefined }], orders: [order(), BADGE] })), at);
  assert.deepEqual(both.notes, ['the collections Harbor Example Owls and Meadow Example Badges declare no ERC-2981 royalty, so the royalty checks did not run for their orders']);
});

test('order-never-expires: no end, an end of never and an end far ahead, at the line of the end', () => {
  const p = withOrders(order({ end: 'never' }));
  const f = ofCheck(p, 'order-never-expires', at);
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(text(p), '"end"'));
  assert.match(f[0].message, /^Order L1 ends never, so it stays open for good/);
  const none = withOrders(order({ end: undefined }));
  const n = ofCheck(none, 'order-never-expires', at);
  assert.match(n[0].message, /^Order L1 has no end, so/);
  assert.equal(n[0].line, lineOf(text(none), '"id"'));
  assert.match(ofCheck(withOrders(order({ end: (2n ** 256n - 1n).toString() })), 'order-never-expires', at)[0].message, /^Order L1 ends at unix second 115792089237316195423\.\.\., more than 30,000 years ahead/);
  assert.deepEqual(ofCheck(withOrders(order({ end: 999999999999, start: 999999999998 })), 'order-never-expires', at), [], 'a far end of 12 digits is a time');
  const noId = withOrders(order({ id: undefined, end: undefined }));
  assert.equal(ofCheck(noId, 'order-never-expires', at)[0].line, lineOf(text(noId), '"side"') - 1, 'with no id, at the order');
});

test('expiry-too-long: an order open longer than --max-expiry-days, from its start or from --now; the threshold passes', () => {
  const p = withOrders(order({ end: NOW + 181 * DAY }));
  const f = ofCheck(p, 'expiry-too-long', at);
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(text(p), '"end"'));
  assert.match(f[0].message, /^Order L1 is open for 181 days from its start, longer than the 180 days of --max-expiry-days\. This is a best practice/);
  assert.deepEqual(ofCheck(withOrders(order({ end: NOW + 180 * DAY })), 'expiry-too-long', at), [], 'exactly the threshold');
  assert.match(ofCheck(withOrders(order({ start: undefined, end: NOW + 200 * DAY + 5 })), 'expiry-too-long', at)[0].message, /open for more than 200 days from the second of --now/);
  assert.equal(ofCheck(withOrders(order({ end: NOW + 8 * DAY })), 'expiry-too-long', { now: NOW, maxExpiryDays: 7 }).length, 1);
  const r = checkText(text(withOrders(order({ start: undefined }), { ...OFFER, start: undefined })));
  assert.ok(r.notes.includes('2 orders with an end and no start were not measured against --max-expiry-days, because no --now was given'));
  const one = checkText(text(withOrders(order({ start: undefined }))));
  assert.ok(one.notes.includes('1 order with an end and no start was not measured against --max-expiry-days, because no --now was given'));
});

test('order-expired: an end at or before --now, at the line of the end; a second later passes; no --now, no check and a note', () => {
  const p = withOrders(order({ start: NOW - WEEK, end: NOW - 10 }));
  const f = ofCheck(p, 'order-expired', at);
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(text(p), '"end"'));
  assert.match(f[0].message, /^Order L1 ends at unix second 1799999990, 10 seconds before the second given with --now, 1800000000, so it can no longer be filled\./);
  assert.match(ofCheck(withOrders(order({ start: NOW - WEEK, end: NOW })), 'order-expired', at)[0].message, /ends at unix second 1800000000, the second given with --now/);
  assert.deepEqual(ofCheck(withOrders(order({ start: NOW - WEEK, end: NOW + 1 })), 'order-expired', at), []);
  const none = checkText(text(withOrders(order({ start: NOW - WEEK, end: NOW - 10 }))));
  assert.ok(!none.findings.some((x) => x.id === 'order-expired'));
  assert.ok(none.notes.includes('no --now was given, so order-expired did not run'));
  assert.deepEqual(checkText(text(withOrders(order({ end: 'never' })))).notes, ['no --now was given, so order-expired did not run']);
  assert.deepEqual(checkText(text(withOrders(order({ end: {} })))).notes, [], 'no end was read, so there is nothing to say of --now');
});

test('start-after-end: a start at or after the end, at the line of the end; one second passes', () => {
  const p = withOrders(order({ start: NOW + 10, end: NOW }));
  const f = ofCheck(p, 'start-after-end', at);
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(text(p), '"end"'));
  assert.match(f[0].message, /^Order L1 starts at unix second 1800000010 and ends at 1800000000, so it is open for no second: it ends before it starts\./);
  assert.match(ofCheck(withOrders(order({ start: NOW + 5, end: NOW + 5 })), 'start-after-end', at)[0].message, /open for no second\. This is/);
  assert.deepEqual(ofCheck(withOrders(order({ start: NOW, end: NOW + 1 })), 'start-after-end', at), []);
});

test('price-zero: a price of 0 that is not a transfer, at the line of the price; a transfer passes', () => {
  const p = withOrders(order({ price: '0.00' }));
  const f = ofCheck(p, 'price-zero');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(text(p), '"price"'));
  assert.match(f[0].message, /^Order L1 has a price of 0 and is not marked as a transfer, so the token would go for nothing\./);
  assert.deepEqual(ofCheck(withOrders(order({ price: 0, transfer: true, fees: [] })), 'price-zero'), []);
  assert.equal(ofCheck(withOrders(order({ price: 0, transfer: false, fees: [] })), 'price-zero').length, 1);
  assert.deepEqual(ofCheck(withOrders(order({ price: '0.000000000000000001', fees: [] })), 'price-zero'), [], 'one wei is a price');
});

test('currency-chain-mismatch and offer-in-native-currency: the currency against the chain, and a native currency on an offer', () => {
  const p = withOrders(order({ currency: 'SOL' }));
  const f = ofCheck(p, 'currency-chain-mismatch');
  assert.equal(f[0].line, lineOf(text(p), '"currency"'));
  assert.match(f[0].message, /^The currency of order L1 is SOL, which the tool knows on no chain of the EVM family, but the chain of the file is ethereum\./);
  assert.match(ofCheck(file({ chain: 'polygon', orders: [order({ currency: 'AVAX' })] }), 'currency-chain-mismatch')[0].message, /AVAX, which the tool knows on avalanche, but the chain of the file is polygon/);
  assert.match(ofCheck(file({ chain: 'polygon' }), 'currency-chain-mismatch')[0].message, /ETH, which the tool knows on ethereum, base, arbitrum and optimism/);
  assert.deepEqual(ofCheck(file({ chain: 'polygon', orders: [order({ currency: 'POL' }), { ...OFFER, currency: 'weth' }] }), 'currency-chain-mismatch'), []);
  assert.deepEqual(ofCheck(file({ chain: 'base', orders: [order({ currency: 'usdc' })] }), 'currency-chain-mismatch'), []);
  const o = withOrders({ ...OFFER, currency: 'ETH' });
  const n = ofCheck(o, 'offer-in-native-currency');
  assert.equal(n.length, 1);
  assert.equal(n[0].line, lineOf(text(o), '"currency"'));
  assert.match(n[0].message, /^Offer O1 is priced in ETH, the native currency of ethereum, which a marketplace cannot draw from the wallet of the buyer/);
  assert.equal(ofCheck(file({ chain: 'polygon', orders: [{ ...OFFER, currency: 'pol' }] }), 'offer-in-native-currency').length, 1);
  assert.deepEqual(ofCheck(withOrders(order({ currency: 'ETH' })), 'offer-in-native-currency'), [], 'a listing may be in the native currency');
  const unknown = checkText(text(withOrders(order({ currency: 'DOGE' }), { ...OFFER, currency: 'PEPE' }, order({ id: 'L3', tokenId: '3', currency: 'doge' }))));
  assert.ok(unknown.notes.includes('the currencies DOGE and PEPE are not one the tool knows, so they were not compared with the chain and their decimal places were not checked'));
  assert.ok(checkText(text(withOrders(order({ currency: 'DOGE' })))).notes.includes('the currency DOGE is not one the tool knows, so it was not compared with the chain and its decimal places were not checked'));
  assert.deepEqual(ofCheck(file({ chain: 'mars', orders: [order({ currency: 'SOL' }), { ...OFFER, currency: 'ETH' }] }), 'currency-chain-mismatch'), [], 'no chain was read, so nothing is compared with it');
});

test('duplicate-listing: one token listed twice by one maker, at the later listing; another maker, token or an offer passes', () => {
  const p = withOrders(order(), order({ id: 'L2', price: '1.2' }));
  const f = ofCheck(p, 'duplicate-listing');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(text(p), '"id": "L2"'));
  assert.match(f[0].message, new RegExp(`^Order L2 lists token #7 of Harbor Example Owls by the same maker as order L1 at line ${lineOf(text(p), '"id": "L1"') - 1} at another price, 1 ETH there and 1\\.2 ETH here\\.`));
  assert.match(ofCheck(withOrders(order(), order({ id: 'L2', price: '1.00' })), 'duplicate-listing')[0].message, /by the same maker as order L1 at line \d+ at the same price\./);
  assert.match(ofCheck(withOrders(order(), order({ id: 'L2', price: '1x' })), 'duplicate-listing')[0].message, /by the same maker as order L1 at line \d+\. This is/);
  assert.deepEqual(ofCheck(withOrders(order(), order({ id: 'L2', contract: addr('3') })), 'duplicate-listing'), [], 'another contract is another token');
  assert.equal(ofCheck(withOrders(order(), order({ id: 'L2', maker: addr('A') })), 'duplicate-listing').length, 1, 'the same maker in capitals');
  assert.deepEqual(ofCheck(withOrders(order(), order({ id: 'L2', maker: addr('c') })), 'duplicate-listing'), []);
  assert.deepEqual(ofCheck(withOrders(order(), order({ id: 'L2', tokenId: '8' })), 'duplicate-listing'), []);
  assert.deepEqual(ofCheck(withOrders(order(), { ...OFFER, maker: addr('a'), tokenId: '7' }), 'duplicate-listing'), []);
  const strange = ofCheck(withOrders(order({ contract: addr('3') }), order({ id: 'L2', contract: addr('3') })), 'duplicate-listing');
  assert.match(strange[0].message, new RegExp(`lists token #7 of ${addr('3')} by the same maker`), 'a contract that is not declared is named by its address');
});

test('erc721-amount-not-one: an amount other than 1 on one ERC-721 token, and 0 on any ERC-721 order', () => {
  const p = withOrders(order({ amount: 2 }));
  const f = ofCheck(p, 'erc721-amount-not-one');
  assert.equal(f[0].line, lineOf(text(p), '"amount"'));
  assert.equal(f[0].message, 'Order L1 is for 2 of token #7 of the ERC-721 collection Harbor Example Owls, but an ERC-721 holder has none or one of a token.');
  assert.match(ofCheck(withOrders(order({ amount: 0 })), 'erc721-amount-not-one')[0].message, /is for 0 of token #7/);
  assert.match(ofCheck(withOrders(crit({ amount: 0 })), 'erc721-amount-not-one')[0].message, /^Order O2 is for 0 tokens of the ERC-721 collection Harbor Example Owls; an ERC-721 token is held whole, none or one of each id\.$/);
  assert.deepEqual(ofCheck(withOrders(crit({ amount: 5 })), 'erc721-amount-not-one'), [], 'an offer for a set of tokens may ask for several');
  assert.deepEqual(ofCheck(withOrders(order({ amount: undefined })), 'erc721-amount-not-one'), [], 'an ERC-721 order with no amount is for one token');
  assert.match(ofCheck(withOrders(order({ amount: 3, tokenId: 'x' })), 'erc721-amount-not-one')[0].message, /is for 3 of its token/);
});

test('erc1155-amount-invalid and erc1155-amount-above-balance: an amount of 0, and a listing above the balance of its maker', () => {
  const p = withOrders(order({ ...BADGE, amount: 0 }));
  const f = ofCheck(p, 'erc1155-amount-invalid');
  assert.equal(f[0].line, lineOf(text(p), '"amount"'));
  assert.match(f[0].message, /^Order B1 is for 0 of token #3 of the ERC-1155 collection Meadow Example Badges\. This is a best practice/);
  const above = withOrders(order({ ...BADGE, amount: 6 }));
  const a = ofCheck(above, 'erc1155-amount-above-balance');
  assert.equal(a[0].line, lineOf(text(above), '"amount"'));
  assert.equal(a[0].message, 'Order B1 lists 6 of token #3 of the ERC-1155 collection Meadow Example Badges, but the file declares a balance of 5 for its maker. A compliant ERC-1155 contract reverts a transfer of more than the holder has.');
  assert.deepEqual(idsOf(withOrders(order({ ...BADGE, amount: 5 }))), [], 'the whole balance passes');
  assert.deepEqual(ofCheck(withOrders({ ...OFFER, contract: addr('2'), amount: 9, makerBalance: 1, fees: [fee('royalty', addr('8'), 250)] }), 'erc1155-amount-above-balance'), [], 'the balance of the maker of an offer is not what it buys');
  const none = checkText(text(withOrders(order({ ...BADGE, makerBalance: undefined }), order({ ...BADGE, id: 'B2', tokenId: '4', makerBalance: undefined }))), at);
  assert.deepEqual(none.findings, []);
  assert.deepEqual(none.notes, ['2 ERC-1155 listings give no makerBalance, so erc1155-amount-above-balance did not run for them']);
  assert.deepEqual(checkText(text(withOrders(order({ ...BADGE, makerBalance: undefined }))), at).notes, ['1 ERC-1155 listing gives no makerBalance, so erc1155-amount-above-balance did not run for it']);
  const missing = withOrders(order({ ...BADGE, amount: undefined }));
  assert.deepEqual(findingsOf(missing).map((x) => [x.id, x.message]), [['field-missing', 'Order B1 is for the ERC-1155 collection Meadow Example Badges and has no amount.']]);
  const noId = withOrders(order({ ...BADGE, id: undefined, amount: undefined }));
  assert.equal(ofCheck(noId, 'field-missing').at(-1).line, lineOf(text(noId), '"side"') - 1);
  assert.deepEqual(idsOf(withOrders(order({ ...BADGE, amount: 'x' }))), ['field-invalid'], 'an amount that could not be read is not missing');
});

test('address-malformed: every address of an order, of a fee and of a collection, with the zero address; a taker of zeros passes', () => {
  const p = withOrders(order({ maker: '0x12345' }));
  const f = ofCheck(p, 'address-malformed');
  assert.equal(f[0].line, lineOf(text(p), '"maker"'));
  assert.match(f[0].message, /^The maker of order L1, "0x12345", has 5 characters after 0x, not 40; an address is 0x followed by 40 hex digits\. This is a best practice/);
  assert.match(ofCheck(withOrders(order({ contract: addr('0') })), 'address-malformed')[0].message, /^The contract of order L1, .* is the zero address, which no one holds/);
  assert.match(ofCheck(withOrders(order({ taker: 'bob.eth' })), 'address-malformed')[0].message, /^The taker of order L1, "bob\.eth", does not start with 0x/);
  assert.deepEqual(idsOf(withOrders(order({ taker: addr('0') }))), [], 'a taker of zeros is an order anyone may fill');
  assert.match(ofCheck(withOrders(order({ fees: [fee('marketplace', addr('0'), 250), FEES[1]] })), 'address-malformed')[0].message, /^The recipient of fee 1 of order L1, .* is the zero address, which no one holds; a fee sent there is lost\./);
  const c = file({ collections: [{ ...OWLS, contract: '0xowls' }, { ...BADGES, royalty: { receiver: addr('0'), bps: 250 } }], orders: [] });
  assert.deepEqual(findingsOf(c).map((x) => x.message.slice(0, 50)), ['The contract of collection Harbor Example Owls, "0', 'The royalty receiver of collection Meadow Example ']);
});

test('maker-is-taker: an order whose taker is its maker, in any case; another taker passes', () => {
  const p = withOrders(order({ taker: addr('A') }));
  const f = ofCheck(p, 'maker-is-taker');
  assert.equal(f[0].line, lineOf(text(p), '"taker"'));
  assert.match(f[0].message, /^The taker of order L1 is its own maker, 0xa{40}, so the order can only fill against the wallet that made it\./);
  assert.deepEqual(idsOf(withOrders(order({ taker: addr('e') }))), []);
});

test('criteria-root-missing: an offer for a set of tokens with no criteria, no root or a root of zeros; a root passes', () => {
  const none = withOrders(crit({ criteria: undefined }));
  const f = ofCheck(none, 'criteria-root-missing');
  assert.equal(f[0].line, lineOf(text(none), '"kind"'));
  assert.match(f[0].message, /^Order O2 is an offer for a set of tokens with no criteria, so no merkle root names the tokens it covers\./);
  const empty = withOrders(crit({ criteria: {} }));
  assert.equal(ofCheck(empty, 'criteria-root-missing')[0].line, lineOf(text(empty), '"criteria": {'));
  assert.match(ofCheck(empty, 'criteria-root-missing')[0].message, /^The criteria of order O2 give no root/);
  const zero = withOrders(crit({ criteria: { root: hash('0') } }));
  assert.equal(ofCheck(zero, 'criteria-root-missing')[0].line, lineOf(text(zero), '"root"'));
  assert.match(ofCheck(zero, 'criteria-root-missing')[0].message, /^The criteria root of order O2 is all zeros, which is the root of no set of tokens\./);
  assert.deepEqual(idsOf(withOrders(crit())), []);
  assert.deepEqual(idsOf(withOrders(crit({ criteria: 'x' }))), ['field-invalid'], 'criteria that could not be read are not missing');
  assert.deepEqual(idsOf(withOrders(crit({ criteria: { root: 'x' } }))), ['field-invalid'], 'a root that could not be read is not missing');
});

test('collection-offer-without-criteria: a note on a collection offer, never on a listing or an offer on one token', () => {
  const p = withOrders({ ...OFFER, kind: 'collection', tokenId: undefined });
  const f = ofCheck(p, 'collection-offer-without-criteria');
  assert.equal(f[0].line, lineOf(text(p), '"kind"'));
  assert.equal(ruleById('collection-offer-without-criteria').severity, 'info');
  assert.match(ofCheck(withOrders({ ...OFFER, kind: 'collection', tokenId: undefined, contract: addr('3') }), 'collection-offer-without-criteria')[0].message, /any holder of the contract may fill it/);
  assert.deepEqual(ofCheck(withOrders(OFFER), 'collection-offer-without-criteria'), []);
});

test('field-duplicate: two orders of one id without case, and one contract declared twice', () => {
  const p = withOrders(order(), order({ id: ' l1 ', tokenId: '8' }));
  const f = ofCheck(p, 'field-duplicate');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(text(p), '"id": " l1 "'));
  assert.match(f[0].message, /^The id l1 is also the id of the order at line \d+; each order needs an id of its own\.$/);
  const c = file({ collections: [OWLS, { ...OWLS, name: 'Owls Again', contract: addr('1').toUpperCase().replace('0X', '0x') }] });
  assert.match(ofCheck(c, 'field-duplicate')[0].message, /^The contract 0x1{40} of collection Owls Again is also the contract of collection Harbor Example Owls at line \d+; declare each contract once\.$/);
});

test('an order that names no readable side, kind or contract skips the checks that need them and adds no other finding', () => {
  assert.deepEqual(idsOf(withOrders(order({ side: 'bid' }))), ['field-invalid']);
  assert.deepEqual(idsOf(withOrders(order({ contract: 'owls' }))), ['address-malformed']);
  assert.deepEqual(idsOf(file({ collections: [{ ...OWLS, standard: 'x' }, BADGES], orders: [order({ amount: 7 })] })), ['field-invalid'], 'no standard, no amount check');
});
