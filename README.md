# marketplace-order-check

Marketplace order check. Give it an export of NFT marketplace orders as JSON, before they are signed or filled: the
chain; the collections, each with its contract, its standard (ERC-721 or ERC-1155) and the royalty it declares under
ERC-2981 with its receiver; and the listings and offers, each with its maker and taker, contract, token id or the
criteria of a set of tokens, amount, price, currency, start and end in unix seconds, and its fees (the marketplace fee,
the royalty and any other split). It reads the file and lists the mistakes an NFT marketplace developer would catch:
fees that take the whole price, a royalty paid to another receiver than the declared one or above or below the declared
share, an order that never expires, lasts too long, has expired or ends before it starts, a price of 0 or with more
places than its currency holds, a currency of another chain, an offer in the native currency, a token listed twice, an
ERC-721 amount other than 1, an ERC-1155 amount of 0 or above the balance of the seller, a malformed or zero address, a
maker that is its own taker, and an offer for a set of tokens with no merkle root. Every finding has its id, level,
message and line, and the run exits with a code a pipeline can act on.

**It is an input to a review of marketplace orders before they are signed or filled: not legal or financial advice, not
an audit of the marketplace or its contracts and not a guarantee that an order will fill as intended.** It is not legal
advice and not financial advice. It reads one file only: it contacts no chain, node, marketplace or API, fetches
nothing, signs nothing, runs nothing, needs no key and reads no clock, so it does not know whether the maker holds the
token, whether the contract declares the royalty the file says, or whether an order was already filled; the checks are a
heuristic. A clean run means only that none of the problems of its checks were found in the file, and the team still
has to check the export against the orders it signs and decide its prices, fees and royalties itself.

A filled order moves a token and money at once, and cannot be called back. ERC-2981 lets a contract tell marketplaces
how much royalty to pay on a sale and to whom; ERC-721 and ERC-1155 say how many of a token a holder can move.
Everything else a careful marketplace checks on an order comes from practice rather than from a standard: fees that are
a part of the price, an end on every order, a real price on a listing, a currency of the right chain, an offer in a
token the marketplace can draw, one listing per token, and addresses that someone holds. A listing at 0, an offer that
never ends or a fee sent to the zero address is easy to miss in a batch of thousands and costly once it is filled. This
tool reads the export on every change and points at the line.

- **One check per problem.** Twenty-six checks, each with what it looks at, what it cannot see, the public pages it
  rests on and what to change. Five are documented, by ERC-2981, ERC-721 and ERC-1155; the others are best practices of
  this tool, and each message says which. ERC-2981 speaks of a percentage of the sale price, calls the payment of a
  royalty voluntary and names neither basis points nor the fee of a marketplace, so a royalty below the declared share
  is only a note, and adding up the fees is the tool's own choice.
- **The file's own numbers.** Prices, fees, shares, balances and times come from the file. The one number of the tool's
  own, the length of `expiry-too-long`, is a warning that `--max-expiry-days` moves.
- **No clock.** The start and the end of an order are unix seconds of the file, and "now" is only the second given with
  `--now`, so the same file and options give the same report on any day.
- **Never a secret.** The tool needs no private key, no seed and no API key. A key named for a private key or a seed,
  and a value shaped like a mnemonic, an extended private key, a private key in hex or a key in WIF, is an error, and the
  value is never shown in any report. A criteria root or an order hash is read as the hash it is, and its value is never
  shown either.
- **Numbers as written.** Prices and fees are read from the characters of the file and shares are worked out exactly,
  never through a floating point number, so one wei is still one wei next to a price in ether.
- **A strict reader of its own.** The JSON reader keeps the line and column of every value, so a finding points at the
  order or the fee; a key written twice stops the reader instead of letting two readers see two values. What the file
  does not say is listed as a finding, never taken for a value that is fine.
