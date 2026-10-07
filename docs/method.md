# Method

This document says how the tool reads an export of marketplace orders and what each check looks at. The tool is an
input to a review of marketplace orders before they are signed or filled: not legal or financial advice, not an audit of
the marketplace or its contracts and not a guarantee that an order will fill as intended. A clean run means only that
none of the problems below were found in the file.

## Why the orders

An NFT marketplace turns a signed order into a sale the moment someone fills it, and a filled order cannot be called
back. Most of the mistakes that cost a seller or a buyer are in the numbers and addresses of the order, long before it
reaches a chain: fees that add up to the whole price, a royalty paid to an old receiver, a listing at 0 that was meant
to be 0.5, an offer that never expires, an offer in a currency the marketplace cannot draw, a token listed twice at two
prices, an ERC-1155 listing for more than the seller holds, a fee sent to the zero address.

A marketplace backend, a wallet or a bot can write the orders it is about to sign or fill to one file in the format of
[inputs.md](inputs.md). The tool reads that file as it is, so the same check runs on every change, in a pipeline or by
hand, and every finding points at a line. The file is the tool's own format on purpose: a marketplace protocol, such as
the open order format Seaport, writes orders as structs of offer and consideration items that a script can turn into
this file, and the tool stays the same whatever protocol signs the orders.

## Reading the file

1. The path is resolved against the folder the command runs in. A link, a folder, a device or a pipe is refused; a file
   over 16 MB is refused before it is read; a file with a null byte, or bytes that are not UTF-8 (or UTF-16 with a byte
   order mark), is refused with exit code `2` and no report.
2. The file goes to the JSON reader of the sibling tools (`src/json.js`, kept unchanged), which keeps the line and column
   of every value and the characters every number was written with: a comment, a trailing comma, a key written twice in
   one object or text after the value is `file-unreadable`, and so is a top level that is not an object.
3. Every key and value of the file is looked at for a key or a seed (`src/secrets.js`, kept unchanged from the sibling
   tools). A key named for a private key, a seed or a mnemonic, and a value shaped like a mnemonic, an extended private
   key, a private key in hex or a key in WIF, is `secret-in-file`. The value is marked and left out of everything that
   follows, and no report shows it. A value of 64 hex digits under `root` or `orderHash` is the hash it is meant to be,
   not a key (decision 2), and is never shown either.
4. The fields are read (`src/orders.js`) as [inputs.md](inputs.md) lists them. A missing field is `field-missing`, a key
   the tool does not read is `field-unknown`, and a value of the wrong type or form is `field-invalid`; a price or a fee
   amount that is not a plain decimal, or has more decimal places than its currency holds, is `price-malformed`. The
   value is then left out of every check that needs it. Prices and fee amounts are read by `src/decimal.js` into a whole
   number and a scale, from the characters of the file, and shares into a whole number of basis points.

## The checks of the file

- A file that is not strict JSON, or holds no object (`file-unreadable`).
- A field the checks need that is not there (`field-missing`): the chain, the collections, the orders, the contract and
  the standard of a collection, the bps of a declared royalty and its receiver when the bps is above 0, the id, side,
  maker, contract and price of an order, the token id of an order for one token, the currency of an order whose price is
  not 0, the amount of an ERC-1155 order, the kind and the recipient of a fee and its bps or amount, and a declared
  collection for the contract of an order.
- A key the tool does not read (`field-unknown`), with the known key it is probably meant to be.
- A value of the wrong type or form (`field-invalid`).
- Two orders of one id, compared without case and outer spaces, and one contract declared as two collections
  (`field-duplicate`).
- A private key, a seed or a mnemonic (`secret-in-file`).
- A price or a fee amount that is not a plain decimal of 0 or more, or has more decimal places than its currency
  (`price-malformed`).

## The checks of the price and the fees

Every fee is turned into an amount of the currency of the order: a share in basis points is the price times the share
divided by 10000, worked out exactly with BigInt; an amount is taken as written.

- Fees that add up to the whole price or more (`fees-exceed-price`), at the line of the fees. At the whole price the
  seller receives nothing; above it the order cannot be filled at all. A fee that could not be read is left out of the
  sum, so a sum that is already too high is still reported.
