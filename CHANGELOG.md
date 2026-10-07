# Changes

## 1.0.0

First release.

- Reads an export of NFT marketplace orders as JSON before they are signed or filled and lists with its line every
  mistake of the orders the checks know, as an input to a review: not legal or financial advice, not an audit of the
  marketplace or its contracts and not a guarantee that an order will fill as intended. It reads the file, contacts no
  chain, node, marketplace or API, fetches nothing, signs nothing, opens no link, runs nothing, needs no key, follows no
  symbolic link and reads no clock.
- Reads the chain; the collections, each with its contract, name, standard (ERC-721 or ERC-1155) and the royalty it
  declares under ERC-2981 in basis points with its receiver; and the orders, listings and offers, each with its id,
  order hash, side, kind (one token, any token of the contract, or a set of tokens named by a merkle root), maker,
  taker, contract, token id, amount, balance of the maker, price, currency, start and end in unix seconds, fees with
  their kind, recipient and share or amount, criteria root and transfer flag.
- The start and the end of an order are unix seconds of the file; "now" is only the second given with `--now`, and the
  tool never reads the clock or turns a second into a date.
- The strict JSON reader of the sibling tools, kept unchanged, with no dependency and no recursion, with the line and
  column of every value, a key written twice as a finding, and limits of size, nesting, values and string length; the
  bounded reading of a file of the sibling tools. Prices and fee amounts are read from the characters of the file with
  BigInt, never through a floating point number, shares are worked out exactly, and token ids are kept as their digits.
- A search for keys and seeds in the file before anything else is read, kept unchanged from the sibling tools: each one
  found is an error whose value is left out of every check and never shown. A hash of 64 hex digits under `root` or
  `orderHash` is read as the hash it is, and the value of either is never shown.
- Twenty-six checks in three levels, each documented or a best practice of the tool and saying which: fees of the whole
  price or more (`fees-exceed-price`); a royalty paid to another address than the declared receiver
  (`royalty-receiver-mismatch`), above the declared share of the price (`royalty-above-declared`) or below it, as a
  note (`royalty-below-declared`), per ERC-2981 and with its rounding to the smallest unit; an order that never expires
  (`order-never-expires`), that is open longer than `--max-expiry-days`, 180 by default (`expiry-too-long`), that has
  expired against `--now` (`order-expired`) or that starts at or after its end (`start-after-end`); a price of 0 that is
  not a transfer (`price-zero`); a currency of another chain (`currency-chain-mismatch`); an offer in the native
  currency of the chain (`offer-in-native-currency`); one token listed twice by one maker (`duplicate-listing`); an
  ERC-721 amount other than 1, per ERC-721 (`erc721-amount-not-one`); an ERC-1155 amount of 0
  (`erc1155-amount-invalid`) or above the balance of the maker, per ERC-1155 (`erc1155-amount-above-balance`); a
  malformed or zero address (`address-malformed`); a maker that is its own taker (`maker-is-taker`); an offer for a set
  of tokens with no merkle root (`criteria-root-missing`); a collection offer, as a note
  (`collection-offer-without-criteria`); and seven checks about the file (`file-unreadable`, `field-missing`,
  `field-unknown`, `field-invalid`, `field-duplicate`, `secret-in-file`, `price-malformed`).
- A table of the orders with their side, collection, token, amount, price, fees and what the seller gets, in every
  format but SARIF.
- Reports as text, markdown, JSON and SARIF 2.1.0; every finding has its id, severity, message, file, line, column and
  subject; `--min-severity`, `--fail-on`, `--now`, `--max-expiry-days`, `--explain` with the points of the pages behind
  each finding, and `--list-checks`. Exit code `0` when no finding is at or above the fail-on level, `1` when one is, `2`
  for a usage or input error, with no result.
- Plain text copies of the public pages the documented checks rest on, under research/sources, with a note on each:
  ERC-2981, ERC-721 and ERC-1155.
- Release packages come with a CycloneDX SBOM, SHA-256 checksums and a build provenance attestation, after the SSDF gate
  of the repository.