- Reports as text, markdown, JSON and SARIF, with an exit code for a pipeline: `0` no finding at or above the
  `--fail-on` level, `1` a finding at or above it, `2` usage or input error.
- Plain JavaScript, no dependencies, no clock and no network.

```
npm test
```

```
tests 132
pass 130
fail 0
skipped 2
```

These are the summary lines that `npm test` prints at the end on Windows. The skipped tests are the ones that need a
symbolic link or a device (a link to an order file, and `/dev/null` named as a file); they are guarded with
`process.platform`, run on Linux and macOS, and none of them asserts a line. `npm run test:coverage` runs the same tests
with coverage; their time limits are four times wider when coverage is on.

## Quick start

Requires Node 22 or newer. There is nothing to install.

```
git clone https://github.com/INNERLUXES/marketplace-order-check.git
cd marketplace-order-check
node bin/marketplace-order-check.js examples/bad/orders.json --now 1800000000
```

Or without a clone, in your own project:

```
npx --yes github:INNERLUXES/marketplace-order-check orders.json --now "$(date +%s)"
```

`examples/` holds two made-up order files on ethereum. Every name in them is made up, every address and hash is one
character written many times, and none holds a real key or seed. The bad file, in `examples/bad`, holds a finding of
nearly every check: an ERC-721 listing for 2 of one token, open for 358 days, that pays a lower royalty to another
receiver; a second listing of the same token at another price with no end and a royalty above the declared share; a
listing at 0 that ends before it starts; an ERC-1155 listing of 12 out of a balance of 5 at a price with 7 places in
USDC; an ERC-1155 listing for 0 tokens in SOL to its own maker, with a fee above its price and a misspelt balance; an
offer in ETH from a maker address cut short, with a fee to the zero address, that has expired against `--now`; an offer
for a set of tokens with no merkle root; a collection offer whose id differs from another only in case and that holds
a seed phrase; and an order with the side "bid" and no price. The good file, in `examples/good`, passes at error,
warning and info level: two listings and two offers with fees and royalties that match what their collections declare,
a 30-day listing with its order hash, an ERC-1155 listing within the balance of its seller, an offer for a set of tokens
with its merkle root, and a gift between two wallets marked as a transfer.

## Usage

```
marketplace-order-check <orders.json> [options]
```

```
--format <name>            text, markdown, json or sarif (default: text)
--json                     the same as --format json
--min-severity <level>     the lowest level of a finding that is shown: info, warning, error (default: info)
--fail-on <level>          the lowest level of a finding that fails the run: info, warning, error (default: error)
--now <seconds>            the unix second to compare the end of each order with; without it order-expired does not run
--max-expiry-days <n>      the length above which expiry-too-long warns, 1 to 36500 days (default: 180)
--explain                  show the points of the pages behind each finding (text, markdown and JSON)
--list-checks              list the checks with their level and kind, and exit
--help                     show the usage
--version                  show the version
```

[docs/inputs.md](docs/inputs.md) lists every field. The path in the report is relative to the folder you run the command
in, with forward slashes on every system, followed by the line.

A short file looks like this:

```json
{
  "chain": "ethereum",
  "collections": [
    { "contract": "0x1111111111111111111111111111111111111111", "name": "Harbor Example Owls", "standard": "ERC-721", "royalty": { "receiver": "0x9999999999999999999999999999999999999999", "bps": 500 } }
  ],
  "orders": [
    { "id": "L1", "side": "listing", "maker": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "contract": "0x1111111111111111111111111111111111111111", "tokenId": "7", "price": "1.5", "currency": "ETH", "start": 1800000000, "end": 1802592000,
      "fees": [{ "kind": "marketplace", "recipient": "0xffffffffffffffffffffffffffffffffffffffff", "bps": 250 }, { "kind": "royalty", "recipient": "0x9999999999999999999999999999999999999999", "bps": 500 }] },
    { "id": "O1", "side": "offer", "maker": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "contract": "0x1111111111111111111111111111111111111111", "tokenId": "9", "price": "0.8", "currency": "WETH", "start": 1800000000, "end": 1800604800,
      "fees": [{ "kind": "royalty", "recipient": "0x9999999999999999999999999999999999999999", "bps": 500 }] }
  ]
}
```

