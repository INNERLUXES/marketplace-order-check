// The reports: text for a terminal, markdown for a job summary or a pull request, JSON for other tools and SARIF for code
// scanning. Every text that comes from the input (a file name, a collection name, an address, an order id) was cleaned
// by safeText before it reached the report object. The markdown format also escapes what markdown gives a meaning to,
// and the SARIF format is built as an object and written by JSON.stringify.

import { SOURCES } from './data.js';
import { RULES } from './rules.js';
import { grouped, listText, plural } from './size.js';

const URI = 'https://github.com/INNERLUXES/marketplace-order-check';

function findingsLine(r) {
  const b = r.totals.byLevel;
  const parts = ['error', 'warning', 'info'].filter((l) => b[l]).map((l) => `${grouped(b[l])} ${l}`);
  return `${grouped(r.totals.findings)}${parts.length ? ` (${parts.join(', ')})` : ''}${r.totals.hidden ? `; ${grouped(r.totals.hidden)} below ${r.config.minSeverity} not shown` : ''}`;
}

const fileLine = (r) => `${r.input.file} (JSON, ${plural(r.input.lines, 'line')}, ${plural(r.input.bytes, 'byte')})`;

// A collection in one phrase: its name, standard and declared royalty.
function collectionText(c) {
  const ro = c.royalty;
  const royalty = ro === null ? 'no royalty declared' : `royalty ${ro.bps === null ? 'not read' : `${grouped(ro.bps)} basis points (${ro.percent})`}${ro.receiver ? ` to ${ro.receiver}` : ''}`;
  return `${c.name}, ${c.standard ?? 'standard not read'}, ${royalty}`;
}

// What the file says, a line for each part.
function exportLines(r) {
  const e = r.export;
  if (!e) return [['orders', 'not read']];
  return [
    ['chain', e.chain ?? 'not read'],
    ['collections', e.collections.length ? `${grouped(e.collections.length)}: ${e.collections.map(collectionText).join('; ')}` : 'none read'],
    ['orders', `${grouped(e.orders.total)} (${plural(e.orders.listings, 'listing')}, ${plural(e.orders.offers, 'offer')})`],
    ['now', r.config.now === null ? 'not given, so order-expired did not run' : `unix second ${r.config.now}, from --now`],
    ['max expiry', `${plural(r.config.maxExpiryDays, 'day')}`]
  ];
}

function table(head, rows, indent = '  ') {
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)));
  const line = (cells) => `${indent}${cells.map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i]))).join('  ')}`.trimEnd();
  return [line(head), ...rows.map(line)];
}

const ORDER_HEAD = ['order', 'side', 'collection', 'token', 'amount', 'price', 'fees', 'seller gets'];
const dash = (v) => (v === null || v === undefined ? '-' : typeof v === 'number' ? grouped(v) : v);
const orderRows = (r) => r.orders.map((x) => [x.id, dash(x.side), dash(x.collection), dash(x.token), dash(x.amount), dash(x.price), dash(x.fees), dash(x.sellerGets)]);

const PAD = ' '.repeat(11);

export function toText(r, { explain = false } = {}) {
  const out = [];
  out.push(`marketplace-order-check: ${r.input.file}`);
  out.push(`file: ${fileLine(r)}`);
  for (const [k, v] of exportLines(r)) out.push(`${k}: ${v}`);
  out.push(`findings: ${findingsLine(r)}`);
  out.push('', `Checks (${grouped(r.rules.length)})`, '');
  out.push(...table(['check', 'level', 'kind', 'findings'], r.rules.map((x) => [x.id, x.level, x.kind, grouped(x.findings)])), '');
  out.push(`Findings (${grouped(r.findings.length)})`, '');
  if (!r.findings.length) out.push('  none', '');
  const width = Math.max(...RULES.map((x) => x.id.length));
  for (const f of r.findings) {
    out.push(`  ${f.severity.toUpperCase().padEnd(8)} ${f.id.padEnd(width)}  ${f.at}`);
    out.push(`${PAD}${f.message}`);
    out.push(`${PAD}fix: ${f.fix}`);
    if (explain) {
      for (const b of f.basis) out.push(`${PAD}basis: ${b.text} (${b.source}, ${b.url})`);
      if (f.own) out.push(`${PAD}the tool's own choice: ${f.own}`);
    }
    out.push('');
  }
  if (r.orders && r.orders.length) out.push(`Orders (${grouped(r.orders.length)})`, '', ...table(ORDER_HEAD, orderRows(r)), '');
  for (const n of r.notes) out.push(`note: ${n}`);
  if (r.notes.length) out.push('');
  out.push(r.notice, '');
  out.push(`RESULT: ${r.result.text}`);
  return `${out.join('\n')}\n`;
}