- A price of 0 on an order that is not marked as a transfer (`price-zero`). A transfer is `"transfer": true` with a price
  of 0; a transfer with a price is `field-invalid`.

## The checks of the royalty

When the collection of an order declares an ERC-2981 royalty, the tool works out the royalty the declared share comes
to on the price of the order, and compares it with the fees of kind `royalty`. Orders at a price of 0 are left out.
ERC-2981 lets the amount be rounded up or down to a whole number of the smallest unit, so for a currency the tool knows,
a royalty less than one smallest unit (one wei for ETH) away from the declared share counts as the declared share; for
another currency the comparison is exact.

- A royalty fee paid to another address than the declared receiver (`royalty-receiver-mismatch`), compared without
  case. ERC-2981 has `royaltyInfo` answer with the address the royalty is sent to.
- Royalty fees that add up to more than the declared share of the price (`royalty-above-declared`), at the first
  royalty fee. ERC-2981 works the royalty out as a percentage of the sale price.
- Royalty fees that add up to less, or none (`royalty-below-declared`), as a note: ERC-2981 leaves the payment of the
  royalty to the marketplace and calls it voluntary.

A collection that declares no royalty is not compared, and a note names it.

## The checks of time

The tool reads no clock. The start and the end are unix seconds of the file, and "now" is the second of `--now`.

- An order that starts at or after its end (`start-after-end`), at the line of the end.
- An order with no end, an end of `never`, or an end of 13 digits or more (`order-never-expires`).
- An order open for longer than `--max-expiry-days`, 180 by default (`expiry-too-long`), counted from its start, or from
  `--now` when it has none. With neither, the order is not measured, and a note says how many.
- An order whose end is at or before `--now` (`order-expired`). Without `--now` the check does not run, and a note says
  so.

## The checks of the currency

The tool knows a short list of chains and currencies ([limits.md](limits.md)).

- A currency the tool knows only on other chains than the chain of the file (`currency-chain-mismatch`), such as SOL on
  any chain of the list, or AVAX on polygon.
- An offer priced in the native currency of the chain of the file (`offer-in-native-currency`), such as ETH on ethereum
  or POL on polygon. A seller fills an offer later, and the marketplace can draw a token the buyer approved but not the
  native currency of the buyer.

A currency the tool does not know is not compared, and a note names it.

## The checks of the tokens

- One token of one contract listed twice by one maker (`duplicate-listing`), at the later listing, with both prices
  when they differ. Only listings of kind `item` are compared.
- An ERC-721 order for one token id with an amount other than 1, or an ERC-721 order of any kind for 0 tokens
  (`erc721-amount-not-one`). An ERC-721 holder has none or one of a token. An offer of kind `collection` or `criteria`
  on ERC-721 may ask for several tokens.
- An ERC-1155 order for an amount of 0 (`erc1155-amount-invalid`).
- An ERC-1155 listing for more than the `makerBalance` the file declares (`erc1155-amount-above-balance`). A compliant
  ERC-1155 contract reverts a transfer of more than the holder has. A listing with no `makerBalance` is not compared,
  and a note says how many.

## The checks of the addresses

- A maker, a taker, a contract, a fee recipient or a declared royalty receiver that is not 0x and 40 hex digits, or is
  the zero address (`address-malformed`). A taker of zeros means an order anyone may fill and is not reported.
- An order whose taker is its own maker (`maker-is-taker`), compared without case.

## The checks of the offers

- An offer of kind `criteria` with no criteria, no root or a root of zeros (`criteria-root-missing`). The root is
  checked for its form only.
- An offer of kind `collection` (`collection-offer-without-criteria`), as a note: any holder may fill it with the token
  they want least.

## Levels and the result

Every check has one level: `error` for a mistake that loses a token or money or makes the order fail, `warning` for one
that is almost always a mistake but can be a choice, and `info` for a note. `--fail-on` sets the lowest level that fails
the run, `error` by default; `--min-severity` hides the findings below a level from the report, and they still count for
the result. The exit code is `0` with no finding at or above the fail-on level, `1` with one, and `2` for a usage or
input error with no report.
