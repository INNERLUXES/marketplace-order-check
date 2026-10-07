// The checks on what was read: the addresses, the collections and the ids written twice, and for each order its price
// and fees, its royalty against the royalty its collection declares, its start and end, its currency, its amount by
// the standard of its collection, its criteria, and listings of one token written twice. Each finding names the line of
// the field it is about. The start and the end of an order are unix seconds of the file; the tool reads no clock, and
// compares an end with "now" only when --now names the second.

import { addressKey, addressProblem, currencyOf, isNative, isZeroAddress } from './addresses.js';
import { addDecimal, compareDecimal, formatDecimal, isZero, mulDecimal, subDecimal, ZERO } from './decimal.js';
import { BEST } from './rules.js';
import { grouped, listText, plural } from './size.js';

export const DEFAULT_MAX_EXPIRY_DAYS = 180;
export const DAY = 86400;

const BP = `This is ${BEST}.`;
const at = (e) => ({ line: e.line, column: e.column });
const shown = (text, max = 60) => (text.length > max ? `${text.slice(0, max - 3)}...` : text);

// A share in basis points as a percent: 250 is 2.5%, 1000 is 10%, 75 is 0.75%.
export function bpsPercent(bps) {
  const whole = Math.floor(bps / 100);
  const rest = String(bps % 100).padStart(2, '0').replace(/0+$/, '');
  return `${whole}${rest ? `.${rest}` : ''}%`;
}

// A share of a price in basis points, exact: price * bps / 10000.
export const shareOf = (price, bps) => mulDecimal(price, { int: BigInt(bps), scale: 4 });

// An amount and its currency as a report shows it.
export const money = (d, currency) => `${formatDecimal(d)}${currency ? ` ${currency}` : ''}`;

// A length in seconds as a report shows it, in days.
export function daysText(seconds) {
  const days = Math.floor(seconds / DAY);
  return `${seconds % DAY ? 'more than ' : ''}${plural(days, 'day')}`;
}

// The token of an order as a report shows it: its id, any token of the contract, or the tokens of a root.
function tokenText(o) {
  if (o.kind === 'collection') return 'any';
  if (o.kind === 'criteria') return 'by root';
  return o.tokenId === null ? null : `#${shown(o.tokenId, 24)}`;
}

