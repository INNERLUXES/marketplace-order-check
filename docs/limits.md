# Limits

The tool is not legal advice and not financial advice. It reads an export of NFT marketplace orders, and its result is
an input to a review of marketplace orders before they are signed or filled: not legal or financial advice, not an audit
of the marketplace or its contracts and not a guarantee that an order will fill as intended. A clean run means only that
none of the problems in [method.md](method.md) were found in the file.

## What it cannot see

- **The law and the money.** Whether a token may be sold where it is sold, how a sale or a royalty is taxed, whether a
  price is right and whether a creator expects a royalty are questions for counsel and for the people who sign the
  orders. The tool says nothing on any of them.
- **The chain.** It contacts no chain, so it cannot tell whether the maker holds the token, whether an approval is in
  place, whether an order was already filled or cancelled, or whether the contract really declares the royalty the file
  says. Every balance and every declared royalty is the exporter's word.
- **The order format.** The file is the tool's own format. The tool does not read the structs, signatures, zones,
  conduits, salts or counters of a marketplace protocol, and cannot tell whether the export matches the order that is
  signed. A 64-hex value such as a conduit key or a zone hash under any key but `root` or `orderHash` is reported as a
  key; leave such fields out of the export.
- **Royalties in practice.** ERC-2981 signals a royalty and leaves its payment to the marketplace. The tool compares the
  royalty fees of an order with the declared share, in basis points, its own choice of unit. A royalty set per token, a
  royalty paid outside the order, a split behind the receiver and a marketplace rule that pays less on purpose are not
  seen; a lower royalty is a note, not a warning.
- **Fees in practice.** The tool adds up the fees the export lists. A fee the marketplace adds later, a gas cost and a
  rounding of a share to the smallest unit of the token are not seen; shares are worked out exactly.
- **Time.** The tool reads no clock and no chain. It compares ends with the second of `--now` only, cannot tell how far a
  start is in the future, and does not know the time of a block. Without `--now` no order is expired.
- **Who fills an offer.** A collection offer may be filled with any token; an offer for a set of tokens is checked for a
  root, never for the tokens behind it. The tool cannot rebuild a merkle tree, so a root built from the wrong token ids
  passes.
- **Addresses.** An address is checked for its form only, with no checksum of EIP-55 and no lookup, so a well formed
  address of the wrong wallet passes. Only the form of an EVM chain is known.
- **Chains and currencies.** The chains known are ethereum, base, arbitrum, optimism, polygon, avalanche and bnb. The
  currencies known are ETH, WETH, POL, MATIC, WPOL, AVAX, WAVAX, BNB, WBNB, APE, DAI, USDC, USDT and SOL, each with the
  chains of the list it is used on and its decimal places; another currency is not compared and its places are not
  checked, and a note names it. A token of the same symbol at another contract address is not seen: the export names a
  currency by its symbol.
- **What a misspelt key meant.** A key the tool does not read is reported and left out. A misspelt `makerBalance` makes
  a listing look as if it had none; read the `field-unknown` findings first.
- **Every secret.** The search for keys and seeds knows them by the name of their key and by their shape: a mnemonic of
  12 to 24 lowercase English words, an extended private key, 64 hex digits or a key in WIF. A value of 64 hex digits
  under `root` or `orderHash` is read as a hash and cannot be told apart from a private key pasted there; it is never
  shown. A token id of exactly 64 digits has the shape of a key in hex and is reported as one. A secret split over
  fields, encoded another way or written under another name is not caught, and API keys and passwords are not looked for
  by their shape. A clean run does not say that the file holds no secret.

## What the reader does not read

[inputs.md](inputs.md) lists the fields. A file that is not strict JSON is one `file-unreadable` finding, and nothing
else in it is checked. A value that is missing, of the wrong type or a secret is a finding, and the checks that need it
leave it out: a clean run says nothing about that part. YAML, CSV, spreadsheets, raw order structs, prices with a
thousands separator or a decimal comma, numbers with an exponent and dates are not read.

## Size limits

| Limit | Value |
| --- | --- |
| file size | 16 MB |
| orders | 10,000; the rest are not read, and a note says so |
| collections | 1,000; the rest are not read, and a note says so |
| fees of an order | 20; the rest are not read, and a note says so |
| JSON nesting of objects and arrays | 1,000 levels |
| JSON values (nodes) in a file | 2,000,000 |
| a JSON string | 1,000,000 characters |
| a price or a fee amount | 40 digits on each side of the point |
| a token id | 78 digits, at most the largest number a uint256 holds |
| an amount, a balance, a start or an end | 0 to 999,999,999,999 |
| a share | 0 to 10,000 basis points |
| `--now` | 0 to 999,999,999,999 |
| `--max-expiry-days` | 1 to 36,500 |
| a text the search for keys looks at | 4,000 characters |

Input past a limit is a `file-unreadable`, `field-invalid` or `price-malformed` finding, a note, or, for the file size,
an input error with exit code `2`. The tool never passes a run because something could not be read.

## What a run does not do

It never reads or asks for a private key, a seed or an API key, contacts no chain, node, marketplace or API, fetches
nothing and connects to nothing, signs nothing, opens no link, runs no program, evaluates nothing it reads, reads no
clock and no locale, follows no symbolic link and writes nothing to disk. [threat-model.md](threat-model.md) lists the
risks of reading an order file from a pull request or an upload and their controls.
