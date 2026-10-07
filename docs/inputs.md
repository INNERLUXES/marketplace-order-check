# Inputs

The tool takes the path of an export of NFT marketplace orders, a JSON file. There is no configuration file of the tool
itself, no environment variable and no standard input; the options are on the command line. The tool never asks for a
private key, a seed, an API key or the address of a node, and needs none. Its result is an input to a review of
marketplace orders before they are signed or filled: not legal or financial advice, not an audit of the marketplace or
its contracts and not a guarantee that an order will fill as intended.

```
marketplace-order-check <orders.json> [--format text|markdown|json|sarif] [--json] [--min-severity <level>]
                        [--fail-on <level>] [--now <seconds>] [--max-expiry-days <n>] [--explain] [--list-checks]
```

| Option | Meaning |
| --- | --- |
| `--format <name>` | `text` (default), `markdown`, `json` or `sarif` |
| `--json` | the same as `--format json` |
| `--min-severity <level>` | the lowest level shown: `info` (default), `warning` or `error` |
| `--fail-on <level>` | the lowest level that fails the run: `info`, `warning` or `error` (default) |
| `--now <seconds>` | the unix second the end of each order is compared with, a whole number of at most 12 digits; without it `order-expired` does not run, and an order with no start is not measured against `--max-expiry-days` |
| `--max-expiry-days <n>` | the length above which `expiry-too-long` warns, a whole number of days from 1 to 36500 (default 180) |
| `--explain` | add the points of the pages behind each finding to the text, markdown and JSON reports |
| `--list-checks` | list the checks with their level and kind, in text, markdown or JSON, and exit |
| `--help`, `--version` | the usage, the version |

Every option that takes a value takes it once. A value may not start with `--`. `-` (standard input) and an address such
as `https://...` are refused. A folder is refused: name the file. Two files are a usage error.

The tool reads no clock. `--now` is the only way to tell it what "now" is, so the same file and the same options give
the same report on every day; a pipeline that wants the check against the time of the run passes the time itself, such
as `--now "$(date +%s)"`.

## The file

The file is always read as JSON, whatever its name. It is UTF-8, with or without a byte order mark, or UTF-16 with a
byte order mark, with LF, CRLF or CR line ends. It is strict JSON (RFC 8259): no comments, no trailing commas, no single
quotes, and no key written twice in one object. Every object may hold a key `notes` with any value, which the tool does
not read; every other key it does not read is `field-unknown`.

The file is the tool's own export format, one object with three parts. It is meant to be written by a script from the
orders a marketplace or a wallet is about to sign or fill, whatever order format they use on chain; the tool does not
read the raw order structs of a marketplace protocol.

## Numbers, prices and times

An amount, a balance, a start and an end are whole numbers, written as JSON numbers or as text of digits, such as `2` or
`"2"`, up to 999,999,999,999. A token id is a whole number of at most 78 digits, up to the largest number a uint256
holds, written as text or as a number; it is kept as the digits of the file.

A price and the amount of a fee are plain decimal numbers of 0 or more in the unit of the currency, such as `"1.5"` for
1.5 ETH, written as a JSON number or as text: no sign, no exponent, no thousands separator and no decimal comma, and at
most 40 digits on each side of the point. They are read from the characters of the file with BigInt, never through a
floating point number. For a currency the tool knows, the price and the fee amounts may have no more decimal places than
the token holds (18 for ETH and WETH, 6 for USDC and USDT); trailing zeros do not count.

A share in basis points (`bps`) is a whole number from 0 to 10000, where 100 is 1% of the price and 10000 the whole
price. The basis point is the tool's own unit: ERC-2981 speaks of a percentage of the sale price and names no unit.

The start and the end of an order are unix seconds. The end may also be the text `never`, may be left out, or may be a
number of 13 to 78 digits, which formats write for an order that never expires (often the largest number a uint256
holds); each of those is an order that never expires.

## The parts

| Key | Type | Needed | Meaning |
| --- | --- | --- | --- |
| `chain` | text | yes | the chain of the orders: `ethereum`, `base`, `arbitrum`, `optimism`, `polygon`, `avalanche` or `bnb` |
| `collections` | list of objects | yes | the contracts the orders trade, each declared once |
| `orders` | list of objects | yes | the listings and the offers |

### A collection

| Key | Type | Needed | Meaning |
| --- | --- | --- | --- |
| `contract` | text | yes | the address of the token contract, 0x and 40 hex digits |
| `name` | text | no | a name for the reports; without it the collection is named by its place in the list |
| `standard` | text | yes | `ERC-721` or `ERC-1155` (also written `erc721`, `EIP-1155` and the like) |
| `royalty` | object | no | the royalty the contract declares under ERC-2981, as the exporter read it from `royaltyInfo` |
| `royalty.bps` | whole number | yes, in a royalty | the declared share of the sale price, in basis points |
| `royalty.receiver` | text | yes, unless `bps` is 0 | the address `royaltyInfo` names as the receiver |

A collection with no `royalty` declares none, and the royalty checks do not run for its orders; a note says so.

### An order

| Key | Type | Needed | Meaning |
| --- | --- | --- | --- |
| `id` | text | yes | a name of the order in the export, unique in the file without case |
| `orderHash` | text | no | the hash of the order, 64 hex digits; read as a hash and never shown |
| `side` | text | yes | `listing` (the maker sells) or `offer` (the maker buys) |
| `kind` | text | no | `item` (one token id, the default), `collection` (any token of the contract, offers only) or `criteria` (a set of tokens named by a merkle root, offers only) |
| `maker` | text | yes | the address that signs the order |
| `taker` | text | no | the only address that may fill the order; left out, or the zero address, for an order anyone may fill |
| `contract` | text | yes | the token contract, declared in `collections` |
| `tokenId` | whole number | for kind `item` | the token the order is for; not given on kinds `collection` and `criteria` |
| `amount` | whole number | for ERC-1155 | how many of the token the order is for; 1 when left out on ERC-721 |
| `makerBalance` | whole number | no | the balance of the token the maker of an ERC-1155 listing holds, as the exporter read it |
| `price` | decimal | yes | the whole price of the order in the unit of `currency` |
| `currency` | text | yes, unless the price is 0 | the symbol of the payment token, such as `ETH`, `WETH` or `USDC` |
| `start` | whole number | no | the unix second the order opens |
| `end` | whole number or `never` | no | the unix second the order closes |
| `fees` | list of objects | no | the parts of the price paid to others than the seller: the marketplace fee, the royalty and any other split |
| `criteria` | object | for kind `criteria` | `root`: the merkle root of the token ids the offer covers, 64 hex digits; read as a hash and never shown |
| `transfer` | true or false | no | true for a gift or a move between own wallets at a price of 0 |

### A fee

| Key | Type | Needed | Meaning |
| --- | --- | --- | --- |
| `kind` | text | yes | `marketplace`, `royalty` or `other` |
| `recipient` | text | yes | the address the fee is paid to |
| `bps` | whole number | one of the two | the fee as a share of the price, in basis points |
| `amount` | decimal | one of the two | the fee as an amount in the currency of the order |

A fee gives `bps` or `amount`, never both. Every fee is paid out of the price: for a listing the seller is the maker,
and for an offer the seller is the taker who fills it.

## Limits

[limits.md](limits.md) lists the size limits: 16 MB for the file, 10,000 orders, 1,000 collections and 20 fees an order,
JSON nested up to 1,000 levels. Past a limit the rest is not read, and a note says so.