The file is the tool's own format. A script writes it from the orders a marketplace or a wallet is about to sign or
fill, whatever order protocol they use on chain, such as Seaport, an open order format whose offer and consideration
items map to the price and the fees here.

The report of the bad example starts with what was read, the findings in one line, and the checks with the number of
findings of each; then the findings, errors first, each with what to change:

```
marketplace-order-check: examples/bad/orders.json
file: examples/bad/orders.json (JSON, 19 lines, 3,944 bytes)
chain: ethereum
collections: 2: Harbor Example Owls, ERC-721, royalty 500 basis points (5%) to 0x9999999999999999999999999999999999999999; Meadow Example Badges, ERC-1155, royalty 250 basis points (2.5%) to 0x8888888888888888888888888888888888888888
orders: 9 (5 listings, 3 offers)
now: unix second 1800000000, from --now
max expiry: 180 days
findings: 27 (18 error, 6 warning, 3 info)

Checks (26)

  check                              level    kind           findings
  file-unreadable                    error    input          0
  field-missing                      error    input          1
  field-unknown                      warning  input          1
  field-invalid                      error    input          1
  field-duplicate                    error    input          1
  secret-in-file                     error    input          1
  price-malformed                    error    input          1
  fees-exceed-price                  error    best practice  1
  royalty-receiver-mismatch          warning  documented     1
  royalty-above-declared             warning  documented     1
  royalty-below-declared             info     documented     2
  order-never-expires                warning  best practice  1
  expiry-too-long                    warning  best practice  1
  order-expired                      error    best practice  1
  start-after-end                    error    best practice  1
  price-zero                         error    best practice  1
  currency-chain-mismatch            error    best practice  1
  offer-in-native-currency           error    best practice  1
  duplicate-listing                  warning  best practice  1
  erc721-amount-not-one              error    documented     1
  erc1155-amount-invalid             error    best practice  1
  erc1155-amount-above-balance       error    documented     1
  address-malformed                  error    best practice  2
  maker-is-taker                     error    best practice  1
  criteria-root-missing              error    best practice  1
  collection-offer-without-criteria  info     best practice  1

```

A finding names its check, its level, the line of the field and what to change. With `--explain` it also gives the
points of the pages behind it and, for a best practice check, the tool's own choice:

```
  WARNING  royalty-receiver-mismatch          examples/bad/orders.json:9
           Fee 2 of order L1 pays royalty to 0x7777777777777777777777777777777777777777, but collection Harbor Example Owls declares 0x9999999999999999999999999999999999999999 as its receiver. The royaltyInfo of ERC-2981 answers a marketplace with the address the royalty is sent to.
           fix: Pay the royalty to the receiver the contract declares, or update the declared receiver in the file if the contract was changed.
           basis: The royaltyInfo function of ERC-2981 answers a marketplace with two values for a sale: the address the royalty is to be sent to, and the amount. (ERC-2981: NFT Royalty Standard, https://eips.ethereum.org/EIPS/eip-2981)
```

After the findings comes the table of the orders: the side, the collection, the token, the amount, the price, the fees
and what the seller gets, with a dash for what could not be read:

```
Orders (9)

  order  side     collection             token    amount  price     fees        seller gets
  L1     listing  Harbor Example Owls    #7       2       1.5 ETH   0.0825 ETH  1.4175 ETH
  L2     listing  Harbor Example Owls    #7       -       1.2 ETH   0.12 ETH    1.08 ETH
  L3     listing  Harbor Example Owls    #8       -       0         0           -
  L4     listing  Meadow Example Badges  #3       12      -         -           -
  L5     listing  Meadow Example Badges  #4       0       2 SOL     3 SOL       -
  O1     offer    Harbor Example Owls    #9       -       0.8 ETH   0.06 ETH    0.74 ETH
  O2     offer    Harbor Example Owls    by root  -       0.5 WETH  0.025 WETH  0.475 WETH
  o1     offer    Harbor Example Owls    any      -       0.4 WETH  0.02 WETH   0.38 WETH
  O4     -        Harbor Example Owls    #10      -       -         -           -
```

