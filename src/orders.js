// Reading the order file of an NFT marketplace from the nodes of the JSON reader: the chain, the collections with their
// standard and their declared ERC-2981 royalty, and the orders, listings and offers, each with its side, kind, maker,
// taker, contract, token, amount, price, currency, start, end, fees and criteria. Every field is read with the line and
// column of its key. A field that is missing, of the wrong type or unknown is a finding of its own, and the value is left
// out of the checks that need it; nothing that was not read is taken for a value that is fine. The start and the end of
// an order are unix seconds of the file; the tool reads no clock.

import { CHAINS, currencyOf } from './addresses.js';
import { placesOf } from './decimal.js';
import { Reader, cut, describe, readAmount, readBps, where } from './fields.js';
import { isArray, isNumber, isObject, isString } from './json.js';

export const ORDER_LIMITS = { maxWhole: 999999999999, maxOrders: 10000, maxCollections: 1000, maxFees: 20 };

export const TOP_KEYS = ['chain', 'collections', 'orders', 'notes'];
export const COLLECTION_KEYS = ['contract', 'name', 'standard', 'royalty', 'notes'];
export const ROYALTY_KEYS = ['receiver', 'bps', 'notes'];
export const ORDER_KEYS = ['id', 'orderHash', 'side', 'kind', 'maker', 'taker', 'contract', 'tokenId', 'amount', 'makerBalance', 'price', 'currency', 'start', 'end', 'fees', 'criteria', 'transfer', 'notes'];
export const FEE_KEYS = ['kind', 'recipient', 'bps', 'amount', 'notes'];
export const CRITERIA_KEYS = ['root', 'notes'];

export const SIDES = ['listing', 'offer'];
export const KINDS = ['item', 'collection', 'criteria'];
export const FEE_KINDS = ['marketplace', 'royalty', 'other'];

// The names a file may give a standard by, compared in small letters with spaces left out.
export const STANDARDS = [
  { name: 'ERC-721', names: ['erc-721', 'erc721', 'eip-721', 'eip721'] },
  { name: 'ERC-1155', names: ['erc-1155', 'erc1155', 'eip-1155', 'eip1155'] }
];
export const standardOf = (text) => STANDARDS.find((s) => s.names.includes(text.toLowerCase().replace(/\s+/g, '')))?.name ?? null;

// A token id is a whole number a uint256 holds: at most 78 digits, and at most 2^256 - 1.
const TOKEN_ID = /^(?:0|[1-9][0-9]{0,77})$/;
export const MAX_TOKEN_ID = 2n ** 256n - 1n;

// An end of 13 to 78 digits is beyond any expiry a marketplace means: more than 30,000 years of unix seconds. Formats
// write such an end, often the largest number a uint256 holds, for an order that never expires.
const FAR = /^[1-9][0-9]{12,77}$/;

// Reads the file from the root node: { file, findings, notes }. file is null when the top level is not an object.
export function readOrders(root, limits = ORDER_LIMITS) {
  const reader = new Reader('orders');
  const notes = [];
  if (!isObject(root)) {
    reader.add('file-unreadable', where(root), `The top level of the file is ${describe(root)}, not an object with the chain, the collections and the orders, so nothing was checked.`);
    return { file: null, findings: reader.findings, notes: ['the file was not checked, because it holds no object at its top level'] };
  }
  const top = reader.fields(root, TOP_KEYS, 'the file');
  const chains = Object.keys(CHAINS);
  const ch = reader.choice(top, 'chain', 'the file', chains);
  if (ch.value === null && !ch.invalid) reader.add('field-missing', where(ch.entry ?? root), `The file has no chain; write one of ${chains.join(', ')}.`);

  const list = (key, what, max, read) => {
    const e = top.get(key);
    const out = [];
    if (!e) {
      reader.add('field-missing', where(root), `The file has no ${key}.`);
      return out;
    }
    if (e.value.secret) return out;
    if (!isArray(e.value)) {
      reader.add('field-invalid', where(e), `The ${key} of the file are ${describe(e.value)}; they must be a list of objects, one for each ${what}.`);
      return out;
    }
    if (e.value.items.length > max) notes.push(`the file holds ${e.value.items.length} ${key}; the tool read the first ${max} and left the rest out`);
    for (const [index, node] of e.value.items.slice(0, max).entries()) {
      if (node.secret) continue;
      if (!isObject(node)) {
        reader.add('field-invalid', where(node), `Item ${index + 1} of the ${key} is ${describe(node)}; it must be an object.`);
        continue;
      }
      out.push(read(node, index + 1));
    }
    return out;
  };

  const collections = list('collections', 'contract', limits.maxCollections, (node, n) => readCollection(reader, node, n));
  const orders = list('orders', 'listing or offer', limits.maxOrders, (node, n) => readOrder(reader, node, n, limits, notes));
  return { file: { root, chain: ch.value, chainEntry: ch.entry, collections, orders }, findings: reader.findings, notes };
}

