# 2. Read JSON with a reader of its own, and never show a secret

## Status

Accepted

## Context

An order export is a JSON file. `JSON.parse` would read it, but it keeps no line and column of a value, so a finding
could not point at the order or the fee to change; it takes the last of two values written under one key without a
word, so two readers of the same file could see two prices; it builds objects whose keys come from the file; and it
turns every number into a floating point number, so that a fee of 0.1 and one of 0.2 do not add up to 0.3, a price of
one wei is lost next to a price of one ether, and a token id of 78 digits loses its last digits.

Marketplace orders are signed by wallets with keys, and a careless export can hold a secret: the key of a bot that signs
listings pasted next to its address, a seed in a note. A tool that reads such a file and echoes its values in a report
would copy the secret into a pipeline log, a pull request comment or a SARIF upload, where many more people can read it.

An export also holds values of 32 bytes that are not secrets: the merkle root of an offer for a set of tokens and the
hash of an order. Written as 64 hex digits, they have exactly the shape the search for secrets of the sibling tools
reads as a private key in hex.

An export that is not complete (an order with no price, a misspelt balance) would also be read as if it were, and a
check could take a value it never saw for one that is fine.

## Decision

1. The file is read by src/json.js, the reader of the sibling tools for strict JSON, kept unchanged, with the line and
   column of every value, a key written twice as an error, and limits of nesting, values and string length. It does not
   recurse. Every number keeps the characters it was written with.
2. Prices and fee amounts are read from the characters of the file by src/decimal.js, kept from the sibling tools, into
   a whole number and a scale, and shares in basis points are worked out exactly with BigInt. A token id is kept as its
   digits. A number with an exponent, a sign where none belongs or a separator is a finding, never rounded.
3. The tool never asks for a private key, a seed or an API key: it checks the orders as written. Before the file is
   read, src/secrets.js, kept unchanged from the sibling tools, walks every key and value of it. A key named for a key or
   a seed, and a value shaped like a mnemonic, an extended private key, a private key in hex or a key in WIF, is a
   `secret-in-file` error at its line. The value is marked, the reader leaves it out as if it were not there, and no
   report and no error message shows it, in any format. An address of 40 hex digits is never taken for a key.
4. A value of 64 hex digits, with or without 0x, under the key `root` or `orderHash` is read as the hash it is meant to
   be: src/check.js drops the finding of the search for that one value and reads it as a hash. The tool never shows the
   value of either key in any report, so a key pasted there by mistake is not echoed either. Under any other key the
   same value is still a `secret-in-file` error, and a mnemonic or a key in WIF under these keys is still one too.
5. Every field the checks need and the file does not give, every key the tool does not read and every value of the wrong
   type is returned with its line and shown as a finding. A check never takes a value it did not read for one that is
   fine.
6. The checks are a heuristic over the orders as written, and every report says so; docs/method.md says what each check
   reads and docs/limits.md what it cannot see. The result is an input to a review of marketplace orders before they are
   signed or filled: not legal or financial advice, not an audit of the marketplace or its contracts and not a guarantee
   that an order will fill as intended.

## Consequences

- The tool needs no install and no network, and the same file gives the same report on Linux, Windows and macOS.
- A finding points at the line of the field, the order or the fee it is about.
- A secret in the file fails the run and is never copied into the output. The shapes are loose, so a value that only
  looks like a secret, such as a note of twelve short lowercase words or a token id of exactly 64 digits, is reported
  too; that is the safe side.
- A private key pasted under `root` or `orderHash` cannot be told apart from a hash and is not reported; it is not shown
  either, and docs/limits.md says so. A conduit key or a zone hash of 64 hex digits under another key is reported as a
  key; the export leaves such fields out.
- YAML, CSV, spreadsheets and raw order structs are not read (docs/limits.md).