// The checks: { findings, notes, summary }. file may be null when the file could not be read.
export function analyze(file = null, { now = null, maxExpiryDays = DEFAULT_MAX_EXPIRY_DAYS } = {}) {
  const findings = [];
  const notes = [];
  const add = (id, where, message, subject = null) => findings.push({ id, file: 'orders', line: where.line, column: where.column, message, subject });
  if (!file) return { findings, notes, summary: null };
  const { chain, collections, orders } = file;

  // The collections: the form of their addresses, and a contract declared twice.
  const byContract = new Map();
  for (const c of collections) {
    if (c.contract !== null) {
      const problem = addressProblem(c.contractRaw);
      if (problem) add('address-malformed', at(c.contractEntry), `The contract of collection ${c.title}, "${shown(c.contract)}", ${problem}; an address is 0x followed by 40 hex digits. ${BP}`);
      else if (byContract.has(addressKey(c.contract))) {
        const first = byContract.get(addressKey(c.contract));
        add('field-duplicate', at(c.contractEntry), `The contract ${shown(c.contract)} of collection ${c.title} is also the contract of collection ${first.title} at line ${first.contractEntry.line}; declare each contract once.`);
      } else byContract.set(addressKey(c.contract), c);
    }
    const ro = c.royalty;
    if (ro && ro.receiver !== null) {
      const problem = addressProblem(ro.receiverRaw);
      if (problem) add('address-malformed', at(ro.receiverEntry), `The royalty receiver of collection ${c.title}, "${shown(ro.receiver)}", ${problem}; an address is 0x followed by 40 hex digits. ${BP}`);
      else ro.valid = true;
    }
  }

  // Orders written twice.
  const ids = new Map();
  for (const o of orders) {
    if (o.id === null) continue;
    const k = o.id.toLowerCase();
    if (ids.has(k)) add('field-duplicate', at(o.idEntry), `The id ${shown(o.id, 40)} is also the id of the order at line ${ids.get(k).idEntry.line}; each order needs an id of its own.`, o.title);
    else ids.set(k, o);
  }

  const listings = new Map();
  const unknown = new Set();
  const used = new Set();
  let unmeasured = 0;
  let noBalance = 0;
  let timed = 0;
  const rows = [];
  for (const o of orders) {
    const subject = o.title;
    const Order = `Order ${o.title}`;

    // The form of every address of the order.
    const valid = {};
    for (const [key, label, zeroOk] of [['maker', 'The maker', false], ['taker', 'The taker', true], ['contract', 'The contract', false]]) {
      if (o[key] === null) continue;
      const problem = addressProblem(o[`${key}Raw`], zeroOk);
      if (problem) add('address-malformed', at(o[`${key}Entry`]), `${label} of order ${o.title}, "${shown(o[key])}", ${problem}; an address is 0x followed by 40 hex digits. ${BP}`, subject);
      else valid[key] = true;
    }
    for (const f of o.fees) {
      if (f.recipient === null) continue;
      const problem = addressProblem(f.recipientRaw);
      if (problem) add('address-malformed', at(f.recipientEntry), `The recipient of fee ${f.index} of order ${o.title}, "${shown(f.recipient)}", ${problem}; a fee sent there is lost. ${BP}`, subject);
      else f.valid = true;
    }
    if (valid.maker && valid.taker && !isZeroAddress(o.taker) && addressKey(o.maker) === addressKey(o.taker)) add('maker-is-taker', at(o.takerEntry), `The taker of order ${o.title} is its own maker, ${shown(o.maker, 50)}, so the order can only fill against the wallet that made it. ${BP}`, subject);

    // The collection of the order, by its contract.
    const col = valid.contract ? (byContract.get(addressKey(o.contract)) ?? null) : null;
    if (valid.contract && !col) add('field-missing', at(o.contractEntry), `The contract ${shown(o.contract, 50)} of order ${o.title} is not declared in the collections of the file, so its standard and its royalty are not known; declare it with its standard.`, subject);
    if (col) used.add(col);
    const standard = col ? col.standard : null;
    const cur = o.currency;

    // The price and the fees.
    const price = o.price;
    if (price && isZero(price) && !o.transfer) add('price-zero', at(o.priceEntry), `${Order} has a price of 0 and is not marked as a transfer, so the token would go for nothing. ${BP}`, subject);
    const amounts = o.fees.map((f) => (f.invalid || !price ? null : f.bps !== null ? shareOf(price, f.bps) : f.amount));
    let total = null;
    if (price) {
      total = amounts.reduce((sum, a) => (a === null ? sum : addDecimal(sum, a)), ZERO);
      if (!isZero(total) && compareDecimal(total, price) >= 0) {
        const over = compareDecimal(total, price) > 0;
        add('fees-exceed-price', at(o.feesEntry), `The fees of order ${o.title} add up to ${money(total, cur)}, ${over ? `${money(subDecimal(total, price), cur)} above` : 'the whole of'} its price of ${money(price, cur)}, so the seller ${o.side === 'offer' ? 'who fills the offer ' : ''}would receive nothing${over ? ' and the order cannot be filled' : ''}. ${BP}`, subject);
      }
    }

    // The royalty against the royalty the collection declares under ERC-2981.
    const ro = col ? col.royalty : null;
    if (price && !isZero(price) && ro && ro.bps !== null) {
      const declared = shareOf(price, ro.bps);
      const royalties = o.fees.map((f, i) => [f, amounts[i]]).filter(([f, a]) => f.kind === 'royalty' && a !== null);
      if (ro.valid) {
        for (const [f] of royalties) {
          if (f.valid && addressKey(f.recipient) !== addressKey(ro.receiver)) add('royalty-receiver-mismatch', at(f.recipientEntry), `Fee ${f.index} of order ${o.title} pays royalty to ${shown(f.recipient, 50)}, but collection ${col.title} declares ${shown(ro.receiver, 50)} as its receiver. The royaltyInfo of ERC-2981 answers a marketplace with the address the royalty is sent to.`, subject);
        }
      }
      const paid = royalties.reduce((sum, [, a]) => addDecimal(sum, a), ZERO);
      // ERC-2981 lets the amount be rounded up or down to a whole number of the smallest unit of the currency, so for a
      // currency the tool knows, a royalty less than one such unit away from the declared share is the declared share.
      const known = currencyOf(cur ?? '');
      const unit = known ? { int: 1n, scale: known.decimals } : null;
      const c = unit && compareDecimal(paid, addDecimal(declared, unit)) < 0 && compareDecimal(declared, addDecimal(paid, unit)) < 0 ? 0 : compareDecimal(paid, declared);
      const where = royalties.length ? at(royalties[0][0].entry) : at(o.priceEntry);
      const basis = `the royalty of ${bpsPercent(ro.bps)} that collection ${col.title} declares works out to ${money(declared, cur)} on the price of ${money(price, cur)}`;
      if (c > 0) add('royalty-above-declared', where, `${Order} pays ${money(paid, cur)} of royalty, but ${basis}. Under ERC-2981 the royalty owed is a percentage of the sale price.`, subject);
      else if (c < 0) add('royalty-below-declared', where, `${Order} pays ${isZero(paid) ? 'no royalty' : `${money(paid, cur)} of royalty`}, but ${basis}. ERC-2981 leaves the payment of a royalty to the marketplace, so this is a note.`, subject);
    }

    // The start and the end.
    if (o.end !== null || o.never) timed += 1;
    if (o.start !== null && o.end !== null && o.start >= o.end) {
      add('start-after-end', at(o.endEntry), `${Order} starts at unix second ${o.start} and ends at ${o.end}, so it is open for no second${o.end < o.start ? ': it ends before it starts' : ''}. ${BP}`, subject);
    } else if (o.never) {
      const why = o.endText === null ? 'has no end' : o.endText === 'never' ? 'ends never' : `ends at unix second ${shown(o.endText, 24)}, more than 30,000 years ahead`;
      add('order-never-expires', at(o.endEntry ?? o.idEntry ?? o), `${Order} ${why}, so it stays open for good and can be filled long after its price stopped making sense. ${BP}`, subject);
    } else if (o.end !== null) {
      const from = o.start ?? now;
      if (from === null) unmeasured += 1;
      else if (o.end - from > maxExpiryDays * DAY) add('expiry-too-long', at(o.endEntry), `${Order} is open for ${daysText(o.end - from)} from ${o.start !== null ? 'its start' : 'the second of --now'}, longer than the ${plural(maxExpiryDays, 'day')} of --max-expiry-days. ${BP}`, subject);
      if (now !== null && o.end <= now) add('order-expired', at(o.endEntry), `${Order} ends at unix second ${o.end}, ${o.end === now ? 'the second' : `${grouped(now - o.end)} seconds before the second`} given with --now, ${now}, so it can no longer be filled. ${BP}`, subject);
    }

    // The currency against the chain.
    if (cur !== null) {
      const known = currencyOf(cur);
      if (!known) unknown.add(shown(cur, 20));
      else if (chain && !known.chains.includes(chain)) add('currency-chain-mismatch', at(o.currencyEntry), `The currency of order ${o.title} is ${cur}, which the tool knows ${known.chains.length ? `on ${listText(known.chains, 8)}` : 'on no chain of the EVM family'}, but the chain of the file is ${chain}. ${BP}`, subject);
      if (chain && o.side === 'offer' && isNative(cur, chain)) add('offer-in-native-currency', at(o.currencyEntry), `Offer ${o.title} is priced in ${cur}, the native currency of ${chain}, which a marketplace cannot draw from the wallet of the buyer when a seller fills the offer; offers are paid in a wrapped token the buyer approved. ${BP}`, subject);
    }

    // A token listed twice by one maker.
    if (o.side === 'listing' && o.kind === 'item' && valid.maker && valid.contract && o.tokenId !== null) {
      const key = `${addressKey(o.maker)} ${addressKey(o.contract)} ${o.tokenId}`;
      const first = listings.get(key);
      if (first) {
        const same = first.price && price && compareDecimal(first.price, price) === 0;
        const prices = first.price && price && !same ? ` at another price, ${money(first.price, first.currency)} there and ${money(price, cur)} here` : same ? ' at the same price' : '';
        add('duplicate-listing', at(o.idEntry ?? o), `${Order} lists token #${shown(o.tokenId, 24)} of ${col ? col.title : shown(o.contract, 50)} by the same maker as order ${first.title} at line ${first.line}${prices}. ${BP}`, subject);
      } else listings.set(key, o);
    }

    // The amount, by the standard of the collection.
    const token = o.tokenId === null ? 'its token' : `token #${shown(o.tokenId, 24)}`;
    if (standard === 'ERC-721' && o.amount !== null) {
      if (o.kind === 'item' && o.amount !== 1) add('erc721-amount-not-one', at(o.amountEntry), `${Order} is for ${grouped(o.amount)} of ${token} of the ERC-721 collection ${col.title}, but an ERC-721 holder has none or one of a token.`, subject);
      else if (o.kind !== 'item' && o.amount === 0) add('erc721-amount-not-one', at(o.amountEntry), `${Order} is for 0 tokens of the ERC-721 collection ${col.title}; an ERC-721 token is held whole, none or one of each id.`, subject);
    }
    if (standard === 'ERC-1155') {
      if (o.amount === null && !o.amountEntry) add('field-missing', at(o.idEntry ?? o), `${Order} is for the ERC-1155 collection ${col.title} and has no amount.`, subject);
      else if (o.amount === 0) add('erc1155-amount-invalid', at(o.amountEntry), `${Order} is for 0 of ${token} of the ERC-1155 collection ${col.title}. ${BP}`, subject);
      else if (o.amount !== null && o.side === 'listing') {
        if (o.balance === null) noBalance += 1;
        else if (o.amount > o.balance) add('erc1155-amount-above-balance', at(o.amountEntry), `${Order} lists ${grouped(o.amount)} of ${token} of the ERC-1155 collection ${col.title}, but the file declares a balance of ${grouped(o.balance)} for its maker. A compliant ERC-1155 contract reverts a transfer of more than the holder has.`, subject);
      }
    }

    // The criteria of an offer for a set of tokens, and a collection offer.
    if (o.kind === 'criteria') {
      const cr = o.criteria;
      if (!cr && !o.criteriaInvalid) add('criteria-root-missing', at(o.kindEntry), `${Order} is an offer for a set of tokens with no criteria, so no merkle root names the tokens it covers. ${BP}`, subject);
      else if (cr && !cr.root && !cr.rootInvalid) add('criteria-root-missing', at(cr.entry), `The criteria of order ${o.title} give no root, so no merkle root names the tokens the offer covers. ${BP}`, subject);
      else if (cr?.root?.zero) add('criteria-root-missing', at(cr.rootEntry), `The criteria root of order ${o.title} is all zeros, which is the root of no set of tokens. ${BP}`, subject);
    }
    if (o.kind === 'collection' && o.side === 'offer') add('collection-offer-without-criteria', at(o.kindEntry), `${Order} is a collection offer, so any holder of ${col ? col.title : 'the contract'} may fill it with the token they want least. ${BP}`, subject);

    const net = price && total !== null && compareDecimal(total, price) < 0 ? money(subDecimal(price, total), cur) : null;
    rows.push({ id: o.title, side: o.side, collection: col ? col.title : null, token: tokenText(o), amount: o.amount, price: price ? (isZero(price) ? (o.transfer ? 'transfer' : '0') : money(price, cur)) : null, fees: total !== null && !isZero(total) ? money(total, cur) : price ? '0' : null, sellerGets: net });
  }

  if (now === null && timed > 0) notes.push('no --now was given, so order-expired did not run');
  if (unmeasured) notes.push(`${plural(unmeasured, 'order')} with an end and no start ${unmeasured === 1 ? 'was' : 'were'} not measured against --max-expiry-days, because no --now was given`);
  if (noBalance) notes.push(`${plural(noBalance, 'ERC-1155 listing')} ${noBalance === 1 ? 'gives' : 'give'} no makerBalance, so erc1155-amount-above-balance did not run for ${noBalance === 1 ? 'it' : 'them'}`);
  const silent = collections.filter((c) => used.has(c) && !c.royalty).map((c) => c.title);
  if (silent.length) notes.push(`${silent.length === 1 ? 'collection' : 'the collections'} ${listText(silent, 8)} ${silent.length === 1 ? 'declares' : 'declare'} no ERC-2981 royalty, so the royalty checks did not run for ${silent.length === 1 ? 'its' : 'their'} orders`);
  if (unknown.size) notes.push(`the ${unknown.size === 1 ? 'currency' : 'currencies'} ${listText([...unknown], 8)} ${unknown.size === 1 ? 'is' : 'are'} not one the tool knows, so ${unknown.size === 1 ? 'it was' : 'they were'} not compared with the chain and ${unknown.size === 1 ? 'its' : 'their'} decimal places were not checked`);

  const summary = {
    chain,
    collections: collections.map((c) => ({ name: c.title, contract: c.contract, standard: c.standard, royalty: c.royalty ? { bps: c.royalty.bps, percent: c.royalty.bps === null ? null : bpsPercent(c.royalty.bps), receiver: c.royalty.receiver } : null })),
    listings: orders.filter((o) => o.side === 'listing').length,
    offers: orders.filter((o) => o.side === 'offer').length,
    rows
  };
  return { findings, notes, summary };
}