The end of the report holds the notes, if any, the notice and the result:

```
This report is an input to a review of marketplace orders before they are signed or filled: not legal or financial advice, not an audit of the marketplace or its contracts and not a guarantee that an order will fill as intended.

RESULT: FAIL - 18 findings at or above error (18 error, 6 warning, 3 info)
```

The good example passes:

```

  none

Orders (5)

  order  side     collection             token    amount  price     fees        seller gets
  L1     listing  Harbor Example Owls    #7       1       1.5 ETH   0.1125 ETH  1.3875 ETH
  L2     listing  Meadow Example Badges  #3       2       40 USDC   2 USDC      38 USDC
  O1     offer    Harbor Example Owls    #9       -       0.8 WETH  0.06 WETH   0.74 WETH
  O2     offer    Harbor Example Owls    by root  3       0.5 WETH  0.025 WETH  0.475 WETH
  T1     listing  Harbor Example Owls    #11      -       transfer  0           -

This report is an input to a review of marketplace orders before they are signed or filled: not legal or financial advice, not an audit of the marketplace or its contracts and not a guarantee that an order will fill as intended.

RESULT: PASS - no finding at or above error
```

## How the file is read

1. The path is resolved against the folder you run the command in. A link, a folder, a device or a file over 16 MB is
   refused, and so is a file that is not UTF-8 (or UTF-16 with a byte order mark) or holds a null byte, with exit code
   `2` and no report.
2. The file is read as strict JSON, whatever its name. The reader keeps the line and column of every value and refuses
   a key written twice in one object.
3. Every key and value of the file is looked at for a private key or a seed. One that is found is an error at its line,
   and its value is left out of everything that follows and never shown. A hash under `root` or `orderHash` is read as
   a hash.
4. The fields are read with their lines. A key the tool does not read is a `field-unknown` finding; a missing field, a
   value of the wrong type and a price that is not a plain decimal are findings of their own, and that value is left out
   of the checks that need it.
5. The prices and fees, the royalties, the times, the currencies, the tokens and amounts, the addresses and the offers
   are checked.

[docs/method.md](docs/method.md) says what each check reads, and [docs/inputs.md](docs/inputs.md) lists the fields, the
units and the times.

## What it checks

| Check | Level | Kind | What it reports |
| --- | --- | --- | --- |
| `fees-exceed-price` | error | best practice | fees that add up to the whole price or more |
| `royalty-receiver-mismatch` | warning | documented | a royalty paid to another address than the declared ERC-2981 receiver |
| `royalty-above-declared` | warning | documented | a royalty above the declared share of the price |
| `royalty-below-declared` | info | documented | a royalty below the declared share of the price, or none |
| `order-never-expires` | warning | best practice | an order with no end, an end of never or an end so far ahead it never comes |
| `expiry-too-long` | warning | best practice | an order open longer than `--max-expiry-days`, 180 by default |
| `order-expired` | error | best practice | an order that ends at or before `--now` |
| `start-after-end` | error | best practice | an order that starts at or after its end |
| `price-zero` | error | best practice | a price of 0 on an order that is not marked as a transfer |
| `currency-chain-mismatch` | error | best practice | a currency of other chains than the chain of the file |
| `offer-in-native-currency` | error | best practice | an offer priced in the native currency of its chain |
| `duplicate-listing` | warning | best practice | one token listed twice by one maker |
| `erc721-amount-not-one` | error | documented | an ERC-721 amount other than 1, or 0 |
| `erc1155-amount-invalid` | error | best practice | an ERC-1155 amount of 0 |
| `erc1155-amount-above-balance` | error | documented | an ERC-1155 listing above the balance of its maker |
| `address-malformed` | error | best practice | an address that is not 0x and 40 hex digits, or the zero address where it loses tokens or money |
| `maker-is-taker` | error | best practice | an order whose taker is its own maker |
| `criteria-root-missing` | error | best practice | an offer for a set of tokens with no merkle root, or a root of zeros |
| `collection-offer-without-criteria` | info | best practice | a collection offer, which any token may fill |
| `price-malformed` | error | input | a price or a fee amount that is not a plain decimal, or has more places than its currency |
| `secret-in-file` | error | input | a key or a seed; its value is never shown |
| `field-duplicate` | error | input | two orders of one id, or one contract declared twice |
| `field-invalid` | error | input | a value of the wrong type or form |
| `field-unknown` | warning | input | a key the tool does not read, often a misspelt one |
| `field-missing` | error | input | a field the checks need |
| `file-unreadable` | error | input | a file that is not strict JSON, or holds no object |