// One collection: its contract, name, standard and declared royalty.
function readCollection(reader, node, n) {
  const m = reader.fields(node, COLLECTION_KEYS, `collection ${n}`);
  const name = reader.text(m, 'name', `collection ${n}`);
  const title = name.value === null ? `${n}` : cut(name.value, 60);
  const of = `collection ${title}`;
  const Of = `Collection ${title}`;
  const c = { index: n, node, title, name: name.value, contract: null, contractRaw: null, contractEntry: null, standard: null, royalty: null };
  const ct = reader.text(m, 'contract', of);
  Object.assign(c, { contract: ct.value, contractRaw: ct.raw ?? null, contractEntry: ct.entry });
  if (ct.value === null && !ct.invalid) reader.add('field-missing', where(ct.entry ?? node), `${Of} has no contract.`);
  const st = reader.text(m, 'standard', of);
  if (st.value === null && !st.invalid) reader.add('field-missing', where(st.entry ?? node), `${Of} has no standard; write ERC-721 or ERC-1155.`);
  else if (st.value !== null) {
    c.standard = standardOf(st.value);
    if (!c.standard) reader.add('field-invalid', where(st.entry), `The standard of ${of} is "${cut(st.value, 40)}", which is not one the tool reads; write ERC-721 or ERC-1155.`);
  }
  const ro = reader.object(m, 'royalty', of, 'its receiver and bps');
  if (ro.value) {
    const rm = reader.fields(ro.value, ROYALTY_KEYS, `the royalty of ${of}`);
    const royalty = { entry: ro.entry, bps: null, receiver: null, receiverRaw: null, receiverEntry: null, valid: false };
    const b = reader.amount(rm, 'bps', `the royalty of ${of}`);
    if (b.value !== null) {
      const bps = readBps(b.value);
      if (bps.state === 'ok') royalty.bps = bps.value;
      else reader.add('field-invalid', where(b.entry), `The bps of the royalty of ${of} is "${cut(b.value, 40)}"; it must be a whole number of basis points from 0 to 10000, where 100 is 1% of the price.`);
    } else if (!b.invalid) reader.add('field-missing', where(b.entry ?? ro.entry), `The royalty of ${of} has no bps.`);
    const r = reader.text(rm, 'receiver', `the royalty of ${of}`);
    Object.assign(royalty, { receiver: r.value, receiverRaw: r.raw ?? null, receiverEntry: r.entry });
    if (r.value === null && !r.invalid && royalty.bps !== 0) reader.add('field-missing', where(r.entry ?? ro.entry), `The royalty of ${of} has no receiver.`);
    c.royalty = royalty;
  }
  return c;
}