// Text for a markdown table cell or line: the characters markdown gives a meaning to are escaped.
const md = (t) => String(t).replace(/[\\`*_{}[\]<>()#+!|~]/g, (c) => `\\${c}`).replace(/\r?\n/g, ' ');

export function toMarkdown(r, { explain = false } = {}) {
  const out = [];
  out.push(`# marketplace-order-check: ${md(r.input.file)}`, '');
  out.push(`- File: ${md(fileLine(r))}`);
  for (const [k, v] of exportLines(r)) out.push(`- ${k[0].toUpperCase()}${k.slice(1)}: ${md(v)}`);
  out.push(`- Findings: ${md(findingsLine(r))}`);
  out.push(`- Result: **${md(r.result.text)}**`, '');
  out.push('## Findings', '');
  if (!r.findings.length) out.push('None.', '');
  else {
    out.push('| Level | Check | Where | Message |', '| --- | --- | --- | --- |');
    for (const f of r.findings) out.push(`| ${f.severity} | ${f.id} | ${md(f.at)} | ${md(f.message)} Fix: ${md(f.fix)} |`);
    out.push('');
  }
  if (explain) {
    out.push('## Basis', '');
    const seen = new Set();
    for (const f of r.findings) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      out.push(`### ${f.id}`, '');
      for (const b of f.basis) out.push(`- ${md(b.text)} (${md(b.source)}, <${b.url}>)`);
      if (f.own) out.push(`- The tool's own choice: ${md(f.own)}`);
      if (!f.basis.length && !f.own) out.push('- A problem with the file itself; it rests on no page.');
      out.push('');
    }
  }
  if (r.orders && r.orders.length) {
    out.push(`## Orders (${grouped(r.orders.length)})`, '');
    out.push('| Order | Side | Collection | Token | Amount | Price | Fees | Seller gets |', '| --- | --- | --- | --- | ---: | --- | --- | --- |');
    for (const row of orderRows(r)) out.push(`| ${row.map(md).join(' | ')} |`);
    out.push('');
  }
  for (const n of r.notes) out.push(`Note: ${md(n)}`, '');
  out.push(`${md(r.notice)}`, '');
  return `${out.join('\n')}`;
}

export function toJson(r, { explain = false } = {}) {
  const out = { ...r, findings: r.findings.map((f) => (explain ? f : { ...f, basis: undefined, own: undefined })) };
  return `${JSON.stringify(out, null, 2)}\n`;
}

const SARIF_LEVEL = { error: 'error', warning: 'warning', info: 'note' };

// SARIF 2.1.0: the checks as rules of the driver, the order file as the artifact, and one result for each finding with
// its line and column. The table of orders has no place in SARIF and is left out.
export function toSarif(r) {
  const sarif = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'marketplace-order-check',
            version: r.version,
            informationUri: URI,
            rules: RULES.map((x) => ({
              id: x.id,
              name: x.id,
              shortDescription: { text: x.summary },
              help: { text: `${x.fix} (${x.kind})` },
              defaultConfiguration: { level: SARIF_LEVEL[x.severity] },
              properties: { kind: x.kind }
            }))
          }
        },
        artifacts: [{ location: { uri: r.input.file } }],
        results: r.findings.map((f) => ({
          ruleId: f.id,
          ruleIndex: RULES.findIndex((x) => x.id === f.id),
          level: SARIF_LEVEL[f.severity],
          message: { text: `${f.message} Fix: ${f.fix}` },
          locations: [{ physicalLocation: { artifactLocation: { uri: f.file, index: 0 }, region: { startLine: f.line, startColumn: f.column } } }],
          properties: { kind: f.kind, subject: f.subject }
        })),
        properties: { notice: r.notice, result: r.result.text, sources: SOURCES.map((s) => s.url) }
      }
    ]
  };
  return `${JSON.stringify(sarif, null, 2)}\n`;
}

// The list of checks, for --list-checks.
export function listChecksText() {
  const width = Math.max(...RULES.map((x) => x.id.length));
  const out = ['marketplace-order-check checks', ''];
  for (const x of RULES) out.push(`  ${x.id.padEnd(width)}  ${x.severity.padEnd(7)}  ${x.kind.padEnd(13)}  ${x.summary}`);
  out.push('', `A documented check rests on ${listText(['ERC-2981', 'ERC-721', 'ERC-1155'], 8)}; a best practice check is this tool's own choice and says so in its message. An input check is about the file itself. None of it is legal or financial advice.`, '');
  return out.join('\n');
}

export function listChecksMarkdown() {
  const out = ['# marketplace-order-check checks', '', '| Check | Level | Kind | What it looks at |', '| --- | --- | --- | --- |'];
  for (const x of RULES) out.push(`| ${x.id} | ${x.severity} | ${x.kind} | ${md(x.summary)} |`);
  out.push('');
  return out.join('\n');
}

export function listChecksJson() {
  return `${JSON.stringify(RULES.map((x) => ({ id: x.id, severity: x.severity, kind: x.kind, summary: x.summary, fix: x.fix, basis: x.basis, own: x.own ?? null })), null, 2)}\n`;
}