A documented check rests on ERC-2981, ERC-721 or ERC-1155. A best practice check is this tool's own choice, and its
message says "a best practice of this tool, not a rule in the pages it cites". `--list-checks` shows the kind of each
check. Some of the choices are worth a word:

- The three royalty checks are documented: the royaltyInfo of ERC-2981 answers with the receiver and with an amount
  worked out as a percentage of the sale price. A royalty below the declared share is only a note, because ERC-2981
  calls the payment voluntary; a royalty less than one smallest unit of a known currency away from the declared share
  counts as the declared share, because ERC-2981 lets the amount be rounded either way.
- `fees-exceed-price` is a best practice: no saved page describes the fees of a marketplace. At the whole price the
  seller receives nothing, and above it the order cannot be filled.
- `order-expired` runs only with `--now`; the tool reads no clock.
- `offer-in-native-currency` is an error: a seller fills an offer later, and the marketplace can draw a token the buyer
  approved, such as WETH, but not the ETH in the wallet of the buyer.
- `erc1155-amount-invalid` is a best practice, because ERC-1155 does not forbid a transfer of 0;
  `erc1155-amount-above-balance` is documented, because a compliant ERC-1155 contract reverts a transfer above the
  balance.
- `duplicate-listing`, `order-never-expires` and `expiry-too-long` are warnings: each can be a choice a seller makes
  knowingly. `collection-offer-without-criteria` is a note: collection offers are common and often meant.
- A value of 64 hex digits under `root` or `orderHash` has the shape of a private key in hex and is read as the hash it
  is; under any other key it is `secret-in-file`.

## What is not checked

[docs/limits.md](docs/limits.md) lists what the tool cannot see. Among them: the law, taxes and prices (ask counsel and
decide them yourself); the chain, so whether the maker holds and approved the token, whether the contract declares the
royalty the file says and whether an order was filled or cancelled; the raw structs and signatures of an order
protocol; a royalty that changes by token or by sale; a fee the marketplace adds later; the time of a block; the tokens
behind a merkle root; the checksum of an address; chains and currencies outside a short list; and secrets in a shape the
search does not know.

## Formats

`--format text` (the default) is for a terminal. `--format markdown` is a report for a job summary or a pull request,
with a table of findings and the table of orders. `--format json` writes every finding with its `id`, `severity`,
`message`, `file`, `line`, `column`, `subject` and `fix`, what the file says, the table of orders, and with `--explain`
the points of the pages. `--format sarif` writes SARIF 2.1.0, with the checks as rules, the order file as the artifact
and a result for each finding with its line and column, for code scanning; the table of orders has no place in it. The
saved output of the examples is in [examples/output](examples/output).

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | no finding at or above the `--fail-on` level (default `error`) |
| `1` | a finding at or above it |
| `2` | a usage error, such as an unknown option, a `--now` that is not a whole number of seconds or a `--max-expiry-days` outside 1 to 36500, or an input error such as a path that does not exist, a link or a folder, or a file that is not text or is too large; there is no report |