// One order: a listing or an offer.
function readOrder(reader, node, n, limits, notes) {
  const max = limits.maxWhole;
  const m = reader.fields(node, ORDER_KEYS, `order ${n}`);
  const id = reader.text(m, 'id', `order ${n}`);
  const title = id.value === null ? `${n}` : cut(id.value, 60);
  const of = `order ${title}`;
  const Of = `Order ${title}`;
  const add = (rule, at, message) => reader.add(rule, at, message, title);
  const o = { index: n, node, line: node.line, column: node.column, title, id: id.value, idEntry: id.entry };
  if (id.value === null && !id.invalid) add('field-missing', where(node), `Order ${n} has no id.`);
  o.orderHash = reader.hash(m, 'orderHash', of).value !== null;

  const side = reader.choice(m, 'side', of, SIDES);
  Object.assign(o, { side: side.value, sideEntry: side.entry });
  if (side.value === null && !side.invalid) add('field-missing', where(side.entry ?? node), `${Of} has no side; write listing or offer.`);
  const kind = reader.choice(m, 'kind', of, KINDS);
  Object.assign(o, { kind: kind.value ?? (kind.invalid ? null : 'item'), kindEntry: kind.entry });
  if (o.side === 'listing' && o.kind !== null && o.kind !== 'item') {
    add('field-invalid', where(kind.entry), `${Of} is a listing of kind ${o.kind}; a listing sells one token id, so its kind is item, and only an offer may be of kind collection or criteria.`);
    o.kind = null;
  }

  for (const key of ['maker', 'taker', 'contract']) {
    const r = reader.text(m, key, of);
    Object.assign(o, { [key]: r.value, [`${key}Raw`]: r.raw ?? null, [`${key}Entry`]: r.entry });
    if (key !== 'taker' && r.value === null && !r.invalid) add('field-missing', where(r.entry ?? node), `${Of} has no ${key}.`);
  }

  // The token id, read as the digits of the file and never as a floating point number.
  o.tokenId = null;
  const te = m.get('tokenId');
  o.tokenEntry = te ?? null;
  if (te && !te.value.secret) {
    const raw = isNumber(te.value) ? te.value.raw : isString(te.value) ? te.value.value.trim() : null;
    if (raw === null || !TOKEN_ID.test(raw) || BigInt(raw) > MAX_TOKEN_ID) add('field-invalid', where(te), `The tokenId of ${of} is ${isString(te.value) ? `"${cut(te.value.value, 40)}"` : describe(te.value)}; it must be a whole number of at most 78 digits, as a uint256 holds, written as a number or as text.`);
    else o.tokenId = raw;
  }
  if (o.kind === 'item' && !te) add('field-missing', where(node), `${Of} is for one token and has no tokenId.`);
  if ((o.kind === 'collection' || o.kind === 'criteria') && te) add('field-invalid', where(te), `${Of} is an offer of kind ${o.kind} and names a tokenId; write kind item for an offer on one token.`);

  const am = reader.whole(m, 'amount', of, { min: 0, max, what: 'tokens' });
  Object.assign(o, { amount: am.value, amountEntry: am.entry });
  const bal = reader.whole(m, 'makerBalance', of, { min: 0, max, what: 'tokens' });
  Object.assign(o, { balance: bal.value, balanceEntry: bal.entry });

  // The price and the currency; the places of the price are checked against the currency when the tool knows it.
  const price = reader.amount(m, 'price', of);
  Object.assign(o, { price: null, priceEntry: price.entry });
  let parsed = null;
  if (price.value !== null) {
    parsed = readAmount(price.value);
    if (parsed.state === 'nan' || parsed.state === 'negative') add('price-malformed', where(price.entry), `The price of ${of} is "${cut(price.value, 40)}"; it must be a plain decimal number of 0 or more, such as 0.25, with no sign, exponent or separator.`);
  } else if (!price.invalid) add('field-missing', where(price.entry ?? node), `${Of} has no price.`);
  const cur = reader.text(m, 'currency', of);
  Object.assign(o, { currency: cur.value === null ? null : cur.value.toUpperCase(), currencyEntry: cur.entry });
  const known = o.currency === null ? null : currencyOf(o.currency);
  const fits = (d, entry, label) => {
    if (!known || placesOf(d) <= known.decimals) return true;
    add('price-malformed', where(entry), `${label} of ${of} has ${placesOf(d)} decimal places, but ${cut(o.currency, 20)} holds ${known.decimals}, so it cannot be paid as written.`);
    return false;
  };
  if (parsed && (parsed.state === 'ok' || parsed.state === 'zero') && fits(parsed.value, price.entry, 'The price')) o.price = parsed.value;
  if (cur.value === null && !cur.invalid && !(parsed && parsed.state === 'zero')) add('field-missing', where(cur.entry ?? node), `${Of} has no currency, such as ETH or WETH.`);

  // The start and the end, in unix seconds. An end that is missing, never, or of 13 digits or more never comes.
  const st = reader.whole(m, 'start', of, { min: 0, max, what: 'unix seconds' });
  Object.assign(o, { start: st.value, startEntry: st.entry, end: null, endEntry: null, never: false, endText: null });
  const ee = m.get('end');
  if (!ee) o.never = true;
  else if (!ee.value.secret) {
    o.endEntry = ee;
    const raw = isNumber(ee.value) ? ee.value.raw : isString(ee.value) ? ee.value.value.trim() : '';
    if (raw === '' && isString(ee.value)) o.never = true;
    else if (raw.toLowerCase() === 'never') Object.assign(o, { never: true, endText: 'never' });
    else if (FAR.test(raw)) Object.assign(o, { never: true, endText: raw });
    else o.end = reader.whole(m, 'end', of, { min: 0, max, what: 'unix seconds, or never' }).value;
  }

  // The fees.
  o.fees = [];
  const fe = m.get('fees');
  o.feesEntry = fe ?? null;
  if (fe && !fe.value.secret) {
    if (!isArray(fe.value)) add('field-invalid', where(fe), `The fees of ${of} are ${describe(fe.value)}; they must be a list of objects, one for each fee.`);
    else {
      if (fe.value.items.length > limits.maxFees) notes.push(`${of} holds ${fe.value.items.length} fees; the tool read the first ${limits.maxFees}`);
      for (const [index, item] of fe.value.items.slice(0, limits.maxFees).entries()) {
        if (item.secret) continue;
        if (!isObject(item)) add('field-invalid', where(item), `Fee ${index + 1} of ${of} is ${describe(item)}; it must be an object.`);
        else o.fees.push(readFee(reader, item, index + 1, of, title, fits));
      }
    }
  }

  // The criteria of an offer for a set of tokens.
  o.criteria = null;
  const cr = reader.object(m, 'criteria', of, 'its root');
  if (cr.value) {
    const cm = reader.fields(cr.value, CRITERIA_KEYS, `the criteria of ${of}`);
    const root = reader.hash(cm, 'root', `the criteria of ${of}`);
    o.criteria = { entry: cr.entry, root: root.value === null ? null : { zero: root.zero }, rootEntry: root.entry, rootInvalid: Boolean(root.invalid) };
  }
  if (cr.entry && !cr.invalid && (o.kind === 'item' || o.kind === 'collection')) add('field-invalid', where(cr.entry), `${Of} is of kind ${o.kind} and has criteria; criteria belong to an offer of kind criteria.`);
  o.criteriaInvalid = Boolean(cr.invalid);

  const tr = reader.flag(m, 'transfer', of);
  o.transfer = tr.value === true;
  if (o.transfer && o.price && o.price.int !== 0n) add('field-invalid', where(tr.entry), `${Of} is marked as a transfer but has a price above 0; a transfer has a price of 0.`);
  return o;
}