Findings below `--min-severity` are not shown, and still count for the result.

## Limits

The tool reads the one file it is given; it contacts no chain, node or marketplace and connects to nothing. A run
reports the problems of docs/method.md that the file holds. [docs/limits.md](docs/limits.md) lists what it cannot see,
with the size limits: 16 MB for the file, 10,000 orders, 1,000 collections, 20 fees an order, JSON nested up to 1,000
deep, prices of up to 40 digits on each side of the point, token ids of up to 78 digits, and whole numbers up to
999,999,999,999. [docs/threat-model.md](docs/threat-model.md) lists the risks of reading an order file from a pull
request or an upload and their controls, and [docs/secure-defaults.md](docs/secure-defaults.md) the defaults and how to
run the tool in a pipeline.

## Architecture

Plain ES modules in `src/`, with no dependencies.

| File | Job |
| --- | --- |
| `src/cli.js` | the command line, the usage and the exit codes |
| `src/check.js` | reads the file as JSON, looks for keys and seeds with the hashes set apart, reads the fields, runs the checks and builds the report of the run |
| `src/files.js` | the bounded reading of a file by its byte order mark, with no link followed, kept from the sibling tools |
| `src/json.js` | the JSON reader of the sibling tools: lines and columns, keys written twice, limits, a stack of its own |
| `src/secrets.js` | the search for keys and seeds by the name of a key and the shape of a value, kept from the sibling tools |
| `src/fields.js` | reading text, choices, prices, basis points, whole numbers, flags and hashes with their lines |
| `src/orders.js` | the fields of the file: the chain, the collections with their declared royalty, and the orders with their fees and criteria |
| `src/decimal.js` | prices read from the characters of a file and worked out with BigInt |
| `src/addresses.js` | the form of an address, the chains, and the currencies with their chains and decimal places |
| `src/analyze.js` | the checks on what was read |
| `src/rules.js` | the checks, their levels and kinds, and the result |
| `src/report.js`, `src/text.js`, `src/size.js` | the text, markdown, JSON and SARIF output, the cleaning of text from the input and number formats |
| `src/data.js` | the public pages and the points the checks rest on, in this project's own words |
| `research/sources/` | text copies of the pages, as they were read |
| `tools/check.mjs`, `tools/example.mjs` | the repository checks, and the examples with their real output |

## Where the facts come from

The documented checks rest on three public pages, nothing else. Each was read before it was listed, a text copy of it
is kept in [research/sources](research/sources), and [research/sources.md](research/sources.md) has a note on each,
says what the pages do not say, and lists the lines the copies leave out.
[docs/rules-and-sources.md](docs/rules-and-sources.md) lists every check with the points of the pages it rests on, what
it cannot see and what to change. Where a check is a best practice and not a rule in the pages, it says so. No page of
an order protocol is saved, and no check rests on one.

- ERC-2981, NFT Royalty Standard: https://eips.ethereum.org/EIPS/eip-2981
- ERC-721, Non-Fungible Token Standard: https://eips.ethereum.org/EIPS/eip-721
- ERC-1155, Multi Token Standard: https://eips.ethereum.org/EIPS/eip-1155

## Background

Marketplace orders are written by the backend of a marketplace, a wallet or a trading bot, and signed and filled by
people who seldom read them line by line. They are checked when a marketplace is first built, when its fees or its
royalty rules change, when a collection moves to another chain or adds ERC-1155 tokens, or when engineers are brought
in to build the order book, the listing flow and the offer flow. How such work is staffed and carried out is described
on the page [NFT Marketplace Development Services for Businesses](https://innerluxes.dev/blockchain/create-nft-marketplace).

## License

MIT