// One fee of an order: its kind, its recipient, and its share in basis points of the price or its amount.
function readFee(reader, node, n, of, title, fits) {
  const label = `fee ${n} of ${of}`;
  const Label = `Fee ${n} of ${of}`;
  const add = (rule, at, message) => reader.add(rule, at, message, title);
  const m = reader.fields(node, FEE_KEYS, label);
  const kind = reader.choice(m, 'kind', label, FEE_KINDS);
  if (kind.value === null && !kind.invalid) add('field-missing', where(kind.entry ?? node), `${Label} has no kind; write marketplace, royalty or other.`);
  const r = reader.text(m, 'recipient', label);
  if (r.value === null && !r.invalid) add('field-missing', where(r.entry ?? node), `${Label} has no recipient.`);
  const bps = reader.amount(m, 'bps', label);
  const amount = reader.amount(m, 'amount', label);
  const f = { index: n, node, kind: kind.value, recipient: r.value, recipientRaw: r.raw ?? null, recipientEntry: r.entry, bps: null, amount: null, entry: bps.entry ?? amount.entry ?? node, invalid: Boolean(bps.invalid || amount.invalid), valid: false };
  if (bps.entry && amount.entry) {
    add('field-invalid', where(amount.entry), `${Label} gives both bps and amount; give one, a share of the price in basis points or an amount in the currency of the order.`);
    f.invalid = true;
  } else if (bps.value !== null) {
    const b = readBps(bps.value);
    if (b.state === 'ok') f.bps = b.value;
    else {
      add('field-invalid', where(bps.entry), `The bps of ${label} is "${cut(bps.value, 40)}"; it must be a whole number of basis points from 0 to 10000, where 100 is 1% of the price.`);
      f.invalid = true;
    }
  } else if (amount.value !== null) {
    const a = readAmount(amount.value);
    if (a.state === 'nan' || a.state === 'negative') {
      add('price-malformed', where(amount.entry), `The amount of ${label} is "${cut(amount.value, 40)}"; it must be a plain decimal number of 0 or more, such as 0.025, with no sign, exponent or separator.`);
      f.invalid = true;
    } else if (fits(a.value, amount.entry, `The amount of fee ${n}`)) f.amount = a.value;
    else f.invalid = true;
  } else if (!f.invalid) {
    add('field-missing', where(node), `${Label} has no bps or amount.`);
    f.invalid = true;
  }
  return f;
}
